using System;
using System.Collections.Concurrent;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Storage;
using Microsoft.Data.Sqlite;

namespace AvoraPosNative.Printing
{
    /// <summary>
    /// Hệ thống quản lý hàng đợi in chuyên nghiệp:
    /// - Không dùng global queue (Directive 6)
    /// - Mỗi printer có worker queue riêng biệt (Per-Printer Worker Queue)
    /// - Lưu trữ persistent trong SQLite, chống mất lệnh khi khởi động lại (Directive 7)
    /// - Idempotency Key chống in lặp hóa đơn
    /// </summary>
    public class PersistentPrintQueue : IDisposable
    {
        private static readonly Lazy<PersistentPrintQueue> _instance = new(() => new PersistentPrintQueue());
        public static PersistentPrintQueue Instance => _instance.Value;

        private readonly ConcurrentDictionary<string, PrinterWorker> _printerWorkers = new();
        private readonly CancellationTokenSource _cts = new();

        private PersistentPrintQueue()
        {
            LocalDatabase.Initialize();
            // Nạp lại các tác vụ in chưa hoàn tất từ phiên trước
            Task.Run(() => RecoverUnfinishedJobsAsync());
        }

        public async Task<bool> EnqueuePrintJobAsync(
            string printerId,
            string printerTarget,
            PrinterConnectionType connectionType,
            byte[] payloadBytes,
            string docName = "AVORA POS RECEIPT",
            string? idempotencyKey = null)
        {
            if (string.IsNullOrWhiteSpace(printerId))
            {
                printerId = string.IsNullOrWhiteSpace(printerTarget) ? "DEFAULT_PRINTER" : printerTarget;
            }

            string key = !string.IsNullOrWhiteSpace(idempotencyKey) ? idempotencyKey : Guid.NewGuid().ToString();
            string jobId = Guid.NewGuid().ToString();
            string now = DateTime.UtcNow.ToString("o");

            try
            {
                // 1. Lưu vào SQLite với Idempotency Key
                using (var conn = new SqliteConnection(LocalDatabase.ConnectionString))
                {
                    await conn.OpenAsync();

                    // Kiểm tra nếu idempotencyKey đã tồn tại
                    using var checkCmd = conn.CreateCommand();
                    checkCmd.CommandText = "SELECT id, status FROM print_jobs WHERE idempotency_key = @key LIMIT 1;";
                    checkCmd.Parameters.AddWithValue("@key", key);

                    using var reader = await checkCmd.ExecuteReaderAsync();
                    if (await reader.ReadAsync())
                    {
                        string existingStatus = reader.GetString(1);
                        System.Diagnostics.Debug.WriteLine($"[PRINT QUEUE] Job with IdempotencyKey '{key}' already exists with status: {existingStatus}");
                        return true; // Đã nhận tác vụ này, chống in lặp
                    }
                    reader.Close();

                    // Ghi nhận job mới vào SQLite
                    using var insertCmd = conn.CreateCommand();
                    insertCmd.CommandText = @"
                        INSERT INTO print_jobs (id, idempotency_key, printer_id, status, attempts, created_at, payload_bytes, doc_name)
                        VALUES (@id, @key, @printerId, 'QUEUED', 0, @created, @bytes, @doc);
                    ";
                    insertCmd.Parameters.AddWithValue("@id", jobId);
                    insertCmd.Parameters.AddWithValue("@key", key);
                    insertCmd.Parameters.AddWithValue("@printerId", printerId);
                    insertCmd.Parameters.AddWithValue("@created", now);
                    insertCmd.Parameters.AddWithValue("@bytes", payloadBytes);
                    insertCmd.Parameters.AddWithValue("@doc", docName);

                    await insertCmd.ExecuteNonQueryAsync();
                }

                // 2. Định tuyến tới Worker riêng của printerId đó
                var worker = GetOrCreateWorker(printerId, printerTarget, connectionType);
                worker.NotifyNewJob();
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PRINT QUEUE] Lỗi EnqueuePrintJobAsync: {ex.Message}");
                return false;
            }
        }

        private PrinterWorker GetOrCreateWorker(string printerId, string printerTarget, PrinterConnectionType connectionType)
        {
            return _printerWorkers.GetOrAdd(printerId, id =>
            {
                var w = new PrinterWorker(id, printerTarget, connectionType, _cts.Token);
                w.Start();
                return w;
            });
        }

