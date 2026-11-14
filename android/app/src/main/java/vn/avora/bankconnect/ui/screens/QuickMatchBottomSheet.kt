package vn.avora.bankconnect.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.database.entity.TransactionEntity
import vn.avora.bankconnect.core.network.*
import vn.avora.bankconnect.ui.theme.*
import java.text.DecimalFormat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickMatchBottomSheet(
    transaction: TransactionEntity,
    onDismiss: () -> Unit,
    onMatchSuccess: (orderId: String, orderCode: String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val authHeader = remember { authManager.getAuthHeader() ?: "" }

    val currencyFormat = remember { DecimalFormat("#,###") }

    var candidates by remember { mutableStateOf<List<PendingOrderCandidateDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCandidate by remember { mutableStateOf<PendingOrderCandidateDto?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var showConfirmDialog by remember { mutableStateOf(false) }

    fun loadCandidates() {
        if (authHeader.isBlank()) return
        isLoading = true
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.getPendingOrderCandidates(
                    authHeader = authHeader,
                    transactionId = transaction.eventId,
                    amount = transaction.amount.toDouble(),
                    search = searchQuery.ifBlank { null }
                )
                if (response.isSuccessful && response.body()?.success == true) {
                    candidates = response.body()?.data ?: emptyList()
                } else {
                    Toast.makeText(context, "Không thể tải danh sách đơn ứng viên", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadCandidates()
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "GÁN ĐƠN HÀNG 1-CHẠM",
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = Slate900,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "Chọn đơn hàng để đối soát với khoản tiền nhận được",
                        fontSize = 12.sp,
                        color = Slate500
                    )
                }
                IconButton(onClick = onDismiss, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Đóng", tint = Slate500)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Transaction Summary Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${transaction.bank} • Ref: ${transaction.bankReference ?: "Chưa rõ"}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = Slate800
                        )
                        Text(
                            text = transaction.transferContent ?: "Không có nội dung",
                            fontSize = 11.sp,
                            color = Slate600,
                            maxLines = 1
                        )
                    }
                    Text(
                        text = "+${currencyFormat.format(transaction.amount)}đ",
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = Emerald600
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = {
                    searchQuery = it
                    loadCandidates()
                },
                placeholder = { Text("Tìm theo mã đơn, bàn, SĐT...", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = ""; loadCandidates() }) {
                            Icon(Icons.Default.Clear, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AvoraRedPrimary,
                    unfocusedBorderColor = Slate300
                )
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Candidate List
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AvoraRedPrimary, strokeWidth = 2.dp)
                }
            } else if (candidates.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Không tìm thấy đơn hàng nào đang chờ thanh toán phù hợp.",
                        fontSize = 13.sp,
                        color = Slate500,
                        textAlign = TextAlign.Center
                    )
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 380.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    candidates.forEach { candidate ->
                        val isExactAmount = Math.abs(candidate.remainingAmount - transaction.amount.toDouble()) < 1.0
                        val isHighMatch = candidate.matchScore >= 50

                        Card(
                            onClick = {
                                selectedCandidate = candidate
                                showConfirmDialog = true
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (isExactAmount) Emerald600 else BorderLight
                            ),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                // Line 1: Order code + Table name (Left) | Price Amount (Right, NEVER WRAPS)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f, fill = false)
                                    ) {
                                        Text(
                                            text = "#${candidate.orderCode}",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.5.sp,
                                            color = Slate900,
                                            maxLines = 1
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        val displayTable = if (candidate.tableName.isNotBlank()) candidate.tableName else "Mang về"
                                        Surface(
                                            color = Slate200.copy(alpha = 0.6f),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = displayTable,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = Slate700,
                                                maxLines = 1,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    // Amount always visible with guaranteed room
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(start = 8.dp)
                                    ) {
                                        Text(
                                            text = "Cần thu: ",
                                            fontSize = 11.5.sp,
                                            color = Slate500,
                                            maxLines = 1
                                        )
                                        Text(
                                            text = "${currencyFormat.format(candidate.remainingAmount)}đ",
                                            fontWeight = FontWeight.ExtraBold,
                                            fontSize = 13.5.sp,
                                            color = if (isExactAmount) Emerald600 else Slate900,
                                            maxLines = 1,
                                            softWrap = false
                                        )
                                    }
                                }

                                // Line 2: Branch + Time (weight = 1f, Ellipsis) | Match Badge (Right)
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "${candidate.branchName} • ${vn.avora.bankconnect.core.util.VnTimeUtils.formatVnDateTime(candidate.createdAt, "dd/MM HH:mm")}",
                                        fontSize = 11.sp,
                                        color = Slate500,
                                        maxLines = 1,
                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                                        modifier = Modifier.weight(1f, fill = false)
                                    )

                                    if (isExactAmount) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            color = Color(0xFFDCFCE7),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = "TRÙNG KHỚP TIỀN",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color(0xFF15803D),
                                                maxLines = 1,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    } else if (isHighMatch) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Surface(
                                            color = Color(0xFFFEF3C7),
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                text = "GỢI Ý",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Black,
                                                color = Color(0xFFB45309),
                                                maxLines = 1,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    // Confirmation Dialog
    if (showConfirmDialog && selectedCandidate != null) {
        val candidate = selectedCandidate!!
        val isAmountDiff = Math.abs(candidate.remainingAmount - transaction.amount.toDouble()) >= 1.0

        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            containerColor = Color.White,
            titleContentColor = Slate900,
            textContentColor = Slate700,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 0.dp,
            title = {
                Text(
                    text = "XÁC NHẬN GÁN ĐƠN HÀNG",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Slate900
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Bạn có chắc chắn muốn gán khoản tiền ngân hàng này vào đơn hàng đã chọn?",
                        fontSize = 13.sp,
                        color = Slate700,
                        lineHeight = 18.sp
                    )

                    Surface(
                        color = Slate50,
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            val tableDisplay = if (candidate.tableName.isNotBlank()) candidate.tableName else "Mang về"
                            Text("Đơn hàng: #${candidate.orderCode} ($tableDisplay)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Slate900)
                            Text("Số tiền cần thu: ${currencyFormat.format(candidate.remainingAmount)}đ", fontSize = 12.sp, color = Slate600)
                            Text("Tiền giao dịch nhận: +${currencyFormat.format(transaction.amount)}đ", fontSize = 12.5.sp, color = Emerald600, fontWeight = FontWeight.Black)
                        }
                    }

                    if (isAmountDiff) {
                        Surface(
                            color = Color(0xFFFEF2F2),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFECACA)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = "Lưu ý: Số tiền nhận khác với số tiền cần thu của đơn hàng.",
                                    fontSize = 11.5.sp,
                                    color = Color(0xFFDC2626),
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        isSubmitting = true
                        coroutineScope.launch {
                            try {
                                val api = NetworkClient.getApiService(context)
                                val response = api.manualMatch(
                                    authHeader = authHeader,
                                    id = transaction.eventId, // or transaction.id
                                    body = ManualMatchRequest(
                                        orderId = candidate.id,
                                        notes = "Gán 1-chạm từ Android App"
                                    )
                                )
                                if (response.isSuccessful && response.body()?.success == true) {
                                    Toast.makeText(context, "Gán đơn hàng thành công!", Toast.LENGTH_SHORT).show()
                                    showConfirmDialog = false
                                    onMatchSuccess(candidate.id, candidate.orderCode)
                                } else {
                                    Toast.makeText(context, "Lỗi khi gán đơn: ${response.message()}", Toast.LENGTH_LONG).show()
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
                            } finally {
                                isSubmitting = false
                            }
                        }
                    },
                    enabled = !isSubmitting,
                    colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Xác nhận gán đơn", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showConfirmDialog = false },
                    enabled = !isSubmitting,
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate300)
                ) {
                    Text("Hủy", color = Slate700, fontWeight = FontWeight.SemiBold)
                }
            }
        )
    }
}

