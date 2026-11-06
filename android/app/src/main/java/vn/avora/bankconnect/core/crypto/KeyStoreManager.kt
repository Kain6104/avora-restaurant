package vn.avora.bankconnect.core.crypto

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

object KeyStoreManager {

    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "avora_bank_gateway_ec_key"
    private const val SIGN_ALGORITHM = "SHA256withECDSA"

    // Bộ nhớ đệm fallback khi chạy môi trường Unit Test
    private var testKeyPair: KeyPair? = null

    /**
     * Tạo hoặc lấy cặp khóa EC P-256 từ Android Keystore
     */
    @Synchronized
    fun getOrCreateKeyPair(): KeyPair {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            if (keyStore.containsAlias(KEY_ALIAS)) {
                val privateKey = keyStore.getKey(KEY_ALIAS, null) as? PrivateKey
                val cert = keyStore.getCertificate(KEY_ALIAS)
                val publicKey = cert?.publicKey
                if (privateKey != null && publicKey != null) {
                    return KeyPair(publicKey, privateKey)
                }
            }

            // Tạo cặp khóa mới trong Android Keystore TEE
            val kpg = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                ANDROID_KEYSTORE
            )

            val parameterSpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN
            ).run {
                setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                setDigests(KeyProperties.DIGEST_SHA256)
                setUserAuthenticationRequired(false) // Không yêu cầu vân tay mỗi lần ký chạy nền 24/7
                build()
            }

            kpg.initialize(parameterSpec)
            return kpg.generateKeyPair()
        } catch (e: Exception) {
            // Môi trường JVM Host / Robolectric fallback
            if (testKeyPair == null) {
                val kpg = KeyPairGenerator.getInstance("EC")
                kpg.initialize(ECGenParameterSpec("secp256r1"))
                testKeyPair = kpg.generateKeyPair()
            }
            return testKeyPair!!
        }
    }

    /**
     * Xuất Public Key dưới định dạng chuẩn X.509 PEM
     */
    fun exportPublicKeyPem(): String {
        val keyPair = getOrCreateKeyPair()
        val encoded = keyPair.public.encoded
        val base64 = Base64.encodeToString(encoded, Base64.NO_WRAP)
        return "-----BEGIN PUBLIC KEY-----\n$base64\n-----END PUBLIC KEY-----"
    }

    /**
     * Ký thông điệp chuẩn hóa bằng Private Key EC P-256
     */
    fun signMessage(canonicalString: String): String {
        val keyPair = getOrCreateKeyPair()
        val signature = Signature.getInstance(SIGN_ALGORITHM)
        signature.initSign(keyPair.private)
        signature.update(canonicalString.toByteArray(Charsets.UTF_8))
        val signatureBytes = signature.sign()
        return Base64.encodeToString(signatureBytes, Base64.NO_WRAP)
    }

    /**
     * Xóa khóa khi thiết bị bị thu hồi hoặc reset
     */
    fun deleteKey() {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS)
            }
        } catch (e: Exception) {
            testKeyPair = null
        }
    }
}

