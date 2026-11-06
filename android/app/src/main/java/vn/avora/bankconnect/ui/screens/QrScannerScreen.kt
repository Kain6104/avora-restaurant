package vn.avora.bankconnect.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.zxing.*
import com.google.zxing.common.HybridBinarizer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import vn.avora.bankconnect.core.crypto.KeyStoreManager
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.network.PairRequest
import vn.avora.bankconnect.ui.theme.AvoraRedPrimary
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.Executors

@androidx.camera.core.ExperimentalGetImage
@Composable
fun QrScannerScreen(
    onNavigateBack: () -> Unit,
    onPairingSuccess: () -> Unit,
    onManualInput: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasCameraPermission = isGranted
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    var cameraControl by remember { mutableStateOf<CameraControl?>(null) }
    var isTorchOn by remember { mutableStateOf(false) }
    var isPairing by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var hasScannedCode by remember { mutableStateOf(false) }

    fun processScannedQr(rawText: String) {
        if (hasScannedCode || isPairing) return
        hasScannedCode = true
        isPairing = true
        errorMessage = null

        // Parse code (có thể là mã 6 ký tự trực tiếp hoặc JSON {"pairingCode":"123456", "serverUrl":"..."})
        var serverUrlExtracted: String? = null
        val pairingCode = try {
            val trimmed = rawText.trim()
            if (trimmed.startsWith("{")) {
                val codeRegex = "\"(?:pairingCode|code)\"\\s*:\\s*\"([A-Za-z0-9]+)\"".toRegex()
                val serverUrlRegex = "\"serverUrl\"\\s*:\\s*\"([^\"]+)\"".toRegex()
                serverUrlExtracted = serverUrlRegex.find(trimmed)?.groupValues?.get(1)?.trim()
                codeRegex.find(trimmed)?.groupValues?.get(1) ?: trimmed
            } else {
                trimmed
            }
        } catch (e: Exception) {
            rawText.trim()
        }

        coroutineScope.launch {
            try {
                val db = AppDatabase.getInstance(context)

                if (!serverUrlExtracted.isNullOrBlank()) {
                    db.configDao().set(ConfigEntity("server_url", serverUrlExtracted))
                }

                // 1. Tạo cặp khóa EC P-256 trong Android Keystore nếu chưa có
                val publicKeyPem = KeyStoreManager.exportPublicKeyPem()

                // 2. Lấy hoặc sinh Device ID
                var deviceId = db.configDao().get("device_id")
                if (deviceId.isNullOrBlank()) {
                    deviceId = "device_${UUID.randomUUID().toString().replace("-", "").take(16)}"
                    db.configDao().set(ConfigEntity("device_id", deviceId))
                }

                val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

                // 3. Gửi yêu cầu ghép nối lên VPS
                val api = NetworkClient.getApiService(context)
                val response = api.pairDevice(
                    PairRequest(
                        pairingCode = pairingCode,
                        deviceId = deviceId,
                        deviceName = deviceName,
                        appVersion = "1.0.0",
                        publicKeyPem = publicKeyPem
                    )
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    val body = response.body()!!
                    db.configDao().set(ConfigEntity("is_paired", "true"))
                    db.configDao().set(ConfigEntity("device_id", body.deviceId))
                    db.configDao().set(ConfigEntity("paired_at", body.pairedAt))
                    db.configDao().set(ConfigEntity("device_name", deviceName))

                    withContext(Dispatchers.Main) {
                        isPairing = false
                        onPairingSuccess()
                    }
                } else {
                    val errorBody = response.errorBody()?.string() ?: ""
                    errorMessage = if (errorBody.contains("Mã ghép nối không hợp lệ", ignoreCase = true) || errorBody.contains("hết hạn", ignoreCase = true)) {
                        "Mã ghép nối không hợp lệ hoặc đã hết hạn (hiệu lực 5 phút)."
                    } else {
                        "Ghép nối không thành công (HTTP ${response.code()}). Vui lòng tạo mã mới trên Web."
                    }
                    isPairing = false
                    hasScannedCode = false
                }
            } catch (e: Exception) {
                errorMessage = "Lỗi ghép nối: ${e.message}"
                isPairing = false
                hasScannedCode = false
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (hasCameraPermission) {
            // CameraX View
            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx)
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                    val cameraExecutor = Executors.newSingleThreadExecutor()

                    cameraProviderFuture.addListener({
                        val cameraProvider = cameraProviderFuture.get()
                        val preview = Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                        val imageAnalysis = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()

                        val multiFormatReader = MultiFormatReader().apply {
                            val hints = mapOf(
                                DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE)
                            )
                            setHints(hints)
                        }

                        imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            if (!hasScannedCode && !isPairing) {
                                val buffer = imageProxy.planes[0].buffer
                                val bytes = ByteArray(buffer.remaining())
                                buffer.get(bytes)
                                val width = imageProxy.width
                                val height = imageProxy.height

                                val source = PlanarYUVLuminanceSource(
                                    bytes, width, height, 0, 0, width, height, false
                                )
                                val binaryBitmap = BinaryBitmap(HybridBinarizer(source))

                                try {
                                    val result = multiFormatReader.decodeWithState(binaryBitmap)
                                    val scannedText = result.text
                                    if (!scannedText.isNullOrBlank()) {
                                        processScannedQr(scannedText)
                                    }
                                } catch (_: NotFoundException) {
                                } catch (e: Exception) {
                                    Log.e("QrScanner", "Lỗi phân tích QR: ${e.message}")
                                } finally {
                                    multiFormatReader.reset()
                                }
                            }
                            imageProxy.close()
                        }

                        try {
                            cameraProvider.unbindAll()
                            val camera = cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis
                            )
                            cameraControl = camera.cameraControl
                        } catch (exc: Exception) {
                            Log.e("QrScanner", "Khởi tạo Camera thất bại", exc)
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize()
            )

            // Animated Laser scanning overlay
            val infiniteTransition = rememberInfiniteTransition()
            val laserY by infiniteTransition.animateFloat(
                initialValue = 0.15f,
                targetValue = 0.85f,
                animationSpec = infiniteRepeatable(
                    animation = tween(1800, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                )
            )

            // Fintech Viewfinder Overlay
            Canvas(modifier = Modifier.fillMaxSize()) {
                val size = size
                val boxWidth = size.width * 0.72f
                val boxHeight = boxWidth
                val left = (size.width - boxWidth) / 2
                val top = (size.height - boxHeight) / 2 - 40.dp.toPx()

                val path = Path().apply {
                    addRect(Rect(0f, 0f, size.width, size.height))
                    addRoundRect(
                        RoundRect(
                            rect = Rect(left, top, left + boxWidth, top + boxHeight),
                            cornerRadius = CornerRadius(24.dp.toPx(), 24.dp.toPx())
                        )
                    )
                }

                drawPath(
                    path = path,
                    color = Color.Black.copy(alpha = 0.65f),
                    blendMode = BlendMode.SrcOver
                )

                // Laser scan line
                val currentLaserY = top + (boxHeight * laserY)
                drawLine(
                    brush = Brush.horizontalGradient(
                        colors = listOf(
                            Color.Transparent,
                            AvoraRedPrimary.copy(alpha = 0.9f),
                            Color.White,
                            AvoraRedPrimary.copy(alpha = 0.9f),
                            Color.Transparent
                        )
                    ),
                    start = Offset(left + 16.dp.toPx(), currentLaserY),
                    end = Offset(left + boxWidth - 16.dp.toPx(), currentLaserY),
                    strokeWidth = 3.dp.toPx()
                )

                // Corner Accents (AVORA Red)
                val cornerLength = 32.dp.toPx()
                val cornerWidth = 4.dp.toPx()
                val red = Color(0xFFD32F2F)

                // Top-Left
                drawLine(red, Offset(left, top + 16.dp.toPx()), Offset(left, top + cornerLength), cornerWidth)
                drawLine(red, Offset(left + 16.dp.toPx(), top), Offset(left + cornerLength, top), cornerWidth)

                // Top-Right
                drawLine(red, Offset(left + boxWidth, top + 16.dp.toPx()), Offset(left + boxWidth, top + cornerLength), cornerWidth)
                drawLine(red, Offset(left + boxWidth - 16.dp.toPx(), top), Offset(left + boxWidth - cornerLength, top), cornerWidth)

                // Bottom-Left
                drawLine(red, Offset(left, top + boxHeight - 16.dp.toPx()), Offset(left, top + boxHeight - cornerLength), cornerWidth)
                drawLine(red, Offset(left + 16.dp.toPx(), top + boxHeight), Offset(left + cornerLength, top + boxHeight), cornerWidth)

                // Bottom-Right
                drawLine(red, Offset(left + boxWidth, top + boxHeight - 16.dp.toPx()), Offset(left + boxWidth, top + boxHeight - cornerLength), cornerWidth)
                drawLine(red, Offset(left + boxWidth - 16.dp.toPx(), top + boxHeight), Offset(left + boxWidth - cornerLength, top + boxHeight), cornerWidth)
            }
        } else {
            // Permission Request State
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    imageVector = Icons.Default.CameraAlt,
                    contentDescription = null,
                    tint = AvoraRedPrimary,
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Cần quyền truy cập Camera",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Để quét mã QR ghép nối từ trang Quản trị AVORA, ứng dụng cần sử dụng camera của thiết bị.",
                    fontSize = 14.sp,
                    color = Color(0xFFB0B0B0),
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                    colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary)
                ) {
                    Text("CẤP QUYỀN CAMERA")
                }
            }
        }

        // Top Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 44.dp, start = 16.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            IconButton(
                onClick = onNavigateBack,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.5f))
            ) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
            }

            Text(
                text = "QUÉT MÃ GHÉP NỐI",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )

            // Torch Toggle
            IconButton(
                onClick = {
                    isTorchOn = !isTorchOn
                    cameraControl?.enableTorch(isTorchOn)
                },
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.5f))
            ) {
                Icon(
                    imageVector = if (isTorchOn) Icons.Default.FlashOn else Icons.Default.FlashOff,
                    contentDescription = "Torch",
                    tint = if (isTorchOn) Color(0xFFFFD54F) else Color.White
                )
            }
        }

        // Bottom Controls & Status
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Pairing Indicator
            if (isPairing) {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E1E))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            color = AvoraRedPrimary,
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Đang xác thực và tạo khóa bảo mật...",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Error banner
            errorMessage?.let { msg ->
                Surface(
                    color = Color(0xFF3E1A1A),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFFF5252))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(text = msg, color = Color(0xFFFFB4AB), fontSize = 12.sp)
                    }
                }
            }

            Text(
                text = "Hướng camera vào mã QR hiển thị tại:\navorafnb.com/admin/bank-connect",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                lineHeight = 18.sp
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Fallback manual entry button
            OutlinedButton(
                onClick = onManualInput,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF616161))
            ) {
                Icon(Icons.Default.Keyboard, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Nhập mã ghép nối thủ công (6 ký tự)", fontSize = 13.sp)
            }
        }
    }
}
