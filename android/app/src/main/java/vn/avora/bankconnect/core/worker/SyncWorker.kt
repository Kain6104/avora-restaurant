package vn.avora.bankconnect.core.worker

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.TransactionEventRequest
import java.util.concurrent.TimeUnit

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    companion object {
        private const val WORK_NAME = "avora_bank_sync_worker"
        private const val TAG = "AVORA_SyncWorker"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    10, TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request
            )
        }
    }

    override suspend fun doWork(): Result {
        val db = AppDatabase.getInstance(applicationContext)
        val isPaired = db.configDao().get("is_paired")?.toBooleanStrictOrNull() ?: false
        if (!isPaired) {
            Log.w(TAG, "Thiết bị chưa được pair, bỏ qua SyncWorker")
            return Result.success()
        }

        val pendingList = db.transactionDao().getPendingTransactions()
        if (pendingList.isEmpty()) {
            return Result.success()
        }

        Log.i(TAG, "Bắt đầu đồng bộ ${pendingList.size} giao dịch đang chờ trong hàng đợi Room")
        val apiService = NetworkClient.getApiService(applicationContext)
        var anyFailed = false

        for (tx in pendingList) {
            try {
                val req = TransactionEventRequest(
                    eventId = tx.eventId,
                    bank = tx.bank,
                    accountNumber = tx.accountNumber,
                    direction = tx.direction,
                    amount = tx.amount,
                    balanceAfter = null,
                    currency = tx.currency,
                    occurredAt = tx.occurredAt,
                    counterparty = tx.counterparty,
                    transferContent = tx.transferContent,
                    bankReference = tx.bankReference,
                    rawNotification = tx.rawText
                )

                val response = apiService.sendTransactionEvent(req)
                if (response.isSuccessful && response.body()?.acknowledged == true) {
                    val body = response.body()!!
                    db.transactionDao().markSynced(tx.eventId, body.status, body.orderId)
                    Log.i(TAG, "[✓] Đồng bộ thành công event ${tx.eventId} -> Status: ${body.status}")
                } else if (response.code() == 401 || response.code() == 403) {
                    Log.w(TAG, "[REVOKED] Thiết bị bị từ chối xác thực (${response.code()}) trong SyncWorker. Ngắt kết nối & hủy ghép nối.")
                    vn.avora.bankconnect.core.service.BankNotificationListenerService.handleDeviceRevokedOrUnpaired(
                        applicationContext,
                        "Thiết bị đã bị thu hồi liên kết trên /admin/bank-connect. Vui lòng ghép nối lại."
                    )
                    return Result.success()
                } else {
                    anyFailed = true
                    val err = response.errorBody()?.string() ?: "HTTP ${response.code()}"
                    db.transactionDao().markFailed(tx.eventId, err)
                    Log.e(TAG, "[!] Lỗi đồng bộ event ${tx.eventId}: $err")
                }
            } catch (e: Exception) {
                anyFailed = true
                db.transactionDao().markFailed(tx.eventId, e.message ?: "Unknown error")
                Log.e(TAG, "[!] Ngoại lệ khi đồng bộ event ${tx.eventId}: ${e.message}")
            }
        }

        return if (anyFailed) Result.retry() else Result.success()
    }
}

