package vn.avora.bankconnect.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import vn.avora.bankconnect.R
import vn.avora.bankconnect.ui.theme.*

/**
 * Enterprise Header chuẩn AVORA BANK CONNECT
 * - Tích hợp statusBarsPadding() duy nhất 1 lần chuẩn xác
 * - Chiều cao cố định 64dp (không tính System Status Bar)
 * - Logo AVORA chính thức bên trái
 * - Tiêu đề & phụ đề sắc nét phong cách Fintech
 * - Khu vực Actions / Settings căn giữa dọc bên phải
 */
@Composable
fun AvoraTopHeader(
    title: String = "AVORA BANK CONNECT",
    subtitle: String? = "Bank Transaction Monitor",
    navigationIcon: (@Composable () -> Unit)? = null,
    actions: (@Composable RowScope.() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color.White,
        shadowElevation = 0.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Bên trái: Nav Icon hoặc Logo AVORA + Tên ứng dụng
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f, fill = false)
                ) {
                    if (navigationIcon != null) {
                        navigationIcon()
                        Spacer(modifier = Modifier.width(8.dp))
                    } else {
                        Surface(
                            modifier = Modifier.size(36.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = Color.Transparent
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Image(
                                    painter = painterResource(id = R.drawable.avora_logo),
                                    contentDescription = "AVORA Logo",
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                    }

                    Column(
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Slate900,
                                fontSize = 15.sp,
                                letterSpacing = 0.2.sp
                            ),
                            maxLines = 1
                        )
                        if (!subtitle.isNullOrBlank()) {
                            Text(
                                text = subtitle,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = Slate500,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                ),
                                maxLines = 1
                            )
                        }
                    }
                }

                // Bên phải: Actions (Nút Settings, Bộ lọc, Status pill, ...)
                if (actions != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.End
                    ) {
                        actions()
                    }
                }
            }

            // Viền 1px mỏng dưới Header
            HorizontalDivider(
                thickness = 1.dp,
                color = Slate200
            )
        }
    }
}

