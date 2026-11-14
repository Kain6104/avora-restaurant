using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using Microsoft.Data.Sqlite;
using Newtonsoft.Json;

namespace AvoraPosNative.Storage
{
    public static class OfflineOrderRepository
    {
        public static async Task<string> GenerateLocalOrderCodeAsync(string deviceId)
        {
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            string dateKey = DateTime.UtcNow.ToString("yyMMdd");
            string shortDevice = deviceId.Length >= 6 ? deviceId.Substring(0, 6).ToUpperInvariant() : deviceId.ToUpperInvariant();

            using var trans = conn.BeginTransaction();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = trans;
                cmd.CommandText = @"
                    INSERT INTO local_order_sequences (device_id, date_key, last_number)
                    VALUES (@devId, @dateKey, 1)
                    ON CONFLICT(device_id, date_key) DO UPDATE SET last_number = last_number + 1;
                ";
                cmd.Parameters.AddWithValue("@devId", shortDevice);
                cmd.Parameters.AddWithValue("@dateKey", dateKey);
                await cmd.ExecuteNonQueryAsync();

                using var selectCmd = conn.CreateCommand();
                selectCmd.Transaction = trans;
                selectCmd.CommandText = "SELECT last_number FROM local_order_sequences WHERE device_id = @devId AND date_key = @dateKey LIMIT 1;";
                selectCmd.Parameters.AddWithValue("@devId", shortDevice);
                selectCmd.Parameters.AddWithValue("@dateKey", dateKey);
                var seq = Convert.ToInt32(await selectCmd.ExecuteScalarAsync());

                trans.Commit();
                return $"OFF-{shortDevice}-{dateKey}-{seq:D4}";
            }
            catch
            {
                trans.Rollback();
                return $"OFF-{shortDevice}-{dateKey}-{new Random().Next(1000, 9999)}";
            }
        }

