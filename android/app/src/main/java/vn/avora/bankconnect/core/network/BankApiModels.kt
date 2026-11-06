package vn.avora.bankconnect.core.network

import com.google.gson.annotations.SerializedName

// 1. Auth DTOs
data class LoginRequest(
    val email: String,
    val password: String
)

data class GoogleVerifyRequest(
    val idToken: String
)

data class LoginUserDto(
    val id: String,
    val email: String,
    val fullName: String,
    val role: String
)

data class LoginResponse(
    val success: Boolean,
    val message: String?,
    @SerializedName("access_token") val accessToken: String?,
    val token: String?,
    val user: LoginUserDto?
)

// 2. Pairing
data class PairRequest(
    val pairingCode: String,
    val deviceId: String,
    val deviceName: String,
    val appVersion: String = "1.0.0",
    val publicKeyPem: String
)

data class PairResponse(
    val success: Boolean,
    val deviceId: String,
    val pairedAt: String
)

// 3. Transaction Event
data class TransactionEventRequest(
    val eventId: String,
    val bank: String = "VIETCOMBANK",
    val accountNumber: String,
    val direction: String, // CREDIT / DEBIT
    val amount: Long,      // Long VND
    val balanceAfter: Long?,
    val currency: String = "VND",
    val occurredAt: String,
    val counterparty: String?,
    val transferContent: String?,
    val bankReference: String?,
    val rawNotification: String?,
    val parserVersion: String = "1.0.0"
)

data class TransactionEventResponse(
    val success: Boolean,
    val eventId: String,
    val status: String, // MATCHED, REVIEW_REQUIRED, DUPLICATE, IGNORED
    val orderId: String?,
    val acknowledged: Boolean
)

// 4. Heartbeat
data class HeartbeatRequest(
    val deviceId: String,
    val batteryLevel: Int?,
    val isCharging: Boolean?,
    val pendingQueueCount: Int?,
    val listenerActive: Boolean?,
    val networkType: String? = null,
    val isNotificationAccessGranted: Boolean? = null,
    val isPowerSaveMode: Boolean? = null,
    val isIgnoringBatteryOptimizations: Boolean? = null,
    val appVersion: String? = null
)

data class HeartbeatResponse(
    val success: Boolean,
    val status: String,
    val serverTime: String
)

// 5. Device Status
data class DeviceStatusResponse(
    val deviceId: String,
    val deviceName: String,
    val status: String,
    val pairedAt: String,
    val serverTime: String? = null
)

// 6. Order Detail Models
data class ProductDto(
    val id: String,
    val name: String,
    val itemCode: String?,
    val imageUrl: String?
)

data class OrderItemDto(
    val id: String,
    val quantity: Int = 1,
    @SerializedName("priceAtSale") val priceAtSale: Double? = null,
    val price: Double? = null,
    val subtotal: Double? = null,
    val note: String? = null,
    val optionsTextSnapshot: String? = null,
    val discountAmount: Double? = null,
    val product: ProductDto? = null
) {
    val effectivePrice: Double
        get() = price ?: priceAtSale ?: 0.0

    val effectiveSubtotal: Double
        get() = subtotal ?: (effectivePrice * (if (quantity > 0) quantity else 1))
}

data class OrderTableDto(
    val id: String,
    val name: String,
    val zone: String?
)

data class OrderBranchDto(
    val id: String,
    val name: String
)

data class OrderPaymentDto(
    val id: String,
    val amount: Double,
    val paymentMethod: String,
    val status: String,
    val transactionRef: String?,
    val createdAt: String
)

data class OrderDetailResponse(
    val id: String,
    val orderCode: String?,
    val temporaryOrderCode: String?,
    val status: String,
    val paymentStatus: String,
    val paymentMethod: String?,
    val orderType: String? = null,
    val orderSource: String? = null,
    val deliveryAddress: String? = null,
    val deliveryDate: String? = null,
    val deliverySlotSnapshot: String? = null,
    val note: String? = null,
    val shippingProvider: String? = null,
    val subTotal: Double? = null,
    val shippingFee: Double? = null,
    val discountAmount: Double? = null,
    val discountReason: String? = null,
    val discountVoucherCodeSnapshot: String? = null,
    val taxAmount: Double? = null,
    val serviceChargeTotal: Double? = null,
    val pointsUsed: Int? = null,
    val totalAmount: Double,
    val finalAmount: Double?,
    val customerName: String?,
    val customerPhone: String?,
    val createdAt: String,
    val table: OrderTableDto?,
    val branch: OrderBranchDto?,
    val orderItems: List<OrderItemDto>?,
    val payments: List<OrderPaymentDto>?
)

data class QuickLoginRequest(
    val email: String
)

data class DeleteTxResponse(
    val success: Boolean,
    val message: String
)

data class BranchItemDto(
    val id: String,
    val name: String,
    val code: String?,
    val address: String?
)

data class BranchesResponse(
    val success: Boolean,
    val data: List<BranchItemDto>
)

data class CompletedOrderItemDto(
    val id: String,
    val orderCode: String,
    val temporaryOrderCode: String?,
    val status: String,
    val paymentStatus: String,
    val paymentMethod: String,
    val totalAmount: Double,
    val customerName: String?,
    val customerPhone: String?,
    val branchName: String,
    val branchId: String,
    val tableName: String?,
    val createdAt: String,
    val completedAt: String?,
    val isBankMatched: Boolean
)

data class CompletedOrdersPagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int
)

