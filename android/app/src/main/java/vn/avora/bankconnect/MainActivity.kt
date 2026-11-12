package vn.avora.bankconnect

import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.auth.BiometricAuthManager
import vn.avora.bankconnect.core.crypto.KeyStoreManager
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.network.AppVersionData
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.PairRequest
import vn.avora.bankconnect.core.service.BankGatewaySocketManager
import vn.avora.bankconnect.core.service.BankNotificationListenerService
import vn.avora.bankconnect.core.update.OtaUpdateManager
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.screens.*
import vn.avora.bankconnect.ui.theme.*
import java.util.Locale
import java.util.UUID

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Dashboard : Screen("dashboard", "Tổng quan", Icons.Default.Dashboard)
    object History : Screen("history", "Biến động", Icons.Default.ReceiptLong)
    object ShiftAudit : Screen("shift_audit", "Đối soát", Icons.Default.Assessment)
    object Orders : Screen("orders", "Đơn hàng", Icons.Default.List)
    object Connection : Screen("connection", "Kết nối", Icons.Default.WifiTethering)
    object Settings : Screen("settings", "Cài đặt", Icons.Default.Settings)
    object Diagnostic : Screen("diagnostic", "Chẩn đoán", Icons.Default.Settings)
}

class MainActivity : FragmentActivity() {

    private lateinit var authManager: AuthManager
    private val isAppLockedState = mutableStateOf(false)
    private val resumeCheckCounter = mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        authManager = AuthManager.getInstance(applicationContext)

        // BẢO VỆ NGHIÊM NGẶT: CHỈ QUYỀN ADMIN / SUPER_ADMIN MỚI ĐƯỢC PHÉP TRUY CẬP
        if (authManager.isLoggedIn && !authManager.isAdmin()) {
            authManager.clearSession()
        }

        if (authManager.isLoggedIn && authManager.isBiometricEnabled && authManager.isAppLocked()) {
            isAppLockedState.value = true
        }

