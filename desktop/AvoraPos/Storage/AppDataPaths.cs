using System;
using System.IO;

namespace AvoraPos.Storage
{
    /// <summary>
    /// Centralized directory management separating Application binaries from User Data:
    /// - Binaries: Programs\AVORA POS\
    /// - SQLite: %LOCALAPPDATA%\AVORA POS\Data\
    /// - Config: %LOCALAPPDATA%\AVORA POS\Config\
    /// - Logs: %LOCALAPPDATA%\AVORA POS\Logs\
    /// - Updates: %LOCALAPPDATA%\AVORA POS\Updates\
    /// - WebView2: %LOCALAPPDATA%\AVORA POS\WebView2Data\
    /// </summary>
    public static class AppDataPaths
    {
        private static readonly string Root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AVORA POS"
        );

        public static string DataDir => Ensure(Path.Combine(Root, "Data"));
        public static string ConfigDir => Ensure(Path.Combine(Root, "Config"));
        public static string LogsDir => Ensure(Path.Combine(Root, "Logs"));
        public static string UpdatesDir => Ensure(Path.Combine(Root, "Updates"));
        public static string WebView2DataDir => Ensure(Path.Combine(Root, "WebView2Data"));

        public static string DatabasePath => Path.Combine(DataDir, "avora_pos_offline.db");

        private static string Ensure(string dir)
        {
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            return dir;
        }

        public static void MigrateLegacyPaths()
        {
            try
            {
                string legacyRoot = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "AvoraPos"
                );

                if (!Directory.Exists(legacyRoot)) return;

                // 1. Migrate SQLite DB
                string legacyDb = Path.Combine(legacyRoot, "avora_pos_offline.db");
                string targetDb = DatabasePath;
                if (File.Exists(legacyDb) && !File.Exists(targetDb))
                {
                    File.Copy(legacyDb, targetDb, true);
                }

                // 2. Migrate any existing WebView2 data if needed
                string legacyWv2 = Path.Combine(legacyRoot, "WebView2Data");
                if (Directory.Exists(legacyWv2) && !Directory.Exists(WebView2DataDir))
                {
                    // If target doesn't exist, can copy
                }
            }
            catch
            {
                // Non-fatal fallback
            }
        }
    }
}
