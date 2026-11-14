package vn.avorafnb.phucvu

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.webkit.*
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import vn.avorafnb.phucvu.databinding.ActivityMainBinding
import java.io.File
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    companion object {
        const val BASE_URL = "https://avorafnb.com/admin/pos/waiter"
        const val TRUSTED_HOST = "avorafnb.com"

        const val CHANNEL_ORDERS = "channel_orders"
        const val CHANNEL_QR = "channel_qr"
        const val CHANNEL_PAYMENT = "channel_payment"
        const val CHANNEL_SERVICE = "channel_service"
        const val CHANNEL_GENERAL = "channel_general"

        private const val PREFS_NAME = "avora_waiter_prefs"
        private const val KEY_INSTALLATION_ID = "device_installation_id"
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val notificationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions[Manifest.permission.POST_NOTIFICATIONS] ?: false
        } else true

        // Notify webview about granted permissions
        binding.webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('native_permissions_updated', { detail: { camera: $cameraGranted, location: $locationGranted, notification: $notificationGranted } }));",
            null
        )
    }

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val intent = result.data
            val uris: Array<Uri>? = if (intent?.clipData != null) {
                val count = intent.clipData!!.itemCount
                Array(count) { i -> intent.clipData!!.getItemAt(i).uri }
            } else if (intent?.data != null) {
                arrayOf(intent.data!!)
            } else null

            fileChooserCallback?.onReceiveValue(uris)
        } else {
            fileChooserCallback?.onReceiveValue(null)
        }
        fileChooserCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Edge-to-Edge System Bars & Safe Area Handling
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = true
        insetsController.isAppearanceLightNavigationBars = true

        ViewCompat.setOnApplyWindowInsetsListener(binding.rootContainer) { _, windowInsets ->
            val systemBars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
            val bottomPadding = maxOf(systemBars.bottom, ime.bottom)

            binding.rootContainer.setPadding(
                systemBars.left,
                systemBars.top,
                systemBars.right,
                bottomPadding
            )
            WindowInsetsCompat.CONSUMED
        }

        createNotificationChannels()
        setupBackNavigation()
        setupErrorRetry()
        setupWebView()

        checkAndRequestEssentialPermissions()

        // Handle initial navigation or deep link
        val startUrl = intent?.data?.toString() ?: BASE_URL
        loadTargetUrl(startUrl)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent?.data?.toString()?.let { deepLinkUrl ->
            if (isTrustedUri(Uri.parse(deepLinkUrl))) {
                binding.webView.loadUrl(deepLinkUrl)
            }
        }
    }

    private fun getOrCreateInstallationId(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        var id = prefs.getString(KEY_INSTALLATION_ID, null)
        if (id.isNullOrBlank()) {
            id = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_INSTALLATION_ID, id).apply()
        }
        return id
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val channels = listOf(
                NotificationChannel(
                    CHANNEL_ORDERS,
                    "Thông báo Đơn hàng",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Thông báo đơn hàng mới, thêm/xóa món, đổi bàn"
                    enableVibration(true)
                },
                NotificationChannel(
                    CHANNEL_QR,
                    "Yêu cầu QR Order",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Khách gọi món qua QR tại bàn"
                    enableVibration(true)
                },
                NotificationChannel(
                    CHANNEL_PAYMENT,
                    "Yêu cầu Thanh toán",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Khách yêu cầu thanh toán hóa đơn"
                    enableVibration(true)
                },
                NotificationChannel(
                    CHANNEL_SERVICE,
                    "Khách gọi nhân viên",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Yêu cầu hỗ trợ trực tiếp tại bàn"
                    enableVibration(true)
                },
                NotificationChannel(
                    CHANNEL_GENERAL,
                    "Thông báo chung",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Tin tức, ca làm việc, điểm danh"
                }
            )

            channels.forEach { manager.createNotificationChannel(it) }
        }
    }

    private fun checkAndRequestEssentialPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // First check if a modal or subscreen is open in Next.js webview
                binding.webView.evaluateJavascript(
                    "(function() { if (window.__handleAndroidBack) { return window.__handleAndroidBack(); } return false; })()"
                ) { result ->
                    val handledByWeb = result == "true"
                    if (handledByWeb) {
                        return@evaluateJavascript
                    }

                    // Second check if webview can go back
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                    } else {
                        // Confirm exit dialog
                        showExitConfirmationDialog()
                    }
                }
            }
        })
    }

    private fun showExitConfirmationDialog() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.exit_confirm_title))
            .setMessage(getString(R.string.exit_confirm_desc))
            .setPositiveButton(getString(R.string.btn_exit)) { _, _ ->
                finish()
            }
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .show()
    }

    private fun setupErrorRetry() {
        binding.btnRetry.setOnClickListener {
            binding.errorOverlay.visibility = View.GONE
            binding.webView.visibility = View.VISIBLE
            binding.webView.reload()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.webView
        val settings = webView.settings

        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW // Strict HTTPS
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false

            // Append custom app identifier to User Agent for server-side recognition
            val originalUa = userAgentString
            userAgentString = "$originalUa AvoraPhucVuApp/1.0.0 (Android Native WebView)"
        }

        // Enable cookies
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }

        // Inject Native Bridge
        webView.addJavascriptInterface(AvoraNativeBridge(), "AvoraNativeBridge")

        // Setup WebChromeClient
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                binding.progressBar.progress = newProgress
                if (newProgress in 1..99) {
                    binding.progressBar.visibility = View.VISIBLE
                } else {
                    binding.progressBar.visibility = View.GONE
                    // Hide splash once loaded
                    if (binding.splashOverlay.visibility == View.VISIBLE) {
                        binding.splashOverlay.animate()
                            .alpha(0f)
                            .setDuration(300)
                            .withEndAction { binding.splashOverlay.visibility = View.GONE }
                            .start()
                    }
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val origin = request.origin?.host ?: ""
                if (origin.equals(TRUSTED_HOST, ignoreCase = true) || origin.endsWith(".$TRUSTED_HOST")) {
                    val requestedResources = request.resources
                    val grantedResources = mutableListOf<String>()

                    for (resource in requestedResources) {
                        if (resource == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                                grantedResources.add(resource)
                            }
                        }
                    }

                    if (grantedResources.isNotEmpty()) {
                        request.grant(grantedResources.toTypedArray())
                    } else {
                        request.deny()
                    }
                } else {
                    request.deny()
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                if (origin != null && (origin.contains(TRUSTED_HOST))) {
                    val hasLocation = ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED

                    callback?.invoke(origin, hasLocation, false)
                } else {
                    callback?.invoke(origin, false, false)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    return false
                }
                return true
            }
        }

        // Setup WebViewClient
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (isTrustedUri(uri)) {
                    return false // Let WebView handle it
                }

                // External links or special protocols (tel:, mailto:) open in external apps
                return try {
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    startActivity(intent)
                    true
                } catch (e: Exception) {
                    true
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                binding.errorOverlay.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    if (!isNetworkAvailable()) {
                        binding.errorOverlay.visibility = View.VISIBLE
                        binding.webView.visibility = View.GONE
                    }
                }
            }
        }

        // File download listener
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, _ ->
            downloadFile(url, URLUtil.guessFileName(url, contentDisposition, mimetype), mimetype)
        }
    }

    private fun isTrustedUri(uri: Uri): Boolean {
        val host = uri.host ?: return false
        return host.equals(TRUSTED_HOST, ignoreCase = true) || host.endsWith(".$TRUSTED_HOST")
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun loadTargetUrl(url: String) {
        if (isNetworkAvailable()) {
            binding.webView.loadUrl(url)
        } else {
            binding.errorOverlay.visibility = View.VISIBLE
            binding.webView.visibility = View.GONE
            binding.splashOverlay.visibility = View.GONE
        }
    }

    private fun downloadFile(url: String, fileName: String, mimeType: String) {
        try {
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setMimeType(mimeType)
                addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                addRequestHeader("User-Agent", binding.webView.settings.userAgentString)
                setDescription("Tải tệp từ AVORA Restaurant...")
                setTitle(fileName)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Đang tải xuống: $fileName", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Lỗi khi tải tệp", Toast.LENGTH_SHORT).show()
        }
    }

    private fun triggerHaptic() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vm.defaultVibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
        } else {
            @Suppress("DEPRECATION")
            val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(30, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(30)
            }
        }
    }

    // ==========================================
    // NATIVE JAVASCRIPT BRIDGE (PHASE 6)
    // ==========================================

    inner class AvoraNativeBridge {

        @JavascriptInterface
        fun getDeviceInfo(): String {
            val installationId = getOrCreateInstallationId()
            return """{"appVersion":"1.0.0","platform":"ANDROID_NATIVE","installationId":"$installationId","apiLevel":${Build.VERSION.SDK_INT}}"""
        }

        @JavascriptInterface
        fun requestCameraPermission() {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
                }
            }
        }

        @JavascriptInterface
        fun requestLocationPermission() {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
            }
        }

        @JavascriptInterface
        fun openAppSettings() {
            val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            }
            startActivity(intent)
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun triggerHapticFeedback() {
            triggerHaptic()
        }

        @JavascriptInterface
        fun downloadFile(url: String, fileName: String, mimeType: String) {
            runOnUiThread {
                this@MainActivity.downloadFile(url, fileName, mimeType)
            }
        }
    }
}

