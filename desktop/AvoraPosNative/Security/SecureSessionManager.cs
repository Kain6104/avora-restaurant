using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
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

    public static class SecureSessionManager
    {
        private static string SessionFilePath => Path.Combine(AppDataPaths.ConfigDir, "auth_session.dat");
        private static string LastUserFilePath => Path.Combine(AppDataPaths.ConfigDir, "last_identifier.txt");

        public static bool HasActiveSession() => LoadSession() != null;

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

        public static void SaveSession(string token, string? userId = null, string? userName = null, string? userEmail = null, string? role = null, string? userJson = null)
        {
            try
            {
                var session = new StoredSession
                {
                    Token = token,
                    UserId = userId,
                    UserName = userName,
                    UserEmail = userEmail,
                    Role = role,
                    UserJson = userJson,
                    SavedAt = DateTime.UtcNow
                };

                string json = JsonConvert.SerializeObject(session);
                byte[] plainBytes = Encoding.UTF8.GetBytes(json);

                // Windows DPAPI encryption bound to CurrentUser
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
    }
}
