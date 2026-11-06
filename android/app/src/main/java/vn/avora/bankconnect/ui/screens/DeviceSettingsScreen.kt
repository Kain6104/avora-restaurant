package vn.avora.bankconnect.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.crypto.KeyStoreManager
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.database.entity.TransactionEntity
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.PairRequest
import vn.avora.bankconnect.core.update.OtaUpdateManager
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*
import java.util.Locale
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeviceSettingsScreen(
    onNavigateToDiagnostic: () -> Unit = {},
    onNavigateToQrScanner: () -> Unit = {},
    onNavigateToConnection: () -> Unit = {},
    onNavigateToBankVoiceConfig: () -> Unit = {},
    onLogout: () -> Unit = {}
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()
    val authManager = remember { AuthManager.getInstance(context) }
    val currentUser = remember { authManager.getUser() }

    val isPairedStr by db.configDao().getFlow("is_paired").collectAsState(initial = "false")
    val voiceEnabledStr by db.configDao().getFlow("voice_announcement_enabled").collectAsState(initial = "true")
    val bankModeStr by db.configDao().getFlow("bank_monitoring_mode").collectAsState(initial = "ALL")
    val enabledBanksStr by db.configDao().getFlow("enabled_banks").collectAsState(initial = "VCB,MB,TCB,ACB,BIDV,CTG")
    val deviceIdStr by db.configDao().getFlow("device_id").collectAsState(initial = "and-gateway")

    val isPaired = isPairedStr?.toBooleanStrictOrNull() ?: false
    val voiceEnabled = voiceEnabledStr?.toBooleanStrictOrNull() ?: true
    val bankMode = bankModeStr ?: "ALL"

    // Dialog state controllers
    var showPairingDialog by remember { mutableStateOf(false) }
    var showOtaDialog by remember { mutableStateOf(false) }
    var showLogoutConfirmDialog by remember { mutableStateOf(false) }

    // Pairing states
    var pairingCodeInput by remember { mutableStateOf("") }
    var isPairingLoading by remember { mutableStateOf(false) }

    // OTA states
    var isOtaDownloading by remember { mutableStateOf(false) }
    var otaProgress by remember { mutableStateOf(0) }

    // Sync from server state
    var isSyncingHistory by remember { mutableStateOf(false) }

    // Ensure device ID exists
    LaunchedEffect(Unit) {
        val existingId = db.configDao().get("device_id")
        if (existingId.isNullOrBlank()) {
            val newId = "and-${UUID.randomUUID().toString().take(18)}"
            db.configDao().set(ConfigEntity("device_id", newId))
        }
    }

    fun handlePair() {
        if (pairingCodeInput.isBlank()) {
            Toast.makeText(context, "Vui lòng nhập mã pairing 6 ký tự", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            isPairingLoading = true
            try {
                val deviceId = db.configDao().get("device_id") ?: "and-${UUID.randomUUID().toString().take(18)}"
                val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
                val publicKeyPem = KeyStoreManager.exportPublicKeyPem()

                val api = NetworkClient.getApiService(context)
                val req = PairRequest(
                    pairingCode = pairingCodeInput.trim().uppercase(),
                    deviceId = deviceId,
                    deviceName = deviceName,
                    appVersion = "1.0.4",
                    publicKeyPem = publicKeyPem
                )

                val res = api.pairDevice(req)
                if (res.isSuccessful && res.body()?.success == true) {
                    db.configDao().set(ConfigEntity("is_paired", "true"))
                    db.configDao().set(ConfigEntity("paired_at", res.body()!!.pairedAt))
                    Toast.makeText(context, "Ghép nối với VPS AVORA thành công!", Toast.LENGTH_LONG).show()
                    pairingCodeInput = ""
                    showPairingDialog = false
                } else {
                    val err = res.errorBody()?.string() ?: "Mã pairing không hợp lệ hoặc đã hết hạn"
                    Toast.makeText(context, "Lỗi: $err", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                isPairingLoading = false
            }
        }
    }

    fun handleRevoke() {
        scope.launch {
            db.configDao().set(ConfigEntity("is_paired", "false"))
            KeyStoreManager.deleteKey()
            Toast.makeText(context, "Đã thu hồi liên kết và xóa khóa bảo mật", Toast.LENGTH_SHORT).show()
            showPairingDialog = false
        }
    }

    fun syncAllHistoryFromServer() {
        val authHeader = authManager.getAuthHeader()
        if (authHeader == null) {
            Toast.makeText(context, "Vui lòng đăng nhập quyền Quản trị viên", Toast.LENGTH_SHORT).show()
            return
        }
        isSyncingHistory = true
        scope.launch {
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
                        Toast.makeText(context, "Đã đồng bộ ${entities.size} biến động từ máy chủ về máy thành công!", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(context, "Máy chủ chưa có giao dịch nào", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(context, "Lỗi lấy dữ liệu từ máy chủ (HTTP ${resp.code()})", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isSyncingHistory = false
            }
        }
    }

    fun handleLogoutClick() {
        authManager.clearSession()
        Toast.makeText(context, "Đã đăng xuất khỏi tài khoản Quản trị viên", Toast.LENGTH_SHORT).show()
        onLogout()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        AvoraTopHeader(
            title = "Cài đặt hệ thống",
            subtitle = "Quản lý thiết bị Gateway & Kết nối POS"
        )

        if (!authManager.isAdmin()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFCA5A5))
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFFDC2626), modifier = Modifier.size(44.dp))
                        Spacer(modifier = Modifier.height(14.dp))
                        Text("QUYỀN TRUY CẬP BỊ GIỚI HẠN", fontWeight = FontWeight.Black, fontSize = 15.sp, color = Color(0xFFDC2626))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập và thay đổi cài đặt của ứng dụng Gateway.",
                            fontSize = 13.sp,
                            color = Slate600,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            lineHeight = 18.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { handleLogoutClick() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Đăng xuất / Đổi tài khoản", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // 1. Enterprise Admin Profile Card
                Card(
                    shape = RoundedCornerShape(14.dp),
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
                                Surface(
                                    modifier = Modifier.size(38.dp),
                                    shape = CircleShape,
                                    color = Color(0xFFFFEBEE)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.Default.AdminPanelSettings,
                                            contentDescription = null,
                                            tint = AvoraRedPrimary,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(
                                        text = currentUser?.fullName ?: "Quản trị viên AVORA",
                                        fontSize = 13.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate900
                                    )
                                    Text(
                                        text = currentUser?.email ?: "admin@avorafnb.com",
                                        fontSize = 11.5.sp,
                                        color = Slate500
                                    )
                                }
                            }

                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = Color(0xFFFFEBEE)
                            ) {
                                Text(
                                    text = currentUser?.role ?: "ADMIN",
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = AvoraRedPrimary
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(8.dp))

                        // Biometric Quick Lock Row
                        var isBiometricSettingEnabled by remember { mutableStateOf(authManager.isBiometricEnabled) }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Fingerprint,
                                    contentDescription = null,
                                    tint = if (isBiometricSettingEnabled) Color(0xFF0F766E) else Slate400,
                                    modifier = Modifier.size(18.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Khóa ứng dụng bằng Vân tay / PIN",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Slate700
                                )
                            }
                            Switch(
                                checked = isBiometricSettingEnabled,
                                onCheckedChange = { checked ->
                                    isBiometricSettingEnabled = checked
                                    authManager.isBiometricEnabled = checked
                                    Toast.makeText(
                                        context,
                                        if (checked) "Đã bật khóa sinh trắc học" else "Đã tắt khóa sinh trắc học",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                },
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = Color.White,
                                    checkedTrackColor = Color(0xFF0F766E)
                                )
                            )
                        }
                    }
                }

                // NHÓM 1: KẾT NỐI & GHÉP NỐI POS
                SettingsCategoryHeader(title = "KẾT NỐI & GHÉP NỐI POS")
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                ) {
                    Column {
                        CompactSettingRow(
                            icon = Icons.Default.WifiTethering,
                            iconTint = Color(0xFF0284C7),
                            iconBg = Color(0xFFF0F9FF),
                            title = "Trung tâm Kết nối & Giám sát Gateway",
                            subtitle = "Kiểm tra socket realtime, test ping, nhật ký kết nối",
                            badgeText = if (isPaired) "ONLINE" else "CẦN KẾT NỐI",
                            badgeColor = if (isPaired) Emerald600 else Rose600,
                            onClick = onNavigateToConnection
                        )
                        HorizontalDivider(color = Color(0xFFF8FAFC), thickness = 1.dp)
                        CompactSettingRow(
                            icon = Icons.Default.QrCodeScanner,
                            iconTint = AvoraRedPrimary,
                            iconBg = Color(0xFFFFEBEE),
                            title = "Quét mã QR ghép nối nhanh POS",
                            subtitle = "Mở camera quét mã QR trên màn hình POS để liên kết",
                            onClick = onNavigateToQrScanner
                        )
                        HorizontalDivider(color = Color(0xFFF8FAFC), thickness = 1.dp)
                        CompactSettingRow(
                            icon = Icons.Default.Link,
                            iconTint = Color(0xFF7C3AED),
                            iconBg = Color(0xFFF5F3FF),
                            title = "Ghép nối thủ công (Mã Pairing 6 số)",
                            subtitle = if (isPaired) "Đã ghép nối an toàn với avorafnb.com (EC P-256)" else "Chưa ghép nối - Chạm để nhập mã kết nối",
                            badgeText = if (isPaired) "ĐÃ KẾT NỐI" else null,
                            badgeColor = Emerald600,
                            onClick = { showPairingDialog = true }
                        )
                    }
                }

                // NHÓM 2: CẤU HÌNH NGÂN HÀNG & DỮ LIỆU
                SettingsCategoryHeader(title = "CẤU HÌNH NGÂN HÀNG & GIỌNG ĐỌC")
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                ) {
                    Column {
                        CompactSettingRow(
                            icon = Icons.Default.AccountBalance,
                            iconTint = Color(0xFF16A34A),
                            iconBg = Color(0xFFF0FDF4),
                            title = "Cấu hình 20 Ngân hàng & Giọng nói",
                            subtitle = if (bankMode == "ALL") "Đang theo dõi 20 ngân hàng • Giọng nói ${if (voiceEnabled) "Bật" else "Tắt"}" else "Lọc ngân hàng chọn • Giọng nói ${if (voiceEnabled) "Bật" else "Tắt"}",
                            badgeText = "2 TABS",
                            badgeColor = Color(0xFF16A34A),
                            onClick = onNavigateToBankVoiceConfig
                        )
                        HorizontalDivider(color = Color(0xFFF8FAFC), thickness = 1.dp)
                        CompactSettingRow(
                            icon = Icons.Default.Sync,
                            iconTint = Color(0xFF0D9488),
                            iconBg = Color(0xFFF0FDFA),
                            title = "Đồng bộ toàn bộ lịch sử từ VPS",
                            subtitle = if (isSyncingHistory) "Đang kéo dữ liệu từ máy chủ..." else "Khôi phục toàn bộ lịch sử giao dịch từ cơ sở dữ liệu",
                            onClick = { syncAllHistoryFromServer() }
                        )
                    }
                }

                // NHÓM 3: CẬP NHẬT ỨNG DỤNG & BẢO TRÌ
                SettingsCategoryHeader(title = "CẬP NHẬT & BẢO TRÌ")
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                ) {
                    Column {
                        CompactSettingRow(
                            icon = Icons.Default.SystemUpdate,
                            iconTint = Color(0xFF2563EB),
                            iconBg = Color(0xFFEFF6FF),
                            title = "Cập nhật ứng dụng tự động (OTA 1-Chạm)",
                            subtitle = "Phiên bản hiện tại: v1.0.4 (Build 5) • Tải đè qua HTTPS",
                            badgeText = "OTA MỚI",
                            badgeColor = Color(0xFF2563EB),
                            onClick = { showOtaDialog = true }
                        )
                        HorizontalDivider(color = Color(0xFFF8FAFC), thickness = 1.dp)
                        CompactSettingRow(
                            icon = Icons.Default.Speed,
                            iconTint = Color(0xFF4F46E5),
                            iconBg = Color(0xFFEEF2FF),
                            title = "Chẩn đoán hệ thống & Quyền truy cập",
                            subtitle = "Kiểm tra quyền thông báo, tối ưu pin chạy ngầm 24/7",
                            onClick = onNavigateToDiagnostic
                        )
                    }
                }

                // NHÓM 4: BẢO MẬT & ĐĂNG XUẤT
                SettingsCategoryHeader(title = "BẢO MẬT & HỆ THỐNG")
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate200),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp)
                ) {
                    Column {
                        CompactSettingRow(
                            icon = Icons.Default.Lock,
                            iconTint = Slate700,
                            iconBg = Slate100,
                            title = "Khóa ứng dụng an toàn ngay",
                            subtitle = "Yêu cầu vân tay hoặc mã PIN máy khi quay lại",
                            onClick = {
                                authManager.lockApp()
                                Toast.makeText(context, "Ứng dụng đã được khóa an toàn", Toast.LENGTH_SHORT).show()
                                onLogout()
                            }
                        )
                        HorizontalDivider(color = Color(0xFFF8FAFC), thickness = 1.dp)
                        CompactSettingRow(
                            icon = Icons.Default.Logout,
                            iconTint = Color(0xFFDC2626),
                            iconBg = Color(0xFFFEF2F2),
                            title = "Đăng xuất Quản trị viên",
                            subtitle = "Xóa phiên đăng nhập an toàn khỏi thiết bị",
                            onClick = { showLogoutConfirmDialog = true }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "AVORA Bank Connect v1.0.4 • Mã thiết bị: $deviceIdStr\nMáy chủ: https://avorafnb.com",
                    fontSize = 10.5.sp,
                    color = Slate400,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                    lineHeight = 15.sp
                )

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }

    // DIALOG 1: GHÉP NỐI THỦ CÔNG
    if (showPairingDialog) {
        AlertDialog(
            onDismissRequest = { showPairingDialog = false },
            containerColor = Color.White,
            titleContentColor = Slate900,
            textContentColor = Slate700,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 0.dp,
            title = {
                Text(
                    text = if (isPaired) "TRẠNG THÁI GHÉP NỐI GATEWAY" else "GHÉP NỐI VỚI AVORA WEB",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Slate900
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (isPaired) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Emerald50,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Emerald600)
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text("Đã ghép nối an toàn với máy chủ", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Emerald600)
                                    Text("Khóa bảo mật EC P-256 đang hoạt động 24/7", fontSize = 11.sp, color = Slate600)
                                }
                            }
                        }
                        Text("Bạn có thể thu hồi ghép nối nếu muốn đổi máy chủ hoặc hủy cấp quyền thiết bị này.", fontSize = 12.sp, color = Slate600)
                    } else {
                        Text("Nhập mã Pairing gồm 6 ký tự được tạo từ Web Admin (Menu Cài đặt -> Bank Connect) để liên kết thiết bị:", fontSize = 12.sp, color = Slate600)
                        OutlinedTextField(
                            value = pairingCodeInput,
                            onValueChange = { pairingCodeInput = it.uppercase() },
                            placeholder = { Text("VD: K9W4M2") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            textStyle = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp,
                                fontFamily = FontFamily.Monospace
                            ),
                            shape = RoundedCornerShape(10.dp)
                        )
                    }
                }
            },
            confirmButton = {
                if (isPaired) {
                    Button(
                        onClick = { handleRevoke() },
                        colors = ButtonDefaults.buttonColors(containerColor = Rose600),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Thu hồi liên kết", fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                    }
                } else {
                    Button(
                        onClick = { handlePair() },
                        enabled = !isPairingLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (isPairingLoading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Xác nhận ghép nối", fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                        }
                    }
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showPairingDialog = false },
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate300)
                ) {
                    Text("Đóng", color = Slate700)
                }
            }
        )
    }

    // DIALOG 2: CẬP NHẬT ỨNG DỤNG OTA
    if (showOtaDialog) {
        AlertDialog(
            onDismissRequest = { if (!isOtaDownloading) showOtaDialog = false },
            containerColor = Color.White,
            titleContentColor = Slate900,
            textContentColor = Slate700,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 0.dp,
            title = {
                Text(text = "CẬP NHẬT ỨNG DỤNG (OTA 1-CHẠM)", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Slate900)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Ứng dụng sẽ tự động tải file APK phiên bản mới nhất từ https://avorafnb.com/downloads/avora-bank-connect.apk và cài đặt trực tiếp không làm mất dữ liệu.",
                        fontSize = 12.sp,
                        color = Slate600,
                        lineHeight = 17.sp
                    )

                    if (isOtaDownloading) {
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = otaProgress / 100f,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp),
                            color = Color(0xFF2563EB),
                            trackColor = Color(0xFFE2E8F0)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Đang tải bản cập nhật: $otaProgress%...",
                            fontSize = 11.sp,
                            color = Color(0xFF2563EB),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        isOtaDownloading = true
                        otaProgress = 0
                        scope.launch {
                            OtaUpdateManager.downloadAndInstall(
                                context = context,
                                onProgress = { otaProgress = it },
                                onError = {
                                    isOtaDownloading = false
                                    Toast.makeText(context, it, Toast.LENGTH_LONG).show()
                                }
                            )
                            isOtaDownloading = false
                        }
                    },
                    enabled = !isOtaDownloading,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isOtaDownloading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Tải & Cài đặt ngay", fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                    }
                }
            },
            dismissButton = {
                if (!isOtaDownloading) {
                    OutlinedButton(
                        onClick = { showOtaDialog = false },
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate300)
                    ) {
                        Text("Hủy", color = Slate700)
                    }
                }
            }
        )
    }

    // DIALOG 3: XÁC NHẬN ĐĂNG XUẤT
    if (showLogoutConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirmDialog = false },
            containerColor = Color.White,
            titleContentColor = Slate900,
            textContentColor = Slate700,
            shape = RoundedCornerShape(16.dp),
            tonalElevation = 0.dp,
            title = {
                Text(text = "XÁC NHẬN ĐĂNG XUẤT", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Slate900)
            },
            text = {
                Text(
                    text = "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Quản trị viên? Để đăng nhập lại bạn sẽ cần nhập mật khẩu hoặc quét vân tay.",
                    fontSize = 12.5.sp,
                    color = Slate600
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutConfirmDialog = false
                        handleLogoutClick()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Đăng xuất", fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showLogoutConfirmDialog = false },
                    shape = RoundedCornerShape(8.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Slate300)
                ) {
                    Text("Hủy", color = Slate700)
                }
            }
        )
    }
}

@Composable
fun CompactSettingRow(
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    title: String,
    subtitle: String,
    badgeText: String? = null,
    badgeColor: Color = Color(0xFFEF4444),
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = iconBg,
                modifier = Modifier.size(34.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0F172A),
                        maxLines = 1
                    )
                    if (badgeText != null) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = badgeColor.copy(alpha = 0.12f)
                        ) {
                            Text(
                                text = badgeText,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = badgeColor,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(1.5.dp))
                Text(
                    text = subtitle,
                    fontSize = 11.sp,
                    color = Color(0xFF64748B),
                    maxLines = 1
                )
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = Color(0xFF94A3B8),
            modifier = Modifier.size(16.dp)
        )
    }
}

@Composable
fun SettingsCategoryHeader(title: String) {
    Text(
        text = title,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF64748B),
        letterSpacing = 0.8.sp,
        modifier = Modifier.padding(start = 4.dp, top = 2.dp, bottom = 2.dp)
    )
}
