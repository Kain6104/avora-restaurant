package vn.avora.bankconnect.core.auth

import android.content.Context
import android.content.SharedPreferences

data class AuthUser(
    val id: String,
    val email: String,
    val fullName: String,
    val role: String
)

class AuthManager private constructor(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "avora_bank_auth_prefs"
        private const val KEY_TOKEN = "access_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_BIOMETRIC_ENABLED = "biometric_quick_login_enabled"
        private const val KEY_LOCK_TIMEOUT_MINS = "lock_timeout_minutes"
        private const val KEY_LAST_ACTIVE_TIME = "last_active_timestamp"
        private const val KEY_HAS_PREVIOUS_ADMIN_LOGIN = "has_previous_admin_login"
        private const val KEY_LAST_ADMIN_EMAIL = "last_admin_email"

        @Volatile
        private var instance: AuthManager? = null
        private var memoryAppLocked: Boolean = false

        fun getInstance(context: Context): AuthManager {
            return instance ?: synchronized(this) {
                instance ?: AuthManager(context.applicationContext).also { instance = it }
            }
        }
    }

    val isLoggedIn: Boolean
        get() = !getToken().isNullOrBlank()

    fun getToken(): String? {
        return prefs.getString(KEY_TOKEN, null)
    }

    fun getAuthHeader(): String? {
        val token = getToken()
        return if (!token.isNullOrBlank()) "Bearer $token" else null
    }

    fun getUser(): AuthUser? {
        val id = prefs.getString(KEY_USER_ID, null) ?: return null
        val email = prefs.getString(KEY_USER_EMAIL, "") ?: ""
        val fullName = prefs.getString(KEY_USER_NAME, "") ?: ""
        val role = prefs.getString(KEY_USER_ROLE, "") ?: ""
        return AuthUser(id, email, fullName, role)
    }

    fun saveSession(token: String, user: AuthUser) {
        val editor = prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_USER_EMAIL, user.email)
            .putString(KEY_USER_NAME, user.fullName)
            .putString(KEY_USER_ROLE, user.role)

        val role = user.role.uppercase().trim()
        if (role == "ADMIN" || role == "SUPER_ADMIN") {
            editor.putBoolean(KEY_HAS_PREVIOUS_ADMIN_LOGIN, true)
            editor.putString(KEY_LAST_ADMIN_EMAIL, user.email)
        }
        editor.apply()
    }

    fun clearSession() {
        // Chỉ xóa token và thông tin phiên hiện tại, giữ lại cờ đã từng đăng nhập Admin và email
        // để hỗ trợ xác thực vân tay sau này nếu tài khoản đó là Admin
        prefs.edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_ROLE)
            .remove(KEY_LAST_ACTIVE_TIME)
            .apply()
        memoryAppLocked = false
    }

    var hasPreviousAdminLogin: Boolean
        get() = prefs.getBoolean(KEY_HAS_PREVIOUS_ADMIN_LOGIN, false)
        set(value) {
            prefs.edit().putBoolean(KEY_HAS_PREVIOUS_ADMIN_LOGIN, value).apply()
        }

    var lastAdminEmail: String?
        get() = prefs.getString(KEY_LAST_ADMIN_EMAIL, null)
        set(value) {
            prefs.edit().putString(KEY_LAST_ADMIN_EMAIL, value).apply()
        }

    fun isAdmin(): Boolean {
        val role = prefs.getString(KEY_USER_ROLE, "") ?: ""
        return role.equals("ADMIN", ignoreCase = true) ||
                role.equals("SUPER_ADMIN", ignoreCase = true)
    }

    fun isAdminOrManager(): Boolean {
        return isAdmin()
    }

    // Biometric & App Lock
    var isBiometricEnabled: Boolean
        get() = prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, value).apply()
        }

    var lockTimeoutMinutes: Int
        get() = prefs.getInt(KEY_LOCK_TIMEOUT_MINS, 0) // 0 = lock immediately on background
        set(value) {
            prefs.edit().putInt(KEY_LOCK_TIMEOUT_MINS, value).apply()
        }

    fun isAppLocked(): Boolean {
        if (!isLoggedIn || !isBiometricEnabled) return false
        return memoryAppLocked
    }

    fun lockApp() {
        if (isLoggedIn && isBiometricEnabled) {
            memoryAppLocked = true
        }
    }

    fun unlockApp() {
        memoryAppLocked = false
        recordActivity()
    }

    fun recordActivity() {
        prefs.edit().putLong(KEY_LAST_ACTIVE_TIME, System.currentTimeMillis()).apply()
    }

    fun checkShouldLockOnResume(): Boolean {
        if (!isLoggedIn || !isBiometricEnabled) return false
        val timeoutMs = lockTimeoutMinutes * 60 * 1000L
        if (timeoutMs <= 0L) {
            memoryAppLocked = true
            return true
        }
        val lastActive = prefs.getLong(KEY_LAST_ACTIVE_TIME, 0L)
        if (System.currentTimeMillis() - lastActive > timeoutMs) {
            memoryAppLocked = true
            return true
        }
        return memoryAppLocked
    }
}

