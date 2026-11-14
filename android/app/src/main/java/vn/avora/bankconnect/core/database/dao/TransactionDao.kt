package vn.avora.bankconnect.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow
import vn.avora.bankconnect.core.database.entity.TransactionEntity

@Dao
interface TransactionDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(transaction: TransactionEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(transactions: List<TransactionEntity>)

    @Update
    suspend fun update(transaction: TransactionEntity)

    @Query("SELECT * FROM bank_transactions ORDER BY createdAt DESC")
    fun getAllFlow(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM bank_transactions WHERE syncStatus != 'SYNCED' ORDER BY createdAt ASC LIMIT 50")
    suspend fun getPendingTransactions(): List<TransactionEntity>

    @Query("SELECT COUNT(*) FROM bank_transactions WHERE syncStatus != 'SYNCED'")
    fun getPendingCountFlow(): Flow<Int>

    @Query("SELECT * FROM bank_transactions WHERE eventId = :eventId LIMIT 1")
    suspend fun getByEventId(eventId: String): TransactionEntity?

    @Query("UPDATE bank_transactions SET syncStatus = 'SYNCED', matchedStatus = :matchedStatus, matchedOrderId = :orderId, lastSyncError = null WHERE eventId = :eventId")
    suspend fun markSynced(eventId: String, matchedStatus: String?, orderId: String?)

    @Query("UPDATE bank_transactions SET syncStatus = 'FAILED', syncAttempts = syncAttempts + 1, lastSyncError = :error WHERE eventId = :eventId")
    suspend fun markFailed(eventId: String, error: String)

    @Query("SELECT COALESCE(SUM(amount), 0) FROM bank_transactions WHERE direction = 'CREDIT' AND createdAt >= :startOfDay")
    fun getIncomingTodayFlow(startOfDay: Long): Flow<Long>

    @Query("SELECT COALESCE(SUM(amount), 0) FROM bank_transactions WHERE direction = 'DEBIT' AND createdAt >= :startOfDay")
    fun getOutgoingTodayFlow(startOfDay: Long): Flow<Long>

    @Query("SELECT * FROM bank_transactions ORDER BY createdAt DESC LIMIT 1")
    fun getLatestTransactionFlow(): Flow<TransactionEntity?>

    @Query("SELECT COUNT(*) FROM bank_transactions WHERE (matchedStatus = 'MATCHED' OR matchedOrderId IS NOT NULL) AND createdAt >= :startOfDay")
    fun getMatchedTodayFlow(startOfDay: Long): Flow<Int>

    @Query("SELECT COUNT(*) FROM bank_transactions WHERE (matchedStatus = 'UNMATCHED' OR matchedStatus = 'REVIEW_REQUIRED') AND createdAt >= :startOfDay")
    fun getUnmatchedTodayFlow(startOfDay: Long): Flow<Int>

    @Query("SELECT * FROM bank_transactions ORDER BY createdAt DESC LIMIT 5")
    fun getRecentTransactionsFlow(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM bank_transactions WHERE bank = :bank AND accountNumber = :accountNumber AND amount = :amount AND direction = :direction AND createdAt >= :sinceTimestamp LIMIT 1")
    suspend fun findRecentDuplicate(bank: String, accountNumber: String, amount: Long, direction: String, sinceTimestamp: Long): TransactionEntity?

    @Query("SELECT * FROM bank_transactions WHERE rawText = :rawText LIMIT 1")
    suspend fun findByRawText(rawText: String): TransactionEntity?

    @Query("SELECT * FROM bank_transactions WHERE bank = :bank AND bankReference = :bankRef AND bankReference IS NOT NULL AND bankReference != '' LIMIT 1")
    suspend fun findByBankReference(bank: String, bankRef: String): TransactionEntity?

    @Query("SELECT * FROM bank_transactions WHERE bank = :bank AND accountNumber = :accountNumber AND amount = :amount AND direction = :direction AND (occurredAt = :occurredAt OR (transferContent IS NOT NULL AND transferContent = :content) OR (rawText IS NOT NULL AND rawText = :rawText)) LIMIT 1")
    suspend fun findDuplicateTx(bank: String, accountNumber: String, amount: Long, direction: String, occurredAt: String, content: String?, rawText: String?): TransactionEntity?

    @Query("DELETE FROM bank_transactions WHERE createdAt < :cutoffTime AND syncStatus = 'SYNCED'")
    suspend fun cleanupOldSynced(cutoffTime: Long)

    @Query("DELETE FROM bank_transactions WHERE (matchedOrderId IS NULL OR matchedOrderId = '') AND (matchedStatus IS NULL OR matchedStatus IN ('UNMATCHED', 'IGNORED', 'DUPLICATE'))")
    suspend fun deleteAllUnmatched(): Int

    @Query("DELETE FROM bank_transactions WHERE eventId IN (:eventIds) AND (matchedOrderId IS NULL OR matchedOrderId = '') AND (matchedStatus IS NULL OR matchedStatus IN ('UNMATCHED', 'IGNORED', 'DUPLICATE'))")
    suspend fun deleteByEventIds(eventIds: List<String>): Int

    @Query("DELETE FROM bank_transactions WHERE eventId = :eventId AND (matchedOrderId IS NULL OR matchedOrderId = '') AND (matchedStatus IS NULL OR matchedStatus IN ('UNMATCHED', 'IGNORED', 'DUPLICATE'))")
    suspend fun deleteSingleUnmatched(eventId: String): Int
}

