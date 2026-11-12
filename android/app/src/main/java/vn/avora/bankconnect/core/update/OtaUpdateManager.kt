package vn.avora.bankconnect.core.update

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.CacheControl
import okhttp3.OkHttpClient
import okhttp3.Request
import vn.avora.bankconnect.core.network.AppVersionData
import vn.avora.bankconnect.core.network.NetworkClient
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.TimeUnit

object OtaUpdateManager {
    private const val TAG = "AVORA_OtaUpdate"
    private const val EXPECTED_PACKAGE_NAME = "vn.avora.bankconnect"

    data class InstalledAppInfo(
        val packageName: String,
        val versionName: String,
        val versionCode: Long
    )

    fun getInstalledAppInfo(context: Context): InstalledAppInfo {
        return try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            val vCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }
            InstalledAppInfo(
                packageName = context.packageName,
                versionName = pInfo.versionName ?: "1.0.5",
                versionCode = vCode
            )
        } catch (e: Exception) {
            InstalledAppInfo(
                packageName = EXPECTED_PACKAGE_NAME,
                versionName = "1.0.5",
                versionCode = 6L
            )
        }
    }

    suspend fun fetchLatestVersionMetadata(context: Context): AppVersionData? = withContext(Dispatchers.IO) {
        try {
            val api = NetworkClient.getApiService(context)
            val resp = api.getAppVersion()
            if (resp.isSuccessful && resp.body()?.success == true && resp.body()?.data != null) {
                resp.body()!!.data
            } else {
                Log.w(TAG, "Không lấy được metadata OTA từ server: HTTP ${resp.code()}")
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Lỗi truy vấn metadata OTA: ${e.message}")
            null
        }
    }

    suspend fun downloadAndInstall(
        context: Context,
        downloadUrl: String = "https://avorafnb.com/api/bank-connect/v1/app/download-latest",
        allowReinstallSameVersion: Boolean = false,
        onProgress: (Int) -> Unit = {},
        onStatusText: (String) -> Unit = {},
        onError: (String) -> Unit = {}
    ): Boolean = withContext(Dispatchers.IO) {
        val installed = getInstalledAppInfo(context)

        withContext(Dispatchers.Main) {
            onStatusText("Đang kiểm tra thông tin phiên bản trên máy chủ...")
        }

        val metadata = fetchLatestVersionMetadata(context)
        if (metadata != null) {
            if (metadata.packageName.isNotBlank() && metadata.packageName != installed.packageName) {
                val err = "Từ chối cập nhật: Package trên máy chủ (${metadata.packageName}) không khớp với ứng dụng (${installed.packageName})"
                Log.e(TAG, err)
                withContext(Dispatchers.Main) { onError(err) }
                return@withContext false
            }

            if (metadata.versionCode.toLong() < installed.versionCode) {
                val err = "Chặn hạ cấp (Downgrade): Bản trên máy chủ v${metadata.versionName} (Build ${metadata.versionCode}) cũ hơn bản đang cài v${installed.versionName} (Build ${installed.versionCode})"
                Log.w(TAG, err)
                withContext(Dispatchers.Main) { onError(err) }
                return@withContext false
            }

            if (!allowReinstallSameVersion && metadata.versionCode.toLong() <= installed.versionCode) {
                val msg = "Thiết bị đang ở phiên bản mới nhất v${installed.versionName} (Build ${installed.versionCode})"
                Log.i(TAG, msg)
                withContext(Dispatchers.Main) { onError(msg) }
                return@withContext false
            }
        }

        val urlsToTry = buildList {
            if (metadata?.downloadUrl?.isNotBlank() == true) add(metadata.downloadUrl)
            if (metadata?.staticDownloadUrl?.isNotBlank() == true) add(metadata.staticDownloadUrl)
            if (downloadUrl.isNotBlank()) add(downloadUrl)
            add("https://avorafnb.com/api/bank-connect/v1/app/download-latest")
            add("https://avorafnb.com/downloads/avora-bank-connect.apk")
        }.distinct()

        var lastError = "Không thể tải bản cập nhật từ máy chủ"

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .cache(null)
            .build()

        for (baseUrl in urlsToTry) {
            val tmpFile = File(context.cacheDir, "avora-bank-connect-ota-temp.apk")
            try {
                if (tmpFile.exists()) tmpFile.delete()

                val separator = if (baseUrl.contains("?")) "&" else "?"
                val cacheBustedUrl = "${baseUrl}${separator}v=${metadata?.versionCode ?: 5}&t=${System.currentTimeMillis()}"
                Log.i(TAG, "Đang tải APK OTA từ: $cacheBustedUrl")

                val request = Request.Builder()
                    .url(cacheBustedUrl)
                    .cacheControl(CacheControl.FORCE_NETWORK)
                    .header("Cache-Control", "no-cache, no-store, must-revalidate")
                    .header("Pragma", "no-cache")
                    .build()

                val response = client.newCall(request).execute()
                if (!response.isSuccessful || response.body == null) {
                    lastError = "Tải bản cập nhật thất bại: HTTP ${response.code}"
                    response.close()
                    continue
                }

                val body = response.body!!
                val expectedSize = if ((metadata?.fileSize ?: 0L) > 0L) metadata!!.fileSize else body.contentLength()
                val digest = MessageDigest.getInstance("SHA-256")

                withContext(Dispatchers.Main) {
                    onStatusText("Đang tải gói cài đặt chuẩn...")
                }

                body.byteStream().use { inputStream ->
                    FileOutputStream(tmpFile).use { outputStream ->
                        val buffer = ByteArray(8192)
                        var bytesRead: Int
                        var totalRead = 0L

                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            outputStream.write(buffer, 0, bytesRead)
                            digest.update(buffer, 0, bytesRead)
                            totalRead += bytesRead
                            if (expectedSize > 0) {
                                val progress = ((totalRead * 100) / expectedSize).toInt().coerceIn(0, 100)
                                withContext(Dispatchers.Main) {
                                    onProgress(progress)
                                }
                            }
                        }
                        outputStream.flush()
                    }
                }

                val actualSize = tmpFile.length()
                val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }

                withContext(Dispatchers.Main) {
                    onStatusText("Đang kiểm tra tính toàn vẹn SHA-256 & Chữ ký APK...")
                }

                // 1. Kiểm tra dung lượng file
                if (metadata != null && metadata.fileSize > 0L && actualSize != metadata.fileSize) {
                    lastError = "File APK tải về bị lỗi dung lượng ($actualSize / ${metadata.fileSize} bytes)"
                    Log.e(TAG, lastError)
                    tmpFile.delete()
                    continue
                }

                // 2. Kiểm tra mã băm SHA-256
                val headerSha256 = response.header("X-Apk-Sha256").orEmpty()
                val expectedSha256 = metadata?.sha256?.ifBlank { headerSha256 } ?: headerSha256
                if (expectedSha256.isNotBlank() && !actualSha256.equals(expectedSha256, ignoreCase = true)) {
                    lastError = "Cảnh báo: SHA-256 của file APK không khớp với máy chủ!"
                    Log.e(TAG, "$lastError (Thực tế: $actualSha256 != Chuẩn: $expectedSha256)")
                    tmpFile.delete()
                    continue
                }

                // 3. Kiểm tra cấu trúc APK, packageName, versionCode và chữ ký số (Signing Certificate)
                val verificationError = verifyDownloadedApkArchive(
                    context = context,
                    apkFile = tmpFile,
                    installed = installed,
                    expectedVersionCode = metadata?.versionCode?.toLong()
                )
                if (verificationError != null) {
                    lastError = verificationError
                    Log.e(TAG, verificationError)
                    tmpFile.delete()
                    continue
                }

                val finalApkFile = File(context.cacheDir, "avora-bank-connect-update.apk")
                if (finalApkFile.exists()) finalApkFile.delete()
                if (!tmpFile.renameTo(finalApkFile)) {
                    tmpFile.copyTo(finalApkFile, overwrite = true)
                    tmpFile.delete()
                }

                Log.i(
                    TAG,
                    "Xác thực APK OTA thành công (${finalApkFile.length()} bytes, SHA-256: $actualSha256). Mở bộ cài đặt Android..."
                )

                withContext(Dispatchers.Main) {
                    onProgress(100)
                    onStatusText("Xác thực hoàn tất! Đang mở trình cài đặt hệ thống...")
                    installApk(context, finalApkFile, metadata?.versionName)
                }
                return@withContext true
            } catch (e: Exception) {
                Log.w(TAG, "Lỗi tải hoặc xác thực từ $baseUrl: ${e.message}")
                lastError = "Lỗi cập nhật OTA: ${e.message}"
                if (tmpFile.exists()) tmpFile.delete()
            }
        }

        withContext(Dispatchers.Main) {
            onError(lastError)
        }
        false
    }

    private fun verifyDownloadedApkArchive(
        context: Context,
        apkFile: File,
        installed: InstalledAppInfo,
        expectedVersionCode: Long?
    ): String? {
        return try {
            val pm = context.packageManager
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_SIGNING_CERTIFICATES
            } else {
                @Suppress("DEPRECATION")
                PackageManager.GET_SIGNATURES
            }

            val archiveInfo = pm.getPackageArchiveInfo(apkFile.absolutePath, flags)
                ?: return "File tải về không phải là gói cài đặt APK Android hợp lệ!"

            // Kiểm tra đúng packageName vn.avora.bankconnect (chặn nhầm bản .debug)
            if (archiveInfo.packageName != installed.packageName) {
                return "Chặn cài đặt: File APK có package '${archiveInfo.packageName}' khác với ứng dụng hiện tại '${installed.packageName}'!"
            }

            val archiveVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                archiveInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                archiveInfo.versionCode.toLong()
            }

            // Chặn tuyệt đối trường hợp server trả nhầm file APK có versionCode thấp hơn bản đang cài
            if (archiveVersionCode < installed.versionCode) {
                return "Chặn cài đặt bản cũ: File APK tải về là v${archiveInfo.versionName} (Build $archiveVersionCode), cũ hơn bản đang cài v${installed.versionName} (Build ${installed.versionCode})!"
            }

            if (expectedVersionCode != null && archiveVersionCode != expectedVersionCode) {
                return "File APK tải về có Build $archiveVersionCode không khớp với metadata máy chủ (Build $expectedVersionCode)!"
            }

            // Kiểm tra chữ ký số (Signing Certificate) khớp với ứng dụng đang cài để tránh lỗi "Ứng dụng chưa được cài đặt do xung đột chữ ký"
            val installedCertSha256 = getInstalledSignatureSha256(context)
            val archiveCertSha256 = extractSignatureSha256(archiveInfo)
            if (installedCertSha256 != null && archiveCertSha256 != null &&
                !installedCertSha256.equals(archiveCertSha256, ignoreCase = true)
            ) {
                return "Chữ ký bảo mật (Signing Key) của file APK mới không khớp với bản đang cài trên thiết bị!"
            }

            null
        } catch (e: Exception) {
            Log.w(TAG, "Lỗi khi kiểm tra gói APK: ${e.message}")
            "Không thể xác thực gói cài đặt APK: ${e.message}"
        }
    }

    private fun getInstalledSignatureSha256(context: Context): String? {
        return try {
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_SIGNING_CERTIFICATES
            } else {
                @Suppress("DEPRECATION")
                PackageManager.GET_SIGNATURES
            }
            val pkgInfo = context.packageManager.getPackageInfo(context.packageName, flags)
            extractSignatureSha256(pkgInfo)
        } catch (e: Exception) {
            null
        }
    }

    private fun extractSignatureSha256(pkgInfo: PackageInfo): String? {
        return try {
            val sigBytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val signingInfo = pkgInfo.signingInfo
                val sigs = if (signingInfo != null) {
                    if (signingInfo.hasMultipleSigners()) signingInfo.apkContentsSigners else signingInfo.signingCertificateHistory
                } else null
                sigs?.firstOrNull()?.toByteArray()
            } else {
                @Suppress("DEPRECATION")
                pkgInfo.signatures?.firstOrNull()?.toByteArray()
            } ?: return null

            MessageDigest.getInstance("SHA-256")
                .digest(sigBytes)
                .joinToString(":") { "%02X".format(Locale.US, it) }
        } catch (e: Exception) {
            null
        }
    }

    fun installApk(context: Context, apkFile: File, versionName: String? = null) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.packageManager.canRequestPackageInstalls()) {
                    val permissionIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(permissionIntent)
                    Toast.makeText(
                        context,
                        "Vui lòng cấp quyền 'Cài đặt ứng dụng không rõ nguồn gốc' rồi bấm Cập nhật lại",
                        Toast.LENGTH_LONG
                    ).show()
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

            val verLabel = if (!versionName.isNullOrBlank()) "v$versionName" else "mới"
            Toast.makeText(
                context,
                "Đã xác thực gói APK $verLabel an toàn. Vui lòng bấm 'Cập nhật' trên hộp thoại hệ thống Android.",
                Toast.LENGTH_LONG
            ).show()
            context.startActivity(installIntent)
        } catch (e: Exception) {
            Log.e(TAG, "Lỗi mở trình cài đặt APK: ${e.message}")
            Toast.makeText(context, "Lỗi mở bộ cài đặt: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
}
