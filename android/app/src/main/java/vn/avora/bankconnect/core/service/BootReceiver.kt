package vn.avora.bankconnect.core.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import vn.avora.bankconnect.core.worker.HeartbeatWorker
import vn.avora.bankconnect.core.worker.SyncWorker

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.i("AVORA_BootReceiver", "Thiết bị khởi động lại ($action). Kích hoạt lại Background Workers")
            SyncWorker.enqueue(context)
            HeartbeatWorker.enqueuePeriodic(context)
        }
    }
}

