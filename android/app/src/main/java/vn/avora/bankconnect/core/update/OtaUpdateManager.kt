package vn.avora.bankconnect.core.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

object OtaUpdateManager {
    private const val TAG = "AVORA_OtaUpdate"

    suspend fun downloadAndInstall(
        context: Context,
        downloadUrl: String = "https://avorafnb.com/downloads/avora-bank-connect.apk",
        onProgress: (Int) -> Unit = {},
        onError: (String) -> Unit = {}
    ): Boolean = withContext(Dispatchers.IO) {
        val urlsToTry = listOf(
            downloadUrl,
            "https://avorafnb.com/downloads/avora-bank-connect.apk",
            "https://avorafnb.com/api/bank-connect/v1/app/download-latest"
        ).distinct()

        var lastError = "Không thể tải bản cập nhật"

        for (url in urlsToTry) {
            try {
                Log.i(TAG, "Thử tải bản cập nhật OTA từ $url")
                val client = OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(60, TimeUnit.SECONDS)
                    .build()

                val request = Request.Builder()
                    .url(url)
                    .build()

                val response = client.newCall(request).execute()
                if (!response.isSuccessful || response.body == null) {
                    lastError = "Tải bản cập nhật thất bại: HTTP ${response.code}"
                    continue
                }

                val body = response.body!!
                val contentLength = body.contentLength()
                val apkFile = File(context.cacheDir, "avora-bank-connect-update.apk")
                if (apkFile.exists()) apkFile.delete()

                val inputStream = body.byteStream()
                val outputStream = FileOutputStream(apkFile)
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalRead = 0L

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalRead += bytesRead
                    if (contentLength > 0) {
                        val progress = ((totalRead * 100) / contentLength).toInt()
                        withContext(Dispatchers.Main) {
                            onProgress(progress)
                        }
                    }
                }

                outputStream.flush()
                outputStream.close()
                inputStream.close()

                Log.i(TAG, "Đã tải xong APK OTA (${apkFile.length()} bytes). Kích hoạt trình cài đặt hệ thống...")

                withContext(Dispatchers.Main) {
                    installApk(context, apkFile)
                }
                return@withContext true
            } catch (e: Exception) {
                Log.w(TAG, "Lỗi tải từ $url: ${e.message}")
                lastError = "Lỗi cập nhật OTA: ${e.message}"
            }
        }

        withContext(Dispatchers.Main) {
            onError(lastError)
        }
        false
    }

    fun installApk(context: Context, apkFile: File) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    val permissionIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(permissionIntent)
                    Toast.makeText(context, "Vui lòng bật quyền 'Cài đặt ứng dụng không rõ nguồn gốc' để hoàn tất cập nhật", Toast.LENGTH_LONG).show()
                    return
                }
            }

            val apkUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.provider",
                apkFile
            )

            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi mở trình cài đặt APK: ${e.message}")
            Toast.makeText(context, "Lỗi mở bộ cài đặt: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}