        setContent {
            AvoraBankTheme {
                val context = LocalContext.current
                val db = remember { AppDatabase.getInstance(context) }
                val scope = rememberCoroutineScope()
                val installedAppInfo = remember { OtaUpdateManager.getInstalledAppInfo(context) }

                val isLocked by isAppLockedState
                val resumeTick by resumeCheckCounter
                var isAdminAuthenticated by remember {
                    mutableStateOf(authManager.isLoggedIn && authManager.isAdmin())
                }

                // Quan sát trạng thái ghép nối trực tiếp từ Room DB (mặc định false nếu chưa có bản ghi)
                val isPairedStr by db.configDao().getFlow("is_paired").collectAsState(initial = "false")
                val revokedReasonStr by db.configDao().getFlow("revoked_reason").collectAsState(initial = "")
                val deviceIdStr by db.configDao().getFlow("device_id").collectAsState(initial = "and-gateway")
                val isPaired = isPairedStr == "true"

                // YÊU CẦU 1: Tự động kiểm tra bản cập nhật mới khi mở ứng dụng và hiển thị Modal yêu cầu cập nhật
                var startupUpdateMeta by remember { mutableStateOf<AppVersionData?>(null) }
                var showStartupUpdateModal by remember { mutableStateOf(false) }
                var isStartupOtaDownloading by remember { mutableStateOf(false) }
                var startupOtaProgress by remember { mutableStateOf(0) }
                var startupOtaStatusText by remember { mutableStateOf("") }

                LaunchedEffect(Unit) {
                    val meta = OtaUpdateManager.fetchLatestVersionMetadata(context)
                    if (meta != null && meta.versionCode.toLong() > installedAppInfo.versionCode) {
                        startupUpdateMeta = meta
                        showStartupUpdateModal = true
                    }
                }

                // YÊU CẦU 3: Mỗi khi vào app hoặc resume, đối chiếu trạng thái thiết bị thực tế trên máy chủ.
                // Nếu đã bị Thu hồi (REVOKED) trên /admin/bank-connect -> khóa quyền vào app & ngắt đọc thông báo ngay lập tức!
                LaunchedEffect(isPaired, resumeTick) {
                    if (isPaired) {
                        try {
                            val api = NetworkClient.getApiService(context)
                            val res = api.getDeviceStatus()
                            if (res.code() == 401 || res.code() == 403) {
                                BankNotificationListenerService.handleDeviceRevokedOrUnpaired(
                                    context,
                                    "Thiết bị đã bị Quản trị viên thu hồi liên kết trên /admin/bank-connect. Vui lòng ghép nối lại."
                                )
                            } else if (res.isSuccessful && res.body() != null) {
                                val serverStatus = res.body()!!.status
                                if (!serverStatus.equals("ACTIVE", ignoreCase = true)) {
                                    BankNotificationListenerService.handleDeviceRevokedOrUnpaired(
                                        context,
                                        "Trạng thái thiết bị trên máy chủ là $serverStatus. Vui lòng ghép nối lại trên /admin/bank-connect."
                                    )
                                } else {
                                    BankGatewaySocketManager.initialize(context)
                                }
                            }
                        } catch (_: Exception) {
                            // Bỏ qua lỗi mạng tạm thời khi offline
                        }
                    }
                }

                if (isLocked && isAdminAuthenticated && authManager.isBiometricEnabled) {
                    // Biometric Lock Screen Overlay
                    AppLockOverlay(
                        activity = this,
                        onUnlock = { isAppLockedState.value = false },
                        onLogout = {
                            authManager.clearSession()
                            isAdminAuthenticated = false
                            isAppLockedState.value = false
                        }
                    )
                } else if (!isAdminAuthenticated) {
                    // Chưa đăng nhập Admin -> hiển thị màn hình đăng nhập
                    AdminLoginScreen(
                        onLoginSuccess = {
                            isAppLockedState.value = false
                            isAdminAuthenticated = true
                        }
                    )
                } else if (!isPaired) {
                    // YÊU CẦU 2 & 3: Khi chưa ghép nối hoặc vừa bị thu hồi trên /admin/bank-connect,
                    // BẮT BUỘC phải ghép nối trên /admin/bank-connect trước mới cho phép sử dụng các tính năng trong app!
                    var isScanningQrInGate by remember { mutableStateOf(false) }

                    if (isScanningQrInGate) {
                        QrScannerScreen(
                            onNavigateBack = { isScanningQrInGate = false },
                            onPairingSuccess = { isScanningQrInGate = false },
                            onManualInput = { isScanningQrInGate = false }
                        )
                    } else {
                        MandatoryPairingGateScreen(
                            deviceId = deviceIdStr ?: "and-gateway",
                            installedVersionName = installedAppInfo.versionName,
                            revokedReason = revokedReasonStr.orEmpty(),
                            onOpenQrScanner = { isScanningQrInGate = true },
                            onLogout = {
                                authManager.clearSession()
                                isAdminAuthenticated = false
                            }
                        )
                    }
                } else {
                    val navController = rememberNavController()
                    val navBackStackEntry by navController.currentBackStackEntryAsState()
                    val currentRoute = navBackStackEntry?.destination?.route

                    val bottomNavItems = listOf(
                        Screen.Dashboard,
                        Screen.History,
                        Screen.ShiftAudit,
                        Screen.Orders,
                        Screen.Settings
                    )

                    val showBottomBar = currentRoute in bottomNavItems.map { it.route }

                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        containerColor = Color.White,
                        contentWindowInsets = WindowInsets(0, 0, 0, 0),
                        bottomBar = {
                            if (showBottomBar) {
                                Column(modifier = Modifier.background(Color.White)) {
                                    HorizontalDivider(color = BorderLight, thickness = 1.dp)
                                    NavigationBar(
                                        containerColor = Color.White,
                                        tonalElevation = 0.dp
                                    ) {
                                        bottomNavItems.forEach { screen ->
                                            val isSelected = currentRoute == screen.route
                                            NavigationBarItem(
                                                icon = { Icon(screen.icon, contentDescription = screen.title) },
                                                label = {
                                                    Text(
                                                        screen.title,
                                                        fontSize = 11.sp,
                                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                                                    )
                                                },
                                                selected = isSelected,
                                                onClick = {
                                                    if (currentRoute != screen.route) {
                                                        navController.navigate(screen.route) {
                                                            popUpTo(Screen.Dashboard.route) {
                                                                saveState = true
                                                            }
                                                            launchSingleTop = true
                                                            restoreState = true
                                                        }
                                                    }
                                                },
                                                colors = NavigationBarItemDefaults.colors(
                                                    selectedIconColor = AvoraRedPrimary,
                                                    selectedTextColor = AvoraRedPrimary,
                                                    unselectedIconColor = TextSecondary,
                                                    unselectedTextColor = TextSecondary,
                                                    indicatorColor = Color.Transparent
                                                )
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    ) { innerPadding ->
                        NavHost(
                            navController = navController,
                            startDestination = Screen.Dashboard.route,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(bottom = innerPadding.calculateBottomPadding())
                        ) {
                            composable(Screen.Dashboard.route) {
                                DashboardScreen(
                                    onNavigateToHistory = { navController.navigate(Screen.History.route) },
                                    onNavigateToSettings = { navController.navigate(Screen.Settings.route) }
                                )
                            }

                            composable(Screen.History.route) {
                                TransactionHistoryScreen(
                                    onNavigateToOrderDetail = { orderId ->
                                        navController.navigate("order_detail/$orderId")
                                    }
                                )
                            }

                            composable(Screen.ShiftAudit.route) {
                                ShiftAuditScreen(
                                    onNavigateBack = { navController.popBackStack() }
                                )
                            }

                            composable(Screen.Orders.route) {
                                CompletedOrdersScreen(
                                    onNavigateToOrderDetail = { orderId ->
                                        navController.navigate("order_detail/$orderId")
                                    }
                                )
                            }

                            composable(Screen.Connection.route) {
                                ConnectionCenterScreen(
                                    onNavigateBack = { navController.popBackStack() }
                                )
                            }

                            composable(Screen.Settings.route) {
                                DeviceSettingsScreen(
                                    onNavigateToDiagnostic = { navController.navigate(Screen.Diagnostic.route) },
                                    onNavigateToQrScanner = { navController.navigate("qr_scanner") },
                                    onNavigateToConnection = { navController.navigate(Screen.Connection.route) },
                                    onNavigateToBankVoiceConfig = { navController.navigate("bank_voice_config") },
                                    onLogout = {
                                        authManager.clearSession()
                                        isAdminAuthenticated = false
                                    }
                                )
                            }

                            composable("bank_voice_config") {
                                BankVoiceConfigScreen(
                                    onNavigateBack = { navController.popBackStack() }
                                )
                            }

                            composable(Screen.Diagnostic.route) {
                                DiagnosticScreen(
                                    onNavigateBack = { navController.popBackStack() }
                                )
                            }

                            composable("qr_scanner") {
                                QrScannerScreen(
                                    onNavigateBack = { navController.popBackStack() },
                                    onPairingSuccess = {
                                        navController.navigate(Screen.Dashboard.route) {
                                            popUpTo(Screen.Dashboard.route) { inclusive = true }
                                        }
                                    },
                                    onManualInput = {
                                        navController.navigate(Screen.Settings.route) {
                                            popUpTo(Screen.Settings.route) { inclusive = true }
                                        }
                                    }
                                )
                            }

                            composable(
                                route = "order_detail/{orderId}",
                                arguments = listOf(navArgument("orderId") { type = NavType.StringType })
                            ) { backStackEntry ->
                                val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
                                OrderDetailScreen(
                                    orderId = orderId,
                                    onNavigateBack = { navController.popBackStack() }
                                )
                            }
                        }
                    }
                }

                // MODAL TỰ ĐỘNG THÔNG BÁO CẬP NHẬT KHI VÀO APP (YÊU CẦU 1)
                if (showStartupUpdateModal && startupUpdateMeta != null) {
                    val meta = startupUpdateMeta!!
                    val sizeMb = if (meta.fileSize > 0L) {
                        String.format(Locale.US, "%.2f MB", meta.fileSize / (1024.0 * 1024.0))
                    } else {
                        "~14.5 MB"
                    }
                    AlertDialog(
                        onDismissRequest = {
                            if (!isStartupOtaDownloading) {
                                showStartupUpdateModal = false
                            }
                        },
                        containerColor = Color.White,
                        titleContentColor = TextPrimary,
                        textContentColor = TextSecondary,
                        shape = RoundedCornerShape(14.dp),
                        tonalElevation = 0.dp,
                        title = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFFFEF2F2),
                                    modifier = Modifier.size(34.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = Icons.Default.SystemUpdate,
                                            contentDescription = null,
                                            tint = AvoraRedPrimary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "CÓ BẢN CẬP NHẬT MỚI v${meta.versionName}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = TextPrimary
                                )
                            }
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
                                            text = "Đang cài đặt: v${installedAppInfo.versionName} (Build ${installedAppInfo.versionCode})",
                                            fontSize = 12.sp,
                                            color = TextSecondary
                                        )
                                        Text(
                                            text = "Bản mới nhất: v${meta.versionName} (Build ${meta.versionCode}) • $sizeMb",
                                            fontSize = 12.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = AvoraRedPrimary
                                        )
                                    }
                                }

                                Text(
                                    text = if (meta.releaseNotes.isNullOrBlank()) {
                                        "Đã có phiên bản AVORA Bank Connect mới trên máy chủ. Vui lòng cập nhật ngay để đảm bảo đồng bộ biến động số dư ổn định và an toàn nhất."
                                    } else {
                                        meta.releaseNotes
                                    },
                                    fontSize = 12.sp,
                                    color = TextSecondary,
                                    lineHeight = 17.sp
                                )

                                if (isStartupOtaDownloading) {
                                    LinearProgressIndicator(
                                        progress = { startupOtaProgress / 100f },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(6.dp),
                                        color = AvoraRedPrimary,
                                        trackColor = BorderLight
                                    )
                                    Text(
                                        text = if (startupOtaStatusText.isNotBlank()) {
                                            "$startupOtaStatusText ($startupOtaProgress%)"
                                        } else {
                                            "Đang tải gói cập nhật: $startupOtaProgress%..."
                                        },
                                        fontSize = 11.5.sp,
                                        color = AvoraRedPrimary,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        },
                        confirmButton = {
                            Button(
                                onClick = {
                                    isStartupOtaDownloading = true
                                    startupOtaProgress = 0
                                    startupOtaStatusText = "Đang kiểm tra gói cài đặt..."
                                    scope.launch {
                                        val ok = OtaUpdateManager.downloadAndInstall(
                                            context = context,
                                            downloadUrl = meta.downloadUrl.ifBlank { "https://avorafnb.com/api/bank-connect/v1/app/download-latest" },
                                            allowReinstallSameVersion = false,
                                            onProgress = { startupOtaProgress = it },
                                            onStatusText = { startupOtaStatusText = it },
                                            onError = { err ->
                                                isStartupOtaDownloading = false
                                                startupOtaStatusText = ""
                                                Toast.makeText(context, err, Toast.LENGTH_LONG).show()
                                            }
                                        )
                                        isStartupOtaDownloading = false
                                        if (ok) {
                                            showStartupUpdateModal = false
                                        }
                                    }
                                },
                                enabled = !isStartupOtaDownloading,
                                colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                if (isStartupOtaDownloading) {
                                    CircularProgressIndicator(
                                        color = Color.White,
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp
                                    )
                                } else {
                                    Text(
                                        text = "Cập nhật ngay",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.5.sp,
                                        color = Color.White
                                    )
                                }
                            }
                        },
                        dismissButton = {
                            if (!isStartupOtaDownloading) {
                                OutlinedButton(
                                    onClick = { showStartupUpdateModal = false },
                                    shape = RoundedCornerShape(8.dp),
                                    border = BorderStroke(1.dp, BorderLight)
                                ) {
                                    Text("Để sau", color = TextPrimary)
                                }
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        resumeCheckCounter.value = resumeCheckCounter.value + 1
        if (::authManager.isInitialized && authManager.checkShouldLockOnResume()) {
            isAppLockedState.value = true
        }
    }

    override fun onPause() {
        super.onPause()
        if (::authManager.isInitialized) {
            authManager.recordActivity()
        }
    }
}

@Composable
fun MandatoryPairingGateScreen(
    deviceId: String,
    installedVersionName: String,
    revokedReason: String,
    onOpenQrScanner: () -> Unit,
    onLogout: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var pairingCodeInput by remember { mutableStateOf("") }
    var isPairingLoading by remember { mutableStateOf(false) }

    fun handleManualPair() {
        if (pairingCodeInput.trim().length < 6) {
            Toast.makeText(context, "Vui lòng nhập đủ mã ghép nối 6 ký tự từ /admin/bank-connect", Toast.LENGTH_SHORT).show()
            return
        }
        scope.launch {
            isPairingLoading = true
            try {
                val actualDeviceId = db.configDao().get("device_id") ?: "and-${UUID.randomUUID().toString().take(18)}"
                val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"
                val publicKeyPem = KeyStoreManager.exportPublicKeyPem()

                val api = NetworkClient.getApiService(context)
                val req = PairRequest(
                    pairingCode = pairingCodeInput.trim().uppercase(),
                    deviceId = actualDeviceId,
                    deviceName = deviceName,
                    appVersion = installedVersionName,
                    publicKeyPem = publicKeyPem
                )

                val res = api.pairDevice(req)
                if (res.isSuccessful && res.body()?.success == true) {
                    val body = res.body()!!
                    db.configDao().set(ConfigEntity("is_paired", "true"))
                    db.configDao().set(ConfigEntity("revoked_reason", ""))
                    db.configDao().set(ConfigEntity("device_id", body.deviceId))
                    db.configDao().set(ConfigEntity("paired_at", body.pairedAt))
                    db.configDao().set(ConfigEntity("device_name", deviceName))
                    BankGatewaySocketManager.initialize(context)
                    Toast.makeText(context, "Ghép nối thiết bị thành công! Đang mở ứng dụng...", Toast.LENGTH_LONG).show()
                    pairingCodeInput = ""
                } else {
                    val err = res.errorBody()?.string() ?: "Mã ghép nối không hợp lệ hoặc đã hết hạn (5 phút)"
                    Toast.makeText(context, "Lỗi ghép nối: $err", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Lỗi kết nối máy chủ: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                isPairingLoading = false
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        AvoraTopHeader(
            title = "Yêu cầu ghép nối Gateway",
            subtitle = "Bắt buộc liên kết trên /admin/bank-connect trước khi sử dụng"
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            if (revokedReason.isNotBlank()) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFFEF2F2),
                    border = BorderStroke(1.dp, Color(0xFFFECACA)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Icon(
                            imageVector = Icons.Default.GppBad,
                            contentDescription = null,
                            tint = AvoraRedPrimary,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = "THIẾT BỊ ĐÃ BỊ THU HỒI QUYỀN TRUY CẬP",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = AvoraRedPrimary
                            )
                            Text(
                                text = revokedReason,
                                fontSize = 12.sp,
                                color = TextPrimary,
                                lineHeight = 17.sp
                            )
                            Text(
                                text = "Chức năng đọc thông báo biến động số dư và giọng nói đã được ngắt tự động. Vui lòng tạo mã ghép nối mới trên /admin/bank-connect để kích hoạt lại.",
                                fontSize = 11.5.sp,
                                color = TextSecondary,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, BorderLight),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = Color(0xFFFEF2F2),
                            modifier = Modifier.size(40.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.PhonelinkLock,
                                    contentDescription = null,
                                    tint = AvoraRedPrimary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "Chưa ghép nối với AVORA POS",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Thiết bị: $deviceId • v$installedVersionName",
                                fontSize = 11.5.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    HorizontalDivider(color = BorderLight, thickness = 0.8.dp)

                    Text(
                        text = "Để bảo mật tuyệt đối và sử dụng các tính năng đọc biến động số dư, đối soát ca và đơn hàng, bạn bắt buộc phải ghép nối thiết bị này trên trang Quản trị:",
                        fontSize = 12.5.sp,
                        color = TextSecondary,
                        lineHeight = 18.sp
                    )

                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = Color(0xFFF9FAFB),
                        border = BorderStroke(1.dp, BorderLight),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "1. Truy cập https://avorafnb.com/admin/bank-connect",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "2. Bấm nút \"Ghép nối Android mới\" ở góc phải màn hình",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            Text(
                                text = "3. Quét mã QR hoặc nhập mã Pairing 6 ký tự bên dưới",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                        }
                    }

                    Button(
                        onClick = onOpenQrScanner,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary)
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Quét mã QR từ /admin/bank-connect",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = Color.White
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 2.dp)
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = BorderLight)
                        Text(
                            text = "  HOẶC NHẬP MÃ 6 KÝ TỰ  ",
                            fontSize = 10.5.sp,
                            color = TextSecondary,
                            fontWeight = FontWeight.Bold
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f), color = BorderLight)
                    }

                    OutlinedTextField(
                        value = pairingCodeInput,
                        onValueChange = { if (it.length <= 8) pairingCodeInput = it.uppercase() },
                        placeholder = { Text("Nhập mã Pairing 6 số (VD: K9W4M2)", color = TextSecondary, fontSize = 13.sp) },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.titleMedium.copy(
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

                    OutlinedButton(
                        onClick = { handleManualPair() },
                        enabled = !isPairingLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, AvoraRedPrimary),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0xFFFEF2F2))
                    ) {
                        if (isPairingLoading) {
                            CircularProgressIndicator(
                                color = AvoraRedPrimary,
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.Link,
                                contentDescription = null,
                                tint = AvoraRedPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Xác nhận ghép nối bằng mã 6 số",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = AvoraRedPrimary
                            )
                        }
                    }
                }
            }

            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, BorderLight),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = Color.White)
            ) {
                Icon(
                    imageVector = Icons.Default.Logout,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Đăng xuất tài khoản Quản trị viên",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = TextSecondary
                )
            }
        }
    }
}

