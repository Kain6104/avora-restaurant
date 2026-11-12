package vn.avora.bankconnect.core.service

import android.content.Context
import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import vn.avora.bankconnect.core.database.AppDatabase

object BankGatewaySocketManager {
    private const val TAG = "GatewaySocket"
    private var socket: Socket? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    fun initialize(context: Context) {
        if (socket?.connected() == true) return

        scope.launch {
            try {
                val db = AppDatabase.getInstance(context)
                val isPaired = db.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
                if (!isPaired) {
                    Log.w(TAG, "Thiết bị chưa ghép nối hoặc đã bị thu hồi, không mở kết nối Socket.")
                    return@launch
                }
                val deviceId = db.configDao().get("device_id") ?: "android-gateway"
                val serverUrl = db.configDao().get("server_url") ?: "https://avorafnb.com"

                val socketEndpoint = if (serverUrl.endsWith("/")) "${serverUrl}pos" else "$serverUrl/pos"

                val opts = IO.Options().apply {
                    path = "/socket.io"
                    transports = arrayOf("websocket", "polling")
                    reconnection = true
                    reconnectionAttempts = Int.MAX_VALUE
                    reconnectionDelay = 2000
                    auth = mapOf(
                        "clientType" to "BANK_GATEWAY",
                        "deviceId" to deviceId
                    )
                }

                socket = IO.socket(socketEndpoint, opts)

                socket?.on(Socket.EVENT_CONNECT) {
                    Log.i(TAG, "[✓] Android Gateway đã kết nối WebSocket với POS Gateway!")
                    socket?.emit("join_admin", JSONObject().put("deviceId", deviceId))
                }

                socket?.on(Socket.EVENT_DISCONNECT) {
                    Log.w(TAG, "[!] Mất kết nối Socket với VPS AVORA")
                }

                // Thu hồi thiết bị thời gian thực từ Web Admin (/admin/bank-connect)
                socket?.on("bank.device.revoked") { args ->
                    try {
                        val data = args.getOrNull(0) as? JSONObject
                        val revokedId = data?.optString("deviceId").orEmpty()
                        val reason = data?.optString("reason")?.ifBlank {
                            "Thiết bị đã bị Quản trị viên thu hồi liên kết trên /admin/bank-connect"
                        } ?: "Thiết bị đã bị Quản trị viên thu hồi liên kết trên /admin/bank-connect"

                        if (revokedId.isBlank() || revokedId == deviceId) {
                            Log.w(TAG, "[REVOKED] Nhận lệnh thu hồi thiết bị thời gian thực từ Web Admin: $revokedId")
                            scope.launch {
                                BankNotificationListenerService.handleDeviceRevokedOrUnpaired(context, reason)
                                kotlinx.coroutines.withContext(Dispatchers.Main) {
                                    android.widget.Toast.makeText(
                                        context,
                                        "Thiết bị này đã bị thu hồi liên kết trên /admin/bank-connect!",
                                        android.widget.Toast.LENGTH_LONG
                                    ).show()
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Lỗi khi xử lý sự kiện bank.device.revoked: ${e.message}")
                    }
                }

                // Feature 2: Anti-Fake Bill Verifier - Khi thu ngân POS bấm "Chưa thấy tiền? Bấm kiểm tra nóng"
                socket?.on("TRIGGER_NOTIFICATION_SCAN") { args ->
                    try {
                        val data = args.getOrNull(0) as? JSONObject
                        val scanJobId = data?.optString("scanJobId") ?: "SCAN-${System.currentTimeMillis()}"
                        Log.i(TAG, "[⚡] NHẬN LỆNH QUÉT NÓNG ACTIVE NOTIFICATIONS TỪ POS! JobId: $scanJobId")

                        scope.launch {
                            val (total, newCount) = BankNotificationListenerService.triggerManualScan(context, scanJobId)
                            Log.i(TAG, "[✓] Hoàn thành quét nóng: tìm thấy $newCount GD mới / $total active notifications")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Lỗi khi xử lý TRIGGER_NOTIFICATION_SCAN: ${e.message}")
                    }
                }

                // OTA Auto-Update: Khi Admin bắn lệnh cập nhật từ xa hoặc máy chủ phát bản build mới
                socket?.on("PUSH_APP_UPDATE") { args ->
                    try {
                        val data = args.getOrNull(0) as? JSONObject
                        val downloadUrl = data?.optString("downloadUrl") ?: "https://avorafnb.com/api/bank-connect/v1/app/download-latest"
                        val versionName = data?.optString("versionName") ?: "1.0.4"
                        val remoteVersionCode = data?.optInt("versionCode", 0) ?: 0
                        val installed = vn.avora.bankconnect.core.update.OtaUpdateManager.getInstalledAppInfo(context)

                        if (remoteVersionCode > 0 && remoteVersionCode.toLong() <= installed.versionCode) {
                            Log.i(
                                TAG,
                                "[OTA] Bỏ qua PUSH_APP_UPDATE vì máy đang ở bản mới nhất v${installed.versionName} (Build ${installed.versionCode} >= Server Build $remoteVersionCode)"
                            )
                            return@on
                        }

                        Log.i(TAG, "[🚀] NHẬN LỆNH CẬP NHẬT TỰ ĐỘNG OTA! Phiên bản mới: v$versionName (Build $remoteVersionCode)")

                        scope.launch {
                            vn.avora.bankconnect.core.update.OtaUpdateManager.downloadAndInstall(
                                context = context,
                                downloadUrl = downloadUrl,
                                allowReinstallSameVersion = false,
                                onProgress = { progress ->
                                    Log.d(TAG, "[OTA] Tiến độ tải bản cập nhật: $progress%")
                                },
                                onError = { error ->
                                    Log.e(TAG, "[OTA] Lỗi tải bản cập nhật: $error")
                                }
                            )
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Lỗi khi xử lý PUSH_APP_UPDATE: ${e.message}")
                    }
                }

                socket?.connect()
            } catch (e: Exception) {
                Log.e(TAG, "Không thể khởi tạo Socket: ${e.message}")
            }
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }
}

