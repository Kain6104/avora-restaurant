package vn.avora.bankconnect.core.parser

import java.util.regex.Pattern

object MbBankParser : BankTransactionParser {
    override val bankCode: String = "MB"
    override val bankName: String = "MBBank"

    override fun supports(packageName: String, title: String?, content: String?): Boolean {
        val pkg = packageName.lowercase()
        if (pkg.contains("mbmobile") || pkg.contains("mbbank")) return true

        val text = "${title.orEmpty()} ${content.orEmpty()}"
        return text.contains("MBBank", ignoreCase = true) || text.contains("MB Bank", ignoreCase = true)
    }

    override fun parse(notification: RawNotification): ParseResult {
        val cleaned = NotificationNormalizer.normalize(notification.fullContent)
        if (cleaned.isBlank()) return ParseResult.Failed("Thông báo trống", false)

        try {
            val accPattern = Pattern.compile("(?:TK|tai TK|tai khoan)\\s*([0-9]{8,16})", Pattern.CASE_INSENSITIVE)
            val accMatcher = accPattern.matcher(cleaned)
            val accountNumber = if (accMatcher.find()) accMatcher.group(1)?.trim() else null
            if (accountNumber.isNullOrEmpty()) {
                return ParseResult.Failed("Không tìm thấy số tài khoản MBBank", true)
            }

            val amountPattern = Pattern.compile("([+-])\\s*([\\d,.]+)\\s*(?:VND|đ|d)", Pattern.CASE_INSENSITIVE)
            val amountMatcher = amountPattern.matcher(cleaned)
            if (!amountMatcher.find()) {
                return ParseResult.Failed("Không tìm thấy số tiền MBBank", true)
            }

            val direction = if (amountMatcher.group(1) == "+") "CREDIT" else "DEBIT"
            val amount = amountMatcher.group(2)?.replace(",", "")?.replace(".", "")?.toLongOrNull() ?: 0L
            if (amount <= 0L) return ParseResult.Failed("Số tiền không hợp lệ", true)

            // Quyền riêng tư AVORA: không thu thập balanceAfter
            val balanceAfter: Long? = null

            var transferContent: String? = null
            val ndPattern = Pattern.compile("(?:ND|Noi dung|Nội dung|Lý do)\\s*:\\s*([^\\n\\r]+)", Pattern.CASE_INSENSITIVE)
            val ndMatcher = ndPattern.matcher(cleaned)
            if (ndMatcher.find()) {
                transferContent = ndMatcher.group(1)?.trim()
            }

            return ParseResult.Success(
                ParsedTransaction(
                    bank = "MBBANK",
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
            return ParseResult.Failed("Lỗi phân tích MBBank: ${e.message}", true)
        }
    }
}

