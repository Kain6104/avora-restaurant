package vn.avora.bankconnect.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import vn.avora.bankconnect.core.database.AppDatabase
import vn.avora.bankconnect.core.database.entity.ConfigEntity
import vn.avora.bankconnect.core.voice.VoiceSpeaker
import vn.avora.bankconnect.ui.components.AvoraTopHeader
import vn.avora.bankconnect.ui.theme.*

data class BankInfo(
    val code: String,
    val shortName: String,
    val fullName: String,
    val tagColor: Color
)

val SUPPORTED_20_BANKS = listOf(
    BankInfo("VCB", "Vietcombank", "Ngân hàng TMCP Ngoại thương Việt Nam", Color(0xFF16A34A)),
    BankInfo("MB", "MBBank", "Ngân hàng TMCP Quân Đội", Color(0xFF2563EB)),
    BankInfo("TCB", "Techcombank", "Ngân hàng TMCP Kỹ Thương Việt Nam", Color(0xFFDC2626)),
    BankInfo("ACB", "ACB", "Ngân hàng TMCP Á Châu", Color(0xFF0284C7)),
    BankInfo("BIDV", "BIDV", "Ngân hàng TMCP Đầu tư và Phát triển VN", Color(0xFF059669)),
    BankInfo("CTG", "VietinBank", "Ngân hàng TMCP Công Thương Việt Nam", Color(0xFF0D9488)),
    BankInfo("TPB", "TPBank", "Ngân hàng TMCP Tiên Phong", Color(0xFF7C3AED)),
    BankInfo("VPB", "VPBank", "Ngân hàng TMCP Việt Nam Thịnh Vượng", Color(0xFF16A34A)),
    BankInfo("OCB", "OCB", "Ngân hàng TMCP Phương Đông", Color(0xFF059669)),
    BankInfo("HDB", "HDBank", "Ngân hàng TMCP Phát triển TP.HCM", Color(0xFFEA580C)),
    BankInfo("STB", "Sacombank", "Ngân hàng TMCP Sài Gòn Thương Tín", Color(0xFF0284C7)),
    BankInfo("MSB", "MSB", "Ngân hàng TMCP Hàng Hải Việt Nam", Color(0xFFEA580C)),
    BankInfo("VIB", "VIB", "Ngân hàng TMCP Quốc tế Việt Nam", Color(0xFF2563EB)),
    BankInfo("SHB", "SHB", "Ngân hàng TMCP Sài Gòn - Hà Nội", Color(0xFFD97706)),
    BankInfo("SEAB", "SeABank", "Ngân hàng TMCP Đông Nam Á", Color(0xFFDC2626)),
    BankInfo("LPB", "LPBank", "Ngân hàng TMCP Lộc Phát Việt Nam", Color(0xFFD97706)),
    BankInfo("BVB", "BVBank", "Ngân hàng TMCP Bản Việt", Color(0xFF0D9488)),
    BankInfo("NAB", "Nam A Bank", "Ngân hàng TMCP Nam Á", Color(0xFFD97706)),
    BankInfo("BAB", "Bac A Bank", "Ngân hàng TMCP Bắc Á", Color(0xFF0284C7)),
    BankInfo("KLB", "Kienlongbank", "Ngân hàng TMCP Kiên Long", Color(0xFF16A34A))
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BankVoiceConfigScreen(
    onNavigateBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val db = remember { AppDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var selectedTabIndex by remember { mutableIntStateOf(0) }

    val bankModeStr by db.configDao().getFlow("bank_monitoring_mode").collectAsState(initial = "ALL")
    val enabledBanksStr by db.configDao().getFlow("enabled_banks").collectAsState(initial = "VCB,MB,TCB,ACB,BIDV,CTG,TPB,VPB,OCB,HDB,STB,MSB,VIB,SHB,SEAB,LPB,BVB,NAB,BAB,KLB")
    val dirFilterStr by db.configDao().getFlow("transaction_direction_filter").collectAsState(initial = "CREDIT_ONLY")
    val voiceEnabledStr by db.configDao().getFlow("voice_announcement_enabled").collectAsState(initial = "true")
    val voiceIncludeBankStr by db.configDao().getFlow("voice_include_bank").collectAsState(initial = "true")
    val voiceIncludeOrderStr by db.configDao().getFlow("voice_include_order").collectAsState(initial = "true")

    val bankMode = bankModeStr ?: "ALL"
    val enabledBanks = remember(enabledBanksStr) {
        (enabledBanksStr ?: "").split(",").map { it.trim().uppercase() }.filter { it.isNotEmpty() }.toSet()
    }
    val dirFilter = dirFilterStr ?: "CREDIT_ONLY"
    val voiceEnabled = voiceEnabledStr?.toBooleanStrictOrNull() ?: true
    val voiceIncludeBank = voiceIncludeBankStr?.toBooleanStrictOrNull() ?: true
    val voiceIncludeOrder = voiceIncludeOrderStr?.toBooleanStrictOrNull() ?: true

    fun toggleBank(bankCode: String) {
        val upperCode = bankCode.uppercase().trim()
        val newSet = if (enabledBanks.contains(upperCode)) {
            enabledBanks - upperCode
        } else {
            enabledBanks + upperCode
        }
        val newStr = newSet.joinToString(",")
        scope.launch {
            db.configDao().set(ConfigEntity("enabled_banks", newStr))
        }
    }

    fun selectAllBanks() {
        val allCodes = SUPPORTED_20_BANKS.joinToString(",") { it.code }
        scope.launch {
            db.configDao().set(ConfigEntity("enabled_banks", allCodes))
        }
    }

    fun deselectAllBanks() {
        scope.launch {
            db.configDao().set(ConfigEntity("enabled_banks", ""))
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        AvoraTopHeader(
            title = "Cấu hình Ngân hàng & Giọng nói",
            subtitle = "Bộ lọc 20 ngân hàng & Đọc số tiền tự động",
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

        // Tab Navigation Header
        TabRow(
            selectedTabIndex = selectedTabIndex,
            containerColor = Color.White,
            contentColor = AvoraRedPrimary,
            divider = { HorizontalDivider(color = Slate200, thickness = 1.dp) }
        ) {
            Tab(
                selected = selectedTabIndex == 0,
                onClick = { selectedTabIndex = 0 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.AccountBalance,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = if (selectedTabIndex == 0) AvoraRedPrimary else Slate500
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Ngân hàng & Bộ lọc",
                            fontWeight = if (selectedTabIndex == 0) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.5.sp,
                            color = if (selectedTabIndex == 0) AvoraRedPrimary else Slate600
                        )
                    }
                }
            )

            Tab(
                selected = selectedTabIndex == 1,
                onClick = { selectedTabIndex = 1 },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.VolumeUp,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = if (selectedTabIndex == 1) AvoraRedPrimary else Slate500
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Giọng đọc tiền về",
                            fontWeight = if (selectedTabIndex == 1) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.5.sp,
                            color = if (selectedTabIndex == 1) AvoraRedPrimary else Slate600
                        )
                    }
                }
            )
        }

        // Tab Content
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            if (selectedTabIndex == 0) {
                // TAB 1: NGÂN HÀNG & BỘ LỌC
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Section 1: Monitoring Mode Card
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "CHẾ ĐỘ GIÁM SÁT THÔNG BÁO",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate500,
                                letterSpacing = 0.8.sp
                            )
                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = bankMode == "ALL",
                                    onClick = {
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("bank_monitoring_mode", "ALL"))
                                        }
                                    },
                                    label = { Text("Tất cả ngân hàng (20+)", fontSize = 12.sp, fontWeight = if (bankMode == "ALL") FontWeight.Bold else FontWeight.Normal) },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = AvoraRedPrimary,
                                        selectedLabelColor = Color.White,
                                        containerColor = Color.White,
                                        labelColor = Slate700
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        borderColor = if (bankMode == "ALL") AvoraRedPrimary else Slate200,
                                        enabled = true,
                                        selected = bankMode == "ALL"
                                    ),
                                    modifier = Modifier.weight(1f)
                                )

                                FilterChip(
                                    selected = bankMode == "CUSTOM",
                                    onClick = {
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("bank_monitoring_mode", "CUSTOM"))
                                        }
                                    },
                                    label = { Text("Chỉ ngân hàng chọn", fontSize = 12.sp, fontWeight = if (bankMode == "CUSTOM") FontWeight.Bold else FontWeight.Normal) },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = AvoraRedPrimary,
                                        selectedLabelColor = Color.White,
                                        containerColor = Color.White,
                                        labelColor = Slate700
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        borderColor = if (bankMode == "CUSTOM") AvoraRedPrimary else Slate200,
                                        enabled = true,
                                        selected = bankMode == "CUSTOM"
                                    ),
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = if (bankMode == "ALL")
                                    "✓ Đang tự động nhận diện và đọc biến động của toàn bộ 20 ngân hàng Việt Nam."
                                else
                                    "✓ Chỉ lọc và đồng bộ các ngân hàng bạn tích chọn bên dưới.",
                                fontSize = 11.5.sp,
                                color = if (bankMode == "ALL") Emerald600 else Color(0xFF2563EB)
                            )
                        }
                    }

                    // Section 2: Transaction Direction Filter
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text(
                                text = "CHIỀU BIẾN ĐỘNG GHI NHẬN",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate500,
                                letterSpacing = 0.8.sp
                            )
                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                FilterChip(
                                    selected = dirFilter == "CREDIT_ONLY",
                                    onClick = {
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("transaction_direction_filter", "CREDIT_ONLY"))
                                        }
                                    },
                                    label = { Text("Chỉ tiền vào (+CREDIT)", fontSize = 12.sp, fontWeight = if (dirFilter == "CREDIT_ONLY") FontWeight.Bold else FontWeight.Normal) },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = Emerald600,
                                        selectedLabelColor = Color.White,
                                        containerColor = Color.White,
                                        labelColor = Slate700
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        borderColor = if (dirFilter == "CREDIT_ONLY") Emerald600 else Slate200,
                                        enabled = true,
                                        selected = dirFilter == "CREDIT_ONLY"
                                    ),
                                    modifier = Modifier.weight(1f)
                                )

                                FilterChip(
                                    selected = dirFilter == "ALL",
                                    onClick = {
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("transaction_direction_filter", "ALL"))
                                        }
                                    },
                                    label = { Text("Cả tiền ra & vào", fontSize = 12.sp, fontWeight = if (dirFilter == "ALL") FontWeight.Bold else FontWeight.Normal) },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = Slate800,
                                        selectedLabelColor = Color.White,
                                        containerColor = Color.White,
                                        labelColor = Slate700
                                    ),
                                    border = FilterChipDefaults.filterChipBorder(
                                        borderColor = if (dirFilter == "ALL") Slate800 else Slate200,
                                        enabled = true,
                                        selected = dirFilter == "ALL"
                                    ),
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = if (dirFilter == "CREDIT_ONLY")
                                    "✓ Khuyên dùng cho quầy thu ngân: Bỏ qua các giao dịch trừ tiền cá nhân (-DEBIT) để không làm loãng sổ sách."
                                else
                                    "✓ Ghi nhận tất cả biến động cộng và trừ tiền tài khoản.",
                                fontSize = 11.5.sp,
                                color = Slate500
                            )
                        }
                    }

                    // Section 3: 20 Banks List Selection
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
                                Column {
                                    Text(
                                        text = "DANH SÁCH 20 NGÂN HÀNG VIỆT NAM",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate500,
                                        letterSpacing = 0.8.sp
                                    )
                                    Text(
                                        text = "Đã bật: ${enabledBanks.size} / ${SUPPORTED_20_BANKS.size} ngân hàng",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Slate800
                                    )
                                }

                                Row {
                                    TextButton(onClick = { selectAllBanks() }) {
                                        Text("Chọn tất cả", fontSize = 11.sp, color = AvoraRedPrimary, fontWeight = FontWeight.Bold)
                                    }
                                    TextButton(onClick = { deselectAllBanks() }) {
                                        Text("Bỏ chọn", fontSize = 11.sp, color = Slate500)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            HorizontalDivider(color = Color(0xFFF1F5F9))
                            Spacer(modifier = Modifier.height(6.dp))

                            // List of 20 Banks with Checkboxes
                            SUPPORTED_20_BANKS.forEachIndexed { index, bank ->
                                val isChecked = enabledBanks.contains(bank.code)
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { toggleBank(bank.code) }
                                        .padding(vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(6.dp),
                                            color = bank.tagColor.copy(alpha = 0.12f),
                                            modifier = Modifier.size(width = 46.dp, height = 28.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Text(
                                                    text = bank.code,
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 11.sp,
                                                    color = bank.tagColor
                                                )
                                            }
                                        }

                                        Spacer(modifier = Modifier.width(10.dp))

                                        Column {
                                            Text(
                                                text = bank.shortName,
                                                fontSize = 13.5.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Slate900
                                            )
                                            Text(
                                                text = bank.fullName,
                                                fontSize = 11.sp,
                                                color = Slate500,
                                                maxLines = 1
                                            )
                                        }
                                    }

                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = { toggleBank(bank.code) },
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = AvoraRedPrimary,
                                            checkmarkColor = Color.White
                                        )
                                    )
                                }

                                if (index < SUPPORTED_20_BANKS.size - 1) {
                                    HorizontalDivider(color = Color(0xFFF8FAFC), thickness = 0.5.dp)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))
                }
            } else {
                // TAB 2: GIỌNG ĐỌC TIỀN VỀ (VOICE SPEAKER)
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Card 1: Master Voice Toggle
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color(0xFFFFF7ED),
                                        modifier = Modifier.size(40.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Default.VolumeUp,
                                                contentDescription = null,
                                                tint = Color(0xFFEA580C),
                                                modifier = Modifier.size(22.dp)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(
                                            text = "Phát loa thông báo tiền về",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Slate900
                                        )
                                        Text(
                                            text = if (voiceEnabled) "Đang bật giọng đọc tiếng Việt" else "Đang tắt âm thanh",
                                            fontSize = 12.sp,
                                            color = if (voiceEnabled) Emerald600 else Slate400
                                        )
                                    }
                                }

                                Switch(
                                    checked = voiceEnabled,
                                    onCheckedChange = { checked ->
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("voice_announcement_enabled", checked.toString()))
                                        }
                                        Toast.makeText(
                                            context,
                                            if (checked) "Đã bật giọng đọc tiền về" else "Đã tắt giọng đọc",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    },
                                    colors = SwitchDefaults.colors(
                                        checkedThumbColor = Color.White,
                                        checkedTrackColor = Color(0xFFEA580C)
                                    )
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "Hệ thống sử dụng TextToSpeech phát âm thanh bằng tiếng Việt tự nhiên qua loa ngoài của thiết bị khi phát hiện có biến động số dư ngân hàng.",
                                fontSize = 12.sp,
                                color = Slate600,
                                lineHeight = 17.sp
                            )
                        }
                    }

                    // Card 2: Voice Test Button
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "THỬ NGHIỆM GIỌNG ĐỌC NGAY",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate500,
                                letterSpacing = 0.8.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Bấm nút dưới đây để kiểm tra âm lượng loa và giọng đọc mẫu của máy:",
                                fontSize = 12.sp,
                                color = Slate600
                            )
                            Spacer(modifier = Modifier.height(12.dp))

                            Button(
                                onClick = {
                                    val speaker = VoiceSpeaker.getInstance(context)
                                    speaker.speakTransactionReceived("Vietcombank", 50000L)
                                    Toast.makeText(context, "Đang thử phát âm thanh...", Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEA580C)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Thử phát âm thanh (Test Voice)",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }

                    // Card 3: Voice Content Options
                    Card(
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 0.5.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "TÙY CHỌN NỘI DUNG ĐỌC",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate500,
                                letterSpacing = 0.8.sp
                            )
                            Spacer(modifier = Modifier.height(10.dp))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("voice_include_bank", (!voiceIncludeBank).toString()))
                                        }
                                    }
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Đọc kèm tên ngân hàng", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate900)
                                    Text("VD: 'Vietcombank, đã nhận năm mươi nghìn đồng'", fontSize = 11.sp, color = Slate500)
                                }
                                Checkbox(
                                    checked = voiceIncludeBank,
                                    onCheckedChange = { checked ->
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("voice_include_bank", checked.toString()))
                                        }
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFFEA580C))
                                )
                            }

                            HorizontalDivider(color = Color(0xFFF1F5F9))

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("voice_include_order", (!voiceIncludeOrder).toString()))
                                        }
                                    }
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Đọc mã đơn hàng khi gạch nợ thành công", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate900)
                                    Text("VD: 'Đã thanh toán cho đơn hàng bàn M không chín'", fontSize = 11.sp, color = Slate500)
                                }
                                Checkbox(
                                    checked = voiceIncludeOrder,
                                    onCheckedChange = { checked ->
                                        scope.launch {
                                            db.configDao().set(ConfigEntity("voice_include_order", checked.toString()))
                                        }
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = Color(0xFFEA580C))
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))
                }
            }
        }
    }
}

