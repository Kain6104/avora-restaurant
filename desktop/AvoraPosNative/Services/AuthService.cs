using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Security;
using AvoraPosNative.Storage;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.Services
{
    public class AuthService
    {
        private static readonly HttpClient _httpClient = new();
        public static string BackendUrl => AppConfig.ApiBaseUrl;

        public StoredSession? CurrentSession { get; private set; }
        public UserProfile? CurrentUser { get; private set; }

        public bool IsAuthenticated => !string.IsNullOrEmpty(CurrentSession?.Token);

        public async Task<(bool Success, string? Error, UserProfile? Profile)> LoginWithEmailAsync(string email, string password)
        {
            try
            {
                var payload = new { email = email.Trim(), password };
                var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{BackendUrl}/api/auth/desktop/login", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    string errorMsg = "Email hoặc mật khẩu không chính xác.";
                    try
                    {
                        var errObj = JObject.Parse(responseBody);
                        string? msg = errObj["message"]?.ToString();
                        if (!string.IsNullOrEmpty(msg))
                        {
                            if (msg.Contains("khóa", StringComparison.OrdinalIgnoreCase))
                                errorMsg = "Tài khoản đã bị khóa.";
                            else if (msg.Contains("xác thực", StringComparison.OrdinalIgnoreCase))
                                errorMsg = "Tài khoản chưa được xác thực email.";
                            else
                                errorMsg = msg;
                        }
                    }
                    catch { }

                    return (false, errorMsg, null);
                }

                var result = JObject.Parse(responseBody);
                string? token = result["access_token"]?.ToString();

                if (string.IsNullOrEmpty(token))
                {
                    return (false, "Không nhận được token xác thực từ máy chủ.", null);
                }

                return await ValidateAndSaveTokenAsync(token);
            }
            catch (Exception ex)
            {
                return (false, $"Lỗi kết nối máy chủ: {ex.Message}", null);
            }
        }

        public async Task<(bool Success, string? Error, UserProfile? Profile)> ExchangeGoogleCodeAsync(string code)
        {
            try
            {
                var payload = new { code = code.Trim() };
                var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{BackendUrl}/api/auth/desktop/exchange-code", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return (false, "Mã xác thực Google đã hết hạn hoặc không hợp lệ.", null);
                }

                var result = JObject.Parse(responseBody);
                string? token = result["access_token"]?.ToString();

                if (string.IsNullOrEmpty(token))
                {
                    return (false, "Không nhận được token từ máy chủ.", null);
                }

                return await ValidateAndSaveTokenAsync(token);
            }
            catch (Exception ex)
            {
                return (false, $"Lỗi xử lý xác thực Google: {ex.Message}", null);
            }
        }

        public async Task<(bool Success, string? Error, UserProfile? Profile)> ExchangeLaunchCodeAsync(string code)
        {
            try
            {
                var payload = new
                {
                    code = code.Trim(),
                    deviceId = DeviceIdentifier.GetHardwareFingerprint(),
                    appVersion = AppConfig.Version
                };
                var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{BackendUrl}/api/auth/desktop/exchange-launch-code", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return (false, "Mã đăng nhập tự động đã hết hạn hoặc không hợp lệ.", null);
                }

                var result = JObject.Parse(responseBody);
                string? token = result["access_token"]?.ToString();

                if (string.IsNullOrEmpty(token))
                {
                    return (false, "Không nhận được token từ máy chủ.", null);
                }

                return await ValidateAndSaveTokenAsync(token);
            }
            catch (Exception ex)
            {
                return (false, $"Lỗi xác thực One-Time SSO: {ex.Message}", null);
            }
        }

        public async Task<(bool Success, string? Error, UserProfile? Profile)> ValidateAndSaveTokenAsync(string token)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{BackendUrl}/api/auth/me");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var res = await _httpClient.SendAsync(req);
                string body = await res.Content.ReadAsStringAsync();

                if (!res.IsSuccessStatusCode)
                {
                    Logout();
                    return (false, "Phiên đăng nhập đã hết hạn.", null);
                }

                var profileObj = JObject.Parse(body);
                var profile = new UserProfile
                {
                    Id = profileObj["id"]?.ToString() ?? string.Empty,
                    FullName = profileObj["fullName"]?.ToString() ?? profileObj["email"]?.ToString() ?? "Người dùng",
                    Email = profileObj["email"]?.ToString() ?? string.Empty,
                    Role = profileObj["role"]?.ToString() ?? string.Empty,
                    AvatarUrl = profileObj["avatarUrl"]?.ToString(),
                    IsAccountLocked = profileObj["isAccountLocked"]?.Value<bool>() ?? false
                };

                // 1. Kiểm tra trạng thái tài khoản bị khóa
                if (profile.IsAccountLocked)
                {
                    Logout();
                    return (false, "Tài khoản của bạn đã bị khóa bởi quản trị viên.", null);
                }

                // Chi nhánh mặc định của user
                if (profileObj["branch"] is JObject branchObj)
                {
                    profile.CurrentBranchId = branchObj["id"]?.ToString();
                    profile.CurrentBranchName = branchObj["name"]?.ToString();
                }
                else if (profileObj["branchId"] != null)
                {
                    profile.CurrentBranchId = profileObj["branchId"]?.ToString();
                }

                // Danh sách Roles
                if (profileObj["roles"] is JArray rolesArr)
                {
                    foreach (var r in rolesArr)
                    {
                        string? rStr = r.ToString();
                        if (!string.IsNullOrEmpty(rStr)) profile.Roles.Add(rStr);
                    }
                }
                if (!string.IsNullOrEmpty(profile.Role) && !profile.Roles.Contains(profile.Role))
                {
                    profile.Roles.Add(profile.Role);
                }

                // 2. Audit hệ thống RBAC backend (Single Source of Truth)
                // Đọc effectivePermissions từ payload getMe
                if (profileObj["effectivePermissions"] is JObject effPerms)
                {
                    foreach (var prop in effPerms.Properties())
                    {
                        string permKey = prop.Name;
                        var permVal = prop.Value as JObject;
                        var scope = new PermissionScope();
                        if (permVal != null)
                        {
                            scope.IsGlobal = permVal["isGlobal"]?.Value<bool>() ?? false;
                            if (permVal["branchIds"] is JArray branchArr)
                            {
                                foreach (var b in branchArr)
                                {
                                    string? bStr = b.ToString();
                                    if (!string.IsNullOrEmpty(bStr)) scope.BranchIds.Add(bStr);
                                }
                            }
                        }
                        profile.EffectivePermissions[permKey] = scope;
                    }
                }

                if (profileObj["permissions"] is JArray permArr)
                {
                    foreach (var p in permArr)
                    {
                        string? permStr = p.ToString();
                        if (!string.IsNullOrEmpty(permStr) && !profile.Permissions.Contains(permStr))
                        {
                            profile.Permissions.Add(permStr);
                        }
                    }
                }

                // Kiểm tra quyền pos.access theo Role, Permission và Branch Scope
                if (!profile.HasPermission("pos.access", profile.CurrentBranchId))
                {
                    Logout();
                    return (false, "Tài khoản không có quyền truy cập AVORA POS trên chi nhánh này (RBAC: pos.access).", null);
                }

                profile.HasPosAccess = true;
                CurrentUser = profile;
                SecureSessionManager.SaveSession(token, profile.Id, profile.FullName, profile.Email, profile.Role, body);
                CurrentSession = SecureSessionManager.LoadSession();

                return (true, null, profile);
            }
            catch (Exception ex)
            {
                return (false, $"Lỗi xác minh quyền truy cập: {ex.Message}", null);
            }
        }

        public async Task<UserProfile?> VerifyCurrentSessionAsync(string token)
        {
            var (success, _, profile) = await ValidateAndSaveTokenAsync(token);
            return success ? profile : null;
        }

        public async Task<bool> RestoreSavedSessionAsync()
        {
            var session = SecureSessionManager.LoadSession();
            if (session == null || string.IsNullOrEmpty(session.Token))
            {
                return false;
            }

            var (success, _, _) = await ValidateAndSaveTokenAsync(session.Token);
            return success;
        }

        public void Logout()
        {
            CurrentSession = null;
            CurrentUser = null;
            SecureSessionManager.ClearSession();
        }
    }
}
