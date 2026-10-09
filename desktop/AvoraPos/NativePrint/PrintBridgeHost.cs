using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;
using AvoraPos.Models;
using AvoraPos.Storage;
using AvoraPos.Update;
using Newtonsoft.Json;

namespace AvoraPos.NativePrint
{
    [ClassInterface(ClassInterfaceType.AutoDual)]
    [ComVisible(true)]
    public class PrintBridgeHost
    {
        private HttpListener? _httpListener;
        private Action? _exitRequestedCallback;
        private Action? _logoutRequestedCallback;

        public PrintBridgeHost()
        {
            StartLocalHttpBridge();
        }

        public void SetExitRequestedCallback(Action cb)
        {
            _exitRequestedCallback = cb;
        }

        public void RequestAppExit()
        {
            _exitRequestedCallback?.Invoke();
        }

        public void SetLogoutRequestedCallback(Action cb)
        {
            _logoutRequestedCallback = cb;
        }

        public void RequestLogout()
        {
            _logoutRequestedCallback?.Invoke();
        }

        private static readonly JsonSerializerSettings CamelCaseSettings = new JsonSerializerSettings
        {
            ContractResolver = new Newtonsoft.Json.Serialization.CamelCasePropertyNamesContractResolver(),
            Formatting = Formatting.None
        };

