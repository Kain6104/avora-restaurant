package vn.avora.bankconnect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import vn.avora.bankconnect.core.parser.ParseResult
import vn.avora.bankconnect.core.parser.VietcombankParser

class VietcombankParserTest {

    private val TEST_FIXTURE = """
        Số dư TK VCB 1019224767 +110,000 VND lúc 03-11-2026 12:54:11.
        Số dư 599,511 VND.
        Ref LE MINH DAT chuyen tien#SP#020097042211031 254102026GWRL685139.5388.32602.125400
    """.trimIndent()

    @Test
    fun `1 Parse chinh xac 100 percent TEST FIXTURE tu Vietcombank`() {
        val result = VietcombankParser.parse(TEST_FIXTURE)

        assertTrue("Parser phai tra ve ParseResult.Success", result is ParseResult.Success)
        val data = (result as ParseResult.Success).transaction

        assertEquals("VIETCOMBANK", data.bank)
        assertEquals("1019224767", data.accountNumber)
        assertEquals("CREDIT", data.direction)
        assertEquals(110000L, data.amount)
        assertEquals("VND", data.currency)
        assertNull(data.balanceAfter)
        assertEquals("2026-11-03T12:54:11+07:00", data.occurredAt)
        assertEquals("LE MINH DAT", data.counterparty)
        assertEquals("chuyen tien#SP#020097042211031", data.transferContent)
        assertEquals("254102026GWRL685139.5388.32602.125400", data.bankReference)
    }

    @Test
    fun `2 Parse giao dich TIEN RA (DEBIT)`() {
        val debitText = """
            Số dư TK VCB 1019224767 -50,000 VND lúc 04-11-2026 09:30:00.
            Số dư 549,511 VND.
            Ref NGUYEN VAN A thanh toan don hang MBVCB.88888888
        """.trimIndent()

        val result = VietcombankParser.parse(debitText)
        assertTrue(result is ParseResult.Success)
        val data = (result as ParseResult.Success).transaction

        assertEquals("DEBIT", data.direction)
        assertEquals(50000L, data.amount)
        assertNull(data.balanceAfter)
        assertEquals("NGUYEN VAN A", data.counterparty)
        assertEquals("MBVCB.88888888", data.bankReference)
    }

    @Test
    fun `3 Xu ly dau cham phan cach hang nghin kieu Viet Nam`() {
        val dotText = """
            Số dư TK VCB 1019224767 +1.500.000 VND lúc 05-11-2026 10:15:00.
            Số dư 2.049.511 VND.
            Ref TRAN THI B chuyen khoan tien an FT2611050099
        """.trimIndent()

        val result = VietcombankParser.parse(dotText)
        assertTrue(result is ParseResult.Success)
        val data = (result as ParseResult.Success).transaction

        assertEquals(1500000L, data.amount)
        assertNull(data.balanceAfter)
    }

    @Test
    fun `4 Thong bao khong co so du van parse duoc tien va ref`() {
        val noBalanceText = """
            Số dư TK VCB 1019224767 +250,000 VND lúc 05-11-2026 14:00:00.
            Ref LE VAN C chuyen tien dat coc 254102026GWRL111111.2222
        """.trimIndent()

        val result = VietcombankParser.parse(noBalanceText)
        assertTrue(result is ParseResult.Success)
        val data = (result as ParseResult.Success).transaction

        assertEquals(250000L, data.amount)
        assertNull(data.balanceAfter)
        assertEquals("254102026GWRL111111.2222", data.bankReference)
    }

    @Test
    fun `5 Tu choi thong bao khong phai tu Vietcombank`() {
        val otherBank = "Số dư TK Techcombank 1903333333 +500,000 VND lúc 05-11-2026 10:00:00. Ref ABC"
        val result = VietcombankParser.parse(otherBank)

        assertTrue(result is ParseResult.Failed)
        assertEquals("Thông báo không phải từ Vietcombank", (result as ParseResult.Failed).reason)
    }

    @Test
    fun `6 Tu choi thong bao quang cao khong phai bien dong so du`() {
        val ads = "VCB Digibank: Chuong trinh uu dai hoan tien 10% khi su dung the tin dung VCB quoc te."
        val result = VietcombankParser.parse(ads)

        assertTrue(result is ParseResult.Failed)
    }
}

