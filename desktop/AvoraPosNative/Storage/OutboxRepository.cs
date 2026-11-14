using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using Microsoft.Data.Sqlite;

namespace AvoraPosNative.Storage
{
    public static class OutboxRepository
    {
        public static async Task<List<OutboxEventRecord>> GetPendingEventsAsync(int limit = 20)
        {
            var list = new List<OutboxEventRecord>();
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT id, event_type, aggregate_id, idempotency_key, payload_json, status, retry_count, created_at, last_attempt_at, error_message
                FROM outbox_events
                WHERE status IN ('PENDING', 'FAILED') AND retry_count < 20
                ORDER BY created_at ASC
                LIMIT @limit;
            ";
            cmd.Parameters.AddWithValue("@limit", limit);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                list.Add(new OutboxEventRecord
                {
                    Id = reader.GetString(0),
                    EventType = reader.GetString(1),
                    AggregateId = reader.GetString(2),
                    IdempotencyKey = reader.GetString(3),
                    PayloadJson = reader.GetString(4),
                    Status = reader.GetString(5),
                    RetryCount = reader.GetInt32(6),
                    CreatedAt = reader.GetString(7),
                    LastAttemptAt = reader.IsDBNull(8) ? null : reader.GetString(8),
                    ErrorMessage = reader.IsDBNull(9) ? null : reader.GetString(9)
                });
            }

            return list;
        }

        public static async Task UpdateEventStatusAsync(string id, string status, string? error = null, bool incrementRetry = false)
        {
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            string sql = @"
                UPDATE outbox_events
                SET status = @status,
                    last_attempt_at = @now,
                    error_message = @err";

            if (incrementRetry)
            {
                sql += ", retry_count = retry_count + 1";
            }

            sql += " WHERE id = @id;";
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("@id", id);
            cmd.Parameters.AddWithValue("@status", status);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
            cmd.Parameters.AddWithValue("@err", (object?)error ?? DBNull.Value);

            await cmd.ExecuteNonQueryAsync();
        }

        public static async Task<(int Pending, int Synced, int Failed, int Conflict)> GetEventCountsAsync()
        {
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT 
                    SUM(CASE WHEN status = 'PENDING' OR status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
                    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
                    SUM(CASE WHEN status = 'CONFLICT' THEN 1 ELSE 0 END) AS conflict_count
                FROM outbox_events;
            ";

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                int pending = reader.IsDBNull(0) ? 0 : Convert.ToInt32(reader.GetValue(0));
                int completed = reader.IsDBNull(1) ? 0 : Convert.ToInt32(reader.GetValue(1));
                int failed = reader.IsDBNull(2) ? 0 : Convert.ToInt32(reader.GetValue(2));
                int conflict = reader.IsDBNull(3) ? 0 : Convert.ToInt32(reader.GetValue(3));
                return (pending, completed, failed, conflict);
            }

            return (0, 0, 0, 0);
        }
    }
}

