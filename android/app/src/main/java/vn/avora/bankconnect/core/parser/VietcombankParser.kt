package vn.avora.bankconnect.core.parser

import java.text.Normalizer
import java.util.regex.Pattern

data class ParsedTransaction(
    val bank: String = "VIETCOMBANK",
    val accountNumber: String,
    val direction: String, // CREDIT / DEBIT
    val amount: Long,      // VND in Long integer
    val currency: String = "VND",
    val balanceAfter: Long?,
    val occurredAt: String, // ISO 8601 UTC+07:00
    val counterparty: String?,
    val transferContent: String?,
    val bankReference: String?,
    val rawText: String
)

sealed class ParseResult {
    data class Success(val transaction: ParsedTransaction) : ParseResult()
    data class Failed(val reason: String, val isFinancial: Boolean) : ParseResult()
}

object VietcombankParser : BankTransactionParser {

    override val bankCode: String = "VCB"
    override val bankName: String = "Vietcombank"

    override fun supports(packageName: String, title: String?, content: String?): Boolean {
        val pkg = packageName.lowercase()
        if (pkg.contains("vcb") || pkg.contains("vietcombank")) return true

        val text = "${title.orEmpty()} ${content.orEmpty()}"
        return text.contains("VCB", ignoreCase = true) || text.contains("Vietcombank", ignoreCase = true)
    }

    override fun parse(notification: RawNotification): ParseResult {
        return parse(notification.fullContent)
    }

