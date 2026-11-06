package vn.avora.bankconnect.core.network

import okhttp3.Interceptor
import okhttp3.Response
import okio.Buffer
import vn.avora.bankconnect.core.crypto.KeyStoreManager
import java.security.MessageDigest
import java.util.UUID

class SecurityInterceptor(
    private val deviceIdProvider: () -> String
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val path = original.url.encodedPath

        // Không ký endpoint /pair hoặc /auth/* hoặc /admin/* (sử dụng JWT hoặc public)
        if (path.endsWith("/pair") || path.contains("/auth/") || path.contains("/admin/")) {
            return chain.proceed(original)
        }

        val deviceId = deviceIdProvider()
        val timestamp = System.currentTimeMillis().toString()
        val nonce = UUID.randomUUID().toString()

        // Đọc nội dung body dạng UTF-8
        val bodyString = if (original.body != null) {
            val buffer = Buffer()
            original.body!!.writeTo(buffer)
            buffer.readUtf8()
        } else {
            ""
        }

        // Tính SHA-256 hash của body
        val md = MessageDigest.getInstance("SHA-256")
        val bodyHashBytes = md.digest(bodyString.toByteArray(Charsets.UTF_8))
        val bodyHashHex = bodyHashBytes.joinToString("") { "%02x".format(it) }

        // Tạo thông điệp chuẩn hóa: deviceId:timestamp:nonce:bodyHash
        val canonicalMessage = "$deviceId:$timestamp:$nonce:$bodyHashHex"

        // Ký bằng Private Key EC P-256
        val signatureBase64 = KeyStoreManager.signMessage(canonicalMessage)

        val newRequest = original.newBuilder()
            .header("X-Device-Id", deviceId)
            .header("X-Timestamp", timestamp)
            .header("X-Nonce", nonce)
            .header("X-Signature", signatureBase64)
            .build()

        return chain.proceed(newRequest)
    }
}

