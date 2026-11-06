package vn.avora.bankconnect.core.worker

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.network.HeartbeatRequest
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.service.BankNotificationListenerService
import java.util.concurrent.TimeUnit

class HeartbeatWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val PERIODIC_WORK_NAME = "avora_bank_heartbeat_worker"
        private const val TAG = "AVORA_HeartbeatWorker"

        fun enqueuePeriodic(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }

    override suspend fun doWork(): Result {
        val db = AppDatabase.getInstance(applicationContext)
        val isPaired = db.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
        val deviceId = db.configDao().get("device_id")

        if (!isPaired || deviceId.isNullOrBlank()) {
            return Result.success()
        }

        try {
            // Đọc trạng thái pin
            val ifilter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
            val batteryStatus: Intent? = applicationContext.registerReceiver(null, ifilter)
            val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val batteryPct = if (level >= 0 && scale > 0) ((level / scale.toFloat()) * 100).toInt() else null

            val status: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging: Boolean = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL

            val pendingList = db.transactionDao().getPendingTransactions()

            // 1. Kiểm tra loại mạng (WIFI / CELLULAR / ETHERNET / UNKNOWN)
            val cm = applicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val activeNetwork = cm?.activeNetwork
            val capabilities = cm?.getNetworkCapabilities(activeNetwork)
            val networkTypeStr = when {
                capabilities == null -> "OFFLINE"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
                else -> "UNKNOWN"
            }

            // 2. Quyền Notification Access & Trạng thái Listener
            val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(applicationContext)
            val isNotificationGranted = enabledListeners.contains(applicationContext.packageName)

            // 3. Chế độ Tiết kiệm pin & Bỏ qua tối ưu hóa pin
            val pm = applicationContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            val isPowerSave = pm?.isPowerSaveMode ?: false
            val isIgnoringOpt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pm?.isIgnoringBatteryOptimizations(applicationContext.packageName) ?: false
            } else {
                true
            }

            val appVersion = try {
                val pInfo = applicationContext.packageManager.getPackageInfo(applicationContext.packageName, 0)
                pInfo.versionName ?: "1.0.0"
            } catch (e: Exception) {
                "1.0.0"
            }

            val apiService = NetworkClient.getApiService(applicationContext)
            val req = HeartbeatRequest(
                deviceId = deviceId,
                batteryLevel = batteryPct,
                isCharging = isCharging,
                pendingQueueCount = pendingList.size,
                listenerActive = BankNotificationListenerService.isConnected,
                networkType = networkTypeStr,
                isNotificationAccessGranted = isNotificationGranted,
                isPowerSaveMode = isPowerSave,
                isIgnoringBatteryOptimizations = isIgnoringOpt,
                appVersion = appVersion
            )

            val res = apiService.sendHeartbeat(req)
            if (res.isSuccessful) {
                Log.i(TAG, "[✓] Gửi Heartbeat thành công tới VPS AVORA (${res.body()?.serverTime})")
            } else {
                Log.w(TAG, "[!] Gửi Heartbeat không thành công: ${res.code()}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "[!] Lỗi khi gửi Heartbeat: ${e.message}")
        }

        return Result.success()
    }
}

