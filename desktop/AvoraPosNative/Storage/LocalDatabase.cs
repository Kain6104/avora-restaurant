using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;

namespace AvoraPosNative.Storage
{
    public static class LocalDatabase
    {
        private static bool _isInitialized = false;
        private static readonly object _initLock = new();

        public static string ConnectionString => $"Data Source={AppDataPaths.DatabasePath}";

        public static void Initialize()
        {
            if (_isInitialized) return;

            lock (_initLock)
            {
                if (_isInitialized) return;

                Directory.CreateDirectory(AppDataPaths.DataDir);

                using var conn = new SqliteConnection(ConnectionString);
                conn.Open();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS offline_orders (
                        id TEXT PRIMARY KEY,
                        order_code TEXT,
                        payload_json TEXT NOT NULL,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING',
                        created_at TEXT NOT NULL
                    );

                    -- Persistent Print Queue Table according to Directive 7
                    CREATE TABLE IF NOT EXISTS print_jobs (
                        id TEXT PRIMARY KEY,
                        idempotency_key TEXT UNIQUE NOT NULL,
                        printer_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, PRINTING, COMPLETED, FAILED
                        attempts INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        printing_at TEXT,
                        printed_at TEXT,
                        error TEXT,
                        payload_bytes BLOB NOT NULL,
                        doc_name TEXT NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_status 
                    ON print_jobs(printer_id, status);

                    CREATE TABLE IF NOT EXISTS product_cache (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        price REAL NOT NULL,
                        category_id TEXT NOT NULL,
                        json_data TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS category_cache (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        json_data TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS app_settings (
                        setting_key TEXT PRIMARY KEY,
                        setting_value TEXT NOT NULL
                    );
                ";
                cmd.ExecuteNonQuery();

                _isInitialized = true;
                System.Diagnostics.Debug.WriteLine($"[STORAGE] Local SQLite database initialized at {AppDataPaths.DatabasePath}");
            }
        }

        public static async Task SaveSettingAsync(string key, string value)
        {
            Initialize();
            using var conn = new SqliteConnection(ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO app_settings (setting_key, setting_value)
                VALUES (@key, @val)
                ON CONFLICT(setting_key) DO UPDATE SET setting_value = @val;
            ";
            cmd.Parameters.AddWithValue("@key", key);
            cmd.Parameters.AddWithValue("@val", value);
            await cmd.ExecuteNonQueryAsync();
        }

        public static async Task<string?> GetSettingAsync(string key)
        {
            Initialize();
            using var conn = new SqliteConnection(ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT setting_value FROM app_settings WHERE setting_key = @key LIMIT 1;";
            cmd.Parameters.AddWithValue("@key", key);

            var result = await cmd.ExecuteScalarAsync();
            return result?.ToString();
        }
    }
}
