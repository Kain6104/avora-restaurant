package vn.avora.bankconnect.core.parser

import java.text.Normalizer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class RawNotification(
    val packageName: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val timestamp: Long = System.currentTimeMillis()
) {
    val fullContent: String
        get() = if (!bigText.isNullOrBlank() && bigText != text) {
            "${title.orEmpty()}\n$bigText"
        } else {
            "${title.orEmpty()}\n${text.orEmpty()}"
        }.trim()
}

object NotificationNormalizer {
    /**
     * Chuẩn hóa Unicode sang NFC, xử lý ký tự xuống dòng và khoảng trắng thừa
     */
    fun normalize(text: String?): String {
        if (text.isNullOrBlank()) return ""
        val nfc = Normalizer.normalize(text, Normalizer.Form.NFC)
        return nfc.replace("\r\n", "\n")
            .replace("\r", "\n")
            .trim()
    }

    fun getCurrentVietnamTimeIso(): String {
        return vn.avora.bankconnect.core.util.VnTimeUtils.currentVnIso()
    }
}

interface BankTransactionParser {
    val bankCode: String
    val bankName: String

    /**
     * Kiểm tra xem thông báo có thuộc về ngân hàng này không
     */
    fun supports(packageName: String, title: String?, content: String?): Boolean

    /**
     * Bóc tách thông tin giao dịch từ thông báo
     */
    fun parse(notification: RawNotification): ParseResult
}

