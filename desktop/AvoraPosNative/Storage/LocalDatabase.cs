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

                // Check and migrate legacy schema if needed
                MigrateLegacyTables(conn);

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    -- PRAGMA configuration for durability & crash resilience
                    PRAGMA journal_mode = WAL;
                    PRAGMA synchronous = NORMAL;

                    -- 1. Offline Orders Table
                    CREATE TABLE IF NOT EXISTS offline_orders (
                        client_order_id TEXT PRIMARY KEY,
                        local_order_code TEXT NOT NULL UNIQUE,
                        server_order_id TEXT,
                        server_order_code TEXT,
                        branch_id TEXT NOT NULL,
                        table_id TEXT,
                        table_name TEXT,
                        order_type TEXT NOT NULL DEFAULT 'DINE_IN',
                        guest_count INTEGER NOT NULL DEFAULT 1,
                        customer_name TEXT,
                        customer_phone TEXT,
                        delivery_address TEXT,
                        note TEXT,
                        sub_total REAL NOT NULL,
                        discount_amount REAL NOT NULL DEFAULT 0,
                        discount_voucher_code TEXT,
                        tax_amount REAL NOT NULL DEFAULT 0,
                        shipping_fee REAL NOT NULL DEFAULT 0,
                        total_amount REAL NOT NULL,
                        payment_method TEXT,
                        payment_status TEXT NOT NULL DEFAULT 'PENDING',
                        received_amount REAL DEFAULT 0,
                        change_amount REAL DEFAULT 0,
                        sync_status TEXT NOT NULL DEFAULT 'PENDING_SYNC',
                        sync_attempts INTEGER NOT NULL DEFAULT 0,
                        last_sync_error TEXT,
                        payload_json TEXT NOT NULL,
                        created_offline_at TEXT NOT NULL,
                        synced_at TEXT,
                        cashier_id TEXT,
                        cashier_name TEXT,
                        device_id TEXT NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_offline_orders_sync_status 
                    ON offline_orders(sync_status);

                    CREATE INDEX IF NOT EXISTS idx_offline_orders_branch 
                    ON offline_orders(branch_id, created_offline_at);

                    -- 2. Transactional Outbox Events Table
                    CREATE TABLE IF NOT EXISTS outbox_events (
                        id TEXT PRIMARY KEY,
                        event_type TEXT NOT NULL,
                        aggregate_id TEXT NOT NULL,
                        idempotency_key TEXT UNIQUE NOT NULL,
                        payload_json TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'PENDING',
                        retry_count INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL,
                        last_attempt_at TEXT,
                        error_message TEXT
                    );

                    CREATE INDEX IF NOT EXISTS idx_outbox_events_status 
                    ON outbox_events(status, created_at);

                    -- 3. Persistent Print Queue Table
                    CREATE TABLE IF NOT EXISTS print_jobs (
                        id TEXT PRIMARY KEY,
                        idempotency_key TEXT UNIQUE NOT NULL,
                        printer_id TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'QUEUED',
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

                    -- 4. Product Cache Table
                    CREATE TABLE IF NOT EXISTS product_cache (
                        id TEXT NOT NULL,
                        branch_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        code TEXT NOT NULL,
                        price REAL NOT NULL,
                        discounted_price REAL,
                        effective_price REAL NOT NULL,
                        category_id TEXT NOT NULL,
                        category_name TEXT,
                        available INTEGER NOT NULL DEFAULT 1,
                        is_buffet_ticket INTEGER NOT NULL DEFAULT 0,
                        is_buffet_item INTEGER NOT NULL DEFAULT 0,
                        json_data TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        PRIMARY KEY(id, branch_id)
                    );

                    CREATE INDEX IF NOT EXISTS idx_product_cache_branch_cat 
                    ON product_cache(branch_id, category_id);

                    -- 5. Category Cache Table
                    CREATE TABLE IF NOT EXISTS category_cache (
                        id TEXT NOT NULL,
                        branch_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        slug TEXT,
                        product_count INTEGER DEFAULT 0,
                        json_data TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        PRIMARY KEY(id, branch_id)
                    );

                    CREATE INDEX IF NOT EXISTS idx_category_cache_branch 
                    ON category_cache(branch_id);

                    -- 6. Menu Snapshot Metadata
                    CREATE TABLE IF NOT EXISTS menu_snapshot_meta (
                        branch_id TEXT PRIMARY KEY,
                        snapshot_version TEXT NOT NULL,
                        product_count INTEGER NOT NULL,
                        category_count INTEGER NOT NULL,
                        synced_at TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'ACTIVE'
                    );

                    -- 7. Local Order Sequence Counter
                    CREATE TABLE IF NOT EXISTS local_order_sequences (
                        device_id TEXT NOT NULL,
                        date_key TEXT NOT NULL,
                        last_number INTEGER NOT NULL DEFAULT 0,
                        PRIMARY KEY (device_id, date_key)
                    );

                    -- 8. General Key-Value App Settings
                    CREATE TABLE IF NOT EXISTS app_settings (
                        setting_key TEXT PRIMARY KEY,
                        setting_value TEXT NOT NULL
                    );

                    -- Purge synthetic unit-test and obsolete conflict records
                    DELETE FROM outbox_events WHERE status = 'CONFLICT' OR payload_json LIKE '%branch-test-01%' OR created_at < datetime('now', '-7 days');
                    DELETE FROM offline_orders WHERE sync_status = 'SYNC_CONFLICT' OR branch_id = 'branch-test-01';
                    DELETE FROM product_cache WHERE branch_id = 'branch-test-01';
                    DELETE FROM category_cache WHERE branch_id = 'branch-test-01';
                    DELETE FROM menu_snapshot_meta WHERE branch_id = 'branch-test-01';
                ";
                cmd.ExecuteNonQuery();

                _isInitialized = true;
                System.Diagnostics.Debug.WriteLine($"[STORAGE] Local SQLite database initialized at {AppDataPaths.DatabasePath}");
            }
        }

        private static void MigrateLegacyTables(SqliteConnection conn)
        {
            try
            {
                // Check category_cache
                if (TableExists(conn, "category_cache") && !ColumnExists(conn, "category_cache", "branch_id"))
                {
                    using var dropCmd = conn.CreateCommand();
                    dropCmd.CommandText = "DROP TABLE IF EXISTS category_cache;";
                    dropCmd.ExecuteNonQuery();
                }

                // Check product_cache
                if (TableExists(conn, "product_cache") && !ColumnExists(conn, "product_cache", "branch_id"))
                {
                    using var dropCmd = conn.CreateCommand();
                    dropCmd.CommandText = "DROP TABLE IF EXISTS product_cache;";
                    dropCmd.ExecuteNonQuery();
                }

                // Check offline_orders
                if (TableExists(conn, "offline_orders") && !ColumnExists(conn, "offline_orders", "client_order_id"))
                {
                    using var dropCmd = conn.CreateCommand();
                    dropCmd.CommandText = "DROP TABLE IF EXISTS offline_orders;";
                    dropCmd.ExecuteNonQuery();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[STORAGE] Migration error: {ex.Message}");
            }
        }

        private static bool TableExists(SqliteConnection conn, string tableName)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=@name;";
            cmd.Parameters.AddWithValue("@name", tableName);
            var result = cmd.ExecuteScalar();
            return result != null && Convert.ToInt32(result) > 0;
        }

        private static bool ColumnExists(SqliteConnection conn, string table, string column)
        {
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"PRAGMA table_info({table});";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                if (reader.GetString(1).Equals(column, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
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
