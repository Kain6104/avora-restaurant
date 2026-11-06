package vn.avora.bankconnect.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val PureWhiteColorScheme = lightColorScheme(
    primary = AvoraRedPrimary,
    onPrimary = Color.White,
    primaryContainer = Color.White,
    onPrimaryContainer = AvoraRedPrimary,
    secondary = TextSecondary,
    onSecondary = Color.White,
    background = Color.White,
    surface = Color.White,
    surfaceVariant = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    onSurfaceVariant = TextSecondary,
    outline = BorderLight,
    outlineVariant = BorderLight
)

@Composable
fun AvoraBankTheme(
    darkTheme: Boolean = false, // Luôn đồng bộ 100% Pure White Fintech UI
    content: @Composable () -> Unit
) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = android.graphics.Color.WHITE
            window.navigationBarColor = android.graphics.Color.WHITE
            val insetsController = WindowCompat.getInsetsController(window, view)
            insetsController.isAppearanceLightStatusBars = true
            insetsController.isAppearanceLightNavigationBars = true
        }
    }

    MaterialTheme(
        colorScheme = PureWhiteColorScheme,
        content = content
    )
}
