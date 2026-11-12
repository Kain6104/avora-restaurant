package vn.avora.bankconnect.ui.screens

import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.network.*
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.text.DecimalFormat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShiftAuditScreen(
    onNavigateBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val authHeader = remember { authManager.getAuthHeader() ?: "" }

    val currencyFormat = remember { DecimalFormat("#,###") }

    var shiftsList by remember { mutableStateOf<List<ShiftSummaryDto>>(emptyList()) }
    var selectedShiftId by remember { mutableStateOf<String?>(null) }
    var shiftAuditData by remember { mutableStateOf<ShiftAuditResponse?>(null) }
    var isLoadingShifts by remember { mutableStateOf(false) }
    var isLoadingAudit by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedTab by remember { mutableStateOf(0) } // 0: Tổng quan, 1: Lệch POS, 2: Chưa gắn đơn, 3: Đã khớp

    fun loadRecentShifts() {
        if (authHeader.isBlank()) return
        isLoadingShifts = true
        errorMessage = null
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.getRecentShifts(authHeader)
                if (response.isSuccessful && response.body()?.success == true) {
                    val list = response.body()?.data ?: emptyList()
                    shiftsList = list
                    if (selectedShiftId == null && list.isNotEmpty()) {
                        selectedShiftId = list.first().id
                    }
                } else {
                    errorMessage = "Không thể tải danh sách ca làm việc."
                }
            } catch (e: Exception) {
                errorMessage = "Lỗi kết nối: ${e.message}"
            } finally {
                isLoadingShifts = false
            }
        }
    }

    fun loadShiftAudit(shiftId: String) {
        if (authHeader.isBlank()) return
        isLoadingAudit = true
        errorMessage = null
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.auditShift(authHeader, shiftId)
                if (response.isSuccessful && response.body()?.success == true) {
                    shiftAuditData = response.body()
                } else {
                    errorMessage = "Lỗi đối soát ca: ${response.message()}"
                }
            } catch (e: Exception) {
                errorMessage = "Lỗi mạng khi đối soát ca: ${e.message}"
            } finally {
                isLoadingAudit = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadRecentShifts()
    }

    LaunchedEffect(selectedShiftId) {
        selectedShiftId?.let { loadShiftAudit(it) }
    }

    Scaffold(
        topBar = {
            AvoraTopHeader(
                title = "ĐỐI SOÁT CHỐT CA",
                subtitle = "Đối chiếu chuyển khoản POS & Biến động số dư 1-chạm"
            )
        },
        containerColor = Color.White
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Shift Selector Bar
            Surface(
                color = Color.White,
                shadowElevation = 1.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "CHỌN CA LÀM VIỆC ĐỐI SOÁT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    if (isLoadingShifts) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = AvoraRedPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Đang tải danh sách ca...", fontSize = 13.sp, color = Slate600)
                        }
                    } else if (shiftsList.isEmpty()) {
                        Text("Chưa có ca làm việc nào được ghi nhận.", fontSize = 13.sp, color = Slate500)
                    } else {
                        var expanded by remember { mutableStateOf(false) }
                        val currentShift = shiftsList.find { it.id == selectedShiftId }

                        Box {
                            OutlinedCard(
                                onClick = { expanded = true },
                                shape = RoundedCornerShape(10.dp),
                                colors = CardDefaults.outlinedCardColors(containerColor = Slate50),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 14.dp, vertical = 10.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = "Ca #${currentShift?.id?.take(8)?.uppercase() ?: ""}",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp,
                                                color = Slate900
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Surface(
                                                color = if (currentShift?.status == "OPEN") Color(0xFFDCFCE7) else Color(0xFFF1F5F9),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = if (currentShift?.status == "OPEN") "ĐANG MỞ" else "ĐÃ CHỐT",
                                                    color = if (currentShift?.status == "OPEN") Color(0xFF166534) else Slate600,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        Text(
                                            text = "${currentShift?.cashierName} • ${currentShift?.branchName}",
                                            fontSize = 12.sp,
                                            color = Slate600
                                        )
                                    }
                                    Icon(
                                        imageVector = Icons.Default.ArrowDropDown,
                                        contentDescription = null,
                                        tint = Slate600
                                    )
                                }
                            }

                            DropdownMenu(
                                expanded = expanded,
                                onDismissRequest = { expanded = false },
                                modifier = Modifier.fillMaxWidth(0.9f)
                            ) {
                                shiftsList.forEach { shift ->
                                    DropdownMenuItem(
                                        text = {
                                            Column {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween
                                                ) {
                                                    Text(
                                                        "Ca #${shift.id.take(8).uppercase()} (${shift.cashierName})",
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 13.sp
                                                    )
                                                    Text(
                                                        if (shift.status == "OPEN") "ĐANG MỞ" else "ĐÃ CHỐT",
                                                        fontSize = 11.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = if (shift.status == "OPEN") Emerald600 else Slate500
                                                    )
                                                }
                                                Text(
                                                    "CK POS: ${currencyFormat.format(shift.totalTransfer)}đ • ${shift.branchName}",
                                                    fontSize = 11.sp,
                                                    color = Slate500
                                                )
                                            }
                                        },
                                        onClick = {
                                            selectedShiftId = shift.id
                                            expanded = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Audit Content
            if (isLoadingAudit) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = AvoraRedPrimary)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Đang tổng hợp dữ liệu chuyển khoản & biến động ngân hàng...",
                            fontSize = 13.sp,
                            color = Slate600,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            } else if (shiftAuditData != null) {
                val audit = shiftAuditData!!
                val metrics = audit.metrics
                val discrepancies = audit.discrepancies

                // Status Badge Color & Text
                val (statusBg, statusFg, statusTitle, statusIcon) = when (metrics.reconciliationStatus) {
                    "MATCHED" -> Quadruple(
                        Color(0xFFDCFCE7),
                        Color(0xFF15803D),
                        "ĐÃ KHỚP HOÀN TOÀN (100%)",
                        Icons.Default.CheckCircle
                    )
                    "NEEDS_REVIEW" -> Quadruple(
                        Color(0xFFFEF9C3),
                        Color(0xFFA16207),
                        "CẦN KIỂM TRA ĐỐI SOÁT",
                        Icons.Default.Warning
                    )
                    else -> Quadruple(
                        Color(0xFFFEE2E2),
                        Color(0xFFB91C1C),
                        "CHÊNH LỆCH ĐỐI SOÁT",
                        Icons.Default.Error
                    )
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingPadding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    // 1. Reconciliation Status Hero Card
                    item {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, statusFg.copy(alpha = 0.35f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(statusIcon, contentDescription = null, tint = statusFg, modifier = Modifier.size(20.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = statusTitle,
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp,
                                            color = statusFg,
                                            letterSpacing = 0.5.sp
                                        )
                                    }
                                    IconButton(
                                        onClick = { selectedShiftId?.let { loadShiftAudit(it) } },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(Icons.Default.Refresh, contentDescription = "Làm mới", tint = statusFg, modifier = Modifier.size(18.dp))
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Tổng Chuyển khoản POS", fontSize = 11.sp, color = Slate600)
                                        Text(
                                            "${currencyFormat.format(metrics.totalPosTransfer)}đ",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = Slate900
                                        )
                                        Text("${metrics.posTransferCount} lượt thanh toán", fontSize = 10.sp, color = Slate500)
                                    }

                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("Thực nhận Ngân hàng", fontSize = 11.sp, color = Slate600)
                                        Text(
                                            "${currencyFormat.format(metrics.totalBankCredit)}đ",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 16.sp,
                                            color = Slate900
                                        )
                                        Text("${metrics.bankCreditCount} giao dịch CREDIT", fontSize = 10.sp, color = Slate500)
                                    }
                                }

                                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = statusFg.copy(alpha = 0.2f))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Chênh lệch (Ngân hàng - POS):",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = statusFg
                                    )
                                    Text(
                                        text = "${if (metrics.variance > 0) "+" else ""}${currencyFormat.format(metrics.variance)}đ",
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Black,
                                        color = statusFg
                                    )
                                }
                            }
                        }
                    }

                    // 2. Metrics Breakdown 2x2 Grid
                    item {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            // Total Matched
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .background(Color(0xFF10B981), CircleShape)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("ĐÃ KHỚP ĐƠN", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Slate500)
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        "${currencyFormat.format(metrics.totalMatched)}đ",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Slate900
                                    )
                                    Text("${metrics.matchedCount} giao dịch", fontSize = 10.sp, color = Slate500)
                                }
                            }

                            // Total Unmatched / Review
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(8.dp)
                                                .background(Color(0xFFF59E0B), CircleShape)
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("CHƯA RÕ NGUỒN", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Slate500)
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        "${currencyFormat.format(metrics.totalUnmatched)}đ",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = if (metrics.totalUnmatched > 0) Color(0xFFD97706) else Slate900
                                    )
                                    Text("${metrics.unmatchedCount} giao dịch", fontSize = 10.sp, color = Slate500)
                                }
                            }
                        }
                    }

                    // 3. Category Tabs
                    item {
                        TabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = Color.White,
                            contentColor = AvoraRedPrimary
                        ) {
                            Tab(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                text = { Text("Lệch POS (${discrepancies.missingBankTransactions.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            Tab(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                text = { Text("Chưa gắn (${discrepancies.unmatchedBankTransactions.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            Tab(
                                selected = selectedTab == 2,
                                onClick = { selectedTab = 2 },
                                text = { Text("Chuyển trùng (${discrepancies.overpaidDuplicates.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                            Tab(
                                selected = selectedTab == 3,
                                onClick = { selectedTab = 3 },
                                text = { Text("Đã khớp (${audit.matchedTransactions.size})", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                            )
                        }
                    }

                    // 4. Tab Items
                    when (selectedTab) {
                        0 -> {
                            if (discrepancies.missingBankTransactions.isEmpty()) {
                                item {
                                    EmptyStateView(title = "Không có khoản lệch POS", description = "Tất cả các khoản chuyển khoản ghi nhận trên POS đều đã tìm thấy giao dịch ngân hàng khớp.")
                                }
                            } else {
                                items(discrepancies.missingBankTransactions) { item ->
                                    Card(
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCA5A5))
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    "Đơn #${item.orderCode} • ${item.tableName}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    color = Slate900
                                                )
                                                Text(
                                                    "${currencyFormat.format(item.amount)}đ",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFFDC2626)
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(item.reason, fontSize = 11.sp, color = Color(0xFFB91C1C))
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Thời gian: ${item.createdAt}", fontSize = 10.sp, color = Slate400)
                                        }
                                    }
                                }
                            }
                        }

                        1 -> {
                            if (discrepancies.unmatchedBankTransactions.isEmpty()) {
                                item {
                                    EmptyStateView(title = "Không có tiền chưa gắn đơn", description = "Toàn bộ giao dịch ngân hàng nhận được trong ca này đều đã được đối soát thành công.")
                                }
                            } else {
                                items(discrepancies.unmatchedBankTransactions) { tx ->
                                    Card(
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFDE68A))
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    "${tx.bank} • Ref: ${tx.bankReference ?: "Không có"}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    color = Slate900
                                                )
                                                Text(
                                                    "+${currencyFormat.format(tx.amount)}đ",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFFD97706)
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Nội dung: ${tx.transferContent ?: "Trống"}", fontSize = 11.sp, color = Slate700)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(tx.reason, fontSize = 11.sp, color = Color(0xFFB45309), fontWeight = FontWeight.SemiBold)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Thời gian: ${tx.occurredAt}", fontSize = 10.sp, color = Slate400)
                                        }
                                    }
                                }
                            }
                        }

                        2 -> {
                            if (discrepancies.overpaidDuplicates.isEmpty()) {
                                item {
                                    EmptyStateView(title = "Không có giao dịch chuyển trùng", description = "Chưa phát hiện khách hàng nào chuyển tiền 2 lần cho cùng một đơn trong ca này.")
                                }
                            } else {
                                items(discrepancies.overpaidDuplicates) { item ->
                                    Card(
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, AvoraRedPrimary.copy(alpha = 0.4f))
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    "Đơn #${item.orderCode ?: "N/A"}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    color = Color(0xFF881337)
                                                )
                                                Text(
                                                    "Thừa: +${currencyFormat.format(item.amount)}đ",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFFE11D48)
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Nội dung: ${item.transferContent ?: ""}", fontSize = 11.sp, color = Slate700)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(item.reason, fontSize = 11.sp, color = Color(0xFFBE123C), fontWeight = FontWeight.SemiBold)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("Thời gian: ${item.occurredAt} • Ref: ${item.bankReference ?: "Trống"}", fontSize = 10.sp, color = Slate400)
                                        }
                                    }
                                }
                            }
                        }

                        3 -> {
                            if (audit.matchedTransactions.isEmpty()) {
                                item {
                                    EmptyStateView(title = "Chưa có giao dịch khớp", description = "Chưa có giao dịch ngân hàng nào được đối soát khớp với đơn hàng của ca này.")
                                }
                            } else {
                                items(audit.matchedTransactions) { tx ->
                                    Card(
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color.White),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                                    ) {
                                        Column(modifier = Modifier.padding(14.dp)) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    "Đơn #${tx.orderCode}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 13.sp,
                                                    color = Slate900
                                                )
                                                Text(
                                                    "+${currencyFormat.format(tx.amount)}đ",
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF059669)
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("${tx.bank} • Ref: ${tx.bankReference ?: tx.transferContent}", fontSize = 11.sp, color = Slate600)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text("Thời gian: ${tx.occurredAt}", fontSize = 10.sp, color = Slate400)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyStateView(title: String, description: String) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircleOutline,
                contentDescription = null,
                tint = Color(0xFF10B981),
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Slate800)
            Spacer(modifier = Modifier.height(4.dp))
            Text(description, fontSize = 12.sp, color = Slate500, textAlign = TextAlign.Center)
        }
    }
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

private fun PaddingPadding(all: androidx.compose.ui.unit.Dp): PaddingValues = PaddingValues(all)

