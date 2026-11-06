package vn.avora.bankconnect

import org.junit.Assert.assertEquals
import org.junit.Test
import vn.avora.bankconnect.core.voice.VoiceSpeaker

class VoiceSpeakerTest {

    @Test
    fun testFormatVndToWords_commonAmounts() {
        assertEquals("ba mươi nghìn đồng", VoiceSpeaker.formatVndToWords(30000))
        assertEquals("năm mươi nghìn đồng", VoiceSpeaker.formatVndToWords(50000))
        assertEquals("ba mươi mốt nghìn năm trăm đồng", VoiceSpeaker.formatVndToWords(31500))
        assertEquals("một trăm nghìn đồng", VoiceSpeaker.formatVndToWords(100000))
        assertEquals("hai trăm năm mươi nghìn đồng", VoiceSpeaker.formatVndToWords(250000))
        assertEquals("một triệu năm trăm nghìn đồng", VoiceSpeaker.formatVndToWords(1500000))
        assertEquals("mười lăm nghìn đồng", VoiceSpeaker.formatVndToWords(15000))
    }

    @Test
    fun testFormatVndToWords_edgeCases() {
        assertEquals("không đồng", VoiceSpeaker.formatVndToWords(0))
        assertEquals("năm nghìn đồng", VoiceSpeaker.formatVndToWords(5000))
        assertEquals("mười nghìn đồng", VoiceSpeaker.formatVndToWords(10000))
    }
}

