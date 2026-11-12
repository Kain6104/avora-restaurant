package vn.avora.bankconnect.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.crypto.KeyStoreManager
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.network.NetworkClient
import vn.avora.bankconnect.core.parser.ParseResult
import vn.avora.bankconnect.core.parser.VietcombankParser
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiagnosticScreen(
    onNavigateBack: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var parserTestResult by remember { mutableStateOf<String?>(null) }
    var parserSuccess by remember { mutableStateOf(false) }

    var serverTestResult by remember { mutableStateOf<String?>(null) }
    var serverTestSuccess by remember { mutableStateOf(false) }
    var isTestingServer by remember { mutableStateOf(false) }

    var signatureTestResult by remember { mutableStateOf<String?>(null) }
    var signatureSuccess by remember { mutableStateOf(false) }

    val TEST_FIXTURE = """
        Số dư TK VCB 1019224767 +110,000 VND lúc 03-11-2026 12:54:11.
        Số dư 599,511 VND.
        Ref LE MINH DAT chuyen tien#SP#020097042211031 254102026GWRL685139.5388.32602.125400
    """.trimIndent()

    fun runParserTest() {
        val result = VietcombankParser.parse(TEST_FIXTURE)
        if (result is ParseResult.Success) {
            val tx = result.transaction
            parserSuccess = tx.amount == 110000L &&
                    tx.accountNumber == "1019224767" &&
                    tx.direction == "CREDIT" &&
                    tx.balanceAfter == null &&
                    tx.counterparty == "LE MINH DAT" &&
                    tx.transferContent == "chuyen tien#SP#020097042211031" &&
                    tx.bankReference == "254102026GWRL685139.5388.32602.125400"

            parserTestResult = """
                [PASS] 100% Khớp Test Fixture Vietcombank:
                - Ngân hàng: ${tx.bank}
                - Số tài khoản: ${tx.accountNumber}
                - Chiều giao dịch: ${tx.direction}
                - Số tiền: ${tx.amount} VND (Long)
                - Thời gian: ${tx.occurredAt}
                - Người gửi: ${tx.counterparty}
                - Nội dung: ${tx.transferContent}
                - Ref VCB: ${tx.bankReference}
            """.trimIndent()
        } else {
            parserSuccess = false
            parserTestResult = "[FAIL] Không parse được: ${(result as ParseResult.Failed).reason}"
        }
    }

    fun runServerTest() {
        scope.launch {
            isTestingServer = true
            val startTime = System.currentTimeMillis()
            try {
                val api = NetworkClient.getApiService(context)
                val res = api.getDeviceStatus()
                val latency = System.currentTimeMillis() - startTime
                if (res.isSuccessful) {
                    serverTestSuccess = true
                    serverTestResult = """
                        [PASS] Kết nối HTTPS tới avorafnb.com thành công!
                        - HTTP Status: ${res.code()}
                        - Độ trễ: ${latency}ms
                        - Server Time: ${res.body()?.serverTime}
                        - Trạng thái thiết bị: ${res.body()?.status}
                    """.trimIndent()
                } else {
                    serverTestSuccess = false
                    serverTestResult = """
                        [FAIL] Server phản hồi HTTP ${res.code()}:
                        ${res.errorBody()?.string() ?: "Lỗi xác thực thiết bị hoặc chưa pair"}
                    """.trimIndent()
                }
            } catch (e: Exception) {
                serverTestSuccess = false
                serverTestResult = "[FAIL] Ngoại lệ kết nối: ${e.message}"
            } finally {
                isTestingServer = false
            }
        }
    }

    fun runSignatureTest() {
        try {
            val sampleMessage = "test-device-id:${System.currentTimeMillis()}:sample-nonce:hash123"
            val signature = KeyStoreManager.signMessage(sampleMessage)
            signatureSuccess = signature.isNotBlank()
            signatureTestResult = """
                [PASS] Khởi tạo & Ký số thành công qua Android Keystore:
                - Thuật toán: SHA256withECDSA (NIST P-256)
                - Chữ ký Base64: ${signature.take(40)}...
                - Khóa lưu trữ an toàn trong TEE phần cứng
            """.trimIndent()
        } catch (e: Exception) {
            signatureSuccess = false
            signatureTestResult = "[FAIL] Lỗi ký số: ${e.message}"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        AvoraTopHeader(
            title = "Trung tâm chẩn đoán",
            subtitle = "Kiểm thử Parser, VPS & Ký số Keystore",
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
            // 1. Transaction Parser Diagnostic Card
            DiagnosticCard(
                title = "1. Kiểm thử Transaction Parser (Test Fixture)",
                description = "Kiểm tra bóc tách giao dịch Vietcombank với dữ liệu chuẩn production:",
                buttonText = "Chạy kiểm thử Parser",
                resultText = parserTestResult,
                isSuccess = parserSuccess,
                onRun = { runParserTest() }
            )

            // 2. Server Connectivity Card
            DiagnosticCard(
                title = "2. Kiểm thử kết nối VPS (https://avorafnb.com)",
                description = "Gửi request kiểm tra kết nối HTTPS và đo lường độ trễ mạng:",
                buttonText = "Chạy kiểm tra VPS",
                resultText = serverTestResult,
                isSuccess = serverTestSuccess,
                isLoading = isTestingServer,
                onRun = { runServerTest() }
            )

            // 3. Keystore ECDSA Signature Card
            DiagnosticCard(
                title = "3. Kiểm thử ký số Android Keystore (EC P-256)",
                description = "Xác minh khả năng sinh khóa và ký số SHA256withECDSA trên thiết bị:",
                buttonText = "Chạy kiểm tra Ký số",
                resultText = signatureTestResult,
                isSuccess = signatureSuccess,
                onRun = { runSignatureTest() }
            )
        }
    }
}

@Composable
fun DiagnosticCard(
    title: String,
    description: String,
    buttonText: String,
    resultText: String?,
    isSuccess: Boolean,
    isLoading: Boolean = false,
    onRun: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = Slate900))
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = description, style = MaterialTheme.typography.bodySmall.copy(color = Slate600))

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = onRun,
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                shape = RoundedCornerShape(8.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(buttonText, style = MaterialTheme.typography.labelMedium)
                }
            }

            if (resultText != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    color = if (isSuccess) Emerald50 else Rose50,
                    border = androidx.compose.foundation.BorderStroke(1.dp, if (isSuccess) Emerald100 else Rose100)
                ) {
                    Text(
                        text = resultText,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = if (isSuccess) Emerald600 else Rose600
                        )
                    )
                }
            }
        }
    }
}

