package vn.avora.bankconnect.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.network.BranchItemDto
import vn.avora.bankconnect.core.network.CompletedOrderItemDto
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompletedOrdersScreen(
    onNavigateToOrderDetail: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val focusManager = LocalFocusManager.current

    var branches by remember { mutableStateOf<List<BranchItemDto>>(emptyList()) }
    var selectedBranchId by remember { mutableStateOf<String?>("ALL") }
    var searchQuery by remember { mutableStateOf("") }

    var orders by remember { mutableStateOf<List<CompletedOrderItemDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var totalCount by remember { mutableStateOf(0) }

    val formatter = remember { NumberFormat.getNumberInstance(Locale("vi", "VN")) }

    fun loadData() {
        val authHeader = authManager.getAuthHeader()
        if (authHeader == null) {
            Toast.makeText(context, "Vui lòng đăng nhập quyền Admin", Toast.LENGTH_SHORT).show()
            return
        }

        isLoading = true
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)

                // Load branches if empty
                if (branches.isEmpty()) {
                    val branchRes = api.getBranches(authHeader)
                    if (branchRes.isSuccessful && branchRes.body() != null) {
                        branches = branchRes.body()!!.data
                    }
                }

                // Load completed orders
                val branchParam = if (selectedBranchId == "ALL") null else selectedBranchId
                val searchParam = if (searchQuery.isBlank()) null else searchQuery.trim()

                val res = api.getCompletedOrders(
                    authHeader = authHeader,
                    branchId = branchParam,
                    page = 1,
                    limit = 50,
                    search = searchParam
                )

                if (res.isSuccessful && res.body() != null) {
                    orders = res.body()!!.data
                    totalCount = res.body()!!.pagination.total
                } else {
                    Toast.makeText(context, "Lỗi tải đơn hàng: HTTP ${res.code()}", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(selectedBranchId) {
        loadData()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate50)
    ) {
        // Top Header
        AvoraTopHeader(
            title = "Đơn hoàn thành ($totalCount)",
            subtitle = "Danh sách đơn hàng đã gạch nợ thành công",
            actions = {
                IconButton(onClick = { loadData() }) {
                    Icon(Icons.Default.Refresh, contentDescription = "Tải lại", tint = Slate700)
                }
            }
        )

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Tìm theo mã đơn hoặc SĐT...", fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400, modifier = Modifier.size(20.dp)) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = {
                        searchQuery = ""
                        loadData()
                    }) {
                        Icon(Icons.Default.Clear, contentDescription = "Xóa", tint = Slate400, modifier = Modifier.size(18.dp))
                    }
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = {
                focusManager.clearFocus()
                loadData()
            }),
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedBorderColor = AvoraRedPrimary,
                unfocusedBorderColor = Slate200
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 6.dp)
                .height(48.dp)
        )

        // Branch Filter Chips
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                val isAll = selectedBranchId == "ALL"
                FilterChip(
                    selected = isAll,
                    onClick = { selectedBranchId = "ALL" },
                    label = { Text("Tất cả chi nhánh", fontSize = 12.sp, fontWeight = if (isAll) FontWeight.Bold else FontWeight.Medium) },
                    shape = RoundedCornerShape(8.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AvoraRedPrimary,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White,
                        labelColor = Slate700
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        borderColor = if (isAll) AvoraRedPrimary else Slate200,
                        enabled = true,
                        selected = isAll
                    )
                )
            }

            items(branches) { b ->
                val isSelected = selectedBranchId == b.id
                FilterChip(
                    selected = isSelected,
                    onClick = { selectedBranchId = b.id },
                    label = { Text(b.name, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium) },
                    shape = RoundedCornerShape(8.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AvoraRedPrimary,
                        selectedLabelColor = Color.White,
                        containerColor = Color.White,
                        labelColor = Slate700
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        borderColor = if (isSelected) AvoraRedPrimary else Slate200,
                        enabled = true,
                        selected = isSelected
                    )
                )
            }
        }

        // List
        if (isLoading) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = AvoraRedPrimary)
            }
        } else if (orders.isEmpty()) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.ReceiptLong,
                        contentDescription = null,
                        tint = Slate300,
                        modifier = Modifier.size(48.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Không tìm thấy đơn hàng hoàn thành nào",
                        style = MaterialTheme.typography.bodyMedium.copy(color = Slate500, fontWeight = FontWeight.Medium)
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(orders, key = { it.id }) { order ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onNavigateToOrderDetail(order.id) },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = Emerald600,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = order.orderCode,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = Slate900
                                    )
                                }

                                Text(
                                    text = "${formatter.format(order.totalAmount)} VND",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = Emerald600
                                )
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val tableDisplay = if (!order.tableName.isNullOrBlank()) " • ${order.tableName}" else " • Mang về"
                                Text(
                                    text = "${order.branchName}$tableDisplay",
                                    fontSize = 12.sp,
                                    color = Slate600,
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f, fill = false)
                                )

                                Spacer(modifier = Modifier.width(8.dp))

                                Surface(
                                    color = if (order.isBankMatched) Color(0xFFECFDF5) else Slate100,
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = if (order.isBankMatched) "KHỚP NGÂN HÀNG" else order.paymentMethod,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        softWrap = false,
                                        color = if (order.isBankMatched) Emerald600 else Slate700
                                    )
                                }
                            }

                            if (!order.customerName.isNullOrBlank() || !order.customerPhone.isNullOrBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Khách: ${order.customerName.orEmpty()} ${if (!order.customerPhone.isNullOrBlank()) "(${order.customerPhone})" else ""}".trim(),
                                    fontSize = 11.5.sp,
                                    color = Slate500
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