        private async Task RecoverUnfinishedJobsAsync()
        {
            try
            {
                using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
                await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT DISTINCT printer_id 
                    FROM print_jobs 
                    WHERE status IN ('QUEUED', 'PRINTING') AND attempts < 5;
                ";

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    string printerId = reader.GetString(0);
                    // Khởi động worker cho máy in này để xử lý tiếp các job tồn đọng
                    var worker = GetOrCreateWorker(printerId, printerId, PrinterConnectionType.USB_WINDOWS_SPOOLER);
                    worker.NotifyNewJob();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PRINT QUEUE] Lỗi RecoverUnfinishedJobsAsync: {ex.Message}");
            }
        }

        public void Dispose()
        {
            _cts.Cancel();
            foreach (var kvp in _printerWorkers)
            {
                kvp.Value.Dispose();
            }
            _printerWorkers.Clear();
            _cts.Dispose();
        }
    }

    /// <summary>
    /// Worker riêng biệt chạy nền cho từng máy in độc lập
    /// </summary>
    internal class PrinterWorker : IDisposable
    {
        private readonly string _printerId;
        private readonly string _printerTarget;
        private readonly PrinterConnectionType _connectionType;
        private readonly CancellationToken _globalCt;
        private readonly AutoResetEvent _jobSignal = new(false);
        private Task? _workerTask;
        private bool _disposed = false;

        public PrinterWorker(string printerId, string printerTarget, PrinterConnectionType connectionType, CancellationToken globalCt)
        {
            _printerId = printerId;
            _printerTarget = printerTarget;
            _connectionType = connectionType;
            _globalCt = globalCt;
        }

        public void Start()
        {
            _workerTask = Task.Run(WorkerLoopAsync);
        }

        public void NotifyNewJob()
        {
            _jobSignal.Set();
        }

        private async Task WorkerLoopAsync()
        {
            while (!_globalCt.IsCancellationRequested && !_disposed)
            {
                try
                {
                    bool hasJob = await ProcessNextJobAsync();
                    if (!hasJob)
                    {
                        // Chờ thông báo có job mới hoặc timeout kiểm tra lại sau 5s
                        _jobSignal.WaitOne(5000);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[WORKER {_printerId}] Exception in loop: {ex.Message}");
                    await Task.Delay(2000, _globalCt);
                }
            }
        }

        private async Task<bool> ProcessNextJobAsync()
        {
            string? jobId = null;
            byte[]? payload = null;
            string? docName = null;
            int currentAttempts = 0;

            // 1. Đọc job cũ nhất đang ở trạng thái QUEUED cho printer này
            using (var conn = new SqliteConnection(LocalDatabase.ConnectionString))
            {
                await conn.OpenAsync(_globalCt);

                using var selectCmd = conn.CreateCommand();
                selectCmd.CommandText = @"
                    SELECT id, payload_bytes, doc_name, attempts 
                    FROM print_jobs 
                    WHERE printer_id = @printerId AND status IN ('QUEUED', 'PRINTING') AND attempts < 5
                    ORDER BY created_at ASC LIMIT 1;
                ";
                selectCmd.Parameters.AddWithValue("@printerId", _printerId);

                using var reader = await selectCmd.ExecuteReaderAsync(_globalCt);
                if (await reader.ReadAsync(_globalCt))
                {
                    jobId = reader.GetString(0);
                    payload = (byte[])reader["payload_bytes"];
                    docName = reader.GetString(2);
                    currentAttempts = reader.GetInt32(3);
                }
            }

            if (jobId == null || payload == null)
            {
                return false; // Không còn job nào
            }

            // 2. Đánh dấu trạng thái PRINTING
            await UpdateJobStatusAsync(jobId, "PRINTING", null, DateTime.UtcNow);

            // 3. Thực hiện gửi RAW bytes tới máy in
            bool printSuccess = false;
            string? errorMessage = null;

            try
            {
                if (_connectionType == PrinterConnectionType.TCP_LAN_RAW || _printerTarget.StartsWith("tcp://", StringComparison.OrdinalIgnoreCase))
                {
                    string ip = _printerTarget.Replace("tcp://", "");
                    int port = 9100;
                    if (ip.Contains(':'))
                    {
                        var parts = ip.Split(':');
                        ip = parts[0];
                        int.TryParse(parts[1], out port);
                    }
                    var (success, error) = await TcpRawPrinter.SendBytesTcpAsync(ip, port, payload);
                    printSuccess = success;
                    errorMessage = error;
                }
                else
                {
                    var (success, error) = WinSpoolNative.SendRawBytes(_printerTarget, payload, docName ?? "AVORA POS NATIVE");
                    printSuccess = success;
                    errorMessage = error;
                }
            }
            catch (Exception ex)
            {
                printSuccess = false;
                errorMessage = ex.Message;
            }

            // 4. Cập nhật kết quả vào SQLite
            if (printSuccess)
            {
                await MarkJobCompletedAsync(jobId);
                System.Diagnostics.Debug.WriteLine($"[WORKER {_printerId}] In thành công job {jobId}");
            }
            else
            {
                int nextAttempts = currentAttempts + 1;
                string nextStatus = nextAttempts >= 5 ? "FAILED" : "QUEUED";
                await UpdateJobFailureAsync(jobId, nextStatus, nextAttempts, errorMessage);
                System.Diagnostics.Debug.WriteLine($"[WORKER {_printerId}] In thất bại job {jobId} (Lần {nextAttempts}): {errorMessage}");
                // Chờ trước khi retry
                await Task.Delay(1500, _globalCt);
            }

            return true;
        }

        private static async Task UpdateJobStatusAsync(string id, string status, string? error, DateTime? printingAt)
        {
            try
            {
                using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    UPDATE print_jobs 
                    SET status = @status, printing_at = @time
                    WHERE id = @id;
                ";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@status", status);
                cmd.Parameters.AddWithValue("@time", printingAt?.ToString("o") ?? (object)DBNull.Value);
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
        }

        private static async Task MarkJobCompletedAsync(string id)
        {
            try
            {
                using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    UPDATE print_jobs 
                    SET status = 'COMPLETED', printed_at = @now, error = NULL
                    WHERE id = @id;
                ";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@now", DateTime.UtcNow.ToString("o"));
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
        }

        private static async Task UpdateJobFailureAsync(string id, string status, int attempts, string? error)
        {
            try
            {
                using var conn = new SqliteConnection(LocalDatabase.ConnectionString);
                await conn.OpenAsync();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    UPDATE print_jobs 
                    SET status = @status, attempts = @attempts, error = @err
                    WHERE id = @id;
                ";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@status", status);
                cmd.Parameters.AddWithValue("@attempts", attempts);
                cmd.Parameters.AddWithValue("@err", error ?? "Lỗi không xác định");
                await cmd.ExecuteNonQueryAsync();
            }
            catch { }
        }

        public void Dispose()
        {
            _disposed = true;
            _jobSignal.Set();
            _jobSignal.Dispose();
        }
    }
}
