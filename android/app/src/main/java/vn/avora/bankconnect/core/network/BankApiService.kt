package vn.avora.bankconnect.core.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface BankApiService {

    // Auth
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<LoginResponse>

    @POST("api/auth/google/android-verify")
    suspend fun verifyGoogleToken(@Body request: GoogleVerifyRequest): Response<LoginResponse>

    @POST("api/auth/android/admin-quick-login")
    suspend fun quickAdminLogin(@Body request: QuickLoginRequest): Response<LoginResponse>

    // Gateway Pairing
    @POST("api/bank-connect/v1/pair")
    suspend fun pairDevice(@Body request: PairRequest): Response<PairResponse>

    // Gateway Events & Heartbeat
    @POST("api/bank-connect/v1/events")
    suspend fun sendTransactionEvent(@Body request: TransactionEventRequest): Response<TransactionEventResponse>

    @POST("api/bank-connect/v1/heartbeat")
    suspend fun sendHeartbeat(@Body request: HeartbeatRequest): Response<HeartbeatResponse>

    @GET("api/bank-connect/v1/device/status")
    suspend fun getDeviceStatus(): Response<DeviceStatusResponse>

    // Order & Reconciliation Details (Requires Admin Bearer token)
    @GET("api/bank-connect/v1/admin/orders/{id}")
    suspend fun getOrderDetail(
        @Header("Authorization") authHeader: String,
        @Path("id") id: String
    ): Response<OrderDetailResponse>

    @POST("api/bank-connect/v1/admin/transactions/{id}/re-match")
    suspend fun reMatchTransaction(
        @Header("Authorization") authHeader: String,
        @Path("id") id: String
    ): Response<ReMatchResponse>

    @GET("api/bank-connect/v1/admin/transactions")
    suspend fun getTransactions(
        @Header("Authorization") authHeader: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 100,
        @Query("matchingStatus") matchingStatus: String? = null,
        @Query("direction") direction: String? = null
    ): Response<RemoteTransactionsResponse>

    @DELETE("api/bank-connect/v1/admin/transactions/{id}")
    suspend fun deleteUnmatchedTransaction(
        @Header("Authorization") authHeader: String,
        @Path("id") id: String
    ): Response<DeleteTxResponse>

    @DELETE("api/bank-connect/v1/admin/transactions-unmatched/all")
    suspend fun deleteAllUnmatchedTransactions(
        @Header("Authorization") authHeader: String
    ): Response<SimpleApiResponse>

    @GET("api/bank-connect/v1/admin/branches")
    suspend fun getBranches(
        @Header("Authorization") authHeader: String
    ): Response<BranchesResponse>

    @GET("api/bank-connect/v1/admin/completed-orders")
    suspend fun getCompletedOrders(
        @Header("Authorization") authHeader: String,
        @Query("branchId") branchId: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("search") search: String? = null
    ): Response<CompletedOrdersResponse>

    // Feature 1: Cash Shift Auto-Audit
    @GET("api/bank-connect/v1/admin/shifts/recent")
    suspend fun getRecentShifts(
        @Header("Authorization") authHeader: String,
        @Query("branchId") branchId: String? = null
    ): Response<RecentShiftsResponse>

    @GET("api/bank-connect/v1/admin/shifts/{shiftId}/audit")
    suspend fun auditShift(
        @Header("Authorization") authHeader: String,
        @Path("shiftId") shiftId: String
    ): Response<ShiftAuditResponse>

    // Feature 2: Anti-Fake Bill Verifier
    @POST("api/bank-connect/v1/scan-report")
    suspend fun reportScanResult(
        @Body body: ScanReportRequest
    ): Response<SimpleApiResponse>

    // Feature 3: Overpaid Duplicates & Refunds
    @GET("api/bank-connect/v1/admin/overpaid-duplicates")
    suspend fun getOverpaidDuplicates(
        @Header("Authorization") authHeader: String
    ): Response<OverpaidDuplicatesResponse>

    @POST("api/bank-connect/v1/admin/overpaid-duplicates/{id}/confirm-refund")
    suspend fun confirmRefund(
        @Header("Authorization") authHeader: String,
        @Path("id") id: String,
        @Body body: ConfirmRefundRequest
    ): Response<SimpleApiResponse>

    // Feature 4: 1-Tap Quick Match Candidates & Manual Match
    @GET("api/bank-connect/v1/admin/pending-order-candidates")
    suspend fun getPendingOrderCandidates(
        @Header("Authorization") authHeader: String,
        @Query("transactionId") transactionId: String? = null,
        @Query("amount") amount: Double? = null,
        @Query("branchId") branchId: String? = null,
        @Query("search") search: String? = null
    ): Response<PendingOrderCandidatesResponse>

    @POST("api/bank-connect/v1/admin/transactions/{id}/manual-match")
    suspend fun manualMatch(
        @Header("Authorization") authHeader: String,
        @Path("id") id: String,
        @Body body: ManualMatchRequest
    ): Response<ManualMatchResponse>
}
