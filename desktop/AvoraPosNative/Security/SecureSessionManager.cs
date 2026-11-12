using System;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Storage;
using Newtonsoft.Json;

namespace AvoraPosNative.Security
{
    public class StoredSession
    {
        public string? Token { get; set; }
        public string AccessToken => Token ?? string.Empty;
        public string? UserId { get; set; }
        public string? UserName { get; set; }
        public string FullName => UserName ?? "Thu ngân";
        public string? UserEmail { get; set; }
        public string? Role { get; set; }
        public string? BranchId { get; set; }
        public string? BranchName { get; set; }
        public string? UserJson { get; set; }
        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }

    public class DeviceCredential
    {
        public string DeviceId { get; set; } = string.Empty;
        public string DeviceSecret { get; set; } = string.Empty;
        public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    }

    public static class SecureSessionManager
    {
        private static string SessionFilePath => Path.Combine(AppDataPaths.ConfigDir, "auth_session.dat");
        private static string LastUserFilePath => Path.Combine(AppDataPaths.ConfigDir, "last_identifier.txt");
        private static string RememberedAccountFilePath => Path.Combine(AppDataPaths.ConfigDir, "remembered_account.dat");
        private static string DeviceCredentialFilePath => Path.Combine(AppDataPaths.ConfigDir, "pos_device_cred.dat");

        private static readonly HttpClient _avatarClient = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };

        public static bool HasActiveSession() => LoadSession() != null;

        #region Trusted Device Credential (DPAPI Encrypted)
        /// <summary>
        /// Lưu chứng thực thiết bị POS (DeviceId + DeviceSecret) mã hóa qua Windows DPAPI.
        /// </summary>
        public static void SaveDeviceCredential(string deviceId, string deviceSecret)
        {
            if (string.IsNullOrWhiteSpace(deviceId) || string.IsNullOrWhiteSpace(deviceSecret))
                return;

            try
            {
                var cred = new DeviceCredential
                {
                    DeviceId = deviceId.Trim(),
                    DeviceSecret = deviceSecret.Trim(),
                    RegisteredAt = DateTime.UtcNow,
                };

                string json = JsonConvert.SerializeObject(cred);
                byte[] plainBytes = Encoding.UTF8.GetBytes(json);

                byte[] encryptedBytes = ProtectedData.Protect(
                    plainBytes,
                    null,
                    DataProtectionScope.CurrentUser);

                Directory.CreateDirectory(AppDataPaths.ConfigDir);
                File.WriteAllBytes(DeviceCredentialFilePath, encryptedBytes);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[DEVICE_CRED] Error saving credential: {ex.Message}");
            }
        }

