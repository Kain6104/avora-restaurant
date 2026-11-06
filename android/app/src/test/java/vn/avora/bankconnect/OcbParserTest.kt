package vn.avora.bankconnect

import org.junit.Assert.*
import org.junit.Test
import vn.avora.bankconnect.core.parser.OcbParser
import vn.avora.bankconnect.core.parser.ParseResult
import vn.avora.bankconnect.core.parser.RawNotification

class OcbParserTest {

    @Test
    fun testParseOcbOmniRealWorldNotification() {
        // Mẫu thông báo thực tế từ người dùng
        val raw = RawNotification(
            packageName = "com.vnpay.ocb",
            title = "Thông báo biến động số dư",
            text = "05/11 15:57\nTài khoản: 0839654952\nSố tiền: +10,000 VND\nSố dư: 10,563 VND\nNội dung: HUYNH THANH PHAT chuyen tien qua MoMo",
            bigText = null,
            timestamp = 1730800681000L
        )

        assertTrue("OcbParser phải nhận diện được package com.vnpay.ocb", OcbParser.supports(raw.packageName, raw.title, raw.fullContent))

        val result = OcbParser.parse(raw)
        assertTrue("Parse result phải là Success", result is ParseResult.Success)

        val tx = (result as ParseResult.Success).transaction
        assertEquals("Ngân hàng phải là OCB", "OCB", tx.bank)
        assertEquals("Số tài khoản phải là 0839654952", "0839654952", tx.accountNumber)
        assertEquals("Số tiền phải là 10.000", 10000L, tx.amount)
        assertEquals("Chiều giao dịch phải là CREDIT", "CREDIT", tx.direction)
        assertNull("Số dư sau GD tuyệt đối phải là null vì bảo mật", tx.balanceAfter)
        assertEquals("Nội dung chuyển khoản phải bóc tách chính xác", "HUYNH THANH PHAT chuyen tien qua MoMo", tx.transferContent)
    }

    @Test
    fun testParseOcbDebitNotification() {
        val raw = RawNotification(
            packageName = "com.ocb.omni",
            title = "Thông báo biến động số dư",
            text = "05/11 16:00\nTài khoản: 0839654952\nSố tiền: -50,000 VND\nSố dư: 100,563 VND\nNội dung: Thanh toan ca phe",
            bigText = null
        )

        val result = OcbParser.parse(raw)
        assertTrue(result is ParseResult.Success)
        val tx = (result as ParseResult.Success).transaction
        assertEquals("DEBIT", tx.direction)
        assertEquals(50000L, tx.amount)
        assertNull(tx.balanceAfter)
    }
}

