package vn.avora.bankconnect

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.worker.HeartbeatWorker
import vn.avora.bankconnect.core.worker.SyncWorker
import java.util.UUID

class AvoraBankApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // Khởi tạo Database & Giá trị mặc định
        val db = AppDatabase.getInstance(this)
        CoroutineScope(Dispatchers.IO).launch {
            if (db.configDao().get("server_url") == null) {
                db.configDao().set(ConfigEntity("server_url", "https://avorafnb.com"))
            }
            if (db.configDao().get("device_id") == null) {
                val newId = "and-${UUID.randomUUID().toString().take(18)}"
                db.configDao().set(ConfigEntity("device_id", newId))
            }
        }

        // Kích hoạt định kỳ Background Workers
        HeartbeatWorker.enqueuePeriodic(this)
        SyncWorker.enqueue(this)

        // Kích hoạt Socket kết nối 24/7 với VPS POS Gateway (Feature 2: Anti-Fake Bill Verifier)
        vn.avora.bankconnect.core.service.BankGatewaySocketManager.initialize(this)
    }
}

