package vn.avora.bankconnect

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
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
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.auth.BiometricAuthManager
import vn.avora.bankconnect.ui.screens.*
import vn.avora.bankconnect.ui.theme.AvoraBankTheme
import vn.avora.bankconnect.ui.theme.AvoraRedPrimary

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
                val isLocked by isAppLockedState

                if (isLocked && authManager.isLoggedIn && authManager.isBiometricEnabled) {
                    // Biometric Lock Screen Overlay
                    AppLockOverlay(
                        activity = this,
                        onUnlock = { isAppLockedState.value = false },
                        onLogout = {
                            authManager.clearSession()
                            isAppLockedState.value = false
                        }
                    )
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
                    val startDestination = if (authManager.isLoggedIn && authManager.isAdmin()) Screen.Dashboard.route else "login"

                    Scaffold(
                        modifier = Modifier.fillMaxSize(),
                        contentWindowInsets = WindowInsets(0, 0, 0, 0),
                        bottomBar = {
                            if (showBottomBar) {
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
                                                unselectedIconColor = Color(0xFF94A3B8),
                                                unselectedTextColor = Color(0xFF94A3B8),
                                                indicatorColor = Color.Transparent
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    ) { innerPadding ->
                        NavHost(
                            navController = navController,
                            startDestination = startDestination,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(bottom = innerPadding.calculateBottomPadding())
                        ) {
                            // 1. Admin Login Screen
                            composable("login") {
                                AdminLoginScreen(
                                    onLoginSuccess = {
                                        isAppLockedState.value = false
                                        navController.navigate(Screen.Dashboard.route) {
                                            popUpTo("login") { inclusive = true }
                                        }
                                    }
                                )
                            }

                            // 2. Main Tabs
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
                                        navController.navigate("login") {
                                            popUpTo(0) { inclusive = true }
                                        }
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

                            // 3. Camera QR Scanner Screen
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

                            // 4. Order Detail Screen
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
            }
        }
    }

    override fun onResume() {
        super.onResume()
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
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF14171F), Color(0xFF0F1117))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(Color(0xFF1E222D), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    tint = AvoraRedPrimary,
                    modifier = Modifier.size(36.dp)
                )
            }

            Spacer(modifier = Modifier.height(20.dp))

            Text(
                text = "ỨNG DỤNG ĐANG ĐƯỢC KHÓA",
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Vui lòng xác thực sinh trắc học hoặc PIN thiết bị để tiếp tục truy cập dữ liệu biến động số dư.",
                fontSize = 12.sp,
                color = Color(0xFF94A3B8),
                textAlign = TextAlign.Center,
                lineHeight = 17.sp
            )

            Spacer(modifier = Modifier.height(28.dp))

            Button(
                onClick = { triggerPrompt() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E))
            ) {
                Icon(Icons.Default.Fingerprint, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Mở khóa bằng Vân tay / PIN", fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }

            Spacer(modifier = Modifier.height(12.dp))

            TextButton(onClick = onLogout) {
                Text("Đăng xuất tài khoản", color = Color(0xFF94A3B8), fontSize = 12.sp)
            }
        }
    }
}