    /**
     * Phân tích thông báo Vietcombank (từ App Notification hoặc SMS)
     */
    fun parse(rawText: String?): ParseResult {
        if (rawText.isNullOrBlank()) {
            return ParseResult.Failed("Thông báo trống", false)
        }

        // Chuẩn hóa Unicode sang NFC
        val cleaned = NotificationNormalizer.normalize(rawText)

        // 1. Nhận diện ngân hàng Vietcombank
        val isVcb = cleaned.contains("VCB", ignoreCase = true) ||
                cleaned.contains("Vietcombank", ignoreCase = true)
        if (!isVcb) {
            return ParseResult.Failed("Thông báo không phải từ Vietcombank", false)
        }

        // 2. Kiểm tra thông báo có phải biến động số dư tài khoản
        val isFinancial = cleaned.contains("Số dư", ignoreCase = true) ||
                cleaned.contains("SD", ignoreCase = true) ||
                cleaned.contains("TK", ignoreCase = true) ||
                cleaned.contains("Ref", ignoreCase = true)

        if (!isFinancial) {
            return ParseResult.Failed("Nội dung không phải biến động số dư", false)
        }

        try {
            // 3. Bóc tách số tài khoản (TK VCB 1019224767 hoặc TK 1019224767)
            val accountPattern = Pattern.compile("(?:TK(?:\\s+VCB)?|Tài khoản|Số dư TK(?:\\s+VCB)?)\\s*([0-9]{8,15})", Pattern.CASE_INSENSITIVE)
            val accountMatcher = accountPattern.matcher(cleaned)
            val accountNumber = if (accountMatcher.find()) accountMatcher.group(1)?.trim() else null

            if (accountNumber.isNullOrEmpty()) {
                return ParseResult.Failed("Không tìm thấy số tài khoản hợp lệ", true)
            }

            // 4. Bóc tách chiều giao dịch & số tiền (+110,000 VND hoặc -50.000 VND)
            val amountPattern = Pattern.compile("([+-])\\s*([\\d,.]+)\\s*(?:VND|đ|d)", Pattern.CASE_INSENSITIVE)
            val amountMatcher = amountPattern.matcher(cleaned)

            var direction: String? = null
            var amount: Long? = null

            if (amountMatcher.find()) {
                direction = if (amountMatcher.group(1) == "+") "CREDIT" else "DEBIT"
                val rawAmountStr = amountMatcher.group(2)?.replace(",", "")?.replace(".", "") ?: "0"
                amount = rawAmountStr.toLongOrNull()
            } else {
                // Dự phòng: từ khóa tăng / giảm
                val altPattern = Pattern.compile("(tang|giam|nhan|thanh toan)\\s+([\\d,.]+)\\s*(?:VND|đ|d)", Pattern.CASE_INSENSITIVE)
                val altMatcher = altPattern.matcher(cleaned)
                if (altMatcher.find()) {
                    val kw = altMatcher.group(1) ?: ""
                    direction = if (kw.contains("tang", true) || kw.contains("nhan", true)) "CREDIT" else "DEBIT"
                    val rawAmountStr = altMatcher.group(2)?.replace(",", "")?.replace(".", "") ?: "0"
                    amount = rawAmountStr.toLongOrNull()
                }
            }

            if (direction == null || amount == null || amount <= 0L) {
                return ParseResult.Failed("Không xác định được số tiền hoặc chiều giao dịch", true)
            }

            // 5. Bóc tách thời gian giao dịch (lúc 05-11-2026 12:30:05)
            val timePattern = Pattern.compile("lúc\\s+(\\d{2})[-/](\\d{2})[-/](\\d{4}|\\d{2})\\s+(\\d{2}):(\\d{2})(?::(\\d{2}))?", Pattern.CASE_INSENSITIVE)
            val timeMatcher = timePattern.matcher(cleaned)

            val occurredAtIso = if (timeMatcher.find()) {
                val day = timeMatcher.group(1)
                val month = timeMatcher.group(2)
                var year = timeMatcher.group(3) ?: "2026"
                if (year.length == 2) year = "20$year"
                val hour = timeMatcher.group(4)
                val min = timeMatcher.group(5)
                val sec = timeMatcher.group(6) ?: "00"
                "$year-$month-${day}T$hour:$min:$sec+07:00"
            } else {
                NotificationNormalizer.getCurrentVietnamTimeIso()
            }

            // 6. Số dư sau giao dịch: Tuân thủ quy định bảo mật & quyền riêng tư AVORA, không thu thập balanceAfter
            val balanceAfter: Long? = null

            // 7. Bóc tách khối Ref (Counterparty, Transfer Content, Bank Reference)
            var counterparty: String? = null
            var transferContent: String? = null
            var bankReference: String? = null

            // Hỗ trợ cả Ref [nội dung] lẫn Ref\n[nội dung]
            val refPattern = Pattern.compile("Ref(?:\\s+|\\n+)([^\\n\\r]+)", Pattern.CASE_INSENSITIVE)
            val refMatcher = refPattern.matcher(cleaned)

            if (refMatcher.find()) {
                val fullRef = refMatcher.group(1)?.trim() ?: ""
                val tokens = fullRef.split("\\s+".toRegex()).filter { it.isNotBlank() }

                if (tokens.size >= 2) {
                    val lastToken = tokens.last()
                    // Kiểm tra token cuối có dạng bank ref: chứa số và dài > 8 ký tự hoặc chứa dấu chấm / GWRL / MBVCB / FT
                    if (lastToken.any { it.isDigit() } && (lastToken.length >= 10 || lastToken.contains(".") || lastToken.contains("GWRL", true) || lastToken.contains("VCB", true))) {
                        bankReference = lastToken
                        val remainingTokens = tokens.dropLast(1)

                        // Tìm phần tên người gửi (họ tên in hoa không dấu hoặc có dấu)
                        var nameCount = 0
                        for (token in remainingTokens) {
                            if (token.all { it.isLetter() || it.isWhitespace() } && token == token.uppercase() && !token.contains("#")) {
                                nameCount++
                            } else {
                                break
                            }
                        }

                        if (nameCount in 1..5) {
                            counterparty = remainingTokens.take(nameCount).joinToString(" ")
                            transferContent = remainingTokens.drop(nameCount).joinToString(" ")
                        } else {
                            transferContent = remainingTokens.joinToString(" ")
                        }
                    } else {
                        transferContent = fullRef
                    }
                } else {
                    // Ref 1 token duy nhất (như Direct Debits VCB)
                    val singleToken = fullRef
                    if (singleToken.contains("DIRECT_DEBITS", true) || singleToken.contains("PARTNER", true)) {
                        bankReference = singleToken.substringBeforeLast("_", singleToken)
                    }
                    transferContent = fullRef
                }
            }

            val tx = ParsedTransaction(
                bank = "VIETCOMBANK",
                accountNumber = accountNumber,
                direction = direction,
                amount = amount,
                currency = "VND",
                balanceAfter = balanceAfter,
                occurredAt = occurredAtIso,
                counterparty = counterparty?.ifBlank { null },
                transferContent = transferContent?.ifBlank { null },
                bankReference = bankReference?.ifBlank { null },
                rawText = cleaned
            )

            return ParseResult.Success(tx)
        } catch (e: Exception) {
            return ParseResult.Failed("Lỗi phân tích: ${e.message}", true)
        }
    }
}
