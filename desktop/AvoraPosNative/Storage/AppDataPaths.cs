using System;
using System.IO;

namespace AvoraPosNative.Storage
{
    /// <summary>
    /// Centralized directory management separating Application binaries from User Data:
    /// - Binaries: Programs\AVORA POS Native\
    /// - SQLite: %LOCALAPPDATA%\AVORA POS Native\Data\
    /// - Config: %LOCALAPPDATA%\AVORA POS Native\Config\
    /// - Logs: %LOCALAPPDATA%\AVORA POS Native\Logs\
    /// - Updates: %LOCALAPPDATA%\AVORA POS Native\Updates\
    /// </summary>
    public static class AppDataPaths
    {
        private static readonly string Root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "AVORA POS Native"
        );

        public static string DataDir => Ensure(Path.Combine(Root, "Data"));
        public static string ConfigDir => Ensure(Path.Combine(Root, "Config"));
        public static string LogsDir => Ensure(Path.Combine(Root, "Logs"));
        public static string UpdatesDir => Ensure(Path.Combine(Root, "Updates"));

        public static string DatabasePath => Path.Combine(DataDir, "avora_pos_native.db");

        private static string Ensure(string dir)
        {
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            return dir;
        }
    }
}
