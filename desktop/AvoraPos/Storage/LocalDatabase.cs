using System;
using System.Collections.Generic;
using System.IO;
using AvoraPos.Models;
using Microsoft.Data.Sqlite;
using Newtonsoft.Json;

namespace AvoraPos.Storage
{
    public class LocalDatabase
    {
        private static LocalDatabase? _instance;
        public static LocalDatabase Instance => _instance ??= new LocalDatabase();

        private readonly string _dbPath;
        private readonly string _connectionString;

        public LocalDatabase()
        {
            AppDataPaths.MigrateLegacyPaths();
            _dbPath = AppDataPaths.DatabasePath;
            _connectionString = $"Data Source={_dbPath};";

            InitializeSchema();
        }

        private void InitializeSchema()
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                CREATE TABLE IF NOT EXISTS PrinterProfiles (
                    PrinterId TEXT PRIMARY KEY,
                    Name TEXT NOT NULL,
                    DataJson TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS PrintJobs (
                    Id TEXT PRIMARY KEY,
                    PrinterId TEXT NOT NULL,
                    JobType TEXT NOT NULL,
                    PayloadJson TEXT NOT NULL,
                    RawBytesBase64 TEXT,
                    Status TEXT NOT NULL,
                    AttemptCount INTEGER DEFAULT 0,
                    MaxAttempts INTEGER DEFAULT 3,
                    ErrorMessage TEXT,
                    IdempotencyKey TEXT UNIQUE NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    PrintedAt TEXT
                );

                CREATE TABLE IF NOT EXISTS OfflineOrders (
                    LocalOrderId TEXT PRIMARY KEY,
                    ServerOrderId TEXT,
                    ClientMutationId TEXT NOT NULL,
                    IdempotencyKey TEXT UNIQUE NOT NULL,
                    BaseVersion INTEGER DEFAULT 1,
                    LocalVersion INTEGER DEFAULT 1,
                    SyncStatus TEXT NOT NULL,
                    OrderDataJson TEXT NOT NULL,
                    CreatedOfflineAt TEXT NOT NULL,
                    LastSyncAttemptAt TEXT,
                    ErrorMessage TEXT,
                    BranchId TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS OfflineMutations (
                    Id TEXT PRIMARY KEY,
                    LocalOrderId TEXT NOT NULL,
                    MutationType TEXT NOT NULL,
                    PayloadJson TEXT NOT NULL,
                    IdempotencyKey TEXT UNIQUE NOT NULL,
                    Status TEXT NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    SyncedAt TEXT,
                    ErrorMessage TEXT
                );

                CREATE TABLE IF NOT EXISTS OfflineSnapshots (
                    BranchId TEXT NOT NULL,
                    SnapshotType TEXT NOT NULL,
                    DataJson TEXT NOT NULL,
                    UpdatedAt TEXT NOT NULL,
                    PRIMARY KEY (BranchId, SnapshotType)
                );
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.ExecuteNonQuery();
        }

        // ==========================================
        // PRINTER PROFILES
        // ==========================================
        public void SavePrinterProfile(PrinterProfile profile)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                INSERT INTO PrinterProfiles (PrinterId, Name, DataJson, UpdatedAt)
                VALUES (@PrinterId, @Name, @DataJson, @UpdatedAt)
                ON CONFLICT(PrinterId) DO UPDATE SET
                    Name = excluded.Name,
                    DataJson = excluded.DataJson,
                    UpdatedAt = excluded.UpdatedAt;
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@PrinterId", profile.PrinterId);
            cmd.Parameters.AddWithValue("@Name", profile.Name);
            cmd.Parameters.AddWithValue("@DataJson", JsonConvert.SerializeObject(profile));
            cmd.Parameters.AddWithValue("@UpdatedAt", DateTime.UtcNow.ToString("o"));
            cmd.ExecuteNonQuery();
        }

        public List<PrinterProfile> GetAllPrinterProfiles()
        {
            var list = new List<PrinterProfile>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = "SELECT DataJson FROM PrinterProfiles ORDER BY UpdatedAt DESC";
            using var cmd = new SqliteCommand(sql, conn);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                string json = reader.GetString(0);
                var p = JsonConvert.DeserializeObject<PrinterProfile>(json);
                if (p != null) list.Add(p);
            }

            return list;
        }

