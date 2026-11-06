package vn.avora.bankconnect.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.OrderDetailResponse
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.text.DecimalFormat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderDetailScreen(
    orderId: String,
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }

    var order by remember { mutableStateOf<OrderDetailResponse?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun loadOrder() {
        isLoading = true
        errorMessage = null
        val authHeader = authManager.getAuthHeader()
        if (authHeader == null) {
            errorMessage = "Vui lòng đăng nhập lại để xem thông tin chi tiết đơn hàng."
            isLoading = false
            return
        }

        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.getOrderDetail(authHeader, orderId)
                if (response.isSuccessful && response.body() != null) {
                    order = response.body()
                    isLoading = false
                } else {
                    errorMessage = "Không tìm thấy thông tin đơn hàng (HTTP ${response.code()})"
                    isLoading = false
                }
            } catch (e: Exception) {
                errorMessage = "Lỗi khi tải thông tin đơn hàng: ${e.message}"
                isLoading = false
            }
        }
    }

    LaunchedEffect(orderId) {
        loadOrder()
    }

    fun formatImageUrl(rawUrl: String?): String? {
        if (rawUrl.isNullOrBlank()) return null
        return if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
            rawUrl
        } else if (rawUrl.startsWith("/")) {
            "https://avorafnb.com$rawUrl"
        } else {
            "https://avorafnb.com/$rawUrl"
        }
    }

    val currencyFormatter = remember { DecimalFormat("#,###") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        AvoraTopHeader(
            title = "Chi tiết đơn hàng",
            subtitle = order?.let { "#${it.orderCode ?: it.temporaryOrderCode ?: it.id.take(8)}" } ?: "Đang tải dữ liệu...",
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = Slate700
                    )
                }
            },
            actions = {
                IconButton(onClick = { loadOrder() }) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh",
                        tint = Slate700
                    )
                }
            }
        )

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            if (isLoading) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(color = AvoraRedPrimary)
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = "Đang tải dữ liệu đơn hàng...",
                        color = Slate500,
                        fontSize = 13.sp
                    )
                }
            } else if (errorMessage != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = Rose600,
                        modifier = Modifier.size(52.dp)
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = errorMessage ?: "Đã có lỗi xảy ra",
                        color = Slate900,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(18.dp))
                    Button(
                        onClick = { loadOrder() },
                        colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("THỬ LẠI", fontWeight = FontWeight.Bold)
                    }
                }
            } else {
                order?.let { ord ->
                    val isPaid = ord.paymentStatus.equals("PAID", ignoreCase = true)
                    val paidAmount = ord.payments?.sumOf { it.amount } ?: 0.0
                    val finalTotal = ord.finalAmount ?: ord.totalAmount
                    val balanceDue = maxOf(0.0, finalTotal - paidAmount)
                    val subTotal = ord.subTotal ?: ord.totalAmount

                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 14.dp),
                        contentPadding = PaddingValues(vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // 1. Order Header Card
                        item {
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f, fill = false)
                                        ) {
                                            Surface(
                                                color = Color(0xFFFFEBEE),
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.size(36.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(
                                                        imageVector = Icons.Default.TableRestaurant,
                                                        contentDescription = null,
                                                        tint = AvoraRedPrimary,
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                }
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column(modifier = Modifier.weight(1f, fill = false)) {
                                                val tableTitle = if (!ord.table?.name.isNullOrBlank()) {
                                                    ord.table!!.name
                                                } else if (ord.orderType == "TAKEAWAY") {
                                                    "Mang về"
                                                } else if (ord.orderType == "DELIVERY") {
                                                    "Giao hàng"
                                                } else {
                                                    "Mang về"
                                                }
                                                Text(
                                                    text = tableTitle,
                                                    fontSize = 15.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Slate900,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                Text(
                                                    text = ord.branch?.name ?: "AVORA Restaurant",
                                                    fontSize = 12.sp,
                                                    color = Slate500,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                        }

                                        // Status Pill (Guaranteed room, never wrapped or distorted)
                                        Surface(
                                            color = if (isPaid) Color(0xFFE8F5E9) else Color(0xFFFFEBEE),
                                            shape = RoundedCornerShape(16.dp),
                                            modifier = Modifier.padding(start = 8.dp)
                                        ) {
                                            Text(
                                                text = if (isPaid) "ĐÃ THANH TOÁN" else "CHỜ THANH TOÁN",
                                                color = if (isPaid) Color(0xFF2E7D32) else Rose600,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                maxLines = 1,
                                                softWrap = false,
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))
                                    HorizontalDivider(color = Color(0xFFF1F5F9))
                                    Spacer(modifier = Modifier.height(12.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text(text = "Mã đơn hàng", fontSize = 11.sp, color = Slate400)
                                            Text(
                                                text = ord.orderCode ?: ord.temporaryOrderCode ?: ord.id.take(8),
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Slate900
                                            )
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(text = "Phương thức", fontSize = 11.sp, color = Slate400)
                                            Text(
                                                text = ord.paymentMethod ?: "CHUYỂN KHOẢN (TRANSFER)",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = AvoraRedPrimary
                                            )
                                        }
                                    }

                                    if (!ord.customerName.isNullOrBlank()) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column {
                                                Text(text = "Khách hàng", fontSize = 11.sp, color = Slate400)
                                                Text(
                                                    text = "${ord.customerName} ${if (!ord.customerPhone.isNullOrBlank()) "(${ord.customerPhone})" else ""}",
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    color = Slate800
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 1b. Online Delivery Info Card (if delivery or takeaway with address)
                        if (!ord.deliveryAddress.isNullOrBlank() || ord.orderType == "DELIVERY") {
                            item {
                                Card(
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Surface(
                                                color = Color(0xFFEFF6FF),
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(
                                                        imageVector = Icons.Default.TwoWheeler,
                                                        contentDescription = null,
                                                        tint = Color(0xFF2563EB),
                                                        modifier = Modifier.size(18.dp)
                                                    )
                                                }
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Text(
                                                text = "THÔNG TIN GIAO HÀNG ONLINE",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF1E40AF),
                                                letterSpacing = 0.5.sp
                                            )
                                        }

                                        Spacer(modifier = Modifier.height(10.dp))
                                        HorizontalDivider(color = Color(0xFFF1F5F9))
                                        Spacer(modifier = Modifier.height(10.dp))

                                        if (!ord.deliveryAddress.isNullOrBlank()) {
                                            Row(modifier = Modifier.fillMaxWidth()) {
                                                Icon(Icons.Default.LocationOn, contentDescription = null, tint = AvoraRedPrimary, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text("Địa chỉ nhận hàng:", fontSize = 11.sp, color = Slate400)
                                                    Text(ord.deliveryAddress!!, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate900)
                                                }
                                            }
                                        }

                                        if (!ord.deliveryDate.isNullOrBlank() || !ord.deliverySlotSnapshot.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Row(modifier = Modifier.fillMaxWidth()) {
                                                Icon(Icons.Default.Schedule, contentDescription = null, tint = Color(0xFF0284C7), modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text("Thời gian giao hàng:", fontSize = 11.sp, color = Slate400)
                                                    val dateStr = ord.deliveryDate?.take(10) ?: ""
                                                    val slotStr = ord.deliverySlotSnapshot ?: ""
                                                    Text("$dateStr $slotStr".trim(), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate900)
                                                }
                                            }
                                        }

                                        if (!ord.note.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Row(modifier = Modifier.fillMaxWidth()) {
                                                Icon(Icons.Default.Notes, contentDescription = null, tint = Color(0xFFD97706), modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text("Ghi chú đơn hàng:", fontSize = 11.sp, color = Slate400)
                                                    Text(ord.note!!, fontSize = 12.5.sp, color = Color(0xFF92400E), fontWeight = FontWeight.Medium)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 2. Order Items Section
                        item {
                            Text(
                                text = "DANH SÁCH MÓN ĂN (${ord.orderItems?.size ?: 0})",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate500,
                                letterSpacing = 0.8.sp
                            )
                        }

                        if (ord.orderItems.isNullOrEmpty()) {
                            item {
                                Surface(
                                    color = Color.White,
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "Chưa có danh sách món ăn trong đơn này",
                                        modifier = Modifier.padding(16.dp),
                                        color = Slate400,
                                        fontSize = 13.sp
                                    )
                                }
                            }
                        } else {
                            items(ord.orderItems) { item ->
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(14.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            // Food Thumbnail Image
                                            val imgUrl = formatImageUrl(item.product?.imageUrl)
                                            if (!imgUrl.isNullOrBlank()) {
                                                AsyncImage(
                                                    model = imgUrl,
                                                    contentDescription = item.product?.name,
                                                    contentScale = ContentScale.Crop,
                                                    modifier = Modifier
                                                        .size(54.dp)
                                                        .clip(RoundedCornerShape(8.dp))
                                                        .border(1.dp, Slate200, RoundedCornerShape(8.dp))
                                                )
                                            } else {
                                                Surface(
                                                    modifier = Modifier.size(54.dp),
                                                    shape = RoundedCornerShape(8.dp),
                                                    color = Color(0xFFFFF7ED),
                                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFEDD5))
                                                ) {
                                                    Box(contentAlignment = Alignment.Center) {
                                                        Icon(
                                                            imageVector = Icons.Default.Restaurant,
                                                            contentDescription = null,
                                                            tint = Color(0xFFEA580C),
                                                            modifier = Modifier.size(24.dp)
                                                        )
                                                    }
                                                }
                                            }

                                            Spacer(modifier = Modifier.width(12.dp))

                                            Column(modifier = Modifier.weight(1f)) {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    verticalAlignment = Alignment.Top
                                                ) {
                                                    Column(modifier = Modifier.weight(1f)) {
                                                        Text(
                                                            text = item.product?.name ?: "Món ăn",
                                                            fontSize = 14.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = Slate900,
                                                            maxLines = 2,
                                                            overflow = TextOverflow.Ellipsis
                                                        )
                                                        if (!item.product?.itemCode.isNullOrBlank()) {
                                                            Text(
                                                                text = "Mã: ${item.product!!.itemCode}",
                                                                fontSize = 10.5.sp,
                                                                color = Slate400,
                                                                fontFamily = FontFamily.Monospace
                                                            )
                                                        }
                                                        Spacer(modifier = Modifier.height(2.dp))
                                                        Text(
                                                            text = "${currencyFormatter.format(item.effectivePrice)}đ  ×  ${item.quantity}",
                                                            fontSize = 12.sp,
                                                            color = Slate500,
                                                            fontFamily = FontFamily.Monospace
                                                        )
                                                    }

                                                    Text(
                                                        text = "${currencyFormatter.format(item.effectiveSubtotal)}đ",
                                                        fontSize = 14.sp,
                                                        fontWeight = FontWeight.Black,
                                                        color = Slate900,
                                                        fontFamily = FontFamily.Monospace,
                                                        modifier = Modifier.padding(start = 6.dp)
                                                    )
                                                }

                                                // Item Options / Toppings (if any)
                                                if (!item.optionsTextSnapshot.isNullOrBlank()) {
                                                    Spacer(modifier = Modifier.height(4.dp))
                                                    Surface(
                                                        color = Color(0xFFF1F5F9),
                                                        shape = RoundedCornerShape(4.dp)
                                                    ) {
                                                        Text(
                                                            text = "Tùy chọn: ${item.optionsTextSnapshot}",
                                                            fontSize = 10.5.sp,
                                                            color = Slate600,
                                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                        )
                                                    }
                                                }

                                                // Item Note (if any)
                                                if (!item.note.isNullOrBlank()) {
                                                    Spacer(modifier = Modifier.height(3.dp))
                                                    Text(
                                                        text = "Ghi chú: ${item.note}",
                                                        fontSize = 11.sp,
                                                        color = Color(0xFFD97706),
                                                        fontWeight = FontWeight.Medium
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 3. Complete Financial Summary Breakdown Card
                        item {
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.White),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp)
                                ) {
                                    Text(
                                        text = "TỔNG KẾT THANH TOÁN CHI TIẾT",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate500,
                                        letterSpacing = 0.8.sp
                                    )

                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Line 1: Tạm tính tiền hàng (Subtotal)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(text = "Tạm tính tiền hàng", fontSize = 13.sp, color = Slate600)
                                        Text(
                                            text = "${currencyFormatter.format(subTotal)}đ",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            fontFamily = FontFamily.Monospace,
                                            color = Slate900
                                        )
                                    }

                                    // Line 2: Phí giao hàng (nếu có)
                                    if (ord.shippingFee != null && ord.shippingFee > 0) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(text = "Phí giao hàng", fontSize = 13.sp, color = Slate600)
                                            Text(
                                                text = "+${currencyFormatter.format(ord.shippingFee)}đ",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Slate900
                                            )
                                        }
                                    }

                                    // Line 3: Giảm giá món / đơn hàng (nếu có)
                                    if (ord.discountAmount != null && ord.discountAmount > 0) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "Giảm giá ${ord.discountReason?.let { "($it)" } ?: ""}",
                                                fontSize = 13.sp,
                                                color = Emerald600
                                            )
                                            Text(
                                                text = "-${currencyFormatter.format(ord.discountAmount)}đ",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.Bold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Emerald600
                                            )
                                        }
                                    }

                                    // Line 4: Mã Voucher (nếu có)
                                    if (!ord.discountVoucherCodeSnapshot.isNullOrBlank()) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(text = "Voucher ưu đãi", fontSize = 13.sp, color = Slate600)
                                            Surface(
                                                color = Color(0xFFFEF3C7),
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text(
                                                    text = ord.discountVoucherCodeSnapshot,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    fontFamily = FontFamily.Monospace,
                                                    color = Color(0xFF92400E),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }

                                    // Line 5: Phụ thu / Phí dịch vụ (nếu có)
                                    if (ord.serviceChargeTotal != null && ord.serviceChargeTotal > 0) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(text = "Phụ thu / Dịch vụ", fontSize = 13.sp, color = Slate600)
                                            Text(
                                                text = "+${currencyFormatter.format(ord.serviceChargeTotal)}đ",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Slate900
                                            )
                                        }
                                    }

                                    // Line 6: Thuế GTGT (VAT) (nếu có)
                                    if (ord.taxAmount != null && ord.taxAmount > 0) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(text = "Thuế GTGT (VAT)", fontSize = 13.sp, color = Slate600)
                                            Text(
                                                text = "+${currencyFormatter.format(ord.taxAmount)}đ",
                                                fontSize = 13.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Slate900
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))
                                    HorizontalDivider(color = Color(0xFFF1F5F9))
                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Line 7: Tổng thanh toán cuối cùng
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "TỔNG THANH TOÁN",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Black,
                                            color = Slate900
                                        )
                                        Text(
                                            text = "${currencyFormatter.format(finalTotal)}đ",
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Black,
                                            fontFamily = FontFamily.Monospace,
                                            color = Slate900
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    // Line 8: Đã thanh toán
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Đã thanh toán",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Emerald600
                                        )
                                        Text(
                                            text = "${currencyFormatter.format(paidAmount)}đ",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace,
                                            color = Emerald600
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    // Line 9: Còn lại
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "Còn phải thu",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (balanceDue > 0) AvoraRedPrimary else Emerald600
                                        )
                                        Text(
                                            text = if (balanceDue > 0) "${currencyFormatter.format(balanceDue)}đ" else "0đ (Đã tất toán)",
                                            fontSize = 15.sp,
                                            fontWeight = FontWeight.Black,
                                            fontFamily = FontFamily.Monospace,
                                            color = if (balanceDue > 0) AvoraRedPrimary else Emerald600
                                        )
                                    }
                                }
                            }
                        }

                        // 4. Payments History Card
                        if (!ord.payments.isNullOrEmpty()) {
                            item {
                                Text(
                                    text = "LỊCH SỬ THANH TOÁN GẮN KÈM",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate500,
                                    letterSpacing = 0.8.sp
                                )
                            }

                            items(ord.payments) { p ->
                                Card(
                                    shape = RoundedCornerShape(12.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color.White),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(14.dp)
                                    ) {
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
                                                    text = p.paymentMethod,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Slate900
                                                )
                                            }

                                            Text(
                                                text = "+${currencyFormatter.format(p.amount)}đ",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                fontFamily = FontFamily.Monospace,
                                                color = Emerald600
                                            )
                                        }

                                        if (!p.transactionRef.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = "Mã Ref: ${p.transactionRef}",
                                                fontSize = 10.sp,
                                                fontFamily = FontFamily.Monospace,
                                                color = Slate400
                                            )
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
