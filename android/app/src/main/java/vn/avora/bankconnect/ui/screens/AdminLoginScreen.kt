package vn.avora.bankconnect.ui.screens

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.FragmentActivity
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.launch
import vn.avora.bankconnect.R
import vn.avora.bankconnect.core.auth.AuthManager
import vn.avora.bankconnect.core.auth.AuthUser
import vn.avora.bankconnect.core.auth.BiometricAuthManager
import vn.avora.bankconnect.core.network.GoogleVerifyRequest
import vn.avora.bankconnect.core.network.LoginRequest
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.QuickLoginRequest
import vn.avora.bankconnect.ui.theme.AvoraRedPrimary

@Composable
fun AdminLoginScreen(
    onLoginSuccess: () -> Unit
) {
    val context = LocalContext.current
    val focusManager = LocalFocusManager.current
    val coroutineScope = rememberCoroutineScope()

    var emailOrPhone by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isPasswordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val authManager = remember { AuthManager.getInstance(context) }
    val isBiometricAvailable = remember { BiometricAuthManager.isAvailable(context) }
    val hasPriorAdmin = authManager.hasPreviousAdminLogin && !authManager.lastAdminEmail.isNullOrBlank()
    val canUseBiometric = hasPriorAdmin && isBiometricAvailable && authManager.isBiometricEnabled

    // Google Sign-In Setup (Web Client ID from backend)
    val googleWebClientId = "13079540543-14tec9eo9kecs7q3jpjq33j1hj2cs14h.apps.googleusercontent.com"
    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(googleWebClientId)
            .requestEmail()
            .build()
    }
    val googleSignInClient = remember { GoogleSignIn.getClient(context, gso) }

    // ĐĂNG NHẬP NHANH ADMIN: CHỈ ÁP DỤNG KHI TRƯỚC ĐÓ CÓ TỪNG LOGIN TÀI KHOẢN ADMIN RỒI
    fun performQuickAdminLoginWithBiometric(adminEmail: String? = null) {
        val targetEmail = adminEmail ?: authManager.lastAdminEmail
        if (!authManager.hasPreviousAdminLogin || targetEmail.isNullOrBlank()) {
            Toast.makeText(
                context,
                "Chưa có tài khoản Quản trị viên nào từng đăng nhập trên thiết bị. Vui lòng đăng nhập bằng Email/Mật khẩu hoặc Google lần đầu tiên!",
                Toast.LENGTH_LONG
            ).show()
            errorMessage = "Yêu cầu đăng nhập tài khoản Quản trị viên lần đầu tiên trước khi dùng vân tay."
            return
        }

        focusManager.clearFocus()
        val fragmentActivity = context as? FragmentActivity
        if (fragmentActivity == null) {
            Toast.makeText(context, "Thiết bị không hỗ trợ Activity xác thực sinh trắc học", Toast.LENGTH_SHORT).show()
            return
        }

        if (!BiometricAuthManager.isAvailable(context)) {
            Toast.makeText(context, "Vui lòng cài đặt khóa màn hình vân tay hoặc mã PIN trên máy để sử dụng tính năng này", Toast.LENGTH_LONG).show()
            return
        }

        BiometricAuthManager.showBiometricPrompt(
            activity = fragmentActivity,
            title = "Xác thực Quản trị viên AVORA",
            subtitle = "Sử dụng vân tay hoặc mật mã thiết bị để mở khóa",
            description = "Xác nhận danh tính Quản trị viên ($targetEmail) trước khi đăng nhập quyền Admin",
            onSuccess = {
                // Đã vượt qua vân tay / mã máy thành công -> Tiến hành cấp phiên Admin
                isLoading = true
                errorMessage = null
                coroutineScope.launch {
                    try {
                        val api = NetworkClient.getApiService(context)
                        val response = api.quickAdminLogin(QuickLoginRequest(targetEmail))

                        if (response.isSuccessful && response.body() != null) {
                            val body = response.body()!!
                            val token = body.accessToken ?: body.token
                            val user = body.user

                            if (token.isNullOrBlank() || user == null) {
                                errorMessage = "Không thể tạo phiên đăng nhập Quản trị viên."
                                isLoading = false
                                return@launch
                            }

                            val role = user.role.uppercase().trim()
                            if (role != "ADMIN" && role != "SUPER_ADMIN") {
                                errorMessage = "Tài khoản không có quyền Quản trị viên (Role: $role)."
                                isLoading = false
                                return@launch
                            }

                            authManager.saveSession(
                                token = token,
                                user = AuthUser(
                                    id = user.id,
                                    email = user.email,
                                    fullName = user.fullName,
                                    role = role
                                )
                            )

                            authManager.isBiometricEnabled = true
                            authManager.unlockApp()

                            isLoading = false
                            Toast.makeText(context, "Xác thực danh tính & Đăng nhập thành công!", Toast.LENGTH_SHORT).show()
                            onLoginSuccess()
                        } else {
                            errorMessage = "Đăng nhập nhanh thất bại (HTTP ${response.code()})."
                            isLoading = false
                        }
                    } catch (e: Exception) {
                        errorMessage = "Không thể kết nối máy chủ: ${e.message}"
                        isLoading = false
                    }
                }
            },
            onError = { code, msg ->
                errorMessage = "Xác thực vân tay/mã máy thất bại: $msg"
            },
            onCancel = {
                // Người dùng hủy, không cho đăng nhập
            }
        )
    }

    fun triggerBiometricUnlock() {
        val fragmentActivity = context as? FragmentActivity ?: return
        val priorEmail = authManager.lastAdminEmail
        if (!hasPriorAdmin || priorEmail.isNullOrBlank()) {
            Toast.makeText(
                context,
                "Chưa có tài khoản Quản trị viên nào từng đăng nhập trên thiết bị. Vui lòng đăng nhập bằng Email/Mật khẩu hoặc Google lần đầu tiên để kích hoạt vân tay.",
                Toast.LENGTH_LONG
            ).show()
            errorMessage = "Yêu cầu đăng nhập tài khoản Quản trị viên lần đầu tiên trước khi dùng vân tay."
            return
        }

        BiometricAuthManager.showBiometricPrompt(
            activity = fragmentActivity,
            title = "Mở khóa Quản trị viên AVORA",
            subtitle = "Sử dụng vân tay hoặc mã PIN thiết bị",
            description = "Xác nhận danh tính Quản trị viên ($priorEmail) để mở khóa Gateway",
            onSuccess = {
                if (authManager.isLoggedIn && authManager.isAdmin()) {
                    authManager.unlockApp()
                    Toast.makeText(context, "Mở khóa thành công!", Toast.LENGTH_SHORT).show()
                    onLoginSuccess()
                } else {
                    performQuickAdminLoginWithBiometric(priorEmail)
                }
            },
            onError = { code, msg ->
                errorMessage = "Xác thực sinh trắc học thất bại: $msg"
            },
            onCancel = {
                // Cancelled
            }
        )
    }

    // Auto-prompt biometric if user previously enabled quick unlock
    LaunchedEffect(Unit) {
        if (canUseBiometric) {
            triggerBiometricUnlock()
        }
    }

    fun performGoogleLogin(idToken: String, googleEmail: String) {
        isLoading = true
        errorMessage = null
        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.verifyGoogleToken(GoogleVerifyRequest(idToken = idToken))

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val token = body.accessToken ?: body.token
                    val user = body.user

                    if (token.isNullOrBlank() || user == null) {
                        errorMessage = "Không nhận được phiên xác thực từ máy chủ."
                        isLoading = false
                        return@launch
                    }

                    val role = user.role.uppercase().trim()
                    // SỬA: CHỈ QUYỀN ADMIN / SUPER_ADMIN MỚI CÓ QUYỀN TRUY CẬP
                    if (role != "ADMIN" && role != "SUPER_ADMIN") {
                        errorMessage = "Tài khoản Google ($googleEmail) thuộc vai trò $role. Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập ứng dụng Gateway!"
                        isLoading = false
                        return@launch
                    }

                    authManager.saveSession(
                        token = token,
                        user = AuthUser(
                            id = user.id,
                            email = user.email,
                            fullName = user.fullName,
                            role = role
                        )
                    )

                    if (isBiometricAvailable) {
                        authManager.isBiometricEnabled = true
                    }
                    authManager.unlockApp()

                    isLoading = false
                    Toast.makeText(context, "Đăng nhập Quản trị viên thành công!", Toast.LENGTH_SHORT).show()
                    onLoginSuccess()
                } else {
                    val errorBody = response.errorBody()?.string() ?: ""
                    errorMessage = if (response.code() == 403 || errorBody.contains("không có quyền", ignoreCase = true)) {
                        "Tài khoản Google ($googleEmail) không có quyền Quản trị viên AVORA."
                    } else if (response.code() == 404 || errorBody.contains("không tồn tại", ignoreCase = true)) {
                        "Tài khoản ($googleEmail) chưa được cấp phép trong hệ thống AVORA."
                    } else {
                        "Xác thực Google thất bại (Mã ${response.code()})."
                    }
                    isLoading = false
                }
            } catch (e: Exception) {
                errorMessage = "Lỗi kết nối khi xác thực Google: ${e.message}"
                isLoading = false
            }
        }
    }

    val googleSignInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken
            val email = account?.email ?: "Google User"
            if (!idToken.isNullOrBlank()) {
                performGoogleLogin(idToken, email)
            } else {
                errorMessage = "Không thể lấy mã định danh Google. Vui lòng thử lại."
                isLoading = false
            }
        } catch (e: ApiException) {
            isLoading = false
            when (e.statusCode) {
                12501 -> {
                    // User cancelled sign-in
                }
                7 -> {
                    errorMessage = "Không thể kết nối mạng. Vui lòng kiểm tra Wi-Fi / 4G."
                }
                10 -> {
                    errorMessage = "Cấu hình Google Sign-In đang đồng bộ SHA-1. Bạn có thể sử dụng Đăng nhập nhanh Admin hoặc Mật khẩu."
                }
                else -> {
                    errorMessage = "Đăng nhập Google thất bại (${e.statusCode}): ${e.localizedMessage ?: "Lỗi xác thực"}"
                }
            }
        } catch (e: Exception) {
            isLoading = false
            errorMessage = "Lỗi đăng nhập Google: ${e.message}"
        }
    }

    fun startGoogleSignIn() {
        focusManager.clearFocus()
        isLoading = true
        errorMessage = null
        googleSignInClient.signOut().addOnCompleteListener {
            googleSignInLauncher.launch(googleSignInClient.signInIntent)
        }
    }

    fun performLogin() {
        focusManager.clearFocus()
        if (emailOrPhone.isBlank() || password.isBlank()) {
            errorMessage = "Vui lòng nhập đầy đủ email và mật khẩu."
            return
        }

        isLoading = true
        errorMessage = null

        coroutineScope.launch {
            try {
                val api = NetworkClient.getApiService(context)
                val response = api.login(LoginRequest(email = emailOrPhone.trim(), password = password))

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val token = body.accessToken ?: body.token
                    val user = body.user

                    if (token.isNullOrBlank() || user == null) {
                        errorMessage = "Không nhận được phiên xác thực từ máy chủ."
                        isLoading = false
                        return@launch
                    }

                    val role = user.role.uppercase().trim()
                    // SỬA: CHỈ QUYỀN ADMIN HOẶC SUPER_ADMIN MỚI CÓ QUYỀN TRUY CẬP GATEWAY
                    if (role != "ADMIN" && role != "SUPER_ADMIN") {
                        errorMessage = "Tài khoản của bạn ($role) không có quyền Quản trị viên. Chỉ Admin mới được phép truy cập và cài đặt Gateway!"
                        isLoading = false
                        return@launch
                    }

                    authManager.saveSession(
                        token = token,
                        user = AuthUser(
                            id = user.id,
                            email = user.email,
                            fullName = user.fullName,
                            role = role
                        )
                    )

                    if (isBiometricAvailable) {
                        authManager.isBiometricEnabled = true
                    }
                    authManager.unlockApp()

                    isLoading = false
                    Toast.makeText(context, "Đăng nhập Quản trị viên thành công!", Toast.LENGTH_SHORT).show()
                    onLoginSuccess()
                } else {
                    val errorBody = response.errorBody()?.string() ?: ""
                    errorMessage = if (errorBody.contains("mật khẩu", ignoreCase = true)) {
                        "Tài khoản hoặc mật khẩu không chính xác."
                    } else if (response.code() == 401) {
                        "Thông tin đăng nhập không hợp lệ."
                    } else {
                        "Lỗi máy chủ (HTTP ${response.code()}). Vui lòng thử lại sau."
                    }
                    isLoading = false
                }
            } catch (e: Exception) {
                errorMessage = "Không thể kết nối tới máy chủ AVORA: ${e.message}"
                isLoading = false
            }
        }
    }

    // GIAO DIỆN LOGIN NỀN TRẮNG TINH TẾ, HIỆN ĐẠI, GỌN GÀNG ĐỒNG BỘ TOÀN APP
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(modifier = Modifier.height(10.dp))

            // AVORA Logo
            Surface(
                modifier = Modifier.size(64.dp),
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Image(
                        painter = painterResource(id = R.drawable.avora_logo),
                        contentDescription = "AVORA Logo",
                        modifier = Modifier.size(42.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            Text(
                text = "AVORA BANK CONNECT",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFF0F172A),
                letterSpacing = 0.8.sp
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Cổng kết nối biến động số dư ngân hàng 24/7",
                fontSize = 12.sp,
                color = Color(0xFF64748B),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Main Clean White Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ĐĂNG NHẬP HỆ THỐNG",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = AvoraRedPrimary,
                            letterSpacing = 0.8.sp
                        )
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = null,
                            tint = AvoraRedPrimary,
                            modifier = Modifier.size(15.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Input Email / Phone
                    OutlinedTextField(
                        value = emailOrPhone,
                        onValueChange = {
                            emailOrPhone = it
                            errorMessage = null
                        },
                        placeholder = { Text("Email hoặc Số điện thoại", fontSize = 12.5.sp, color = Color(0xFF94A3B8)) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Email,
                                contentDescription = null,
                                tint = Color(0xFF64748B),
                                modifier = Modifier.size(17.dp)
                            )
                        },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Email,
                            imeAction = ImeAction.Next
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AvoraRedPrimary,
                            unfocusedBorderColor = Color(0xFFCBD5E1),
                            focusedTextColor = Color(0xFF0F172A),
                            unfocusedTextColor = Color(0xFF0F172A),
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Input Password
                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            errorMessage = null
                        },
                        placeholder = { Text("Nhập mật khẩu", fontSize = 12.5.sp, color = Color(0xFF94A3B8)) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = null,
                                tint = Color(0xFF64748B),
                                modifier = Modifier.size(17.dp)
                            )
                        },
                        trailingIcon = {
                            IconButton(onClick = { isPasswordVisible = !isPasswordVisible }) {
                                Icon(
                                    imageVector = if (isPasswordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                                    contentDescription = null,
                                    tint = Color(0xFF64748B),
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                        },
                        visualTransformation = if (isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Password,
                            imeAction = ImeAction.Done
                        ),
                        keyboardActions = KeyboardActions(
                            onDone = { performLogin() }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AvoraRedPrimary,
                            unfocusedBorderColor = Color(0xFFCBD5E1),
                            focusedTextColor = Color(0xFF0F172A),
                            unfocusedTextColor = Color(0xFF0F172A),
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White
                        )
                    )

                    // Error Notification Banner
                    AnimatedVisibility(
                        visible = errorMessage != null,
                        enter = fadeIn(),
                        exit = fadeOut()
                    ) {
                        errorMessage?.let { msg ->
                            Spacer(modifier = Modifier.height(10.dp))
                            Surface(
                                color = Color(0xFFFEF2F2),
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFECACA)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.ErrorOutline,
                                        contentDescription = null,
                                        tint = Color(0xFFDC2626),
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = msg,
                                        color = Color(0xFFDC2626),
                                        fontSize = 11.sp,
                                        lineHeight = 15.sp,
                                        modifier = Modifier.weight(1f)
                                    )
                                    IconButton(
                                        onClick = { errorMessage = null },
                                        modifier = Modifier.size(18.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Đóng",
                                            tint = Color(0xFFDC2626),
                                            modifier = Modifier.size(13.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Main Login Button
                    Button(
                        onClick = { performLogin() },
                        enabled = !isLoading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = AvoraRedPrimary,
                            disabledContainerColor = Color(0xFF94A3B8)
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = "Đang xác thực...", fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                        } else {
                            Icon(
                                imageVector = Icons.Default.Login,
                                contentDescription = null,
                                modifier = Modifier.size(17.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "ĐĂNG NHẬP",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.5.sp,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFFE2E8F0))
                        Text(
                            text = "  HOẶC  ",
                            color = Color(0xFF94A3B8),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold
                        )
                        HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFFE2E8F0))
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // YÊU CẦU 4: NÚT LOGIN GOOGLE VÀ NÚT VÂN TAY (CHỈ ICON) NẰM CÙNG 1 DÒNG
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Google Sign-In Button
                        OutlinedButton(
                            onClick = { startGoogleSignIn() },
                            enabled = !isLoading,
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = Color.White,
                                contentColor = Color(0xFF334155)
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFCBD5E1))
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.ic_google_logo),
                                contentDescription = "Google Logo",
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Tiếp tục với Google",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 12.5.sp,
                                color = Color(0xFF334155)
                            )
                        }

                        // Biometric Fingerprint Icon-Only Button
                        OutlinedButton(
                            onClick = {
                                if (!hasPriorAdmin) {
                                    Toast.makeText(
                                        context,
                                        "Chưa có tài khoản Quản trị viên nào từng đăng nhập trên thiết bị. Vui lòng đăng nhập bằng Email hoặc Google lần đầu tiên để kích hoạt vân tay!",
                                        Toast.LENGTH_LONG
                                    ).show()
                                    errorMessage = "Yêu cầu đăng nhập tài khoản Quản trị viên lần đầu tiên trước khi dùng vân tay."
                                } else if (!isBiometricAvailable) {
                                    Toast.makeText(
                                        context,
                                        "Thiết bị chưa cài đặt vân tay hoặc mã PIN bảo mật trong Cài đặt máy.",
                                        Toast.LENGTH_LONG
                                    ).show()
                                } else {
                                    triggerBiometricUnlock()
                                }
                            },
                            enabled = !isLoading,
                            modifier = Modifier.size(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(0.dp),
                            colors = ButtonDefaults.outlinedButtonColors(
                                containerColor = if (hasPriorAdmin) Color(0xFFFEF2F2) else Color(0xFFF1F5F9),
                                contentColor = if (hasPriorAdmin) AvoraRedPrimary else Color(0xFF94A3B8)
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                if (hasPriorAdmin) Color(0xFFFECACA) else Color(0xFFE2E8F0)
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Default.Fingerprint,
                                contentDescription = "Đăng nhập bằng Vân tay / PIN",
                                tint = if (hasPriorAdmin) AvoraRedPrimary else Color(0xFF94A3B8),
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Text(
                text = "Hệ thống bảo mật nội bộ AVORA Restaurant • Ký số EC P-256",
                fontSize = 10.5.sp,
                color = Color(0xFF94A3B8),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