        // ==========================================
        // PERSISTENT PRINT JOBS (Directive 9)
        // ==========================================
        public void EnqueuePrintJob(string id, string printerId, string jobType, string payloadJson, string? rawBytesBase64, string idempotencyKey)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                INSERT OR IGNORE INTO PrintJobs (Id, PrinterId, JobType, PayloadJson, RawBytesBase64, Status, AttemptCount, MaxAttempts, IdempotencyKey, CreatedAt)
                VALUES (@Id, @PrinterId, @JobType, @PayloadJson, @RawBytesBase64, 'PENDING', 0, 3, @IdempotencyKey, @CreatedAt);
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.Parameters.AddWithValue("@PrinterId", printerId);
            cmd.Parameters.AddWithValue("@JobType", jobType);
            cmd.Parameters.AddWithValue("@PayloadJson", payloadJson);
            cmd.Parameters.AddWithValue("@RawBytesBase64", (object?)rawBytesBase64 ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@IdempotencyKey", idempotencyKey);
            cmd.Parameters.AddWithValue("@CreatedAt", DateTime.UtcNow.ToString("o"));
            cmd.ExecuteNonQuery();
        }

        public void MarkJobPrinted(string jobId)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                UPDATE PrintJobs SET Status = 'PRINTED', PrintedAt = @PrintedAt, ErrorMessage = NULL
                WHERE Id = @Id;
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", jobId);
            cmd.Parameters.AddWithValue("@PrintedAt", DateTime.UtcNow.ToString("o"));
            cmd.ExecuteNonQuery();
        }

        public void MarkJobFailed(string jobId, string error)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                UPDATE PrintJobs SET 
                    AttemptCount = AttemptCount + 1,
                    Status = CASE WHEN AttemptCount >= MaxAttempts THEN 'FAILED' ELSE 'PENDING' END,
                    ErrorMessage = @Error
                WHERE Id = @Id;
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", jobId);
            cmd.Parameters.AddWithValue("@Error", error);
            cmd.ExecuteNonQuery();
        }

        public List<PrintJobRecord> GetUnfinishedPrintJobs()
        {
            var list = new List<PrintJobRecord>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = "SELECT Id, PrinterId, JobType, PayloadJson, RawBytesBase64, Status, AttemptCount, MaxAttempts, ErrorMessage, IdempotencyKey, CreatedAt FROM PrintJobs WHERE Status = 'PENDING' OR Status = 'PROCESSING' ORDER BY CreatedAt ASC";
            using var cmd = new SqliteCommand(sql, conn);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new PrintJobRecord
                {
                    Id = reader.GetString(0),
                    PrinterId = reader.GetString(1),
                    JobType = reader.GetString(2),
                    PayloadJson = reader.GetString(3),
                    RawBytesBase64 = reader.IsDBNull(4) ? null : reader.GetString(4),
                    Status = reader.GetString(5),
                    AttemptCount = reader.GetInt32(6),
                    MaxAttempts = reader.GetInt32(7),
                    ErrorMessage = reader.IsDBNull(8) ? null : reader.GetString(8),
                    IdempotencyKey = reader.GetString(9),
                    CreatedAt = DateTime.Parse(reader.GetString(10))
                });
            }

            return list;
        }

        public bool IsJobAlreadyPrinted(string idempotencyKey)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = "SELECT COUNT(1) FROM PrintJobs WHERE IdempotencyKey = @Key AND Status = 'PRINTED'";
            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Key", idempotencyKey);
            long count = (long)(cmd.ExecuteScalar() ?? 0);
            return count > 0;
        }

        // ==========================================
        // OFFLINE ORDER SYNC (Directive 10)
        // ==========================================
        public void UpsertOfflineOrder(OfflineOrderRecord record)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                INSERT INTO OfflineOrders (LocalOrderId, ServerOrderId, ClientMutationId, IdempotencyKey, BaseVersion, LocalVersion, SyncStatus, OrderDataJson, CreatedOfflineAt, LastSyncAttemptAt, ErrorMessage, BranchId)
                VALUES (@LocalOrderId, @ServerOrderId, @ClientMutationId, @IdempotencyKey, @BaseVersion, @LocalVersion, @SyncStatus, @OrderDataJson, @CreatedOfflineAt, @LastSyncAttemptAt, @ErrorMessage, @BranchId)
                ON CONFLICT(LocalOrderId) DO UPDATE SET
                    ServerOrderId = excluded.ServerOrderId,
                    LocalVersion = excluded.LocalVersion,
                    SyncStatus = excluded.SyncStatus,
                    OrderDataJson = excluded.OrderDataJson,
                    LastSyncAttemptAt = excluded.LastSyncAttemptAt,
                    ErrorMessage = excluded.ErrorMessage;
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@LocalOrderId", record.LocalOrderId);
            cmd.Parameters.AddWithValue("@ServerOrderId", (object?)record.ServerOrderId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ClientMutationId", record.ClientMutationId);
            cmd.Parameters.AddWithValue("@IdempotencyKey", record.IdempotencyKey);
            cmd.Parameters.AddWithValue("@BaseVersion", record.BaseVersion);
            cmd.Parameters.AddWithValue("@LocalVersion", record.LocalVersion);
            cmd.Parameters.AddWithValue("@SyncStatus", record.SyncStatus.ToString());
            cmd.Parameters.AddWithValue("@OrderDataJson", record.OrderDataJson);
            cmd.Parameters.AddWithValue("@CreatedOfflineAt", record.CreatedOfflineAt.ToString("o"));
            cmd.Parameters.AddWithValue("@LastSyncAttemptAt", (object?)record.LastSyncAttemptAt?.ToString("o") ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ErrorMessage", (object?)record.ErrorMessage ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@BranchId", record.BranchId);
            cmd.ExecuteNonQuery();
        }

        public List<OfflineOrderRecord> GetPendingSyncOrders()
        {
            var list = new List<OfflineOrderRecord>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = "SELECT LocalOrderId, ServerOrderId, ClientMutationId, IdempotencyKey, BaseVersion, LocalVersion, SyncStatus, OrderDataJson, CreatedOfflineAt, LastSyncAttemptAt, ErrorMessage, BranchId FROM OfflineOrders WHERE SyncStatus != 'SYNCED' ORDER BY CreatedOfflineAt ASC";
            using var cmd = new SqliteCommand(sql, conn);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(new OfflineOrderRecord
                {
                    LocalOrderId = reader.GetString(0),
                    ServerOrderId = reader.IsDBNull(1) ? null : reader.GetString(1),
                    ClientMutationId = reader.GetString(2),
                    IdempotencyKey = reader.GetString(3),
                    BaseVersion = reader.GetInt32(4),
                    LocalVersion = reader.GetInt32(5),
                    SyncStatus = Enum.Parse<SyncStatus>(reader.GetString(6)),
                    OrderDataJson = reader.GetString(7),
                    CreatedOfflineAt = DateTime.Parse(reader.GetString(8)),
                    LastSyncAttemptAt = reader.IsDBNull(9) ? null : DateTime.Parse(reader.GetString(9)),
                    ErrorMessage = reader.IsDBNull(10) ? null : reader.GetString(10),
                    BranchId = reader.GetString(11)
                });
            }

            return list;
        }

        // ==========================================
        // OFFLINE SNAPSHOTS
        // ==========================================
        public void SaveSnapshot(string branchId, string type, string dataJson)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = @"
                INSERT INTO OfflineSnapshots (BranchId, SnapshotType, DataJson, UpdatedAt)
                VALUES (@BranchId, @SnapshotType, @DataJson, @UpdatedAt)
                ON CONFLICT(BranchId, SnapshotType) DO UPDATE SET
                    DataJson = excluded.DataJson,
                    UpdatedAt = excluded.UpdatedAt;
            ";

            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@BranchId", branchId);
            cmd.Parameters.AddWithValue("@SnapshotType", type);
            cmd.Parameters.AddWithValue("@DataJson", dataJson);
            cmd.Parameters.AddWithValue("@UpdatedAt", DateTime.UtcNow.ToString("o"));
            cmd.ExecuteNonQuery();
        }

        public string? GetSnapshot(string branchId, string type)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            string sql = "SELECT DataJson FROM OfflineSnapshots WHERE BranchId = @BranchId AND SnapshotType = @SnapshotType";
            using var cmd = new SqliteCommand(sql, conn);
            cmd.Parameters.AddWithValue("@BranchId", branchId);
            cmd.Parameters.AddWithValue("@SnapshotType", type);
            return cmd.ExecuteScalar() as string;
        }
    }

    public class PrintJobRecord
    {
        public string Id { get; set; } = string.Empty;
        public string PrinterId { get; set; } = string.Empty;
        public string JobType { get; set; } = string.Empty;
        public string PayloadJson { get; set; } = string.Empty;
        public string? RawBytesBase64 { get; set; }
        public string Status { get; set; } = "PENDING";
        public int AttemptCount { get; set; }
        public int MaxAttempts { get; set; } = 3;
        public string? ErrorMessage { get; set; }
        public string IdempotencyKey { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
