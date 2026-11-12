package vn.avora.bankconnect.ui.screens

import android.os.Build
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.crypto.KeyStoreManager
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.database.entity.TransactionEntity
import vn.avora.bankconnect.core.network.AppVersionData
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
    val installedAppInfo = remember { OtaUpdateManager.getInstalledAppInfo(context) }

    val isPairedStr by db.configDao().getFlow("is_paired").collectAsState(initial = "false")
    val voiceEnabledStr by db.configDao().getFlow("voice_announcement_enabled").collectAsState(initial = "true")
    val bankModeStr by db.configDao().getFlow("bank_monitoring_mode").collectAsState(initial = "ALL")
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
    var isCheckingOtaMeta by remember { mutableStateOf(false) }
    var otaProgress by remember { mutableStateOf(0) }
    var otaStatusText by remember { mutableStateOf("") }
    var remoteVersionMeta by remember { mutableStateOf<AppVersionData?>(null) }

    // Sync from server state
    var isSyncingHistory by remember { mutableStateOf(false) }

    // Ensure device ID exists & check latest OTA metadata
    LaunchedEffect(Unit) {
        val existingId = db.configDao().get("device_id")
        if (existingId.isNullOrBlank()) {
            val newId = "and-${UUID.randomUUID().toString().take(18)}"
            db.configDao().set(ConfigEntity("device_id", newId))
        }
        isCheckingOtaMeta = true
        remoteVersionMeta = OtaUpdateManager.fetchLatestVersionMetadata(context)
        isCheckingOtaMeta = false
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
                    appVersion = installedAppInfo.versionName,
                    publicKeyPem = publicKeyPem
                )

                val res = api.pairDevice(req)
                if (res.isSuccessful && res.body()?.success == true) {
                    db.configDao().set(ConfigEntity("is_paired", "true"))
                    db.configDao().set(ConfigEntity("revoked_reason", ""))
                    db.configDao().set(ConfigEntity("paired_at", res.body()!!.pairedAt))
                    vn.avora.bankconnect.core.service.BankGatewaySocketManager.initialize(context)
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
            vn.avora.bankconnect.core.service.BankNotificationListenerService.handleDeviceRevokedOrUnpaired(
                context,
                "Thiết bị đã được thu hồi liên kết thủ công. Vui lòng ghép nối lại trên /admin/bank-connect."
            )
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
        if (isSyncingHistory) return
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
                        Toast.makeText(context, "Đã đồng bộ ${entities.size} biến động từ máy chủ thành công!", Toast.LENGTH_LONG).show()
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
                    .background(Color.White)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .wrapContentHeight(),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                    border = BorderStroke(1.dp, BorderLight)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = null,
                            tint = AvoraRedPrimary,
                            modifier = Modifier.size(40.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            "QUYỀN TRUY CẬP BỊ GIỚI HẠN",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập và thay đổi cài đặt của ứng dụng Gateway.",
                            fontSize = 13.sp,
                            color = TextSecondary,
                            textAlign = TextAlign.Center,
                            lineHeight = 18.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { handleLogoutClick() },
                            colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text("Đăng xuất / Đổi tài khoản", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.White),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // 1. Enterprise Admin Profile Card
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentHeight(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                        border = BorderStroke(1.dp, BorderLight)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .wrapContentHeight()
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Surface(
                                        modifier = Modifier.size(36.dp),
                                        shape = CircleShape,
                                        color = Color(0xFFFEF2F2)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Default.AdminPanelSettings,
                                                contentDescription = null,
                                                tint = AvoraRedPrimary,
                                                modifier = Modifier.size(20.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = currentUser?.fullName ?: "Quản trị viên AVORA",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = currentUser?.email ?: "admin@avorafnb.com",
                                            fontSize = 12.sp,
                                            color = TextSecondary,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.width(8.dp))
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color(0xFFFEF2F2),
                                    border = BorderStroke(1.dp, Color(0xFFFECACA))
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
                            HorizontalDivider(color = BorderLight, thickness = 0.8.dp)
                            Spacer(modifier = Modifier.height(6.dp))

                            // Biometric Quick Lock Row
                            var isBiometricSettingEnabled by remember { mutableStateOf(authManager.isBiometricEnabled) }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(
                                        Icons.Default.Fingerprint,
                                        contentDescription = null,
                                        tint = if (isBiometricSettingEnabled) Emerald600 else TextSecondary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Text(
                                        text = "Khóa ứng dụng bằng Vân tay / PIN",
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = TextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
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
                                        checkedTrackColor = Emerald600,
                                        uncheckedThumbColor = Color.White,
                                        uncheckedTrackColor = BorderLight,
                                        uncheckedBorderColor = BorderLight
                                    )
                                )
                            }
                        }
                    }
                }

                // NHÓM 1: KẾT NỐI & GHÉP NỐI POS
                item {
                    SettingsCategoryHeader(title = "KẾT NỐI & GHÉP NỐI POS")
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentHeight(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, BorderLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .wrapContentHeight()
                        ) {
                            CompactSettingRow(
                                icon = Icons.Default.WifiTethering,
                                iconTint = AvoraRedPrimary,
                                iconBg = Color(0xFFFEF2F2),
                                title = "Trung tâm Kết nối & Giám sát",
                                subtitle = "Kiểm tra socket realtime, test ping, nhật ký kết nối",
                                badgeText = if (isPaired) "ONLINE" else "CHƯA GHÉP",
                                badgeColor = if (isPaired) Emerald600 else Amber600,
                                onClick = onNavigateToConnection
                            )
                            HorizontalDivider(
                                color = BorderLight,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                            CompactSettingRow(
                                icon = Icons.Default.QrCodeScanner,
                                iconTint = AvoraRedPrimary,
                                iconBg = Color(0xFFFEF2F2),
                                title = "Quét mã QR ghép nối nhanh POS",
                                subtitle = "Mở camera quét mã QR trên màn hình POS để liên kết",
                                onClick = onNavigateToQrScanner
                            )
                            HorizontalDivider(
                                color = BorderLight,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                            CompactSettingRow(
                                icon = Icons.Default.Link,
                                iconTint = TextPrimary,
                                iconBg = Color(0xFFF3F4F6),
                                title = "Ghép nối thủ công (Mã Pairing 6 số)",
                                subtitle = if (isPaired) "Đã ghép nối an toàn với avorafnb.com (EC P-256)" else "Chưa ghép nối • Chạm để nhập mã 6 số",
                                badgeText = if (isPaired) "ĐÃ KẾT NỐI" else null,
                                badgeColor = Emerald600,
                                onClick = { showPairingDialog = true }
                            )
                        }
                    }
                }

                // NHÓM 2: CẤU HÌNH NGÂN HÀNG & GIỌNG ĐỌC
                item {
                    SettingsCategoryHeader(title = "CẤU HÌNH NGÂN HÀNG & GIỌNG ĐỌC")
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentHeight(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, BorderLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .wrapContentHeight()
                        ) {
                            CompactSettingRow(
                                icon = Icons.Default.AccountBalance,
                                iconTint = Emerald600,
                                iconBg = Color(0xFFF0FDF4),
                                title = "Cấu hình 20 Ngân hàng & Giọng nói",
                                subtitle = if (bankMode == "ALL") "Theo dõi 20 ngân hàng • Giọng đọc: ${if (voiceEnabled) "Bật" else "Tắt"}" else "Lọc ngân hàng chọn • Giọng đọc: ${if (voiceEnabled) "Bật" else "Tắt"}",
                                badgeText = if (voiceEnabled) "LOA BẬT" else "LOA TẮT",
                                badgeColor = if (voiceEnabled) Emerald600 else TextSecondary,
                                onClick = onNavigateToBankVoiceConfig
                            )
                            HorizontalDivider(
                                color = BorderLight,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                            CompactSettingRow(
                                icon = Icons.Default.Sync,
                                iconTint = Emerald600,
                                iconBg = Color(0xFFF0FDF4),
                                title = "Đồng bộ toàn bộ lịch sử từ VPS",
                                subtitle = if (isSyncingHistory) "Đang đồng bộ dữ liệu từ máy chủ..." else "Khôi phục lịch sử giao dịch từ cơ sở dữ liệu máy chủ",
                                onClick = { syncAllHistoryFromServer() }
                            )
                        }
                    }
                }

                // NHÓM 3: CẬP NHẬT & BẢO TRÌ
                item {
                    val hasNewerUpdate = (remoteVersionMeta?.versionCode ?: 0) > installedAppInfo.versionCode.toInt()
                    SettingsCategoryHeader(title = "CẬP NHẬT & BẢO TRÌ")
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentHeight(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, BorderLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .wrapContentHeight()
                        ) {
                            CompactSettingRow(
                                icon = Icons.Default.SystemUpdate,
                                iconTint = AvoraRedPrimary,
                                iconBg = Color(0xFFFEF2F2),
                                title = "Cập nhật ứng dụng tự động (OTA)",
                                subtitle = if (hasNewerUpdate) {
                                    "Có bản mới v${remoteVersionMeta?.versionName} (Build ${remoteVersionMeta?.versionCode}) • Bấm để cập nhật"
                                } else {
                                    "Đang ở bản mới nhất: v${installedAppInfo.versionName} (Build ${installedAppInfo.versionCode})"
                                },
                                badgeText = if (hasNewerUpdate) "CÓ BẢN MỚI" else "MỚI NHẤT",
                                badgeColor = if (hasNewerUpdate) AvoraRedPrimary else Emerald600,
                                onClick = {
                                    showOtaDialog = true
                                    scope.launch {
                                        isCheckingOtaMeta = true
                                        remoteVersionMeta = OtaUpdateManager.fetchLatestVersionMetadata(context)
                                        isCheckingOtaMeta = false
                                    }
                                }
                            )
                            HorizontalDivider(
                                color = BorderLight,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                            CompactSettingRow(
                                icon = Icons.Default.Speed,
                                iconTint = Amber600,
                                iconBg = Color(0xFFFFFBEB),
                                title = "Chẩn đoán hệ thống & Quyền truy cập",
                                subtitle = "Kiểm tra quyền đọc thông báo và tối ưu pin chạy ngầm 24/7",
                                onClick = onNavigateToDiagnostic
                            )
                        }
                    }
                }

                // NHÓM 4: BẢO MẬT & HỆ THỐNG
                item {
                    SettingsCategoryHeader(title = "BẢO MẬT & HỆ THỐNG")
                    Spacer(modifier = Modifier.height(4.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentHeight(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        border = BorderStroke(1.dp, BorderLight),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .wrapContentHeight()
                        ) {
                            CompactSettingRow(
                                icon = Icons.Default.Lock,
                                iconTint = TextPrimary,
                                iconBg = Color(0xFFF3F4F6),
                                title = "Khóa ứng dụng an toàn ngay",
                                subtitle = "Yêu cầu vân tay hoặc mã PIN máy khi mở lại ứng dụng",
                                onClick = {
                                    authManager.lockApp()
                                    Toast.makeText(context, "Ứng dụng đã được khóa an toàn", Toast.LENGTH_SHORT).show()
                                    onLogout()
                                }
                            )
                            HorizontalDivider(
                                color = BorderLight,
                                thickness = 0.8.dp,
                                modifier = Modifier.padding(horizontal = 16.dp)
                            )
                            CompactSettingRow(
                                icon = Icons.Default.Logout,
                                iconTint = AvoraRedPrimary,
                                iconBg = Color(0xFFFEF2F2),
                                title = "Đăng xuất Quản trị viên",
                                subtitle = "Xóa phiên đăng nhập quản trị khỏi thiết bị này",
                                onClick = { showLogoutConfirmDialog = true }
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "AVORA Bank Connect v${installedAppInfo.versionName} (Build ${installedAppInfo.versionCode}) • Thiết bị: $deviceIdStr\nMáy chủ: https://avorafnb.com",
                        fontSize = 11.sp,
                        color = TextSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }

    // DIALOG 1: GHÉP NỐI THỦ CÔNG
    if (showPairingDialog) {
        AlertDialog(
            onDismissRequest = { showPairingDialog = false },
            containerColor = Color.White,
            titleContentColor = TextPrimary,
            textContentColor = TextSecondary,
            shape = RoundedCornerShape(14.dp),
            tonalElevation = 0.dp,
            title = {
                Text(
                    text = if (isPaired) "TRẠNG THÁI GHÉP NỐI GATEWAY" else "GHÉP NỐI VỚI AVORA POS",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = TextPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (isPaired) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color.White,
                            border = BorderStroke(1.dp, Emerald600),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Emerald600)
                                Spacer(modifier = Modifier.width(8.dp))
                                Column {
                                    Text(
                                        "Đã ghép nối an toàn với máy chủ",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.5.sp,
                                        color = Emerald600
                                    )
                                    Text(
                                        "Khóa bảo mật EC P-256 đang hoạt động 24/7",
                                        fontSize = 11.5.sp,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                        Text(
                            "Bạn có thể thu hồi ghép nối nếu muốn đổi máy chủ hoặc hủy cấp quyền thiết bị này.",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                    } else {
                        Text(
                            "Nhập mã Pairing gồm 6 ký tự được tạo từ Web Admin (Menu Cài đặt -> Bank Connect) để liên kết thiết bị:",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                        OutlinedTextField(
                            value = pairingCodeInput,
                            onValueChange = { pairingCodeInput = it.uppercase() },
                            placeholder = { Text("VD: K9W4M2", color = TextSecondary) },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            textStyle = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 2.sp,
                                fontFamily = FontFamily.Monospace,
                                color = TextPrimary
                            ),
                            shape = RoundedCornerShape(10.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color.White,
                                unfocusedContainerColor = Color.White,
                                focusedBorderColor = AvoraRedPrimary,
                                unfocusedBorderColor = BorderLight
                            )
                        )
                    }
                }
            },
            confirmButton = {
                if (isPaired) {
                    Button(
                        onClick = { handleRevoke() },
                        colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Thu hồi liên kết", fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Color.White)
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
                            Text("Xác nhận ghép nối", fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Color.White)
                        }
                    }
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showPairingDialog = false },
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, BorderLight)
                ) {
                    Text("Đóng", color = TextPrimary)
                }
            }
        )
    }

    // DIALOG 2: CẬP NHẬT ỨNG DỤNG OTA CHUẨN XÁC THỰC SHA-256
    if (showOtaDialog) {
        val serverVerName = remoteVersionMeta?.versionName ?: installedAppInfo.versionName
        val serverVerCode = remoteVersionMeta?.versionCode ?: installedAppInfo.versionCode.toInt()
        val hasNewUpdate = !isCheckingOtaMeta && remoteVersionMeta != null && serverVerCode > installedAppInfo.versionCode.toInt()
        val serverSizeMb = if ((remoteVersionMeta?.fileSize ?: 0L) > 0L) {
            String.format(Locale.US, "%.2f MB", remoteVersionMeta!!.fileSize / (1024.0 * 1024.0))
        } else {
            "~14.5 MB"
        }
        val shortSha = remoteVersionMeta?.sha256?.take(16)?.ifBlank { "Đang kiểm tra..." } ?: "Đang kiểm tra..."

        AlertDialog(
            onDismissRequest = { if (!isOtaDownloading) showOtaDialog = false },
            containerColor = Color.White,
            titleContentColor = TextPrimary,
            textContentColor = TextSecondary,
            shape = RoundedCornerShape(14.dp),
            tonalElevation = 0.dp,
            title = {
                Text(
                    text = if (hasNewUpdate) "CÓ BẢN CẬP NHẬT MỚI (OTA)" else "KIỂM TRA CẬP NHẬT (OTA)",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = TextPrimary
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White,
                        border = BorderStroke(1.dp, BorderLight),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = "Phiên bản đang cài: v${installedAppInfo.versionName} (Build ${installedAppInfo.versionCode})",
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                            Text(
                                text = "Phiên bản máy chủ: v$serverVerName (Build $serverVerCode)",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Dung lượng: $serverSizeMb • SHA-256: $shortSha...",
                                fontSize = 11.sp,
                                color = TextSecondary,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    if (isCheckingOtaMeta) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(vertical = 4.dp)
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = AvoraRedPrimary
                            )
                            Text(
                                text = "Đang kiểm tra phiên bản mới nhất từ máy chủ...",
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                        }
                    } else if (!hasNewUpdate) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFF0FDF4),
                            border = BorderStroke(1.dp, Emerald600),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = null,
                                    tint = Emerald600,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "Ứng dụng của bạn đang ở phiên bản mới nhất v${installedAppInfo.versionName} (Build ${installedAppInfo.versionCode}). Không cần tải & cài đặt thêm.",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Emerald600,
                                    lineHeight = 17.sp
                                )
                            }
                        }
                    } else {
                        Text(
                            text = remoteVersionMeta?.releaseNotes
                                ?: "Tải bản phát hành chính thức từ máy chủ AVORA, tự động đối chiếu VersionCode, chữ ký số và mã băm SHA-256 trước khi mở bộ cài đặt hệ thống Android (giữ nguyên 100% dữ liệu ghép nối).",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 17.sp
                        )
                    }

                    if (isOtaDownloading) {
                        Spacer(modifier = Modifier.height(2.dp))
                        LinearProgressIndicator(
                            progress = { otaProgress / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp),
                            color = AvoraRedPrimary,
                            trackColor = BorderLight
                        )
                        Text(
                            text = if (otaStatusText.isNotBlank()) "$otaStatusText ($otaProgress%)" else "Đang tải bản cập nhật: $otaProgress%...",
                            fontSize = 11.5.sp,
                            color = AvoraRedPrimary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            },
            confirmButton = {
                if (hasNewUpdate) {
                    Button(
                        onClick = {
                            isOtaDownloading = true
                            otaProgress = 0
                            otaStatusText = "Đang kiểm tra metadata..."
                            scope.launch {
                                val ok = OtaUpdateManager.downloadAndInstall(
                                    context = context,
                                    allowReinstallSameVersion = false,
                                    onProgress = { otaProgress = it },
                                    onStatusText = { otaStatusText = it },
                                    onError = {
                                        isOtaDownloading = false
                                        otaStatusText = ""
                                        Toast.makeText(context, it, Toast.LENGTH_LONG).show()
                                    }
                                )
                                isOtaDownloading = false
                                if (ok) {
                                    showOtaDialog = false
                                }
                            }
                        },
                        enabled = !isOtaDownloading,
                        colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (isOtaDownloading) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Tải & Cài đặt ngay", fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Color.White)
                        }
                    }
                }
            },
            dismissButton = {
                if (!isOtaDownloading) {
                    OutlinedButton(
                        onClick = { showOtaDialog = false },
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, BorderLight)
                    ) {
                        Text("Đóng", color = TextPrimary)
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
            titleContentColor = TextPrimary,
            textContentColor = TextSecondary,
            shape = RoundedCornerShape(14.dp),
            tonalElevation = 0.dp,
            title = {
                Text(text = "XÁC NHẬN ĐĂNG XUẤT", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
            },
            text = {
                Text(
                    text = "Bạn có chắc chắn muốn đăng xuất khỏi tài khoản Quản trị viên? Dữ liệu ghép nối POS và lịch sử giao dịch vẫn được giữ nguyên an toàn.",
                    fontSize = 12.5.sp,
                    color = TextSecondary,
                    lineHeight = 18.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutConfirmDialog = false
                        handleLogoutClick()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Đăng xuất", fontWeight = FontWeight.Bold, fontSize = 12.5.sp, color = Color.White)
                }
            },
            dismissButton = {
                OutlinedButton(
                    onClick = { showLogoutConfirmDialog = false },
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, BorderLight)
                ) {
                    Text("Hủy", color = TextPrimary)
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
    badgeColor: Color = AvoraRedPrimary,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = iconBg,
            modifier = Modifier.size(34.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(
            modifier = Modifier
                .weight(1f)
                .wrapContentHeight()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = title,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (badgeText != null) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = badgeColor.copy(alpha = 0.12f)
                    ) {
                        Text(
                            text = badgeText,
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = badgeColor,
                            maxLines = 1,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.5.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                fontSize = 11.5.sp,
                color = TextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextSecondary,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
fun SettingsCategoryHeader(title: String) {
    Text(
        text = title,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = TextSecondary,
        letterSpacing = 0.6.sp,
        modifier = Modifier.padding(start = 4.dp, top = 4.dp, bottom = 2.dp)
    )
}
