package vn.avora.bankconnect.core.parser

import java.util.regex.Pattern

object GenericBankParser : BankTransactionParser {
    override val bankCode: String = "GENERIC"
    override val bankName: String = "Ngân hàng khác"

    override fun supports(packageName: String, title: String?, content: String?): Boolean {
        // Tuyệt đối không dùng text.contains("đ") vì từ "đã", "được" gây false positive với tiếng Việt
        val text = "${title.orEmpty()} ${content.orEmpty()}"

        val hasKeyword = text.contains("biến động số dư", ignoreCase = true) ||
                text.contains("bien dong so du", ignoreCase = true) ||
                text.contains("số dư TK", ignoreCase = true) ||
                text.contains("so du TK", ignoreCase = true) ||
                text.contains("tài khoản số", ignoreCase = true) ||
                text.contains("tai khoan so", ignoreCase = true) ||
                text.contains("giao dịch thành công", ignoreCase = true) ||
                text.contains("giao dich thanh cong", ignoreCase = true) ||
                text.contains("nhận được tiền", ignoreCase = true)

        val hasCurrency = text.contains("VND", ignoreCase = true) ||
                text.contains("VNĐ", ignoreCase = true) ||
                text.contains(" đồng", ignoreCase = true)

        return hasKeyword && hasCurrency
    }

    override fun parse(notification: RawNotification): ParseResult {
        val cleaned = NotificationNormalizer.normalize(notification.fullContent)
        if (cleaned.isBlank()) return ParseResult.Failed("Thông báo trống", false)

        // Chặn tuyệt đối tin nhắn chat / nhóm
        if (cleaned.contains("nhóm:", ignoreCase = true) ||
            cleaned.contains("thành viên", ignoreCase = true) ||
            cleaned.contains("tin nhắn", ignoreCase = true)
        ) {
            return ParseResult.Failed("Nội dung không phải giao dịch ngân hàng", false)
        }

        try {
            val accPattern = Pattern.compile("(?:TK|tai TK|tai khoan|Tài khoản|STK|tai khoan so)\\s*[:\\s]\\s*([0-9]{6,16})", Pattern.CASE_INSENSITIVE)
            val accMatcher = accPattern.matcher(cleaned)
            val accountNumber = (if (accMatcher.find()) accMatcher.group(1)?.trim() else null) ?: "UNKNOWN"

            // Chỉ bắt số tiền có tiền tố hoặc hậu tố tiền tệ rõ ràng, tránh bắt nhầm năm học như KLTN-HK1-2026/2027
            val amountPattern = Pattern.compile("(?:Số tiền|So tien)?\\s*[:\\s]?\\s*([+-])\\s*([\\d,.]+)\\s*(?:VND|VNĐ|đ\\b|đồng\\b)", Pattern.CASE_INSENSITIVE)
            var amountMatcher = amountPattern.matcher(cleaned)

            var direction = "CREDIT"
            var amountStr: String? = null

            if (amountMatcher.find()) {
                direction = if (amountMatcher.group(1) == "+") "CREDIT" else "DEBIT"
                amountStr = amountMatcher.group(2)
            } else {
                val fallbackAmountPattern = Pattern.compile("(?:Số tiền|So tien)\\s*[:\\s]\\s*([+-]?)\\s*([\\d,.]+)\\s*(?:VND|VNĐ)?", Pattern.CASE_INSENSITIVE)
                val fallbackMatcher = fallbackAmountPattern.matcher(cleaned)
                if (fallbackMatcher.find()) {
                    direction = if (fallbackMatcher.group(1) == "-") "DEBIT" else "CREDIT"
                    amountStr = fallbackMatcher.group(2)
                } else {
                    return ParseResult.Failed("Không tìm thấy số tiền hợp lệ", true)
                }
            }

            val amount = amountStr?.replace(",", "")?.replace(".", "")?.toLongOrNull() ?: 0L
            if (amount <= 0L) return ParseResult.Failed("Số tiền không hợp lệ", true)

            // Quyền riêng tư AVORA: không thu thập balanceAfter
            val balanceAfter: Long? = null

            var transferContent: String? = null
            val ndPattern = Pattern.compile("(?:^|\\n)\\s*(?:ND|Noi dung|Nội dung|Lý do|Ref)\\s*[:\\s]\\s*([^\\n\\r]+)", Pattern.CASE_INSENSITIVE)
            val ndMatcher = ndPattern.matcher(cleaned)
            if (ndMatcher.find()) {
                val candidate = ndMatcher.group(1)?.trim()
                if (!candidate.isNullOrBlank() && !candidate.startsWith("Số dư", ignoreCase = true) && !candidate.startsWith("So du", ignoreCase = true)) {
                    transferContent = candidate
                }
            }

            return ParseResult.Success(
                ParsedTransaction(
                    bank = "GENERIC",
                    accountNumber = accountNumber,
                    direction = direction,
                    amount = amount,
                    currency = "VND",
                    balanceAfter = balanceAfter,
                    occurredAt = NotificationNormalizer.getCurrentVietnamTimeIso(),
                    counterparty = null,
                    transferContent = transferContent,
                    bankReference = null,
                    rawText = cleaned
                )
            )
        } catch (e: Exception) {
            return ParseResult.Failed("Lỗi phân tích Generic: ${e.message}", true)
        }
    }
}
