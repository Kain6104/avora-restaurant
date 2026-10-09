using System;
using System.IO;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.Storage
{
    public static class AppConfig
    {
        private static string? _apiBaseUrl;
        private static string? _wsBaseUrl;
        private static string _product = "AVORA_POS_NATIVE";
        private static string _version = "1.0.0";
        private static bool _isLoaded = false;
        private static readonly object _lock = new();

        public static string ApiBaseUrl
        {
            get
            {
                EnsureLoaded();
                return _apiBaseUrl ?? "http://127.0.0.1:4001";
            }
        }

        public static string WsBaseUrl
        {
            get
            {
                EnsureLoaded();
                return _wsBaseUrl ?? "http://127.0.0.1:4001";
            }
        }

        public static string Product
        {
            get
            {
                EnsureLoaded();
                return _product;
            }
        }

        public static string Version
        {
            get
            {
                EnsureLoaded();
                return _version;
            }
        }

        public static void Reload()
        {
            lock (_lock)
            {
                _isLoaded = false;
                EnsureLoaded();
            }
        }

        private static void EnsureLoaded()
        {
            if (_isLoaded) return;
            lock (_lock)
            {
                if (_isLoaded) return;

                // 1. Defaults
                string defaultBase = "http://127.0.0.1:4001";
                _apiBaseUrl = defaultBase;
                _wsBaseUrl = defaultBase;

                // 2. Try App Directory appsettings.json
                try
                {
                    string appDirFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
                    if (File.Exists(appDirFile))
                    {
                        string json = File.ReadAllText(appDirFile);
                        var obj = JObject.Parse(json);
                        string? api = obj["ApiBaseUrl"]?.ToString();
                        string? ws = obj["WsBaseUrl"]?.ToString();
                        if (!string.IsNullOrWhiteSpace(api)) _apiBaseUrl = api.Trim().TrimEnd('/');
                        if (!string.IsNullOrWhiteSpace(ws)) _wsBaseUrl = ws.Trim().TrimEnd('/');
                    }
                }
                catch { }

                // 3. Try LocalAppData Config appsettings.json (User override)
                try
                {
                    string userConfigFile = Path.Combine(AppDataPaths.ConfigDir, "appsettings.json");
                    if (File.Exists(userConfigFile))
                    {
                        string json = File.ReadAllText(userConfigFile);
                        var obj = JObject.Parse(json);
                        string? api = obj["ApiBaseUrl"]?.ToString();
                        string? ws = obj["WsBaseUrl"]?.ToString();
                        if (!string.IsNullOrWhiteSpace(api)) _apiBaseUrl = api.Trim().TrimEnd('/');
                        if (!string.IsNullOrWhiteSpace(ws)) _wsBaseUrl = ws.Trim().TrimEnd('/');
                    }
                }
                catch { }

                // 4. Environment Variables have highest priority
                string? envApi = Environment.GetEnvironmentVariable("AVORA_API_BASE_URL")
                                ?? Environment.GetEnvironmentVariable("API_BASE_URL")
                                ?? Environment.GetEnvironmentVariable("AVORA_BACKEND_URL");
                if (!string.IsNullOrWhiteSpace(envApi))
                {
                    _apiBaseUrl = envApi.Trim().TrimEnd('/');
                }

                string? envWs = Environment.GetEnvironmentVariable("AVORA_WS_BASE_URL")
                               ?? Environment.GetEnvironmentVariable("WS_BASE_URL");
                if (!string.IsNullOrWhiteSpace(envWs))
                {
                    _wsBaseUrl = envWs.Trim().TrimEnd('/');
                }
                else if (!string.IsNullOrWhiteSpace(envApi))
                {
                    _wsBaseUrl = envApi.Trim().TrimEnd('/');
                }

                _isLoaded = true;
                System.Diagnostics.Debug.WriteLine($"[CONFIG] Loaded ApiBaseUrl: {_apiBaseUrl}, WsBaseUrl: {_wsBaseUrl}");
            }
        }
    }
}
