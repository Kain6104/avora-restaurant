using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using AvoraPos.Models;
using AvoraPos.Storage;
using Newtonsoft.Json;

namespace AvoraPos.NativePrint
{
    public class PersistentPrintQueueManager
    {
        private static PersistentPrintQueueManager? _instance;
        public static PersistentPrintQueueManager Instance => _instance ??= new PersistentPrintQueueManager();

        private readonly ConcurrentDictionary<string, Channel<PrintJobRecord>> _printerChannels = new ConcurrentDictionary<string, Channel<PrintJobRecord>>();
        private readonly ConcurrentDictionary<string, Task> _printerWorkers = new ConcurrentDictionary<string, Task>();
        private readonly CancellationTokenSource _cts = new CancellationTokenSource();

        public PersistentPrintQueueManager()
        {
            // Recover unfinished jobs upon instantiation (Directive 9)
            Task.Run(RecoverUnfinishedJobs);
        }

        private Channel<PrintJobRecord> GetOrCreatePrinterChannel(string printerId)
        {
            return _printerChannels.GetOrAdd(printerId, (pid) =>
            {
                var channel = Channel.CreateUnbounded<PrintJobRecord>(new UnboundedChannelOptions
                {
                    SingleReader = true,
                    SingleWriter = false
                });

                // Spawn a dedicated worker for this printer
                _printerWorkers[pid] = Task.Run(() => ProcessPrinterQueueWorkerAsync(pid, channel.Reader, _cts.Token));

                return channel;
            });
        }

        public (bool Success, string? Error) SubmitJob(
            string printerId,
            string jobType,
            object payload,
            string idempotencyKey,
            byte[]? preRenderedBytes = null)
        {
            if (string.IsNullOrWhiteSpace(printerId))
            {
                return (false, "Chưa chỉ định máy in (printerId trống)");
            }

            // Check if already printed (deduplication)
            if (LocalDatabase.Instance.IsJobAlreadyPrinted(idempotencyKey))
            {
                return (true, null); // Idempotent success
            }

            string jobId = Guid.NewGuid().ToString();
            string payloadJson = JsonConvert.SerializeObject(payload);
            string? bytesBase64 = preRenderedBytes != null ? Convert.ToBase64String(preRenderedBytes) : null;

            // 1. Persist to SQLite BEFORE dispatch (Directive 9)
            LocalDatabase.Instance.EnqueuePrintJob(jobId, printerId, jobType, payloadJson, bytesBase64, idempotencyKey);

            var record = new PrintJobRecord
            {
                Id = jobId,
                PrinterId = printerId,
                JobType = jobType,
                PayloadJson = payloadJson,
                RawBytesBase64 = bytesBase64,
                Status = "PENDING",
                AttemptCount = 0,
                MaxAttempts = 3,
                IdempotencyKey = idempotencyKey,
                CreatedAt = DateTime.UtcNow
            };

            // 2. Enqueue into printer worker (unbounded channel always writes synchronously)
            var channel = GetOrCreatePrinterChannel(printerId);
            channel.Writer.TryWrite(record);

            return (true, null);
        }

        public Task<(bool Success, string? Error)> SubmitJobAsync(
            string printerId,
            string jobType,
            object payload,
            string idempotencyKey,
            byte[]? preRenderedBytes = null)
        {
            return Task.FromResult(SubmitJob(printerId, jobType, payload, idempotencyKey, preRenderedBytes));
        }

