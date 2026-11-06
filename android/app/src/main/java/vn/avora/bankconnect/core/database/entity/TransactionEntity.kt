package vn.avora.bankconnect.core.database.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "bank_transactions",
    indices = [
        Index(value = ["eventId"], unique = true),
        Index(value = ["syncStatus"]),
        Index(value = ["createdAt"])
    ]
)
data class TransactionEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val eventId: String,
    val bank: String = "VIETCOMBANK",
    val accountNumber: String,
    val direction: String, // CREDIT / DEBIT
    val amount: Long,      // VND Long
    val balanceAfter: Long?,
    val currency: String = "VND",
    val occurredAt: String,
    val counterparty: String?,
    val transferContent: String?,
    val bankReference: String?,
    val rawText: String?,
    var syncStatus: String = "PENDING", // PENDING, SYNCED, FAILED
    var syncAttempts: Int = 0,
    var lastSyncError: String? = null,
    var matchedStatus: String? = null,
    var matchedOrderId: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

