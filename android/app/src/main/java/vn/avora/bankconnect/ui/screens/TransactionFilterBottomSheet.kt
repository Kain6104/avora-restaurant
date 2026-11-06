package vn.avora.bankconnect.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import vn.avora.bankconnect.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

data class TransactionFilterState(
    val keyword: String = "",
    val selectedBanks: Set<String> = emptySet(), // Rỗng nghĩa là Tất cả
    val direction: String = "ALL", // ALL, CREDIT, DEBIT
    val matchedStatus: String = "ALL", // ALL, MATCHED, UNMATCHED, REVIEW_REQUIRED, IGNORED, DUPLICATE
    val timeRange: String = "ALL", // ALL, TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS
    val minAmount: Long? = null,
    val maxAmount: Long? = null
) {
    fun activeCount(): Int {
        var count = 0
        if (keyword.isNotBlank()) count++
        if (selectedBanks.isNotEmpty()) count++
        if (direction != "ALL") count++
        if (matchedStatus != "ALL") count++
        if (timeRange != "ALL") count++
        if (minAmount != null || maxAmount != null) count++
        return count
    }
}

val SUPPORTED_BANKS_CATALOG = listOf(
    "VCB" to "Vietcombank",
    "OCB" to "OCB (Phương Đông)",
    "MB" to "MB Bank",
    "TCB" to "Techcombank",
    "ACB" to "ACB",
    "BIDV" to "BIDV",
    "CTG" to "VietinBank",
    "VBA" to "Agribank",
    "VPB" to "VPBank",
    "TPB" to "TPBank",
    "STB" to "Sacombank",
    "HDB" to "HDBank",
    "VIB" to "VIB",
    "MSB" to "MSB",
    "EIB" to "Eximbank"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionFilterBottomSheet(
    currentState: TransactionFilterState,
    onApply: (TransactionFilterState) -> Unit,
    onDismiss: () -> Unit
) {
    var state by remember { mutableStateOf(currentState) }
    var bankSearchQuery by remember { mutableStateOf("") }
    var minAmountText by remember { mutableStateOf(currentState.minAmount?.toString() ?: "") }
    var maxAmountText by remember { mutableStateOf(currentState.maxAmount?.toString() ?: "") }

    val filteredBanks = remember(bankSearchQuery) {
        if (bankSearchQuery.isBlank()) {
            SUPPORTED_BANKS_CATALOG
        } else {
            SUPPORTED_BANKS_CATALOG.filter {
                it.first.contains(bankSearchQuery, ignoreCase = true) ||
                        it.second.contains(bankSearchQuery, ignoreCase = true)
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
        dragHandle = {
            BottomSheetDefaults.DragHandle(
                color = Slate300,
                width = 40.dp,
                height = 4.dp
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Bộ lọc giao dịch nâng cao",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = Slate900,
                            fontSize = 17.sp
                        )
                    )
                    if (state.activeCount() > 0) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            color = Color(0xFFFFEBEE),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(
                                text = "${state.activeCount()}",
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = AvoraRedPrimary
                            )
                        }
                    }
                }

                TextButton(
                    onClick = {
                        state = TransactionFilterState()
                        minAmountText = ""
                        maxAmountText = ""
                        bankSearchQuery = ""
                    }
                ) {
                    Text(
                        "Đặt lại",
                        color = AvoraRedPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }

            HorizontalDivider(thickness = 1.dp, color = Slate200)

            // Content List
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(vertical = 16.dp)
            ) {
                // 1. Tìm kiếm từ khóa
                item {
                    Text(
                        text = "TÌM KIẾM THEO TỪ KHÓA",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = state.keyword,
                        onValueChange = { state = state.copy(keyword = it) },
                        placeholder = { Text("Mã tham chiếu, mã đơn, nội dung...", fontSize = 13.sp, color = Slate400) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Slate400, modifier = Modifier.size(20.dp)) },
                        trailingIcon = {
                            if (state.keyword.isNotEmpty()) {
                                IconButton(onClick = { state = state.copy(keyword = "") }) {
                                    Icon(Icons.Default.Clear, contentDescription = null, tint = Slate400, modifier = Modifier.size(18.dp))
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AvoraRedPrimary,
                            unfocusedBorderColor = Slate300
                        )
                    )
                }

                // 2. Chiều giao dịch
                item {
                    Text(
                        text = "LOẠI GIAO DỊCH",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            "ALL" to "Tất cả",
                            "CREDIT" to "Tiền vào (+)",
                            "DEBIT" to "Tiền ra (-)"
                        ).forEach { (code, label) ->
                            val isSelected = state.direction == code
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(38.dp)
                                    .clickable { state = state.copy(direction = code) },
                                shape = RoundedCornerShape(8.dp),
                                color = if (isSelected) AvoraRedPrimary else Slate100,
                                border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, Slate200)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = label,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) Color.White else Slate700
                                    )
                                }
                            }
                        }
                    }
                }

                // 3. Trạng thái đối soát
                item {
                    Text(
                        text = "TRẠNG THÁI ĐỐI SOÁT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val statuses = listOf(
                            "ALL" to "Tất cả",
                            "MATCHED" to "Đã khớp đơn",
                            "UNMATCHED" to "Chưa khớp",
                            "REVIEW_REQUIRED" to "Cần kiểm tra",
                            "IGNORED" to "Đã bỏ qua",
                            "DUPLICATE" to "Trùng lặp"
                        )
                        items(statuses) { (code, label) ->
                            val isSelected = state.matchedStatus == code
                            FilterChip(
                                selected = isSelected,
                                onClick = { state = state.copy(matchedStatus = code) },
                                label = { Text(label, fontSize = 12.sp) },
                                shape = RoundedCornerShape(8.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = AvoraRedPrimary,
                                    selectedLabelColor = Color.White,
                                    containerColor = Slate100,
                                    labelColor = Slate700
                                )
                            )
                        }
                    }
                }

                // 4. Khoảng thời gian
                item {
                    Text(
                        text = "KHOẢNG THỜI GIAN",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val times = listOf(
                            "ALL" to "Tất cả",
                            "TODAY" to "Hôm nay",
                            "YESTERDAY" to "Hôm qua",
                            "LAST_7_DAYS" to "7 ngày gần nhất",
                            "LAST_30_DAYS" to "30 ngày gần nhất"
                        )
                        items(times) { (code, label) ->
                            val isSelected = state.timeRange == code
                            FilterChip(
                                selected = isSelected,
                                onClick = { state = state.copy(timeRange = code) },
                                label = { Text(label, fontSize = 12.sp) },
                                shape = RoundedCornerShape(8.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = AvoraRedPrimary,
                                    selectedLabelColor = Color.White,
                                    containerColor = Slate100,
                                    labelColor = Slate700
                                )
                            )
                        }
                    }
                }

                // 5. Khoảng số tiền (VND)
                item {
                    Text(
                        text = "KHOẢNG TIỀN (VND)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate500,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = minAmountText,
                            onValueChange = {
                                minAmountText = it.filter { char -> char.isDigit() }
                                state = state.copy(minAmount = minAmountText.toLongOrNull())
                            },
                            label = { Text("Từ số tiền", fontSize = 11.sp) },
                            placeholder = { Text("0 đ", fontSize = 12.sp) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = maxAmountText,
                            onValueChange = {
                                maxAmountText = it.filter { char -> char.isDigit() }
                                state = state.copy(maxAmount = maxAmountText.toLongOrNull())
                            },
                            label = { Text("Đến số tiền", fontSize = 11.sp) },
                            placeholder = { Text("Không giới hạn", fontSize = 12.sp) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            singleLine = true
                        )
                    }
                }

                // 6. Ngân hàng phát hành
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "NGÂN HÀNG (${if (state.selectedBanks.isEmpty()) "Tất cả" else "${state.selectedBanks.size} đã chọn"})",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate500,
                            letterSpacing = 0.5.sp
                        )
                        Row {
                            TextButton(
                                onClick = { state = state.copy(selectedBanks = emptySet()) },
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("Tất cả", fontSize = 11.sp, color = AvoraRedPrimary)
                            }
                            TextButton(
                                onClick = { state = state.copy(selectedBanks = SUPPORTED_BANKS_CATALOG.map { it.first }.toSet()) },
                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text("Chọn hết", fontSize = 11.sp, color = Slate600)
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = bankSearchQuery,
                        onValueChange = { bankSearchQuery = it },
                        placeholder = { Text("Tìm kiếm ngân hàng...", fontSize = 12.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp), tint = Slate400) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        filteredBanks.forEach { (code, name) ->
                            val isChecked = state.selectedBanks.contains(code)
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        val newSet = state.selectedBanks.toMutableSet()
                                        if (isChecked) {
                                            newSet.remove(code)
                                        } else {
                                            newSet.add(code)
                                        }
                                        state = state.copy(selectedBanks = newSet)
                                    },
                                color = if (isChecked) Color(0xFFFFF1F2) else Color.Transparent
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 8.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = { checked ->
                                            val newSet = state.selectedBanks.toMutableSet()
                                            if (checked) newSet.add(code) else newSet.remove(code)
                                            state = state.copy(selectedBanks = newSet)
                                        },
                                        colors = CheckboxDefaults.colors(
                                            checkedColor = AvoraRedPrimary
                                        ),
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = code,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = if (isChecked) AvoraRedPrimary else Slate900
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "- $name",
                                        fontSize = 12.sp,
                                        color = Slate600
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Bottom Actions: Apply Button
            Surface(
                color = Color.White,
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp),
                        shape = RoundedCornerShape(10.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate300)
                    ) {
                        Text("Đóng", color = Slate700, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            onApply(state)
                            onDismiss()
                        },
                        modifier = Modifier
                            .weight(2f)
                            .height(46.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = AvoraRedPrimary),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            text = if (state.activeCount() > 0) "Áp dụng (${state.activeCount()})" else "Áp dụng",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        }
    }
}