        /// <summary>
        /// Đọc chứng thực thiết bị POS từ bộ nhớ DPAPI.
        /// </summary>
        public static (string? deviceId, string? deviceSecret) GetDeviceCredential()
        {
            try
            {
                if (!File.Exists(DeviceCredentialFilePath))
                    return (null, null);

                byte[] encryptedBytes = File.ReadAllBytes(DeviceCredentialFilePath);
                if (encryptedBytes.Length == 0)
                    return (null, null);

                byte[] plainBytes = ProtectedData.Unprotect(
                    encryptedBytes,
                    null,
                    DataProtectionScope.CurrentUser);

                string json = Encoding.UTF8.GetString(plainBytes);
                var cred = JsonConvert.DeserializeObject<DeviceCredential>(json);

                if (cred != null && !string.IsNullOrWhiteSpace(cred.DeviceId) && !string.IsNullOrWhiteSpace(cred.DeviceSecret))
                {
                    return (cred.DeviceId, cred.DeviceSecret);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[DEVICE_CRED] Error reading credential: {ex.Message}");
            }

            return (null, null);
        }
        #endregion

        #region Identifier
        public static void SaveLastIdentifier(string identifier)
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(identifier))
                {
                    Directory.CreateDirectory(AppDataPaths.ConfigDir);
                    File.WriteAllText(LastUserFilePath, identifier.Trim(), Encoding.UTF8);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error saving last identifier: {ex.Message}");
            }
        }

        public static string? GetLastIdentifier()
        {
            try
            {
                if (File.Exists(LastUserFilePath))
                {
                    string text = File.ReadAllText(LastUserFilePath, Encoding.UTF8).Trim();
                    if (!string.IsNullOrEmpty(text)) return text;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error reading last identifier: {ex.Message}");
            }
            return null;
        }
        #endregion

        #region Remembered Account (DPAPI Encrypted)
        /// <summary>
        /// Lưu thông tin nhận diện tài khoản đăng nhập gần nhất trên máy tính.
        /// TUYỆT ĐỐI KHÔNG lưu mật khẩu hoặc mã PIN.
        /// Được mã hóa bảo vệ an toàn bằng Windows DPAPI (CurrentUser).
        /// </summary>
        public static void SaveRememberedAccount(RememberedAccount account)
        {
            if (account == null || string.IsNullOrWhiteSpace(account.Email))
                return;

            try
            {
                account.LastLoginAt = DateTime.UtcNow;
                string json = JsonConvert.SerializeObject(account);
                byte[] plainBytes = Encoding.UTF8.GetBytes(json);

                byte[] encryptedBytes = ProtectedData.Protect(
                    plainBytes,
                    null,
                    DataProtectionScope.CurrentUser);

                Directory.CreateDirectory(AppDataPaths.ConfigDir);
                File.WriteAllBytes(RememberedAccountFilePath, encryptedBytes);

                SaveLastIdentifier(account.Email);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error saving remembered account: {ex.Message}");
            }
        }

        public static RememberedAccount? GetRememberedAccount()
        {
            try
            {
                if (!File.Exists(RememberedAccountFilePath))
                    return null;

                byte[] encryptedBytes = File.ReadAllBytes(RememberedAccountFilePath);
                if (encryptedBytes.Length == 0)
                    return null;

                byte[] plainBytes = ProtectedData.Unprotect(
                    encryptedBytes,
                    null,
                    DataProtectionScope.CurrentUser);

                string json = Encoding.UTF8.GetString(plainBytes);
                var account = JsonConvert.DeserializeObject<RememberedAccount>(json);

                if (account != null && (!string.IsNullOrWhiteSpace(account.Email) || !string.IsNullOrWhiteSpace(account.FullName)))
                {
                    return account;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error reading remembered account: {ex.Message}");
                try
                {
                    if (File.Exists(RememberedAccountFilePath))
                    {
                        File.Delete(RememberedAccountFilePath);
                    }
                }
                catch { }
            }

            return null;
        }

        public static void ClearRememberedAccount()
        {
            try
            {
                if (File.Exists(RememberedAccountFilePath))
                {
                    File.Delete(RememberedAccountFilePath);
                }

                if (File.Exists(LastUserFilePath))
                {
                    File.Delete(LastUserFilePath);
                }

                if (Directory.Exists(AppDataPaths.AvatarsDir))
                {
                    var files = Directory.GetFiles(AppDataPaths.AvatarsDir);
                    foreach (var file in files)
                    {
                        try { File.Delete(file); } catch { }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error clearing remembered account: {ex.Message}");
            }
        }

        public static async Task<string?> CacheAvatarAsync(string userId, string avatarUrl)
        {
            if (string.IsNullOrWhiteSpace(avatarUrl) || string.IsNullOrWhiteSpace(userId))
                return null;

            try
            {
                if (File.Exists(avatarUrl))
                    return avatarUrl;

                if (avatarUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                    avatarUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    string safeUserId = string.Join("_", userId.Split(Path.GetInvalidFileNameChars()));
                    string targetPath = Path.Combine(AppDataPaths.AvatarsDir, $"user_{safeUserId}.img");

                    byte[] imageBytes = await _avatarClient.GetByteArrayAsync(avatarUrl);
                    if (imageBytes != null && imageBytes.Length > 0)
                    {
                        await File.WriteAllBytesAsync(targetPath, imageBytes);
                        return targetPath;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[AVATAR_CACHE] Error downloading avatar: {ex.Message}");
            }

            return null;
        }
        #endregion

        #region Session Storage (DPAPI Encrypted)
        public static void SaveSession(string token, string? userId = null, string? userName = null, string? userEmail = null, string? role = null, string? userJson = null, string? branchId = null, string? branchName = null)
        {
            try
            {
                var existing = LoadSession();
                var session = new StoredSession
                {
                    Token = token,
                    UserId = userId ?? existing?.UserId,
                    UserName = userName ?? existing?.UserName,
                    UserEmail = userEmail ?? existing?.UserEmail,
                    Role = role ?? existing?.Role,
                    BranchId = !string.IsNullOrEmpty(branchId) ? branchId : existing?.BranchId,
                    BranchName = !string.IsNullOrEmpty(branchName) ? branchName : existing?.BranchName,
                    UserJson = userJson ?? existing?.UserJson,
                    SavedAt = DateTime.UtcNow
                };

                string json = JsonConvert.SerializeObject(session);
                byte[] plainBytes = Encoding.UTF8.GetBytes(json);

                byte[] encryptedBytes = ProtectedData.Protect(
                    plainBytes,
                    null,
                    DataProtectionScope.CurrentUser);

                Directory.CreateDirectory(AppDataPaths.ConfigDir);
                File.WriteAllBytes(SessionFilePath, encryptedBytes);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error saving secure session: {ex.Message}");
            }
        }

        public static void UpdateSessionBranch(string branchId, string branchName)
        {
            var existing = LoadSession();
            if (existing == null || string.IsNullOrEmpty(existing.Token)) return;
            SaveSession(existing.Token, existing.UserId, existing.UserName, existing.UserEmail, existing.Role, existing.UserJson, branchId, branchName);
        }

        public static StoredSession? LoadSession()
        {
            try
            {
                if (!File.Exists(SessionFilePath))
                    return null;

                byte[] encryptedBytes = File.ReadAllBytes(SessionFilePath);
                if (encryptedBytes.Length == 0)
                    return null;

                byte[] plainBytes = ProtectedData.Unprotect(
                    encryptedBytes,
                    null,
                    DataProtectionScope.CurrentUser);

                string json = Encoding.UTF8.GetString(plainBytes);
                return JsonConvert.DeserializeObject<StoredSession>(json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SECURITY] Error reading secure session: {ex.Message}");
                ClearSession();
                return null;
            }
        }

        public static void ClearSession()
        {
            try
            {
                if (File.Exists(SessionFilePath))
                {
                    File.Delete(SessionFilePath);
                }
            }
            catch
            {
                // Non-fatal
            }
        }
        #endregion
    }
}
