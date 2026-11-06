package vn.avora.bankconnect.core.auth

import android.content.Context
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

enum class BiometricCapability {
    AVAILABLE,
    NONE_ENROLLED,
    NO_HARDWARE,
    HARDWARE_UNAVAILABLE,
    UNSUPPORTED
}

object BiometricAuthManager {

    private const val ALLOWED_AUTHENTICATORS = BIOMETRIC_STRONG or DEVICE_CREDENTIAL

    fun checkCapability(context: Context): BiometricCapability {
        val biometricManager = BiometricManager.from(context)
        return when (biometricManager.canAuthenticate(ALLOWED_AUTHENTICATORS)) {
            BiometricManager.BIOMETRIC_SUCCESS -> BiometricCapability.AVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> BiometricCapability.NONE_ENROLLED
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> BiometricCapability.NO_HARDWARE
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> BiometricCapability.HARDWARE_UNAVAILABLE
            else -> BiometricCapability.UNSUPPORTED
        }
    }

    fun isAvailable(context: Context): Boolean {
        return checkCapability(context) == BiometricCapability.AVAILABLE
    }

    fun showBiometricPrompt(
        activity: FragmentActivity,
        title: String = "Xác thực Quản trị viên AVORA",
        subtitle: String = "Sử dụng vân tay hoặc mã PIN thiết bị để mở khóa",
        description: String = "Bảo vệ truy cập an toàn vào hệ thống AVORA Bank Connect",
        onSuccess: () -> Unit,
        onError: (errorCode: Int, errString: String) -> Unit,
        onCancel: () -> Unit = {}
    ) {
        val executor = ContextCompat.getMainExecutor(activity)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                AuthManager.getInstance(activity).unlockApp()
                onSuccess()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                    errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                    errorCode == BiometricPrompt.ERROR_CANCELED
                ) {
                    onCancel()
                } else {
                    onError(errorCode, errString.toString())
                }
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // Biometric was not recognized, Android automatically prompts to retry
            }
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setDescription(description)
            .setAllowedAuthenticators(ALLOWED_AUTHENTICATORS)
            .build()

        val biometricPrompt = BiometricPrompt(activity, executor, callback)
        biometricPrompt.authenticate(promptInfo)
    }
}

