package vn.avora.bankconnect.ui.screens

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.service.BankNotificationListenerService
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnectionCenterScreen(
    onNavigateBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    val isListenerConnected = BankNotificationListenerService.isConnected
    val isPairedStr by db.configDao().getFlow("is_paired").collectAsState(initial = "false")
    val deviceIdStr by db.configDao().getFlow("device_id").collectAsState(initial = "and-unknown")
    val serverUrlStr by db.configDao().getFlow("server_url").collectAsState(initial = "https://avorafnb.com")
    val pendingCount by db.transactionDao().getPendingCountFlow().collectAsState(initial = 0)
    val latestTx by db.transactionDao().getLatestTransactionFlow().collectAsState(initial = null)

    var pingLatency by remember { mutableStateOf<Long?>(null) }
    var isPinging by remember { mutableStateOf(false) }

    fun testPing() {
        scope.launch {
            isPinging = true
            val startTime = System.currentTimeMillis()
            try {
                val api = NetworkClient.getApiService(context)
                val res = api.getDeviceStatus()
                if (res.isSuccessful) {
                    pingLatency = System.currentTimeMillis() - startTime
                } else {
                    pingLatency = -1
                }
            } catch (e: Exception) {
                pingLatency = -1
            } finally {
                isPinging = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Slate50)
    ) {
        AvoraTopHeader(
            title = "Trung tâm kết nối & Giám sát",
            subtitle = "VPS Gateway & System Health",
            navigationIcon = {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Quay lại",
                        tint = Slate800
                    )
                }
            }
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Android Notification Listener Service Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                modifier = Modifier.size(40.dp),
                                shape = RoundedCornerShape(10.dp),
                                color = if (isListenerConnected) Emerald50 else Rose50
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.NotificationsActive,
                                        contentDescription = null,
                                        tint = if (isListenerConnected) Emerald600 else Rose600
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = "Notification Listener Service",
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                                )
                                Text(
                                    text = if (isListenerConnected) "Đang lắng nghe thanh thông báo" else "Chưa được cấp quyền đọc thông báo",
                                    style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    if (!isListenerConnected) {
                        Button(
                            onClick = {
                                val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                                context.startActivity(intent)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(Icons.Default.Security, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Cấp quyền Notification Access")
                        }
                    }
                }
            }

            // 2. VPS Production Connection Card
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "KẾT NỐI MÁY CHỦ PRODUCTION",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 1.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    DetailItem(
                        icon = Icons.Default.Language,
                        title = "Production Domain",
                        subtitle = serverUrlStr ?: "https://avorafnb.com"
                    )
                    DetailItem(
                        icon = Icons.Default.Dns,
                        title = "Giao thức bảo mật",
                        subtitle = "HTTPS (TLS 1.2/1.3) + SHA256withECDSA Signature"
                    )
                    DetailItem(
                        icon = Icons.Default.Fingerprint,
                        title = "Device ID",
                        subtitle = deviceIdStr ?: "N/A"
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (pingLatency != null) {
                            Text(
                                text = if (pingLatency!! >= 0) "Độ trễ: ${pingLatency}ms" else "Kết nối thất bại",
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = if (pingLatency!! in 0..500) Emerald600 else Rose600
                                )
                            )
                        } else {
                            Text(
                                text = "Chưa kiểm tra độ trễ",
                                style = MaterialTheme.typography.bodySmall.copy(color = Slate400)
                            )
                        }

                        Button(
                            onClick = { testPing() },
                            enabled = !isPinging,
                            colors = ButtonDefaults.buttonColors(containerColor = Slate800),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            if (isPinging) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.Speed, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Kiểm tra Ping")
                            }
                        }
                    }
                }
            }

            // 3. Queue & Reliability Diagnostics
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "VẬN HÀNH & ĐỘ TIN CẬY 24/7",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 1.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    DetailItem(
                        icon = Icons.Default.Storage,
                        title = "Hàng đợi Room Database",
                        subtitle = "$pendingCount sự kiện đang chờ đồng bộ"
                    )
                    DetailItem(
                        icon = Icons.Default.History,
                        title = "Biến động VCB gần nhất",
                        subtitle = latestTx?.let { "${it.occurredAt} (+${it.amount}đ)" } ?: "Chưa có dữ liệu"
                    )
                    DetailItem(
                        icon = Icons.Default.Schedule,
                        title = "Cơ chế dự phòng",
                        subtitle = "WorkManager Exponential Backoff + Jitter"
                    )
                }
            }
        }
    }
}

@Composable
fun DetailItem(icon: ImageVector, title: String, subtitle: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = Slate400, modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(text = title, style = MaterialTheme.typography.bodySmall.copy(color = Slate500))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold, color = Slate900)
            )
        }
    }
}