        public static async Task SaveOrderAtomicallyAsync(
            OfflineOrderRecord order,
            OutboxEventRecord? outboxEvent = null,
            List<OfflinePrintJobQueueItem>? printJobs = null)
        {
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var trans = conn.BeginTransaction();
            try
            {
                // 1. Upsert Order
                using var cmdOrder = conn.CreateCommand();
                cmdOrder.Transaction = trans;
                cmdOrder.CommandText = @"
                    INSERT INTO offline_orders (
                        client_order_id, local_order_code, server_order_id, server_order_code,
                        branch_id, table_id, table_name, order_type, guest_count,
                        customer_name, customer_phone, delivery_address, note,
                        sub_total, discount_amount, discount_voucher_code, tax_amount, shipping_fee, total_amount,
                        payment_method, payment_status, received_amount, change_amount,
                        sync_status, sync_attempts, last_sync_error,
                        payload_json, created_offline_at, synced_at,
                        cashier_id, cashier_name, device_id
                    )
                    VALUES (
                        @clientOrderId, @localOrderCode, @serverOrderId, @serverOrderCode,
                        @branchId, @tableId, @tableName, @orderType, @guestCount,
                        @custName, @custPhone, @delAddr, @note,
                        @subTotal, @discAmount, @discCode, @taxAmount, @shipFee, @totalAmount,
                        @payMethod, @payStatus, @recAmount, @chgAmount,
                        @syncStatus, @syncAttempts, @syncErr,
                        @payloadJson, @createdOffline, @syncedAt,
                        @cashierId, @cashierName, @deviceId
                    )
                    ON CONFLICT(client_order_id) DO UPDATE SET
                        local_order_code = @localOrderCode,
                        server_order_id = COALESCE(@serverOrderId, server_order_id),
                        server_order_code = COALESCE(@serverOrderCode, server_order_code),
                        sub_total = @subTotal,
                        discount_amount = @discAmount,
                        tax_amount = @taxAmount,
                        shipping_fee = @shipFee,
                        total_amount = @totalAmount,
                        payment_method = @payMethod,
                        payment_status = @payStatus,
                        received_amount = @recAmount,
                        change_amount = @chgAmount,
                        sync_status = @syncStatus,
                        last_sync_error = @syncErr,
                        payload_json = @payloadJson;
                ";
                cmdOrder.Parameters.AddWithValue("@clientOrderId", order.ClientOrderId);
                cmdOrder.Parameters.AddWithValue("@localOrderCode", order.LocalOrderCode);
                cmdOrder.Parameters.AddWithValue("@serverOrderId", (object?)order.ServerOrderId ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@serverOrderCode", (object?)order.ServerOrderCode ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@branchId", order.BranchId);
                cmdOrder.Parameters.AddWithValue("@tableId", (object?)order.TableId ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@tableName", (object?)order.TableName ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@orderType", order.OrderType);
                cmdOrder.Parameters.AddWithValue("@guestCount", order.GuestCount);
                cmdOrder.Parameters.AddWithValue("@custName", (object?)order.CustomerName ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@custPhone", (object?)order.CustomerPhone ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@delAddr", (object?)order.DeliveryAddress ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@note", (object?)order.Note ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@subTotal", (double)order.SubTotal);
                cmdOrder.Parameters.AddWithValue("@discAmount", (double)order.DiscountAmount);
                cmdOrder.Parameters.AddWithValue("@discCode", (object?)order.DiscountVoucherCode ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@taxAmount", (double)order.TaxAmount);
                cmdOrder.Parameters.AddWithValue("@shipFee", (double)order.ShippingFee);
                cmdOrder.Parameters.AddWithValue("@totalAmount", (double)order.TotalAmount);
                cmdOrder.Parameters.AddWithValue("@payMethod", (object?)order.PaymentMethod ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@payStatus", order.PaymentStatus);
                cmdOrder.Parameters.AddWithValue("@recAmount", (double)order.ReceivedAmount);
                cmdOrder.Parameters.AddWithValue("@chgAmount", (double)order.ChangeAmount);
                cmdOrder.Parameters.AddWithValue("@syncStatus", order.SyncStatus);
                cmdOrder.Parameters.AddWithValue("@syncAttempts", order.SyncAttempts);
                cmdOrder.Parameters.AddWithValue("@syncErr", (object?)order.LastSyncError ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@payloadJson", order.PayloadJson);
                cmdOrder.Parameters.AddWithValue("@createdOffline", order.CreatedOfflineAt);
                cmdOrder.Parameters.AddWithValue("@syncedAt", (object?)order.SyncedAt ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@cashierId", (object?)order.CashierId ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@cashierName", (object?)order.CashierName ?? DBNull.Value);
                cmdOrder.Parameters.AddWithValue("@deviceId", order.DeviceId);
                await cmdOrder.ExecuteNonQueryAsync();

                // 2. Insert Outbox Event if provided
                if (outboxEvent != null)
                {
                    using var cmdOutbox = conn.CreateCommand();
                    cmdOutbox.Transaction = trans;
                    cmdOutbox.CommandText = @"
                        INSERT INTO outbox_events (id, event_type, aggregate_id, idempotency_key, payload_json, status, retry_count, created_at)
                        VALUES (@id, @type, @aggId, @key, @json, @status, @retry, @created)
                        ON CONFLICT(idempotency_key) DO NOTHING;
                    ";
                    cmdOutbox.Parameters.AddWithValue("@id", outboxEvent.Id);
                    cmdOutbox.Parameters.AddWithValue("@type", outboxEvent.EventType);
                    cmdOutbox.Parameters.AddWithValue("@aggId", outboxEvent.AggregateId);
                    cmdOutbox.Parameters.AddWithValue("@key", outboxEvent.IdempotencyKey);
                    cmdOutbox.Parameters.AddWithValue("@json", outboxEvent.PayloadJson);
                    cmdOutbox.Parameters.AddWithValue("@status", outboxEvent.Status);
                    cmdOutbox.Parameters.AddWithValue("@retry", outboxEvent.RetryCount);
                    cmdOutbox.Parameters.AddWithValue("@created", outboxEvent.CreatedAt);
                    await cmdOutbox.ExecuteNonQueryAsync();
                }

                // 3. Insert Print Jobs if provided
                if (printJobs != null && printJobs.Count > 0)
                {
                    foreach (var job in printJobs)
                    {
                        using var cmdJob = conn.CreateCommand();
                        cmdJob.Transaction = trans;
                        cmdJob.CommandText = @"
                            INSERT INTO print_jobs (id, idempotency_key, printer_id, status, attempts, created_at, payload_bytes, doc_name)
                            VALUES (@id, @key, @printerId, 'QUEUED', 0, @created, @bytes, @doc)
                            ON CONFLICT(idempotency_key) DO NOTHING;
                        ";
                        cmdJob.Parameters.AddWithValue("@id", job.Id);
                        cmdJob.Parameters.AddWithValue("@key", job.IdempotencyKey);
                        cmdJob.Parameters.AddWithValue("@printerId", job.PrinterId);
                        cmdJob.Parameters.AddWithValue("@created", DateTime.UtcNow.ToString("o"));
                        cmdJob.Parameters.AddWithValue("@bytes", job.PayloadBytes);
                        cmdJob.Parameters.AddWithValue("@doc", job.DocName);
                        await cmdJob.ExecuteNonQueryAsync();
                    }
                }

                trans.Commit();
                System.Diagnostics.Debug.WriteLine($"[OFFLINE ORDER] Atomically saved order {order.LocalOrderCode} ({order.ClientOrderId})");
            }
            catch (Exception ex)
            {
                trans.Rollback();
                System.Diagnostics.Debug.WriteLine($"[OFFLINE ORDER] Transaction failed: {ex.Message}");
                throw;
            }
        }

        public static async Task<OfflineOrderRecord?> GetOrderByClientIdAsync(string clientOrderId)
        {
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT payload_json, sync_status, local_order_code, server_order_id, server_order_code FROM offline_orders WHERE client_order_id = @id LIMIT 1;";
            cmd.Parameters.AddWithValue("@id", clientOrderId);

            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                string json = reader.GetString(0);
                var rec = JsonConvert.DeserializeObject<OfflineOrderRecord>(json);
                if (rec != null)
                {
                    rec.SyncStatus = reader.GetString(1);
                    rec.LocalOrderCode = reader.GetString(2);
                    rec.ServerOrderId = reader.IsDBNull(3) ? null : reader.GetString(3);
                    rec.ServerOrderCode = reader.IsDBNull(4) ? null : reader.GetString(4);
                    return rec;
                }
            }

            return null;
        }

        public static async Task UpdateOrderSyncStatusAsync(
            string clientOrderId,
            string syncStatus,
            string? serverOrderId = null,
            string? serverOrderCode = null,
            string? error = null)
        {
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                UPDATE offline_orders
                SET sync_status = @status,
                    server_order_id = COALESCE(@srvId, server_order_id),
                    server_order_code = COALESCE(@srvCode, server_order_code),
                    last_sync_error = @err,
                    synced_at = CASE WHEN @status = 'SYNCED' THEN @now ELSE synced_at END,
                    sync_attempts = sync_attempts + 1
                WHERE client_order_id = @id;
            ";
            cmd.Parameters.AddWithValue("@id", clientOrderId);
            cmd.Parameters.AddWithValue("@status", syncStatus);
            cmd.Parameters.AddWithValue("@srvId", (object?)serverOrderId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@srvCode", (object?)serverOrderCode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@err", (object?)error ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));

            await cmd.ExecuteNonQueryAsync();
        }

        public static async Task<List<OfflineOrderRecord>> GetPendingSyncOrdersAsync()
        {
            var list = new List<OfflineOrderRecord>();
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT payload_json, sync_status, local_order_code, server_order_id, server_order_code, last_sync_error
                FROM offline_orders
                WHERE sync_status IN ('PENDING_SYNC', 'LOCAL_SAVED', 'SYNC_FAILED')
                ORDER BY created_offline_at ASC;
            ";

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string json = reader.GetString(0);
                var rec = JsonConvert.DeserializeObject<OfflineOrderRecord>(json);
                if (rec != null)
                {
                    rec.SyncStatus = reader.GetString(1);
                    rec.LocalOrderCode = reader.GetString(2);
                    rec.ServerOrderId = reader.IsDBNull(3) ? null : reader.GetString(3);
                    rec.ServerOrderCode = reader.IsDBNull(4) ? null : reader.GetString(4);
                    rec.LastSyncError = reader.IsDBNull(5) ? null : reader.GetString(5);
                    list.Add(rec);
                }
            }

            return list;
        }

        public static async Task<List<OfflineOrderRecord>> GetRecentOrdersAsync(int limit = 50)
        {
            var list = new List<OfflineOrderRecord>();
            LocalDatabase.Initialize();
            using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
            await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT payload_json, sync_status, local_order_code, server_order_id, server_order_code, last_sync_error, created_offline_at
                FROM offline_orders
                ORDER BY created_offline_at DESC
                LIMIT @limit;
            ";
            cmd.Parameters.AddWithValue("@limit", limit);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                string json = reader.GetString(0);
                var rec = JsonConvert.DeserializeObject<OfflineOrderRecord>(json);
                if (rec != null)
                {
                    rec.SyncStatus = reader.GetString(1);
                    rec.LocalOrderCode = reader.GetString(2);
                    rec.ServerOrderId = reader.IsDBNull(3) ? null : reader.GetString(3);
                    rec.ServerOrderCode = reader.IsDBNull(4) ? null : reader.GetString(4);
                    rec.LastSyncError = reader.IsDBNull(5) ? null : reader.GetString(5);
                    rec.CreatedOfflineAt = reader.GetString(6);
                    list.Add(rec);
                }
            }

            return list;
        }
    }
}

