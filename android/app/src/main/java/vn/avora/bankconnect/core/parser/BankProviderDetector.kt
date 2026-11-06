package vn.avora.bankconnect.core.parser

import android.util.Log

object BankProviderDetector {
    private const val TAG = "BankDetector"

    private val parsers = listOf(
        VietcombankParser,
        OcbParser,
        BidvParser,
        VietinBankParser,
        MbBankParser,
        TechcombankParser,
        AcbParser,
        GenericBankParser
    )

    /**
     * Tự động xác định parser phù hợp nhất cho notification và bóc tách dữ liệu
     */
    fun detectAndParse(notification: RawNotification): ParseResult {
        val title = notification.title.orEmpty()
        val content = notification.fullContent

        for (parser in parsers) {
            if (parser.supports(notification.packageName, title, content)) {
                Log.d(TAG, "Sử dụng parser [${parser.bankName}] cho package: ${notification.packageName}")
                val result = parser.parse(notification)
                if (result is ParseResult.Success) {
                    return result
                }
            }
        }

        // Fallback: Thử với GenericBankParser nếu chưa khớp
        return GenericBankParser.parse(notification)
    }

    /**
     * Lấy danh sách các ngân hàng được hỗ trợ
     */
    fun getSupportedBanks(): List<Pair<String, String>> {
        return parsers.filter { it != GenericBankParser }.map { it.bankCode to it.bankName }
    }
}

