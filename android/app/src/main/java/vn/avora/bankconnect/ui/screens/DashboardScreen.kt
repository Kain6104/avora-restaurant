package vn.avora.bankconnect.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.R
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.TransactionEntity
import vn.avora.bankconnect.core.service.BankNotificationListenerService
import vn.avora.bankconnect.core.worker.SyncWorker
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.text.NumberFormat
import java.util.Calendar
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToHistory: () -> Unit,
    onNavigateToSettings: () -> Unit = {}
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    // Query start of day timestamp (00:00:00 Asia/Ho_Chi_Minh)
    val startOfDay = remember {
        vn.avora.bankconnect.core.util.VnTimeUtils.startOfVnDayMillis()
    }

    // Live States from Room
    val allTransactions by db.transactionDao().getAllFlow().collectAsState(initial = emptyList())
    val incomingToday by db.transactionDao().getIncomingTodayFlow(startOfDay).collectAsState(initial = 0L)
    val outgoingToday by db.transactionDao().getOutgoingTodayFlow(startOfDay).collectAsState(initial = 0L)
    val matchedToday by db.transactionDao().getMatchedTodayFlow(startOfDay).collectAsState(initial = 0)
    val unmatchedToday by db.transactionDao().getUnmatchedTodayFlow(startOfDay).collectAsState(initial = 0)
    val pendingSyncCount by db.transactionDao().getPendingCountFlow().collectAsState(initial = 0)
    val recentTransactions by db.transactionDao().getRecentTransactionsFlow().collectAsState(initial = emptyList())
    val isPairedStr by db.configDao().getFlow("is_paired").collectAsState(initial = "false")
    val serverUrlStr by db.configDao().getFlow("server_url").collectAsState(initial = "https://avorafnb.com")

    val isPaired = isPairedStr?.toBooleanStrictOrNull() ?: false
    val isListenerActive = BankNotificationListenerService.isConnected

    val currencyFormatter = remember { NumberFormat.getNumberInstance(Locale("vi", "VN")) }

    // Tính toán phân bổ biến động theo 6 khung giờ hôm nay (Asia/Ho_Chi_Minh)
    val hourlyData = remember(allTransactions, startOfDay) {
        val todayCredits = allTransactions.filter {
            it.direction == "CREDIT" &&
                vn.avora.bankconnect.core.util.VnTimeUtils.parseToEpochMillis(it.occurredAt, it.createdAt) >= startOfDay
        }
        val slots = listOf(
            "06-09h" to (6 until 9),
            "09-12h" to (9 until 12),
            "12-15h" to (12 until 15),
            "15-18h" to (15 until 18),
            "18-21h" to (18 until 21),
            "21-24h" to (21 until 24)
        )
        slots.map { (label, hourRange) ->
            val matching = todayCredits.filter { tx ->
                val txMillis = vn.avora.bankconnect.core.util.VnTimeUtils.parseToEpochMillis(tx.occurredAt, tx.createdAt)
                vn.avora.bankconnect.core.util.VnTimeUtils.vnHourOfDay(txMillis) in hourRange
            }
            Triple(label, matching.sumOf { it.amount }, matching.size)
        }
    }

    val maxSlotAmount = remember(hourlyData) {
        val maxVal = hourlyData.maxOfOrNull { it.second } ?: 0L
        if (maxVal > 0) maxVal else 1L
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        AvoraTopHeader(
            title = "AVORA BANK CONNECT",
            subtitle = "Bank Transaction Monitor",
            actions = {
                // Status Pill
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (isListenerActive && isPaired) Color(0xFFE8F5E9) else Color(0xFFFFEBEE),
                    modifier = Modifier.padding(end = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .background(
                                    color = if (isListenerActive && isPaired) Emerald600 else Rose600,
                                    shape = CircleShape
                                )
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = if (isListenerActive && isPaired) "ONLINE" else "CẦN KẾT NỐI",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isListenerActive && isPaired) Color(0xFF2E7D32) else Rose600
                        )
                    }
                }
            }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. Monitored Account & Gateway Status Card
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "TÀI KHOẢN GIÁM SÁT",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = Slate500,
                                letterSpacing = 0.8.sp
                            )
                        )
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFFE8F5E9)
                        ) {
                            Text(
                                text = "24/7 TỰ ĐỘNG",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF2E7D32),
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                modifier = Modifier.size(36.dp),
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFFE8F5E9)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.AccountBalance,
                                        contentDescription = null,
                                        tint = Color(0xFF007A3D), // VCB Green
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = "Vietcombank (VCB)",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Slate900
                                )
                                Text(
                                    text = "TK: 1019224767  •  HUYNH THANH PHAT",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Slate600
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = Color(0xFFF1F5F9))
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CloudQueue,
                                contentDescription = null,
                                tint = Slate400,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "VPS: avorafnb.com",
                                fontSize = 11.sp,
                                color = Slate500
                            )
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (isListenerActive) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                                contentDescription = null,
                                tint = if (isListenerActive) Emerald600 else Rose600,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (isListenerActive) "Listener hoạt động" else "Listener ngắt kết nối",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isListenerActive) Emerald600 else Rose600
                            )
                        }
                    }
                }
            }

            // 2. Today Financial Metrics (High-Density 4-Metric Grid)
            Text(
                text = "THỐNG KÊ HÔM NAY",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = FontWeight.Bold,
                    color = Slate500,
                    letterSpacing = 0.8.sp
                )
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Metric 1: Tiền Vào (+VND)
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Tiền vào",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate500
                            )
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFE8F5E9),
                                modifier = Modifier.size(24.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.ArrowDownward,
                                        contentDescription = null,
                                        tint = Emerald600,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "+${currencyFormatter.format(incomingToday)}đ",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = Emerald600,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }

                // Metric 2: Tiền Ra (-VND)
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Tiền ra",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate500
                            )
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFFFEBEE),
                                modifier = Modifier.size(24.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.ArrowUpward,
                                        contentDescription = null,
                                        tint = Rose600,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "-${currencyFormatter.format(outgoingToday)}đ",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = Rose600,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Metric 3: Đã đối soát
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "Đã đối soát",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate500
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "$matchedToday GD",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF0284C7) // Sky Blue
                            )
                        }
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFF0F9FF),
                            modifier = Modifier.size(28.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircleOutline,
                                    contentDescription = null,
                                    tint = Color(0xFF0284C7),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }

                // Metric 4: Cần kiểm tra
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(
                                text = "Cần kiểm tra",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate500
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "$unmatchedToday GD",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (unmatchedToday > 0) Color(0xFFD97706) else Slate600
                            )
                        }
                        Surface(
                            shape = CircleShape,
                            color = Color(0xFFFFFBEB),
                            modifier = Modifier.size(28.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.HelpOutline,
                                    contentDescription = null,
                                    tint = Color(0xFFD97706),
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 2.5 Biểu đồ biến động số dư theo khung giờ hôm nay
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.BarChart,
                                contentDescription = null,
                                tint = AvoraRedPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "BIỂU ĐỒ BIẾN ĐỘNG THEO GIỜ",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = Slate700,
                                    letterSpacing = 0.8.sp
                                )
                            )
                        }

                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFFFEF2F2)
                        ) {
                            Text(
                                text = "HÔM NAY",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = AvoraRedPrimary,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Bar Chart Area
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(130.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        hourlyData.forEach { (label, amount, count) ->
                            val heightRatio = if (maxSlotAmount > 0) (amount.toFloat() / maxSlotAmount).coerceIn(0.08f, 1f) else 0.08f
                            val isSlotActive = amount > 0

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.weight(1f)
                            ) {
                                // Amount text on top of bar
                                if (isSlotActive) {
                                    val amountStr = if (amount >= 1_000_000) {
                                        "${String.format(Locale.US, "%.1f", amount / 1_000_000.0)}M"
                                    } else if (amount >= 1_000) {
                                        "${amount / 1_000}k"
                                    } else {
                                        amount.toString()
                                    }
                                    Text(
                                        text = amountStr,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = AvoraRedPrimary
                                    )
                                } else {
                                    Text(
                                        text = "-",
                                        fontSize = 9.sp,
                                        color = Slate400
                                    )
                                }

                                Spacer(modifier = Modifier.height(4.dp))

                                // The Bar
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(0.6f)
                                        .fillMaxHeight(heightRatio)
                                        .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                        .background(
                                            if (isSlotActive) {
                                                androidx.compose.ui.graphics.Brush.verticalGradient(
                                                    colors = listOf(
                                                        Color(0xFFEF4444),
                                                        Color(0xFFDC2626)
                                                    )
                                                )
                                            } else {
                                                androidx.compose.ui.graphics.Brush.verticalGradient(
                                                    colors = listOf(
                                                        Color(0xFFE2E8F0),
                                                        Color(0xFFCBD5E1)
                                                    )
                                                )
                                            }
                                        )
                                )

                                Spacer(modifier = Modifier.height(6.dp))

                                // Label
                                Text(
                                    text = label,
                                    fontSize = 10.sp,
                                    fontWeight = if (isSlotActive) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSlotActive) Slate800 else Slate400
                                )
                            }
                        }
                    }
                }
            }

            // 3. Recent Transactions Card
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "GIAO DỊCH GẦN NHẤT",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.8.sp
                    )
                )

                Text(
                    text = "Xem tất cả",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = AvoraRedPrimary,
                    modifier = Modifier.clickable { onNavigateToHistory() }
                )
            }

            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
            ) {
                if (recentTransactions.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Outlined.ReceiptLong,
                                contentDescription = null,
                                tint = Slate300,
                                modifier = Modifier.size(36.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Chưa có giao dịch biến động số dư nào",
                                fontSize = 12.sp,
                                color = Slate400
                            )
                        }
                    }
                } else {
                    Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)) {
                        recentTransactions.forEachIndexed { index, tx ->
                            val isCredit = tx.direction == "CREDIT"
                            val isMatched = tx.matchedStatus == "MATCHED" || tx.matchedOrderId != null

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onNavigateToHistory() }
                                    .padding(vertical = 10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Surface(
                                        shape = CircleShape,
                                        color = if (isCredit) Color(0xFFE8F5E9) else Color(0xFFFFEBEE),
                                        modifier = Modifier.size(32.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isCredit) Icons.Default.ArrowDownward else Icons.Default.ArrowUpward,
                                                contentDescription = null,
                                                tint = if (isCredit) Emerald600 else Rose600,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.width(10.dp))

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = tx.counterparty ?: tx.transferContent?.take(25) ?: "Giao dịch VCB",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Slate900,
                                            maxLines = 1
                                        )
                                        Text(
                                            text = vn.avora.bankconnect.core.util.VnTimeUtils.formatVnDateTime(tx.occurredAt, "dd/MM/yyyy HH:mm:ss"),
                                            fontSize = 10.sp,
                                            color = Slate400,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "${if (isCredit) "+" else "-"}${currencyFormatter.format(tx.amount)}đ",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isCredit) Emerald600 else Rose600,
                                        fontFamily = FontFamily.Monospace
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = if (isMatched) Color(0xFFE8F5E9) else Color(0xFFFFFBEB)
                                    ) {
                                        Text(
                                            text = if (isMatched) "ĐÃ KHỚP" else "CHƯA KHỚP",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isMatched) Color(0xFF2E7D32) else Color(0xFFD97706),
                                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                            }

                            if (index < recentTransactions.size - 1) {
                                HorizontalDivider(color = Color(0xFFF1F5F9))
                            }
                        }
                    }
                }
            }

            // 4. Quick Actions / Sync Pending
            if (pendingSyncCount > 0) {
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Amber600)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CloudSync,
                                contentDescription = null,
                                tint = Color(0xFFD97706),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = "Có $pendingSyncCount giao dịch chưa đồng bộ VPS",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF92400E)
                                )
                                Text(
                                    text = "Đang trong hàng đợi gửi tự động",
                                    fontSize = 10.sp,
                                    color = Color(0xFFB45309)
                                )
                            }
                        }

                        Button(
                            onClick = {
                                SyncWorker.enqueue(context)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD97706)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(30.dp)
                        ) {
                            Text("Đồng bộ", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
