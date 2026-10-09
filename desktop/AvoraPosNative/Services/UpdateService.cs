using System;
using System.Net.Http;
using System.Threading.Tasks;
using AvoraPosNative.Storage;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.Services
{
    public class UpdateInfo
    {
        public string Version { get; set; } = "1.0.0";
        public string UpdateType { get; set; } = "OPTIONAL";
        public string DownloadUrl { get; set; } = string.Empty;
        public string[] ReleaseNotes { get; set; } = Array.Empty<string>();
        public bool HasUpdate { get; set; } = false;
    }

    public class UpdateService
    {
        private static readonly HttpClient _httpClient = new();

        public static async Task<UpdateInfo?> CheckForUpdateAsync()
        {
            try
            {
                string url = $"{AppConfig.ApiBaseUrl}/api/pos-desktop/update/latest?product={AppConfig.Product}";
                var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;

                string body = await response.Content.ReadAsStringAsync();
                var obj = JObject.Parse(body);

                string remoteVer = obj["version"]?.ToString() ?? "1.0.0";
                var notes = obj["releaseNotes"]?.ToObject<string[]>() ?? Array.Empty<string>();
                string downloadUrl = obj["downloadUrl"]?.ToString() ?? string.Empty;
                string updateType = obj["updateType"]?.ToString() ?? "OPTIONAL";

                // Compare version with AppConfig.Version (1.0.0)
                bool hasUpdate = IsVersionHigher(remoteVer, AppConfig.Version);

                return new UpdateInfo
                {
                    Version = remoteVer,
                    UpdateType = updateType,
                    DownloadUrl = downloadUrl,
                    ReleaseNotes = notes,
                    HasUpdate = hasUpdate
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[UPDATE] Check update error: {ex.Message}");
                return null;
            }
        }

        private static bool IsVersionHigher(string remoteVer, string currentVer)
        {
            try
            {
                var r = new Version(remoteVer);
                var c = new Version(currentVer);
                return r > c;
            }
            catch
            {
                return false;
            }
        }
    }
}