data class CompletedOrdersResponse(
    val success: Boolean,
    val data: List<CompletedOrderItemDto>,
    val pagination: CompletedOrdersPagination
)

data class ReMatchResponse(
    val matched: Boolean,
    val status: String,
    val orderId: String?,
    val orderCode: String?,
    val reason: String?
)

// 7. Cash Shift Auto-Audit Models
data class ShiftSummaryDto(
    val id: String,
    val branchId: String,
    val branchName: String,
    val cashierId: String,
    val cashierName: String,
    val status: String,
    val openedAt: String,
    val closedAt: String?,
    val totalRevenue: Double,
    val totalTransfer: Double,
    val orderCount: Int,
    val note: String?
)

data class RecentShiftsResponse(
    val success: Boolean,
    val data: List<ShiftSummaryDto>
)

data class ShiftAuditMetrics(
    val totalPosTransfer: Double,
    val posTransferCount: Int,
    val totalBankCredit: Double,
    val bankCreditCount: Int,
    val totalMatched: Double,
    val matchedCount: Int,
    val totalUnmatched: Double,
    val unmatchedCount: Int,
    val variance: Double,
    val reconciliationStatus: String // MATCHED, NEEDS_REVIEW, DISCREPANCY
)

data class MissingBankTxItem(
    val paymentId: String,
    val orderId: String,
    val orderCode: String,
    val tableName: String,
    val amount: Double,
    val createdAt: String,
    val note: String?,
    val reason: String
)

data class UnmatchedBankTxItem(
    val id: String,
    val bank: String,
    val amount: Double,
    val transferContent: String?,
    val bankReference: String?,
    val occurredAt: String,
    val matchingStatus: String,
    val reason: String
)

data class OverpaidDuplicateItem(
    val id: String,
    val bank: String,
    val amount: Double,
    val transferContent: String?,
    val bankReference: String?,
    val occurredAt: String,
    val orderId: String?,
    val orderCode: String?,
    val reason: String
)

data class ShiftAuditDiscrepancies(
    val missingBankTransactions: List<MissingBankTxItem> = emptyList(),
    val unmatchedBankTransactions: List<UnmatchedBankTxItem> = emptyList(),
    val overpaidDuplicates: List<OverpaidDuplicateItem> = emptyList()
)

data class MatchedTxItem(
    val id: String,
    val bank: String,
    val amount: Double,
    val direction: String,
    val transferContent: String?,
    val bankReference: String?,
    val occurredAt: String,
    val orderId: String?,
    val orderCode: String?,
    val matchingStatus: String
)

data class ShiftAuditResponse(
    val success: Boolean,
    val shift: ShiftSummaryDto,
    val metrics: ShiftAuditMetrics,
    val discrepancies: ShiftAuditDiscrepancies,
    val matchedTransactions: List<MatchedTxItem>
)

// 8. 1-Tap Quick Match Candidates
data class PendingOrderCandidateDto(
    val id: String,
    val orderCode: String,
    val temporaryOrderCode: String?,
    val tableName: String,
    val branchName: String,
    val totalAmount: Double,
    val alreadyPaid: Double,
    val remainingAmount: Double,
    val createdAt: String,
    val paymentStatus: String,
    val status: String,
    val matchScore: Int
)

data class PendingOrderCandidatesResponse(
    val success: Boolean,
    val data: List<PendingOrderCandidateDto>
)

data class ManualMatchRequest(
    val orderId: String,
    val notes: String? = null
)

data class ManualMatchResponse(
    val success: Boolean,
    val message: String? = null
)

// 9. Overpaid Duplicates & Refunds
data class OverpaidRefundDto(
    val id: String,
    val transactionId: String,
    val orderId: String,
    val orderCode: String,
    val tableName: String,
    val branchName: String,
    val orderTotalAmount: Double,
    val overpaidAmount: Double,
    val status: String, // REFUND_PENDING, REFUND_PROCESSING, REFUNDED, REFUND_FAILED
    val refundBankReference: String?,
    val refundedAmount: Double?,
    val refundedAt: String?,
    val notes: String?,
    val createdAt: String,
    val bankTransaction: BankTransactionSnapshotDto
)

data class BankTransactionSnapshotDto(
    val bank: String,
    val accountNumberMasked: String,
    val transferContent: String?,
    val bankReference: String?,
    val occurredAt: String
)

data class OverpaidDuplicatesResponse(
    val success: Boolean,
    val data: List<OverpaidRefundDto>
)

data class ConfirmRefundRequest(
    val refundBankReference: String,
    val amount: Double? = null,
    val notes: String? = null
)

// 10. Scan Report Request
data class ScanReportRequest(
    val scanJobId: String,
    val status: String,
    val activeNotificationsCount: Int = 0,
    val newTransactionsCount: Int = 0,
    val resultMessage: String? = null
)

data class SimpleApiResponse(
    val success: Boolean,
    val message: String? = null
)

// 11. Remote Bank Transactions
data class RemoteBankTransactionItem(
    val id: String,
    val eventId: String?,
    val bank: String = "VIETCOMBANK",
    val accountNumberMasked: String?,
    val direction: String, // CREDIT / DEBIT
    val amount: Double,
    val balanceAfter: Double?,
    val currency: String = "VND",
    val occurredAt: String,
    val counterparty: String?,
    val transferContent: String?,
    val bankReference: String?,
    val rawText: String?,
    val matchingStatus: String?,
    val orderId: String?,
    val createdAt: String?
)

data class RemoteTransactionsResponse(
    val items: List<RemoteBankTransactionItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val limit: Int = 50
)