        private async Task ProcessPrinterQueueWorkerAsync(string printerId, ChannelReader<PrintJobRecord> reader, CancellationToken ct)
        {
            while (!ct.IsCancellationRequested && await reader.WaitToReadAsync(ct))
            {
                while (reader.TryRead(out var job))
                {
                    try
                    {
                        var result = await ExecutePrintJobAsync(job);
                        if (result.Success)
                        {
                            LocalDatabase.Instance.MarkJobPrinted(job.Id);
                        }
                        else
                        {
                            LocalDatabase.Instance.MarkJobFailed(job.Id, result.Error ?? "Lỗi không xác định");
                            // If attempts < max, retry with a brief backoff
                            if (job.AttemptCount + 1 < job.MaxAttempts)
                            {
                                job.AttemptCount++;
                                await Task.Delay(1500, ct);
                                var channel = GetOrCreatePrinterChannel(printerId);
                                await channel.Writer.WriteAsync(job, ct);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        LocalDatabase.Instance.MarkJobFailed(job.Id, ex.Message);
                    }
                }
            }
        }

        private async Task<(bool Success, string? Error)> ExecutePrintJobAsync(PrintJobRecord job)
        {
            // Lookup printer profile
            var profiles = LocalDatabase.Instance.GetAllPrinterProfiles();
            var profile = profiles.FirstOrDefault(p => p.PrinterId == job.PrinterId || p.Name.Equals(job.PrinterId, StringComparison.OrdinalIgnoreCase));

            if (profile == null)
            {
                // Fallback: If printerId is a Windows printer name, build a default profile
                profile = new PrinterProfile
                {
                    PrinterId = job.PrinterId,
                    Name = job.PrinterId,
                    PrinterType = job.JobType == "LABEL" ? PrinterType.LABEL : PrinterType.CASHIER,
                    ConnectionType = PrinterConnectionType.WINDOWS_RAW,
                    CommandSet = job.JobType == "LABEL" ? PrinterCommandSet.TSPL : PrinterCommandSet.ESC_POS,
                    PaperWidthMm = 80,
                    PrintableWidthDots = 576
                };
            }

            byte[]? printBytes = null;

            if (!string.IsNullOrWhiteSpace(job.RawBytesBase64))
            {
                printBytes = Convert.FromBase64String(job.RawBytesBase64);
            }
            else
            {
                // Generate bytes based on JobType
                switch (job.JobType)
                {
                    case "RECEIPT":
                    case "TEMP_BILL":
                        var receiptPayload = JsonConvert.DeserializeObject<ReceiptPrintPayload>(job.PayloadJson);
                        if (receiptPayload != null)
                        {
                            printBytes = RasterTextEngine.BuildReceiptRasterBytes(receiptPayload, profile);
                        }
                        break;

                    case "KITCHEN_TICKET":
                    case "CANCEL_TICKET":
                        var kitchenPayload = JsonConvert.DeserializeObject<KitchenPrintPayload>(job.PayloadJson);
                        if (kitchenPayload != null)
                        {
                            printBytes = RasterTextEngine.BuildKitchenTicketRasterBytes(kitchenPayload, profile);
                        }
                        break;

                    case "LABEL":
                        var labelPayload = JsonConvert.DeserializeObject<LabelPrintPayload>(job.PayloadJson);
                        if (labelPayload != null && labelPayload.Labels.Count > 0)
                        {
                            using var ms = new System.IO.MemoryStream();
                            foreach (var item in labelPayload.Labels)
                            {
                                byte[] itemBytes = profile.LabelCommandLanguage == LabelCommandLanguage.ZPL
                                    ? ZplLabelEngine.BuildZplLabel(item, profile)
                                    : TsplLabelEngine.BuildTsplLabel(item, profile);
                                ms.Write(itemBytes, 0, itemBytes.Length);
                            }
                            printBytes = ms.ToArray();
                        }
                        break;
                }
            }

            if (printBytes == null || printBytes.Length == 0)
            {
                return (false, "Không thể tạo mã lệnh in (dữ liệu payload không hợp lệ)");
            }

            // Dispatch
            if (profile.ConnectionType == PrinterConnectionType.TCP_RAW)
            {
                if (string.IsNullOrWhiteSpace(profile.IpAddress))
                {
                    return (false, "Máy in mạng thiếu địa chỉ IP");
                }
                return await LanPrinterDispatcher.SendBytesTcpAsync(profile.IpAddress, profile.TcpPort, printBytes);
            }
            else
            {
                // Check if printer is known office/GDI printer (RICOH, Canon, HP, PDF...)
                if (WinSpoolNative.IsGdiOrOfficePrinter(profile.Name))
                {
                    using var gdiBmp = RenderJobToBitmap(job, profile);
                    if (gdiBmp != null)
                    {
                        return WinSpoolNative.PrintBitmapViaGdi(profile.Name, gdiBmp, $"AVORA POS - {job.JobType}");
                    }
                }

                // Standard thermal printer: WINDOWS_RAW via WinSpoolNative
                var rawResult = WinSpoolNative.SendRawBytes(profile.Name, printBytes, $"AVORA POS - {job.JobType}");
                if (!rawResult.Success)
                {
                    // Fallback: Driver rejected RAW datatype or printer requires GDI
                    using var fallbackBmp = RenderJobToBitmap(job, profile);
                    if (fallbackBmp != null)
                    {
                        var gdiResult = WinSpoolNative.PrintBitmapViaGdi(profile.Name, fallbackBmp, $"AVORA POS - {job.JobType}");
                        if (gdiResult.Success)
                        {
                            return (true, null);
                        }
                    }
                }
                return rawResult;
            }
        }

        private System.Drawing.Bitmap? RenderJobToBitmap(PrintJobRecord job, PrinterProfile profile)
        {
            try
            {
                switch (job.JobType)
                {
                    case "RECEIPT":
                    case "TEMP_BILL":
                        var receiptPayload = JsonConvert.DeserializeObject<ReceiptPrintPayload>(job.PayloadJson);
                        if (receiptPayload != null)
                        {
                            var builder = RasterTextEngine.CreateReceiptBuilder(receiptPayload, profile);
                            return builder.RenderToBitmap();
                        }
                        break;

                    case "KITCHEN_TICKET":
                    case "CANCEL_TICKET":
                        var kitchenPayload = JsonConvert.DeserializeObject<KitchenPrintPayload>(job.PayloadJson);
                        if (kitchenPayload != null)
                        {
                            var builder = RasterTextEngine.CreateKitchenTicketBuilder(kitchenPayload, profile);
                            return builder.RenderToBitmap();
                        }
                        break;
                }
            }
            catch { }
            return null;
        }

        private void RecoverUnfinishedJobs()
        {
            try
            {
                var unfinished = LocalDatabase.Instance.GetUnfinishedPrintJobs();
                foreach (var job in unfinished)
                {
                    var channel = GetOrCreatePrinterChannel(job.PrinterId);
                    channel.Writer.TryWrite(job);
                }
            }
            catch { }
        }

        public bool HasActiveJobs()
        {
            try
            {
                var unfinished = LocalDatabase.Instance.GetUnfinishedPrintJobs();
                return unfinished.Count > 0;
            }
            catch
            {
                return false;
            }
        }

        public void Stop()
        {
            _cts.Cancel();
        }
    }
}
