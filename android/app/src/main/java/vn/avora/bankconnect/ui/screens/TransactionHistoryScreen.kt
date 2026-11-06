package vn.avora.bankconnect.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.TransactionEntity
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionHistoryScreen(
    onNavigateToOrderDetail: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val db = remember { AppDatabase.getInstance(context) }
    val authManager = remember { AuthManager.getInstance(context) }

    val transactions by db.transactionDao().getAllFlow().collectAsState(initial = emptyList())
    var quickFilter by remember { mutableStateOf("ALL") }
    var filterState by remember { mutableStateOf(TransactionFilterState()) }
    var isFilterSheetOpen by remember { mutableStateOf(false) }

    var selectedTx by remember { mutableStateOf<TransactionEntity?>(null) }
    var quickMatchTx by remember { mutableStateOf<TransactionEntity?>(null) }
    var isReMatching by remember { mutableStateOf(false) }
    var isRefunding by remember { mutableStateOf(false) }
    var isSyncingFromServer by remember { mutableStateOf(false) }
    var showDeleteAllConfirmDialog by remember { mutableStateOf(false) }

    fun syncTransactionsFromServer(showFeedbackToast: Boolean = false) {
        val authHeader = authManager.getAuthHeader()
        if (authHeader == null) {
            if (showFeedbackToast) {
                Toast.makeText(context, "Vui lòng đăng nhập Admin để đồng bộ dữ liệu", Toast.LENGTH_SHORT).show()
            }
            return
        }
        isSyncingFromServer = true
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val resp = api.getTransactions(authHeader, page = 1, limit = 100)
                if (resp.isSuccessful && resp.body() != null) {
                    val remoteItems = resp.body()!!.items
                    if (remoteItems.isNotEmpty()) {
                        val entities = remoteItems.map { item ->
                            val occurredTs = try {
                                java.time.Instant.parse(item.occurredAt).toEpochMilli()
                            } catch (e: Exception) {
                                try {
                                    java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(item.occurredAt)?.time ?: System.currentTimeMillis()
                                } catch (e2: Exception) {
                                    System.currentTimeMillis()
                                }
                            }
                            TransactionEntity(
                                eventId = item.eventId ?: item.id,
                                bank = item.bank,
                                accountNumber = item.accountNumberMasked ?: "UNKNOWN",
                                direction = item.direction,
                                amount = item.amount.toLong(),
                                balanceAfter = item.balanceAfter?.toLong(),
                                currency = item.currency,
                                occurredAt = item.occurredAt,
                                counterparty = item.counterparty,
                                transferContent = item.transferContent,
                                bankReference = item.bankReference,
                                rawText = item.rawText,
                                syncStatus = "SYNCED",
                                matchedStatus = item.matchingStatus ?: "UNMATCHED",
                                matchedOrderId = item.orderId,
                                createdAt = occurredTs
                            )
                        }
                        db.transactionDao().upsertAll(entities)
                        if (showFeedbackToast) {
                            Toast.makeText(context, "Đã đồng bộ ${entities.size} biến động từ máy chủ", Toast.LENGTH_SHORT).show()
                        }
                    } else if (showFeedbackToast) {
                        Toast.makeText(context, "Máy chủ chưa có giao dịch nào mới", Toast.LENGTH_SHORT).show()
                    }
                } else if (showFeedbackToast) {
                    Toast.makeText(context, "Lỗi lấy dữ liệu từ máy chủ (HTTP ${resp.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                android.util.Log.e("SyncTx", "Sync error: ${e.message}")
                if (showFeedbackToast) {
                    Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            } finally {
                isSyncingFromServer = false
            }
        }
    }

    LaunchedEffect(Unit) {
        syncTransactionsFromServer(showFeedbackToast = false)
    }

    fun handleDeleteSingleTx(tx: TransactionEntity) {
        if (!tx.matchedOrderId.isNullOrBlank() || tx.matchedStatus == "MATCHED") {
            Toast.makeText(context, "Không thể xóa giao dịch đã đối soát thành công với đơn hàng!", Toast.LENGTH_SHORT).show()
            return
        }
        coroutineScope.launch {
            try {
                val authHeader = authManager.getAuthHeader()
                if (authHeader != null) {
                    try {
                        val api = NetworkClient.getApiService(context)
                        api.deleteUnmatchedTransaction(authHeader, tx.eventId)
                    } catch (e: Exception) {
                        android.util.Log.w("DeleteTx", "VPS error: ${e.message}")
                    }
                }
                db.transactionDao().deleteSingleUnmatched(tx.eventId)
                selectedTx = null
                Toast.makeText(context, "Đã xóa giao dịch thành công (Đồng bộ VPS)", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi khi xóa giao dịch: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun handleDeleteAllUnmatched() {
        coroutineScope.launch {
            try {
                val authHeader = authManager.getAuthHeader()
                if (authHeader != null) {
                    try {
                        val api = NetworkClient.getApiService(context)
                        api.deleteAllUnmatchedTransactions(authHeader)
                    } catch (e: Exception) {
                        android.util.Log.w("DeleteAllTx", "VPS batch error: ${e.message}")
                    }
                }
                val count = db.transactionDao().deleteAllUnmatched()
                selectedTx = null
                showDeleteAllConfirmDialog = false
                Toast.makeText(context, "Đã dọn dẹp $count giao dịch chưa gắn đơn trên cả App và Web", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi dọn dẹp: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun handleConfirmOverpaidRefund(tx: TransactionEntity) {
        val authHeader = authManager.getAuthHeader()
        if (authHeader == null) {
            Toast.makeText(context, "Vui lòng đăng nhập quyền Quản trị viên", Toast.LENGTH_SHORT).show()
            return
        }
        isRefunding = true
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val resp = api.confirmRefund(
                    authHeader = authHeader,
                    id = tx.eventId,
                    body = vn.avora.bankconnect.core.network.ConfirmRefundRequest(
                        refundBankReference = "REFUND-" + System.currentTimeMillis().toString().takeLast(8),
                        notes = "Xác nhận chuyển dư & ghi nhận hoàn tiền từ Android App"
                    )
                )
                if (resp.isSuccessful) {
                    db.transactionDao().markSynced(tx.eventId, "MATCHED", tx.matchedOrderId)
                    selectedTx = tx.copy(matchedStatus = "MATCHED")
                    Toast.makeText(context, "Đã xác nhận chuyển dư & ghi nhận hoàn tiền (REFUNDED) thành công!", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(context, "Lỗi ghi nhận hoàn tiền: HTTP ${resp.code()}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isRefunding = false
            }
        }
    }

    val formatter = remember { NumberFormat.getNumberInstance(Locale("vi", "VN")) }

    // Logic lọc đa tầng: Quick Chip + Bộ lọc nâng cao
    val filteredList = remember(transactions, quickFilter, filterState) {
        transactions.filter { tx ->
            // 1. Quick Chip filter
            val matchesQuick = when (quickFilter) {
                "CREDIT" -> tx.direction == "CREDIT"
                "DEBIT" -> tx.direction == "DEBIT"
                "MATCHED" -> tx.matchedStatus == "MATCHED" || tx.matchedOrderId != null
                "REVIEW_REQUIRED" -> tx.matchedStatus == "REVIEW_REQUIRED" || tx.matchedStatus == "UNMATCHED"
                "SYNCED" -> tx.syncStatus == "SYNCED"
                else -> true
            }
            if (!matchesQuick) return@filter false

            // 2. Keyword Search
            if (filterState.keyword.isNotBlank()) {
                val kw = filterState.keyword.trim().lowercase()
                val textToSearch = "${tx.bank} ${tx.accountNumber} ${tx.transferContent.orEmpty()} ${tx.bankReference.orEmpty()} ${tx.counterparty.orEmpty()} ${tx.matchedOrderId.orEmpty()}".lowercase()
                if (!textToSearch.contains(kw)) return@filter false
            }

            // 3. Bank Filter (Multi-select)
            if (filterState.selectedBanks.isNotEmpty()) {
                if (!filterState.selectedBanks.contains(tx.bank.uppercase())) return@filter false
            }

            // 4. Direction Filter
            if (filterState.direction != "ALL" && tx.direction != filterState.direction) {
                return@filter false
            }

            // 5. Matched Status Filter
            if (filterState.matchedStatus != "ALL") {
                when (filterState.matchedStatus) {
                    "MATCHED" -> if (tx.matchedStatus != "MATCHED" && tx.matchedOrderId == null) return@filter false
                    "UNMATCHED" -> if (tx.matchedStatus != "UNMATCHED") return@filter false
                    "REVIEW_REQUIRED" -> if (tx.matchedStatus != "REVIEW_REQUIRED") return@filter false
                    "IGNORED" -> if (tx.matchedStatus != "IGNORED") return@filter false
                    "DUPLICATE" -> if (tx.matchedStatus != "DUPLICATE") return@filter false
                }
            }

            // 6. Amount Filter
            if (filterState.minAmount != null && tx.amount < filterState.minAmount!!) return@filter false
            if (filterState.maxAmount != null && tx.amount > filterState.maxAmount!!) return@filter false

            // 7. Time Range Filter
            if (filterState.timeRange != "ALL") {
                val now = System.currentTimeMillis()
                val oneDay = 24 * 60 * 60 * 1000L
                when (filterState.timeRange) {
                    "TODAY" -> if (now - tx.createdAt > oneDay) return@filter false
                    "YESTERDAY" -> if (now - tx.createdAt < oneDay || now - tx.createdAt > 2 * oneDay) return@filter false
                    "LAST_7_DAYS" -> if (now - tx.createdAt > 7 * oneDay) return@filter false
                    "LAST_30_DAYS" -> if (now - tx.createdAt > 30 * oneDay) return@filter false
                }
            }

            true
        }
    }

    fun handleReMatch(tx: TransactionEntity) {
        val authHeader = authManager.getAuthHeader()
        if (authHeader == null) {
            Toast.makeText(context, "Vui lòng đăng nhập quyền Admin để đối soát lại", Toast.LENGTH_SHORT).show()
            return
        }

        isReMatching = true
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.reMatchTransaction(authHeader, tx.eventId)
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.matched) {
                        db.transactionDao().markSynced(tx.eventId, "MATCHED", body.orderId)
                        selectedTx = tx.copy(matchedStatus = "MATCHED", matchedOrderId = body.orderId)
                        Toast.makeText(context, "Khớp lệnh thành công đơn hàng ${body.orderCode ?: body.orderId}!", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(context, body.reason ?: "Chưa tìm thấy đơn hàng phù hợp", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(context, "Lỗi đối soát lại (HTTP ${response.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isReMatching = false
            }
        }
    }

    fun copyToClipboard(text: String, label: String = "Raw Text") {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(label, text)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "Đã sao chép vào bộ nhớ tạm", Toast.LENGTH_SHORT).show()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate50)
    ) {
        // 1. Enterprise Top Header
        AvoraTopHeader(
            title = "Lịch sử biến động (${filteredList.size})",
            subtitle = if (filterState.activeCount() > 0) "Đang áp dụng ${filterState.activeCount()} tiêu chí lọc nâng cao" else "Toàn bộ giao dịch ngân hàng",
            actions = {
                // Nút Đồng bộ dữ liệu từ VPS
                IconButton(
                    onClick = { syncTransactionsFromServer(showFeedbackToast = true) },
                    modifier = Modifier.size(38.dp)
                ) {
                    if (isSyncingFromServer) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = AvoraRedPrimary
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Đồng bộ từ máy chủ",
                            tint = Slate700,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }

                // Nút Dọn dẹp giao dịch không gắn đơn
                IconButton(
                    onClick = { showDeleteAllConfirmDialog = true },
                    modifier = Modifier.size(38.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DeleteSweep,
                        contentDescription = "Dọn dẹp giao dịch chưa khớp",
                        tint = Slate600,
                        modifier = Modifier.size(22.dp)
                    )
                }

                // Nút Bộ Lọc Nâng Cao có Badge số lượng
                IconButton(
                    onClick = { isFilterSheetOpen = true },
                    modifier = Modifier.size(38.dp)
                ) {
                    BadgedBox(
                        badge = {
                            if (filterState.activeCount() > 0) {
                                Badge(
                                    containerColor = AvoraRedPrimary,
                                    contentColor = Color.White
                                ) {
                                    Text(filterState.activeCount().toString(), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.FilterList,
                            contentDescription = "Bộ lọc nâng cao",
                            tint = if (filterState.activeCount() > 0) AvoraRedPrimary else Slate700,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                }
            }
        )

        // 2. Thanh lọc nhanh dạng Chip
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val chips = listOf(
                "ALL" to "Tất cả",
                "MATCHED" to "Đã khớp đơn",
                "REVIEW_REQUIRED" to "Chờ kiểm tra",
                "CREDIT" to "Tiền vào (+)",
                "DEBIT" to "Tiền ra (-)",
                "SYNCED" to "Đã đồng bộ"
            )
            items(chips) { (key, label) ->
                val isSelected = quickFilter == key
                FilterChip(
                    selected = isSelected,
                    onClick = { quickFilter = key },
                    label = { Text(label, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium) },
                    shape = RoundedCornerShape(8.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AvoraRedPrimary,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White,
                        labelColor = Slate700
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true,
                        selected = isSelected,
                        borderColor = if (isSelected) AvoraRedPrimary else Slate200,
                        selectedBorderColor = AvoraRedPrimary,
                        borderWidth = 1.dp
                    )
                )
            }
        }

        // 3. Danh sách giao dịch
        if (filteredList.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.SearchOff,
                        contentDescription = null,
                        tint = Slate300,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Không có giao dịch nào phù hợp với bộ lọc",
                        style = MaterialTheme.typography.bodyMedium.copy(color = Slate500, fontWeight = FontWeight.Medium)
                    )
                    if (filterState.activeCount() > 0 || quickFilter != "ALL") {
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(
                            onClick = {
                                quickFilter = "ALL"
                                filterState = TransactionFilterState()
                            }
                        ) {
                            Text("Xóa bộ lọc", color = AvoraRedPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredList, key = { it.eventId }) { tx ->
                    val isCredit = tx.direction == "CREDIT"
                    val isMatched = tx.matchedStatus == "MATCHED" || tx.matchedOrderId != null

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { selectedTx = tx },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Surface(
                                    modifier = Modifier.size(38.dp),
                                    shape = CircleShape,
                                    color = if (isCredit) Emerald50 else Rose50
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = if (isCredit) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward,
                                            contentDescription = null,
                                            tint = if (isCredit) Emerald600 else Rose600,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            color = when (tx.bank.uppercase()) {
                                                "VCB" -> Color(0xFFE8F5E9)
                                                "OCB" -> Color(0xFFFFF8E1)
                                                "MB" -> Color(0xFFE3F2FD)
                                                "TCB" -> Color(0xFFFFEBEE)
                                                else -> Slate100
                                            },
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = tx.bank,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = when (tx.bank.uppercase()) {
                                                    "VCB" -> Color(0xFF2E7D32)
                                                    "OCB" -> Color(0xFFB45309)
                                                    "MB" -> Color(0xFF1565C0)
                                                    "TCB" -> Color(0xFFC62828)
                                                    else -> Slate700
                                                },
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text(
                                            text = tx.counterparty ?: (if (tx.accountNumber.length > 4) "••••${tx.accountNumber.takeLast(4)}" else tx.accountNumber),
                                            style = MaterialTheme.typography.bodyMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = Slate900,
                                                fontSize = 13.sp
                                            ),
                                            maxLines = 1
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = tx.transferContent ?: "Ref: ${tx.bankReference ?: "N/A"}",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = Slate600,
                                            fontSize = 11.sp,
                                            fontFamily = FontFamily.Monospace
                                        ),
                                        maxLines = 1
                                    )
                                    Text(
                                        text = tx.occurredAt,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = Slate400,
                                            fontSize = 10.sp
                                        )
                                    )
                                }
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "${if (isCredit) "+" else "-"}${formatter.format(tx.amount)} đ",
                                    style = MaterialTheme.typography.bodyLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 15.sp,
                                        color = if (isCredit) Emerald600 else Slate800
                                    )
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Surface(
                                    shape = RoundedCornerShape(4.dp),
                                    color = when {
                                        isMatched -> Emerald100
                                        tx.matchedStatus == "REVIEW_REQUIRED" -> Amber100
                                        tx.matchedStatus == "DUPLICATE" -> Color(0xFFF3E8FF)
                                        tx.matchedStatus == "IGNORED" -> Slate100
                                        else -> Slate100
                                    }
                                ) {
                                    Text(
                                        text = when {
                                            isMatched -> "ĐÃ KHỚP ĐƠN"
                                            tx.matchedStatus == "REVIEW_REQUIRED" -> "CẦN KIỂM TRA"
                                            tx.matchedStatus == "DUPLICATE" -> "TRÙNG LẶP"
                                            tx.matchedStatus == "IGNORED" -> "BỎ QUA"
                                            else -> tx.syncStatus
                                        },
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = when {
                                                isMatched -> Emerald600
                                                tx.matchedStatus == "REVIEW_REQUIRED" -> Amber600
                                                tx.matchedStatus == "DUPLICATE" -> Color(0xFF7E22CE)
                                                tx.matchedStatus == "IGNORED" -> Slate500
                                                else -> Slate600
                                            }
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Modal Bottom Sheet Bộ Lọc Nâng Cao
    if (isFilterSheetOpen) {
        TransactionFilterBottomSheet(
            currentState = filterState,
            onApply = { filterState = it },
            onDismiss = { isFilterSheetOpen = false }
        )
    }

    // Dialog xác nhận dọn dẹp toàn bộ giao dịch chưa khớp
    if (showDeleteAllConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteAllConfirmDialog = false },
            containerColor = Color.White,
            titleContentColor = Slate900,
            textContentColor = Slate700,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 0.dp,
            title = { Text("Dọn dẹp giao dịch chưa khớp?", fontWeight = FontWeight.Bold) },
            text = { Text("Hành động này sẽ xóa toàn bộ các bản ghi biến động số dư chưa được khớp với bất kỳ đơn hàng nào (bao gồm giao dịch bỏ qua, trùng lặp hoặc chưa đối soát). Bạn có chắc chắn muốn xóa?") },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteAllConfirmDialog = false
                        handleDeleteAllUnmatched()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Xác nhận xóa", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteAllConfirmDialog = false }) {
                    Text("Hủy", color = Slate700)
                }
            }
        )
    }

    // Detail Bottom Sheet cho từng giao dịch
    selectedTx?.let { tx ->
        ModalBottomSheet(
            onDismissRequest = { selectedTx = null },
            containerColor = Color.White,
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Chi tiết biến động số dư",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Slate900)
                    )
                    IconButton(onClick = { selectedTx = null }) {
                        Icon(Icons.Default.Close, contentDescription = "Đóng", tint = Slate500)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))

                DetailRow("Ngân hàng", tx.bank)
                DetailRow("Số tài khoản", tx.accountNumber)
                DetailRow("Chiều giao dịch", tx.direction)
                DetailRow("Số tiền", "${formatter.format(tx.amount)} VND")
                DetailRow("Thời gian GD", tx.occurredAt)
                DetailRow("Người gửi", tx.counterparty ?: "N/A")
                DetailRow("Nội dung chuyển", tx.transferContent ?: "N/A")
                DetailRow("Mã Ref ngân hàng", tx.bankReference ?: "N/A")
                DetailRow("Trạng thái đồng bộ", tx.syncStatus)
                DetailRow("Trạng thái đối soát", tx.matchedStatus ?: "Chưa đối soát")

                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "RAW NOTIFICATION TEXT",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate500,
                    letterSpacing = 0.5.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    color = Slate50,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { copyToClipboard(tx.rawText ?: "", "Raw Notification") }
                ) {
                    Text(
                        text = tx.rawText ?: "N/A",
                        modifier = Modifier.padding(8.dp),
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        color = Slate700
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Feature 3: Khách chuyển tiền trùng 2 lần (OVERPAID_DUPLICATE)
                if (tx.matchedStatus == "OVERPAID_DUPLICATE") {
                    Surface(
                        color = Color(0xFFFEF3C7),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color(0xFFD97706),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Phát hiện khách hàng chuyển trùng 2 lần cho đơn hàng đã thanh toán. Vui lòng xác nhận để hoàn tiền cho khách và khớp sổ sách.",
                                fontSize = 11.5.sp,
                                color = Color(0xFF92400E),
                                lineHeight = 16.sp
                            )
                        }
                    }

                    Button(
                        onClick = { handleConfirmOverpaidRefund(tx) },
                        enabled = !isRefunding,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED)),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        if (isRefunding) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                "Xác nhận chuyển dư -> Ghi nhận hoàn tiền",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                // Action Buttons
                if (tx.matchedOrderId != null && tx.matchedStatus != "OVERPAID_DUPLICATE") {
                    val orderId = tx.matchedOrderId
                    Button(
                        onClick = {
                            if (!orderId.isNullOrBlank()) {
                                selectedTx = null
                                onNavigateToOrderDetail(orderId)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Xem chi tiết đơn hàng liên quan", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { selectedTx = null },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(42.dp)
                    ) {
                        Text("Đóng", color = Slate700, fontWeight = FontWeight.Bold)
                    }
                } else {
                    // Feature 4: 1-Tap Quick Match Button
                    Button(
                        onClick = {
                            val target = tx
                            selectedTx = null
                            quickMatchTx = target
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Emerald600),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        Icon(Icons.Default.TouchApp, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Gán đơn hàng 1-chạm (Quick Match)", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { handleReMatch(tx) },
                            enabled = !isReMatching,
                            colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                        ) {
                            if (isReMatching) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Đối soát lại", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }

                        OutlinedButton(
                            onClick = { handleDeleteSingleTx(tx) },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCA5A5)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp)
                        ) {
                            Icon(Icons.Default.DeleteOutline, contentDescription = null, modifier = Modifier.size(18.dp), tint = Color(0xFFDC2626))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Xóa GD này", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFFDC2626))
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { selectedTx = null },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(42.dp)
                    ) {
                        Text("Đóng", color = Slate700, fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }

    // Modal Bottom Sheet Gán Đơn Hàng 1-Chạm (Quick Match)
    quickMatchTx?.let { tx ->
        QuickMatchBottomSheet(
            transaction = tx,
            onDismiss = { quickMatchTx = null },
            onMatchSuccess = { orderId, orderCode ->
                quickMatchTx = null
                Toast.makeText(context, "Đã khớp thành công giao dịch với đơn $orderCode!", Toast.LENGTH_LONG).show()
                onNavigateToOrderDetail(orderId)
            }
        )
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, fontSize = 12.5.sp, color = Slate500)
        Text(
            text = value,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            color = Slate900,
            modifier = Modifier.padding(start = 12.dp)
        )
    }
}
