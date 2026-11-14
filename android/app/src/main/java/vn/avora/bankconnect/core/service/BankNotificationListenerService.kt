package vn.avora.bankconnect.core.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.database.entity.TransactionEntity
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.TransactionEventRequest
import vn.avora.bankconnect.core.parser.ParseResult
import vn.avora.bankconnect.core.parser.VietcombankParser
import vn.avora.bankconnect.core.worker.SyncWorker
import java.util.UUID

class BankNotificationListenerService : NotificationListenerService() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var database: AppDatabase

    companion object {
        private const val TAG = "AVORA_BankListener"
        @Volatile
        var isConnected: Boolean = false
            private set

        @Volatile
        var currentInstance: BankNotificationListenerService? = null
            private set

        // Blacklist tuyệt đối các app OTT, chat, mạng xã hội (BUG 3: Không bắt thông báo từ Zalo, Telegram, Facebook...)
        val BLACKLISTED_PACKAGES = setOf(
            "com.zing.zalo",
            "com.facebook.katana",
            "com.facebook.orca",
            "com.facebook.lite",
            "com.instagram.android",
            "org.telegram.messenger",
            "org.telegram.plus",
            "com.google.android.talk",
            "com.google.android.apps.messaging",
            "com.viber.voip",
            "com.skype.raider",
            "com.whatsapp",
            "com.whatsapp.w4b",
            "com.tiktok.android",
            "com.zhiliaoapp.musically",
            "com.shopee.vn",
            "com.lazada.android",
            "vn.tiki.app",
            "android",
            "com.android.systemui",
            "com.google.android.gms",
            "com.google.android.youtube"
        )

        // Whitelist các ứng dụng Ngân hàng & Fintech chính thống tại Việt Nam
        val SUPPORTED_BANKING_PACKAGES = setOf(
            "com.vcb", "com.VCB", // Vietcombank
            "com.techcombank.mobile", "com.techcombank.bb", "fe.com.techcombank.mobile", // Techcombank
            "com.mbmobile", "com.mb.mbbank", // MBBank
            "com.vietinbank.ipay", // VietinBank
            "com.vnpay.bidv", // BIDV
            "mobile.acb.com.vn", "com.acb.mobile", // ACB
            "com.tpb.mb.gprsandroid", // TPBank
            "com.vnpay.vpbankonline", "com.vpbank.neo", // VPBank
            "com.ocb.omni", "com.ocb.omni.retail", // OCB
            "com.sacombank.ewallet", "com.sacombank.mplus", // Sacombank
            "com.vnpay.agribank", // Agribank
            "com.vnpay.hdbank", // HDBank
            "vn.msb.mplus", // MSB
            "com.vnpay.shb", // SHB
            "vn.seabank.mb", // SeABank
            "com.vib.mop", // VIB
            "xyz.be.cake", // Cake by VPBank
            "vn.timo", // Timo
            "com.mservice.momopay", // MoMo Merchant
            "com.viettel.viettelpay", // Viettel Money
            "vn.com.vng.zalopay" // ZaloPay (KHÔNG phải com.zing.zalo)
        )

        // In-memory deduplication cache: Key/Fingerprint -> Timestamp
        private val recentNotificationKeys = java.util.concurrent.ConcurrentHashMap<String, Long>()
        private const val DEDUPE_WINDOW_MS = 6000L // 6 giây chống double notification

        /**
         * Thu hồi liên kết hoặc hủy ghép nối thiết bị ngay lập tức tại local,
         * ngắt kết nối Socket và chặn hoàn toàn việc đọc/phát giọng nói thông báo.
         */
        suspend fun handleDeviceRevokedOrUnpaired(
            context: android.content.Context,
            reason: String = "Thiết bị đã bị Quản trị viên thu hồi liên kết trên /admin/bank-connect"
        ) {
            try {
                val db = AppDatabase.getInstance(context)
                db.configDao().set(ConfigEntity("is_paired", "false"))
                db.configDao().set(ConfigEntity("revoked_reason", reason))
                vn.avora.bankconnect.core.crypto.KeyStoreManager.deleteKey()
                BankGatewaySocketManager.disconnect()
                Log.w(TAG, "[REVOKED] Đã hủy trạng thái ghép nối thiết bị: $reason")
            } catch (e: Exception) {
                Log.e(TAG, "Lỗi khi xử lý thu hồi thiết bị: ${e.message}")
            }
        }

        /**
         * Kích hoạt quét khẩn cấp active notifications từ bên ngoài (POS trigger scan)
         */
        suspend fun triggerManualScan(context: android.content.Context, scanJobId: String): Pair<Int, Int> {
            val db = AppDatabase.getInstance(context)
            val isPaired = db.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
            if (!isPaired) {
                return Pair(0, 0)
            }
            val service = currentInstance
            if (service == null || !isConnected) {
                val api = NetworkClient.getApiService(context)
                try {
                    api.reportScanResult(
                        vn.avora.bankconnect.core.network.ScanReportRequest(
                            scanJobId = scanJobId,
                            status = "DEVICE_OFFLINE",
                            activeNotificationsCount = 0,
                            newTransactionsCount = 0,
                            resultMessage = "NotificationListenerService chưa được kết nối hoặc bị tắt quyền truy cập."
                        )
                    )
                } catch (_: Exception) {}
                return Pair(0, 0)
            }

            return service.performActiveScanAndReport(scanJobId)
        }
    }

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getInstance(this)
        currentInstance = this
        Log.i(TAG, "BankNotificationListenerService khởi tạo")
    }

    override fun onDestroy() {
        currentInstance = null
        super.onDestroy()
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        isConnected = true
        currentInstance = this
        Log.i(TAG, "Notification Listener đã kết nối thành công với Android OS")
        serviceScope.launch {
            database.configDao().set(ConfigEntity("listener_connected", "true"))
            database.configDao().set(ConfigEntity("listener_last_connected_at", System.currentTimeMillis().toString()))

            val isPaired = database.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
            if (isPaired) {
                // Feature 6: Tự động quét bù active notifications ngay khi service vừa kết nối lại
                catchUpActiveNotifications()

                // Kết nối lại WebSocket tới POS Gateway
                BankGatewaySocketManager.initialize(applicationContext)
            } else {
                Log.w(TAG, "Thiết bị chưa ghép nối hoặc đã bị thu hồi: tạm ngưng đọc thông báo và không kết nối Socket.")
            }
        }
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        isConnected = false
        Log.w(TAG, "Notification Listener bị ngắt kết nối")
        serviceScope.launch {
            database.configDao().set(ConfigEntity("listener_connected", "false"))
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return
        serviceScope.launch {
            processStatusBarNotification(sbn)
        }
    }

    /**
     * Feature 6: Quét bù toàn bộ active notifications còn trên thanh trạng thái
     */
    private suspend fun catchUpActiveNotifications(): Int {
        val isPaired = database.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
        if (!isPaired) return 0

        val active = try { activeNotifications } catch (e: Exception) { null } ?: return 0
        var newCount = 0
        for (sbn in active) {
            if (processStatusBarNotification(sbn)) {
                newCount++
            }
        }
        if (newCount > 0) {
            Log.i(TAG, "[Catch-Up] Đã quét bù thành công $newCount giao dịch mới từ active notifications (${active.size} thông báo)")
        }
        return newCount
    }

    /**
     * Feature 2: Thực hiện quét khẩn cấp active notifications và báo cáo kết quả lên VPS
     */
    suspend fun performActiveScanAndReport(scanJobId: String): Pair<Int, Int> {
        val isPaired = database.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
        if (!isPaired) return Pair(0, 0)

        val active = try { activeNotifications } catch (e: Exception) { null } ?: emptyArray()
        var newCount = 0
        for (sbn in active) {
            if (processStatusBarNotification(sbn)) {
                newCount++
            }
        }

        val status = if (newCount > 0) "TRANSACTION_FOUND" else "NO_MATCHING_NOTIFICATION"
        val message = if (newCount > 0) {
            "Đã phát hiện $newCount giao dịch ngân hàng mới và đồng bộ thành công lên VPS."
        } else {
            "Gateway đã quét ${active.size} thông báo trên thanh trạng thái nhưng chưa tìm thấy biến động số dư phù hợp."
        }

        try {
            val api = NetworkClient.getApiService(applicationContext)
            api.reportScanResult(
                vn.avora.bankconnect.core.network.ScanReportRequest(
                    scanJobId = scanJobId,
                    status = status,
                    activeNotificationsCount = active.size,
                    newTransactionsCount = newCount,
                    resultMessage = message
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi gửi báo cáo scan kết quả: ${e.message}")
        }

        return Pair(active.size, newCount)
    }

    /**
     * Xử lý và phân tích một StatusBarNotification với đầy đủ 3 tầng deduplication
     */
    private suspend fun processStatusBarNotification(sbn: StatusBarNotification): Boolean {
        // BẮT BUỘC: Nếu thiết bị chưa ghép nối hoặc đã bị thu hồi trên /admin/bank-connect,
        // chặn tuyệt đối việc đọc/phân tích thông báo, phát âm thanh giọng nói và lưu DB.
        val isPaired = database.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
        if (!isPaired) {
            return false
        }

        val packageName = sbn.packageName ?: return false
        val extras = sbn.notification?.extras ?: return false

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""

        val now = System.currentTimeMillis()

        // 1. Dọn dẹp cache deduplication cũ (> 1 giờ)
        val iterator = recentNotificationKeys.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (now - entry.value > 3600000L) {
                iterator.remove()
            }
        }

        // 2. Chống lặp tầng 1: Notification Signature Deduplication (sbn id, time, text hash)
        val contentDigest = "${title.trim()}_${text.trim()}_${bigText.trim()}"
        val notifKey = "${packageName}_${sbn.id}_${sbn.postTime}_${contentDigest.hashCode()}"
        val lastSeen = recentNotificationKeys[notifKey]
        if (lastSeen != null && (now - lastSeen) < DEDUPE_WINDOW_MS) {
            Log.w(TAG, "[Deduplicate] Bỏ qua thông báo trùng lặp từ OS (${now - lastSeen}ms): $packageName")
            return false
        }
        recentNotificationKeys[notifKey] = now

        // 2b. BUG 3: Kiểm tra Blacklist tuyệt đối (BỎ QUA Zalo, Telegram, Facebook...)
        val lowerPkg = packageName.lowercase()
        if (BLACKLISTED_PACKAGES.contains(lowerPkg) ||
            (lowerPkg.contains("zalo") && lowerPkg != "vn.com.vng.zalopay") ||
            lowerPkg.contains("facebook") ||
            lowerPkg.contains("messenger") ||
            lowerPkg.contains("telegram") ||
            lowerPkg.contains("whatsapp")
        ) {
            return false
        }

        // Kiểm tra cấu hình package nguồn
        val selectedPackage = database.configDao().get("target_package_name") ?: "ALL"
        val listenerEnabled = database.configDao().get("listener_enabled")?.toBooleanStrictOrNull() ?: true

        if (!listenerEnabled) return false

        // Nếu người dùng chỉ định package cụ thể (khác ALL), kiểm tra đúng app đã cấu hình
        if (selectedPackage != "ALL") {
            if (!packageName.equals(selectedPackage, ignoreCase = true)) {
                return false
            }
        } else {
            // Chế độ ALL: Chỉ chấp nhận các app thuộc Whitelist ngân hàng chính thống
            val isKnownBank = SUPPORTED_BANKING_PACKAGES.any { it.equals(lowerPkg, ignoreCase = true) }
            if (!isKnownBank) {
                return false
            }
        }

        val rawNotification = vn.avora.bankconnect.core.parser.RawNotification(
            packageName = packageName,
            title = title,
            text = text,
            bigText = bigText,
            timestamp = sbn.postTime
        )

        if (rawNotification.fullContent.isBlank()) return false

        // Chống lặp tầng 1.5: Kiểm tra thông báo cũ còn treo trên thanh trạng thái đã lưu DB trước đó chưa
        val existingByRaw = database.transactionDao().findByRawText(rawNotification.fullContent)
        if (existingByRaw != null) {
            Log.i(TAG, "[Deduplicate] Bỏ qua thông báo cũ vẫn còn trên thanh trạng thái (đã lưu eventId: ${existingByRaw.eventId})")
            return false
        }

        // Phân tích nội dung qua BankProviderDetector đa ngân hàng (VCB, OCB, BIDV, CTG, MB, TCB, ACB, Generic)
        val parseResult = vn.avora.bankconnect.core.parser.BankProviderDetector.detectAndParse(rawNotification)
        if (parseResult !is ParseResult.Success) {
            return false
        }

        val tx = parseResult.transaction

        // 3. Chống lặp tầng 2: Transaction Fingerprint Deduplication
        val txFingerprint = "${tx.bank}_${tx.accountNumber}_${tx.direction}_${tx.amount}_${tx.transferContent?.trim()}"
        val lastTxTime = recentNotificationKeys[txFingerprint]
        if (lastTxTime != null && (now - lastTxTime) < DEDUPE_WINDOW_MS) {
            Log.w(TAG, "[Deduplicate] Bỏ qua giao dịch trùng lặp trong ${DEDUPE_WINDOW_MS}ms: $txFingerprint")
            return false
        }
        recentNotificationKeys[txFingerprint] = now

        // 4. Chống lặp tầng 3: Kiểm tra Room Database toàn diện (Mã Ref, Nội dung, Thời điểm, hoặc 24h gần nhất)
        if (!tx.bankReference.isNullOrBlank()) {
            val existingByRef = database.transactionDao().findByBankReference(tx.bank, tx.bankReference!!)
            if (existingByRef != null) {
                Log.w(TAG, "[Deduplicate] Giao dịch có mã Ref ngân hàng đã tồn tại trong Room DB (Ref: ${tx.bankReference}, eventId: ${existingByRef.eventId}), bỏ qua chèn đúp!")
                return false
            }
        }

        val existingTx = database.transactionDao().findDuplicateTx(
            bank = tx.bank,
            accountNumber = tx.accountNumber,
            amount = tx.amount,
            direction = tx.direction,
            occurredAt = tx.occurredAt,
            content = tx.transferContent,
            rawText = tx.rawText
        )
        if (existingTx != null) {
            Log.w(TAG, "[Deduplicate] Giao dịch khớp hoàn toàn với bản ghi trong Room DB (eventId: ${existingTx.eventId}), bỏ qua chèn đúp!")
            return false
        }

        val oneDayAgo = now - 86400000L
        val recentInDb = database.transactionDao().findRecentDuplicate(
            bank = tx.bank,
            accountNumber = tx.accountNumber,
            amount = tx.amount,
            direction = tx.direction,
            sinceTimestamp = oneDayAgo
        )
        if (recentInDb != null && (recentInDb.occurredAt == tx.occurredAt || recentInDb.transferContent == tx.transferContent)) {
            Log.w(TAG, "[Deduplicate] Giao dịch tương tự đã tồn tại trong Room DB 24h qua (eventId: ${recentInDb.eventId}), bỏ qua chèn đúp!")
            return false
        }

        // 5. Kiểm tra tùy chọn theo dõi ngân hàng & chiều giao dịch từ Cài đặt
        val bankMode = database.configDao().get("bank_monitoring_mode") ?: "ALL"
        if (bankMode == "CUSTOM") {
            val enabledBanks = database.configDao().get("enabled_banks")?.split(",")?.map { it.trim().uppercase() } ?: emptyList()
            if (!enabledBanks.contains(tx.bank.uppercase())) {
                return false
            }
        }

        val dirFilter = database.configDao().get("transaction_direction_filter") ?: "ALL"
        if (dirFilter == "CREDIT_ONLY" && !tx.direction.equals("CREDIT", ignoreCase = true)) {
            return false
        }

        Log.i(TAG, "[✓] Nhận diện GD ${tx.bank}: ${tx.direction} ${tx.amount}đ, Acc: ${tx.accountNumber}, Ref: ${tx.bankReference ?: tx.transferContent}")

        // Phát âm thanh đọc thông báo nhận tiền ngay lập tức khi chạy ngầm
        if (tx.direction.equals("CREDIT", ignoreCase = true)) {
            val voiceEnabled = database.configDao().get("voice_announcement_enabled")?.toBooleanStrictOrNull() ?: true
            if (voiceEnabled) {
                val voiceMode = database.configDao().get("voice_banks_mode") ?: "ALL"
                val allowedBanksStr = database.configDao().get("voice_enabled_banks") ?: "VCB,OCB,CTG,BIDV,MB,TCB,ACB"
                val allowedBanks = allowedBanksStr.split(",").map { it.trim().uppercase() }.filter { it.isNotEmpty() }

                val bankKey = when (tx.bank.uppercase().trim()) {
                    "VIETCOMBANK" -> "VCB"
                    "VIETINBANK" -> "CTG"
                    "MBBANK" -> "MB"
                    "TECHCOMBANK" -> "TCB"
                    "AGRIBANK" -> "VBA"
                    "VPBANK" -> "VPB"
                    "TPBANK" -> "TPB"
                    "SACOMBANK" -> "STB"
                    "HDBANK" -> "HDB"
                    else -> tx.bank.uppercase().trim()
                }

                val shouldSpeak = if (voiceMode == "CUSTOM") {
                    allowedBanks.contains(bankKey) || allowedBanks.contains(tx.bank.uppercase().trim())
                } else {
                    true
                }

                if (shouldSpeak) {
                    vn.avora.bankconnect.core.voice.VoiceSpeaker.getInstance(applicationContext)
                        .speakTransactionReceived(tx.bank, tx.amount)
                }
            }
        }

        val eventId = UUID.randomUUID().toString()

        // Lưu ngay vào Room Database với trạng thái PENDING
        val entity = TransactionEntity(
            eventId = eventId,
            bank = tx.bank,
            accountNumber = tx.accountNumber,
            direction = tx.direction,
            amount = tx.amount,
            balanceAfter = tx.balanceAfter,
            currency = tx.currency,
            occurredAt = tx.occurredAt,
            counterparty = tx.counterparty,
            transferContent = tx.transferContent,
            bankReference = tx.bankReference,
            rawText = tx.rawText,
            syncStatus = "PENDING"
        )
        database.transactionDao().insert(entity)

        // Gửi ngay lập tức lên VPS qua HTTPS (Không chờ đợi / Không polling)
        sendTransactionToVpsImmediately(entity)

        // Đóng thông báo trên thanh trạng thái sau khi đã ghi nhận thành công để tránh tích tụ
        try {
            cancelNotification(sbn.key)
        } catch (e: Exception) {
            Log.d(TAG, "Không thể tự đóng thông báo: ${e.message}")
        }

        return true
    }

    /**
     * Gửi sự kiện giao dịch trực tiếp lên VPS
     */
    private suspend fun sendTransactionToVpsImmediately(entity: TransactionEntity) {
        val isPaired = database.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
        if (!isPaired) {
            Log.w(TAG, "Thiết bị chưa ghép nối với VPS AVORA. Lưu vào hàng đợi chờ pairing.")
            return
        }

        try {
            val apiService = NetworkClient.getApiService(applicationContext)
            val req = TransactionEventRequest(
                eventId = entity.eventId,
                bank = entity.bank,
                accountNumber = entity.accountNumber,
                direction = entity.direction,
                amount = entity.amount,
                balanceAfter = null,
                currency = entity.currency,
                occurredAt = entity.occurredAt,
                counterparty = entity.counterparty,
                transferContent = entity.transferContent,
                bankReference = entity.bankReference,
                rawNotification = entity.rawText
            )

            val response = apiService.sendTransactionEvent(req)
            if (response.isSuccessful && response.body()?.acknowledged == true) {
                val body = response.body()!!
                Log.i(TAG, "[✓] VPS đã xác nhận ACK cho event ${entity.eventId}. Trạng thái: ${body.status}")
                database.transactionDao().markSynced(entity.eventId, body.status, body.orderId)
            } else if (response.code() == 401 || response.code() == 403) {
                val errorMsg = response.errorBody()?.string() ?: "Thiết bị đã bị thu hồi hoặc chưa đăng ký (HTTP ${response.code()})"
                Log.w(TAG, "[REVOKED] Máy chủ từ chối xác thực thiết bị (${response.code()}): $errorMsg")
                database.transactionDao().markFailed(entity.eventId, "Thiết bị đã bị thu hồi liên kết")
                handleDeviceRevokedOrUnpaired(
                    applicationContext,
                    "Thiết bị đã bị thu hồi liên kết trên /admin/bank-connect. Vui lòng ghép nối lại."
                )
            } else {
                val errorMsg = response.errorBody()?.string() ?: "HTTP ${response.code()}"
                Log.e(TAG, "[!] VPS trả về lỗi: $errorMsg. Lên lịch retry qua WorkManager")
                database.transactionDao().markFailed(entity.eventId, errorMsg)
                SyncWorker.enqueue(applicationContext)
            }
        } catch (e: Exception) {
            Log.e(TAG, "[!] Lỗi mạng khi gửi trực tiếp lên VPS: ${e.message}. Lên lịch retry qua WorkManager")
            database.transactionDao().markFailed(entity.eventId, e.message ?: "Network error")
            SyncWorker.enqueue(applicationContext)
        }
    }
}

