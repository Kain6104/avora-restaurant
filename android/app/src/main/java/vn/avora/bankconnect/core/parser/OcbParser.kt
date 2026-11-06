package vn.avora.bankconnect.core.parser

import java.util.regex.Pattern

/**
 * Parser chuyên dụng cho Ngân hàng Thương mại Cổ phần Phương Đông (OCB / OCB OMNI)
 *
 * Mẫu thông báo thực tế:
 * Title: Thông báo biến động số dư
 * Body:
 * 05/11 15:57
 * Tài khoản: 0839654952
 * Số tiền: +10,000 VND
 * Số dư: 10,563 VND
 * Nội dung: HUYNH THANH PHAT chuyen tien qua MoMo
 */
object OcbParser : BankTransactionParser {
    override val bankCode: String = "OCB"
    override val bankName: String = "Ngân hàng Phương Đông (OCB)"

    override fun supports(packageName: String, title: String?, content: String?): Boolean {
        val pkg = packageName.lowercase()
        if (pkg.contains("ocb")) return true

        val text = "${title.orEmpty()} ${content.orEmpty()}"
        return text.contains("OCB", ignoreCase = true) ||
                text.contains("Phương Đông", ignoreCase = true) ||
                text.contains("Phuong Dong", ignoreCase = true)
    }

    override fun parse(notification: RawNotification): ParseResult {
        val cleaned = NotificationNormalizer.normalize(notification.fullContent)
        if (cleaned.isBlank()) return ParseResult.Failed("Thông báo trống", false)

        try {
            // 1. Bóc tách số tài khoản (Tài khoản: 0839654952 hoặc TK: 0839654952)
            val accPattern = Pattern.compile(
                "(?:Tài khoản|Tai khoan|TK|STK|Tài khoản số)\\s*[:\\s]\\s*([0-9]{6,16})",
                Pattern.CASE_INSENSITIVE
            )
            val accMatcher = accPattern.matcher(cleaned)
            val accountNumber = if (accMatcher.find()) accMatcher.group(1)?.trim() else null
            if (accountNumber.isNullOrEmpty()) {
                return ParseResult.Failed("Không tìm thấy số tài khoản OCB", true)
            }

            // 2. Bóc tách chiều giao dịch & số tiền (Số tiền: +10,000 VND hoặc +10,000 VND hoặc -50.000 VND)
            val amountPattern = Pattern.compile(
                "(?:Số tiền|So tien)?\\s*[:\\s]?\\s*([+-])\\s*([\\d,.]+)\\s*(?:VND|đ|d)?",
                Pattern.CASE_INSENSITIVE
            )
            val amountMatcher = amountPattern.matcher(cleaned)
            if (!amountMatcher.find()) {
                return ParseResult.Failed("Không tìm thấy số tiền OCB", true)
            }

            val sign = amountMatcher.group(1) ?: "+"
            val direction = if (sign == "+") "CREDIT" else "DEBIT"
            val rawAmountStr = amountMatcher.group(2)?.replace(",", "")?.replace(".", "") ?: "0"
            val amount = rawAmountStr.toLongOrNull() ?: 0L
            if (amount <= 0L) return ParseResult.Failed("Số tiền không hợp lệ", true)

            // 3. Quyền riêng tư AVORA: Tuyệt đối không thu thập hoặc lưu trữ balanceAfter
            val balanceAfter: Long? = null

            // 4. Bóc tách nội dung chuyển khoản (Nội dung: HUYNH THANH PHAT chuyen tien qua MoMo)
            var transferContent: String? = null
            val ndPattern = Pattern.compile(
                "(?:^|\\n)\\s*(?:Nội dung|Noi dung|\\bND\\b|Lý do|Mo ta)\\s*[:\\s]\\s*([^\\n\\r]+)",
                Pattern.CASE_INSENSITIVE
            )
            val ndMatcher = ndPattern.matcher(cleaned)
            if (ndMatcher.find()) {
                transferContent = ndMatcher.group(1)?.trim()
            }

            // 5. Bóc tách mã tham chiếu nếu có (Ref / Mã GD / FT)
            var bankReference: String? = null
            val refPattern = Pattern.compile(
                "(?:Ref|Mã GD|Ma GD|Số GD|FT)\\s*[:\\s]\\s*([A-Za-z0-9._-]+)",
                Pattern.CASE_INSENSITIVE
            )
            val refMatcher = refPattern.matcher(cleaned)
            if (refMatcher.find()) {
                bankReference = refMatcher.group(1)?.trim()
            }

            return ParseResult.Success(
                ParsedTransaction(
                    bank = "OCB",
                    accountNumber = accountNumber,
                    direction = direction,
                    amount = amount,
                    currency = "VND",
                    balanceAfter = balanceAfter,
                    occurredAt = NotificationNormalizer.getCurrentVietnamTimeIso(),
                    counterparty = null,
                    transferContent = transferContent,
                    bankReference = bankReference,
                    rawText = cleaned
                )
            )
        } catch (e: Exception) {
            return ParseResult.Failed("Lỗi phân tích OCB: ${e.message}", true)
        }
    }
}
