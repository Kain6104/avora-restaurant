package vn.avora.bankconnect.core.util

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

/**
 * Centralized timezone helper for AVORA Connect Bank.
 * Business timezone is strictly Asia/Ho_Chi_Minh; storage and wire transport use UTC / explicit ISO 8601 offsets.
 */
object VnTimeUtils {
    val VN_ZONE: ZoneId = ZoneId.of("Asia/Ho_Chi_Minh")
    private val VN_LOCALE: Locale = Locale("vi", "VN")

    private val spaceDateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
    private val vnSpaceDateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
    private val compactOffsetFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ")

    fun currentVnIso(now: Instant = Instant.now()): String {
        return ZonedDateTime.ofInstant(now, VN_ZONE)
            .truncatedTo(ChronoUnit.SECONDS)
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }

    fun formatLocalDateTimeToVnIso(localDateTime: LocalDateTime): String {
        return localDateTime.atZone(VN_ZONE)
            .truncatedTo(ChronoUnit.SECONDS)
            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
    }

    fun parseToInstantOrNull(raw: String?): Instant? {
        val text = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null

        // 1. Standard UTC instant (...Z)
        try {
            return Instant.parse(text)
        } catch (_: Exception) {
        }

        // 2. ISO 8601 with explicit offset (+07:00, -05:00, etc.)
        try {
            return OffsetDateTime.parse(text, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant()
        } catch (_: Exception) {
        }

        // 3. ISO 8601 with compact offset (+0700)
        try {
            return OffsetDateTime.parse(text, compactOffsetFormatter).toInstant()
        } catch (_: Exception) {
        }

        // 4. Offset/Zoned ISO string
        try {
            return ZonedDateTime.parse(text, DateTimeFormatter.ISO_DATE_TIME).toInstant()
        } catch (_: Exception) {
        }

        // 5. Naive ISO datetime without zone -> interpret as business timezone Asia/Ho_Chi_Minh
        try {
            return LocalDateTime.parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                .atZone(VN_ZONE)
                .toInstant()
        } catch (_: Exception) {
        }

        // 6. Common SQL / VN datetime strings without zone
        for (formatter in listOf(spaceDateTimeFormatter, vnSpaceDateTimeFormatter)) {
            try {
                return LocalDateTime.parse(text, formatter).atZone(VN_ZONE).toInstant()
            } catch (_: Exception) {
            }
        }

        return null
    }

    fun parseToEpochMillisOrNull(raw: String?): Long? {
        return parseToInstantOrNull(raw)?.toEpochMilli()
    }

    fun parseToEpochMillis(raw: String?, fallbackMillis: Long = System.currentTimeMillis()): Long {
        return parseToEpochMillisOrNull(raw) ?: fallbackMillis
    }

    fun formatVnDateTime(raw: String?, pattern: String = "dd/MM/yyyy HH:mm:ss"): String {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return "--"
        val instant = parseToInstantOrNull(trimmed) ?: return trimmed
        return formatVnDateTime(instant.toEpochMilli(), pattern)
    }

    fun formatVnDateTime(epochMillis: Long, pattern: String = "dd/MM/yyyy HH:mm:ss"): String {
        val formatter = DateTimeFormatter.ofPattern(pattern, VN_LOCALE).withZone(VN_ZONE)
        return formatter.format(Instant.ofEpochMilli(epochMillis))
    }

    fun formatVnTime(raw: String?): String = formatVnDateTime(raw, "HH:mm:ss")

    fun formatVnDate(raw: String?): String = formatVnDateTime(raw, "dd/MM/yyyy")

    fun startOfVnDayMillis(daysAgo: Long = 0L, now: Instant = Instant.now()): Long {
        val vnDate = ZonedDateTime.ofInstant(now, VN_ZONE).toLocalDate().minusDays(daysAgo)
        return vnDate.atStartOfDay(VN_ZONE).toInstant().toEpochMilli()
    }

    fun endOfVnDayMillis(daysAgo: Long = 0L, now: Instant = Instant.now()): Long {
        val nextDayStart = startOfVnDayMillis(daysAgo - 1, now)
        return nextDayStart - 1L
    }

    fun vnDateOf(epochMillis: Long): LocalDate {
        return Instant.ofEpochMilli(epochMillis).atZone(VN_ZONE).toLocalDate()
    }

    fun vnHourOfDay(epochMillis: Long): Int {
        return Instant.ofEpochMilli(epochMillis).atZone(VN_ZONE).hour
    }

    fun vnHourOfDay(raw: String?): Int? {
        val instant = parseToInstantOrNull(raw) ?: return null
        return instant.atZone(VN_ZONE).hour
    }
}

