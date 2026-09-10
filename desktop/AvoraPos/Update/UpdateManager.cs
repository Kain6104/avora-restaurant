using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using AvoraPos.Storage;
using Newtonsoft.Json;

namespace AvoraPos.Update
{
    public class UpdateManager
    {
        private static UpdateManager? _instance;
        public static UpdateManager Instance => _instance ??= new UpdateManager();

        public const string CurrentVersion = "1.0.1";
        public const int CurrentBuild = 101;

        private readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        public async Task<UpdateCheckResult> CheckForUpdateAsync(string? manifestUrl = null)
        {
            var result = new UpdateCheckResult
            {
                CurrentVersion = CurrentVersion,
                CurrentBuild = CurrentBuild
            };

            try
            {
                string url = manifestUrl
                    ?? Environment.GetEnvironmentVariable("AVORA_UPDATE_URL")
                    ?? "http://localhost:3001/api/pos-desktop/update/latest";

                var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    result.Error = $"Máy chủ cập nhật trả về mã: {(int)response.StatusCode}";
                    return result;
                }

                string json = await response.Content.ReadAsStringAsync();
                var manifest = JsonConvert.DeserializeObject<UpdateManifest>(json);

                if (manifest == null)
                {
                    result.Error = "Dữ liệu cập nhật từ máy chủ không hợp lệ";
                    return result;
                }

                result.Manifest = manifest;

                // Compare version numbers
                if (Version.TryParse(manifest.Version, out var remoteVer) &&
                    Version.TryParse(CurrentVersion, out var localVer))
                {
                    result.UpdateAvailable = remoteVer > localVer;

                    if (Version.TryParse(manifest.MinimumSupportedVersion, out var minVer))
                    {
                        result.IsMandatory = localVer < minVer || manifest.UpdateType.Equals("MANDATORY", StringComparison.OrdinalIgnoreCase);
                    }
                    else
                    {
                        result.IsMandatory = manifest.UpdateType.Equals("MANDATORY", StringComparison.OrdinalIgnoreCase);
                    }
                }
                else
                {
                    // Fallback to build number comparison
                    result.UpdateAvailable = manifest.Build > CurrentBuild;
                    result.IsMandatory = manifest.UpdateType.Equals("MANDATORY", StringComparison.OrdinalIgnoreCase);
                }

                return result;
            }
            catch (Exception ex)
            {
                result.Error = $"Lỗi kết nối máy chủ cập nhật: {ex.Message}";
                return result;
            }
        }

        public async Task<string> DownloadUpdateAsync(UpdateManifest manifest, Action<long, long, double>? onProgress = null)
        {
            if (string.IsNullOrWhiteSpace(manifest.DownloadUrl))
            {
                throw new InvalidOperationException("Địa chỉ tải về bản cập nhật rỗng.");
            }

            string targetDir = AppDataPaths.UpdatesDir;
            string targetFile = Path.Combine(targetDir, $"AVORA-POS-Update-{manifest.Version}.exe");

            using (var response = await _httpClient.GetAsync(manifest.DownloadUrl, HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();

                long totalBytes = response.Content.Headers.ContentLength ?? manifest.FileSize;
                using (var contentStream = await response.Content.ReadAsStreamAsync())
                using (var fileStream = new FileStream(targetFile, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true))
                {
                    byte[] buffer = new byte[8192];
                    long totalRead = 0;
                    int read;

                    while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        await fileStream.WriteAsync(buffer, 0, read);
                        totalRead += read;

                        double pct = totalBytes > 0 ? (double)totalRead / totalBytes * 100.0 : 0.0;
                        onProgress?.Invoke(totalRead, totalBytes, pct);
                    }
                }
            }

            // Verify SHA256 if provided (Directive 82)
            if (!string.IsNullOrWhiteSpace(manifest.Sha256))
            {
                string calculatedHash = ComputeSha256(targetFile);
                if (!calculatedHash.Equals(manifest.Sha256.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    try { File.Delete(targetFile); } catch { }
                    throw new InvalidOperationException($"Mã băm SHA-256 không khớp! File: {calculatedHash}, Kỳ vọng: {manifest.Sha256}");
                }
            }

            return targetFile;
        }

        public void ApplyUpdate(string installerPath)
        {
            if (!File.Exists(installerPath))
            {
                throw new FileNotFoundException("Không tìm thấy tệp cài đặt cập nhật", installerPath);
            }

            string currentExe = Process.GetCurrentProcess().MainModule?.FileName
                ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AvoraPos.exe");

            // Launch detached updater script (Directive 84)
            // Waits 2 seconds for current process to exit, runs installer silently, then relaunches
            string cmdArgs = $"/c timeout /t 2 /nobreak > nul & \"{installerPath}\" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART & start \"\" \"{currentExe}\"";

            var startInfo = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = cmdArgs,
                CreateNoWindow = true,
                UseShellExecute = false,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            Process.Start(startInfo);

            // Gracefully close current application
            Application.Current.Dispatcher.Invoke(() =>
            {
                Application.Current.Shutdown(0);
            });
        }

        private static string ComputeSha256(string filePath)
        {
            using var sha = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            byte[] hash = sha.ComputeHash(stream);
            var sb = new StringBuilder();
            foreach (byte b in hash)
            {
                sb.Append(b.ToString("x2"));
            }
            return sb.ToString();
        }
    }
}