@Composable
fun AppLockOverlay(
    activity: FragmentActivity,
    onUnlock: () -> Unit,
    onLogout: () -> Unit
) {
    fun triggerPrompt() {
        BiometricAuthManager.showBiometricPrompt(
            activity = activity,
            title = "Mở khóa AVORA Bank Connect",
            subtitle = "Xác thực sinh trắc học hoặc PIN thiết bị",
            onSuccess = onUnlock,
            onError = { _, _ -> },
            onCancel = {}
        )
    }

    LaunchedEffect(Unit) {
        triggerPrompt()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            border = BorderStroke(1.dp, BorderLight)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(28.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(68.dp)
                        .background(Color(0xFFFEF2F2), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = AvoraRedPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = "ỨNG DỤNG ĐANG ĐƯỢC KHÓA",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    letterSpacing = 0.5.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Vui lòng xác thực sinh trắc học hoặc PIN thiết bị để tiếp tục truy cập dữ liệu biến động số dư.",
                    fontSize = 12.5.sp,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = { triggerPrompt() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary)
                ) {
                    Icon(Icons.Default.Fingerprint, contentDescription = null, modifier = Modifier.size(20.dp), tint = Color.White)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Mở khóa bằng Vân tay / PIN", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color.White)
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(onClick = onLogout) {
                    Text("Đăng xuất tài khoản", color = TextSecondary, fontSize = 12.5.sp)
                }
            }
        }
    }
}