        // ==========================================
        // COM VISIBLE METHODS FOR WEBVIEW2 SCRIPT
        // ==========================================
        public string GetPrintersJson()
        {
            try
            {
                var printers = WinSpoolNative.GetInstalledPrinters();
                return JsonConvert.SerializeObject(new { success = true, data = printers }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string GetPrinterProfilesJson()
        {
            try
            {
                var profiles = LocalDatabase.Instance.GetAllPrinterProfiles();
                return JsonConvert.SerializeObject(new { success = true, data = profiles }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string SavePrinterProfile(string profileJson)
        {
            try
            {
                var profile = JsonConvert.DeserializeObject<PrinterProfile>(profileJson);
                if (profile == null) return JsonConvert.SerializeObject(new { success = false, error = "Dữ liệu cấu hình không hợp lệ" }, CamelCaseSettings);

                LocalDatabase.Instance.SavePrinterProfile(profile);
                return JsonConvert.SerializeObject(new { success = true, data = profile }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string PrintHtml(string payloadJson)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(payloadJson))
                {
                    return JsonConvert.SerializeObject(new { success = false, error = "Payload in HTML rỗng" }, CamelCaseSettings);
                }

                var j = JsonConvert.DeserializeObject<dynamic>(payloadJson);
                string html = (string)(j?.html ?? j?.htmlContent ?? "");
                string printerName = (string)(j?.printerName ?? j?.targetPrinterId ?? "");
                string paperSize = (string)(j?.paperSize ?? "80mm");
                int copies = (int)(j?.copies ?? 1);

                if (string.IsNullOrWhiteSpace(html))
                {
                    return JsonConvert.SerializeObject(new { success = false, error = "Nội dung HTML rỗng" }, CamelCaseSettings);
                }

                if (MainWindow.Instance == null)
                {
                    return JsonConvert.SerializeObject(new { success = false, error = "Cửa sổ POS chưa sẵn sàng" }, CamelCaseSettings);
                }

                var task = MainWindow.Instance.PrintHtmlSilentAsync(html, printerName, paperSize, copies);
                var result = task.GetAwaiter().GetResult();

                return JsonConvert.SerializeObject(new { success = result.Success, error = result.Error }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string PrintReceipt(string payloadJson)
        {
            try
            {
                var payload = JsonConvert.DeserializeObject<ReceiptPrintPayload>(payloadJson);
                if (payload == null) return JsonConvert.SerializeObject(new { success = false, error = "Payload hóa đơn rỗng" }, CamelCaseSettings);

                string printerId = payload.TargetPrinterId ?? "XP-80C";
                string idempotencyKey = $"receipt_{payload.OrderId}_{DateTime.UtcNow.Ticks}";

                var result = PersistentPrintQueueManager.Instance.SubmitJob(
                    printerId,
                    payload.IsProForma ? "TEMP_BILL" : "RECEIPT",
                    payload,
                    idempotencyKey);

                return JsonConvert.SerializeObject(new { success = result.Success, error = result.Error }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string PrintKitchenTicket(string payloadJson)
        {
            try
            {
                var payload = JsonConvert.DeserializeObject<KitchenPrintPayload>(payloadJson);
                if (payload == null) return JsonConvert.SerializeObject(new { success = false, error = "Payload vé bếp rỗng" }, CamelCaseSettings);

                string printerId = payload.TargetPrinterId ?? "XP-80C";
                string idempotencyKey = $"kitchen_{payload.OrderId}_{payload.StationId}_{DateTime.UtcNow.Ticks}";

                var result = PersistentPrintQueueManager.Instance.SubmitJob(
                    printerId,
                    payload.IsCancelTicket ? "CANCEL_TICKET" : "KITCHEN_TICKET",
                    payload,
                    idempotencyKey);

                return JsonConvert.SerializeObject(new { success = result.Success, error = result.Error }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string PrintLabel(string payloadJson)
        {
            try
            {
                var payload = JsonConvert.DeserializeObject<LabelPrintPayload>(payloadJson);
                if (payload == null) return JsonConvert.SerializeObject(new { success = false, error = "Payload tem nhãn rỗng" }, CamelCaseSettings);

                string printerId = payload.TargetPrinterId ?? "Xprinter XP-350B";
                string idempotencyKey = $"label_{DateTime.UtcNow.Ticks}";

                var result = PersistentPrintQueueManager.Instance.SubmitJob(
                    printerId,
                    "LABEL",
                    payload,
                    idempotencyKey);

                return JsonConvert.SerializeObject(new { success = result.Success, error = result.Error }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string OpenCashDrawer(string printerOrJson = "XP-80C", int pin = 2, int pulseOn = 50, int pulseOff = 500)
        {
            try
            {
                string printerName = printerOrJson;
                if (!string.IsNullOrWhiteSpace(printerOrJson) && printerOrJson.TrimStart().StartsWith("{"))
                {
                    try
                    {
                        var parsed = JsonConvert.DeserializeObject<dynamic>(printerOrJson);
                        if (parsed != null)
                        {
                            printerName = (string)(parsed.printerName ?? printerName);
                            pin = (int)(parsed.pin ?? pin);
                        }
                    }
                    catch { }
                }

                byte pinByte = (byte)(pin == 5 ? 1 : 0);
                byte t1 = (byte)Math.Clamp(pulseOn / 2, 1, 255);
                byte t2 = (byte)Math.Clamp(pulseOff / 2, 1, 255);

                byte[] pulseBytes = new byte[] { 0x1B, 0x70, pinByte, t1, t2 };
                var result = WinSpoolNative.SendRawBytes(printerName, pulseBytes, "AVORA Open Cash Drawer");
                return JsonConvert.SerializeObject(new { success = result.Success, error = result.Error }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string TestPrint(string printerOrJson = "XP-80C", string type = "RECEIPT")
        {
            try
            {
                string printerName = printerOrJson;
                string printType = type;

                if (!string.IsNullOrWhiteSpace(printerOrJson) && printerOrJson.TrimStart().StartsWith("{"))
                {
                    try
                    {
                        var parsed = JsonConvert.DeserializeObject<dynamic>(printerOrJson);
                        if (parsed != null)
                        {
                            printerName = (string)(parsed.printerName ?? parsed.targetPrinterId ?? printerName);
                            printType = (string)(parsed.type ?? parsed.purpose ?? printType);
                        }
                    }
                    catch { }
                }

                if (string.IsNullOrWhiteSpace(printerName))
                {
                    printerName = "XP-80C";
                }

                if (string.Equals(printType, "LABEL", StringComparison.OrdinalIgnoreCase))
                {
                    var labelPayload = new LabelPrintPayload
                    {
                        TargetPrinterId = printerName,
                        Labels = new List<LabelPrintItemPayload>
                        {
                            new LabelPrintItemPayload
                            {
                                ItemName = "Trà Đào Cam Sả (L)",
                                OptionsText = "Ít đường, Ít đá",
                                Price = 45000,
                                OrderCode = "OD-TEST",
                                TableName = "Bàn 01",
                                Barcode = "AVORA1001",
                                CopyNumber = 1,
                                TotalCopies = 1
                            }
                        }
                    };
                    return PrintLabel(JsonConvert.SerializeObject(labelPayload));
                }
                else
                {
                    var receiptPayload = new ReceiptPrintPayload
                    {
                        TargetPrinterId = printerName,
                        OrderCode = "TEST-PRINT-01",
                        TableName = "Bàn TEST",
                        RestaurantName = "AVORA RESTAURANT",
                        BranchName = "Chi nhánh Thử nghiệm",
                        Items = new List<ReceiptItemPayload>
                        {
                            new ReceiptItemPayload { Name = "Bún bò Huế Đặc Biệt", Quantity = 1, UnitPrice = 65000, TotalPrice = 65000, Note = "Không hành, ớt riêng" },
                            new ReceiptItemPayload { Name = "Trà Chanh Mật Ong", Quantity = 2, UnitPrice = 25000, TotalPrice = 50000, Options = new List<string> { "50% Đường", "50% Đá" } }
                        },
                        SubTotal = 115000,
                        TotalAmount = 115000,
                        PaymentMethod = "CASH",
                        AmountReceived = 120000,
                        ChangeAmount = 5000,
                        FooterNote = "TEST NATIVE ESC/POS IN THỰC TẾ"
                    };
                    return PrintReceipt(JsonConvert.SerializeObject(receiptPayload));
                }
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string OpenExternalBrowser(string url)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(url)) return JsonConvert.SerializeObject(new { success = false, error = "URL rỗng" });
                
                string fullUrl = url.Trim();
                if (fullUrl.StartsWith("/"))
                {
                    string baseWeb = Environment.GetEnvironmentVariable("AVORA_POS_URL") ?? "http://localhost:4000";
                    if (Uri.TryCreate(baseWeb, UriKind.Absolute, out var baseUri))
                    {
                        fullUrl = $"{baseUri.Scheme}://{baseUri.Authority}{fullUrl}";
                    }
                    else
                    {
                        fullUrl = $"http://localhost:4000{fullUrl}";
                    }
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = fullUrl,
                    UseShellExecute = true
                });
                return JsonConvert.SerializeObject(new { success = true });
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message });
            }
        }

        public string GetAppVersionJson()
        {
            return JsonConvert.SerializeObject(new
            {
                success = true,
                version = UpdateManager.CurrentVersion,
                build = UpdateManager.CurrentBuild,
                channel = "STABLE",
                appName = "AVORA POS"
            });
        }

        public string CheckUpdateJson()
        {
            try
            {
                var res = Task.Run(() => UpdateManager.Instance.CheckForUpdateAsync()).GetAwaiter().GetResult();
                return JsonConvert.SerializeObject(new
                {
                    success = string.IsNullOrEmpty(res.Error),
                    updateAvailable = res.UpdateAvailable,
                    isMandatory = res.IsMandatory,
                    currentVersion = res.CurrentVersion,
                    currentBuild = res.CurrentBuild,
                    manifest = res.Manifest,
                    error = res.Error
                }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string DownloadUpdateJson(string manifestJson)
        {
            try
            {
                var manifest = JsonConvert.DeserializeObject<UpdateManifest>(manifestJson);
                if (manifest == null) return JsonConvert.SerializeObject(new { success = false, error = "Dữ liệu manifest không hợp lệ" }, CamelCaseSettings);

                string filePath = Task.Run(() => UpdateManager.Instance.DownloadUpdateAsync(manifest)).GetAwaiter().GetResult();
                return JsonConvert.SerializeObject(new { success = true, filePath = filePath }, CamelCaseSettings);
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message }, CamelCaseSettings);
            }
        }

        public string ApplyUpdate(string installerPath)
        {
            try
            {
                UpdateManager.Instance.ApplyUpdate(installerPath);
                return JsonConvert.SerializeObject(new { success = true });
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message });
            }
        }

        public string GuidePinToTaskbar()
        {
            try
            {
                string currentExe = Process.GetCurrentProcess().MainModule?.FileName
                    ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AvoraPos.exe");

                if (File.Exists(currentExe))
                {
                    Process.Start("explorer.exe", $"/select,\"{currentExe}\"");
                }

                return JsonConvert.SerializeObject(new
                {
                    success = true,
                    message = "Đã mở vị trí AVORA POS. Bạn chỉ cần nhấp chuột phải vào biểu tượng và chọn 'Ghim vào thanh tác vụ' (Pin to taskbar)."
                });
            }
            catch (Exception ex)
            {
                return JsonConvert.SerializeObject(new { success = false, error = ex.Message });
            }
        }

        // ==========================================
        // LOCAL HTTP BRIDGE (http://127.0.0.1:9123)
        // ==========================================
        private void StartLocalHttpBridge()
        {
            Task.Run(async () =>
            {
                try
                {
                    _httpListener = new HttpListener();
                    _httpListener.Prefixes.Add("http://127.0.0.1:9123/");
                    _httpListener.Start();

                    while (_httpListener.IsListening)
                    {
                        var context = await _httpListener.GetContextAsync();
                        ProcessHttpRequest(context);
                    }
                }
                catch { }
            });
        }

        private async void ProcessHttpRequest(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;

            // CORS headers
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            string path = req.Url?.AbsolutePath ?? "/";
            string responseJson = "{}";

            try
            {
                if (path == "/health" || path == "/api/health")
                {
                    responseJson = JsonConvert.SerializeObject(new { status = "ONLINE", version = "1.0.0", native = true });
                }
                else if (path == "/printers" || path == "/api/printers")
                {
                    responseJson = GetPrintersJson();
                }
                else if (path == "/print-html" || path == "/api/print-html")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    responseJson = PrintHtml(body);
                }
                else if (path == "/print-receipt" || path == "/api/print-receipt")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    responseJson = PrintReceipt(body);
                }
                else if (path == "/print-kitchen" || path == "/api/print-kitchen")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    responseJson = PrintKitchenTicket(body);
                }
                else if (path == "/print-label" || path == "/api/print-label")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    responseJson = PrintLabel(body);
                }
                else if (path == "/open-drawer" || path == "/api/open-drawer")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    var j = JsonConvert.DeserializeObject<dynamic>(body);
                    string printerName = (string)(j?.printerName ?? "XP-80C");
                    responseJson = OpenCashDrawer(printerName);
                }
                else if (path == "/test-print" || path == "/api/test-print")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    var j = JsonConvert.DeserializeObject<dynamic>(body);
                    string printerName = (string)(j?.printerName ?? "XP-80C");
                    string type = (string)(j?.type ?? "RECEIPT");
                    responseJson = TestPrint(printerName, type);
                }
                else if (path == "/open-browser" || path == "/api/open-browser")
                {
                    using var reader = new StreamReader(req.InputStream, req.ContentEncoding);
                    string body = await reader.ReadToEndAsync();
                    var j = JsonConvert.DeserializeObject<dynamic>(body);
                    string url = (string)(j?.url ?? "");
                    responseJson = OpenExternalBrowser(url);
                }
                else if (path == "/exit" || path == "/api/exit")
                {
                    RequestAppExit();
                    responseJson = JsonConvert.SerializeObject(new { success = true });
                }
                else if (path == "/logout" || path == "/api/logout")
                {
                    RequestLogout();
                    responseJson = JsonConvert.SerializeObject(new { success = true });
                }
                else
                {
                    res.StatusCode = 404;
                    responseJson = JsonConvert.SerializeObject(new { error = "Not Found" });
                }
            }
            catch (Exception ex)
            {
                res.StatusCode = 500;
                responseJson = JsonConvert.SerializeObject(new { error = ex.Message });
            }

            byte[] buf = Encoding.UTF8.GetBytes(responseJson);
            res.ContentType = "application/json; charset=utf-8";
            res.ContentLength64 = buf.Length;
            await res.OutputStream.WriteAsync(buf, 0, buf.Length);
            res.Close();
        }
    }
}
