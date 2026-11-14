package vn.avora.bankconnect

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import vn.avora.bankconnect.core.util.VnTimeUtils
import java.time.Instant
import java.util.TimeZone

class VnTimeUtilsTest {

    private lateinit var originalTimeZone: TimeZone

    @Before
    fun setUp() {
        originalTimeZone = TimeZone.getDefault()
        // Simulate a device running in US Eastern timezone to guarantee Asia/Ho_Chi_Minh independence
        TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"))
    }

    @After
    fun tearDown() {
        TimeZone.setDefault(originalTimeZone)
    }

    @Test
    fun `chuyen doi chinh xac cac moc gio VN trong ngay tu UTC ISO`() {
        assertEquals("12/11/2026 00:00:00", VnTimeUtils.formatVnDateTime("2026-11-11T17:00:00.000Z"))
        assertEquals("12/11/2026 08:00:00", VnTimeUtils.formatVnDateTime("2026-11-12T01:00:00.000Z"))
        assertEquals("12/11/2026 12:00:00", VnTimeUtils.formatVnDateTime("2026-11-12T05:00:00.000Z"))
        assertEquals("12/11/2026 18:00:00", VnTimeUtils.formatVnDateTime("2026-11-12T11:00:00.000Z"))
        assertEquals("12/11/2026 23:59:59", VnTimeUtils.formatVnDateTime("2026-11-12T16:59:59.000Z"))
    }

    @Test
    fun `chuyen doi chinh xac ngay chuyen thang va chuyen nam`() {
        // Month rollover: 31/10 17:00 UTC -> 01/11 00:00 VN
        assertEquals("01/11/2026 00:00:00", VnTimeUtils.formatVnDateTime("2026-10-31T17:00:00.000Z"))
        // Month rollover: 28/02 23:59 VN (non-leap year 2026) -> 16:59 UTC
        assertEquals("28/02/2026 23:59:00", VnTimeUtils.formatVnDateTime("2026-02-28T16:59:00.000Z"))
        assertEquals("01/03/2026 00:00:00", VnTimeUtils.formatVnDateTime("2026-02-28T17:00:00.000Z"))
        // Year rollover: 31/12/2025 17:00 UTC -> 01/01/2026 00:00 VN
        assertEquals("31/12/2025 23:59:59", VnTimeUtils.formatVnDateTime("2025-12-31T16:59:59.000Z"))
        assertEquals("01/01/2026 00:00:00", VnTimeUtils.formatVnDateTime("2025-12-31T17:00:00.000Z"))
    }

    @Test
    fun `dong nhat UTC Z va +07_00 offset cho cung mot giao dich`() {
        val fromUtc = "2026-11-12T07:14:07.000Z"
        val fromVnOffset = "2026-11-12T14:14:07+07:00"

        val instantUtc = VnTimeUtils.parseToInstantOrNull(fromUtc)
        val instantOffset = VnTimeUtils.parseToInstantOrNull(fromVnOffset)

        assertNotNull(instantUtc)
        assertEquals(instantUtc, instantOffset)
        assertEquals("12/11/2026 14:14:07", VnTimeUtils.formatVnDateTime(fromUtc))
        assertEquals("12/11/2026 14:14:07", VnTimeUtils.formatVnDateTime(fromVnOffset))
        assertEquals(14, VnTimeUtils.vnHourOfDay(fromUtc))
    }

    @Test
    fun `startOfVnDayMillis tinh theo lich ngay Viet Nam bat ke thiet bi o mui gio My`() {
        // Now = 2026-11-12T18:00:00Z = 2026-11-13T01:00:00+07:00 (01:00 AM on Nov 13 in VN, 13:00 on Nov 12 in New York)
        val now = Instant.parse("2026-11-12T18:00:00Z")
        val startOfTodayVn = VnTimeUtils.startOfVnDayMillis(0, now)
        val startOfYesterdayVn = VnTimeUtils.startOfVnDayMillis(1, now)

        assertEquals("13/11/2026 00:00:00", VnTimeUtils.formatVnDateTime(startOfTodayVn))
        assertEquals("12/11/2026 00:00:00", VnTimeUtils.formatVnDateTime(startOfYesterdayVn))
    }
}

