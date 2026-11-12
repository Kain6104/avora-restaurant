using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.Services
{
    public class PosApiService
    {
        private static readonly HttpClient _http = new();
        private readonly AuthService _authService;

        public PosApiService(AuthService? authService = null)
        {
            _authService = authService ?? new AuthService();
        }

        private HttpRequestMessage CreateRequest(HttpMethod method, string path)
        {
            string url = $"{Storage.AppConfig.ApiBaseUrl}{path}";
            var req = new HttpRequestMessage(method, url);
            string? token = _authService.CurrentSession?.Token ?? Security.SecureSessionManager.LoadSession()?.Token;
            if (!string.IsNullOrEmpty(token))
            {
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            }
            return req;
        }

        public async Task<(List<PosCategory> Categories, List<PosProduct> Products)> GetMenuDataAsync(string? branchId = null)
        {
            try
            {
                string effectiveBranch = branchId ?? Security.SecureSessionManager.LoadSession()?.BranchId ?? string.Empty;
                string path = string.IsNullOrWhiteSpace(effectiveBranch) || effectiveBranch == "DEFAULT"
                    ? "/api/pos/products"
                    : $"/api/pos/products?branchId={Uri.EscapeDataString(effectiveBranch)}";

                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return (new List<PosCategory>(), new List<PosProduct>());

                var obj = JObject.Parse(text);
                var catArr = obj["data"]?["categories"] as JArray;
                var prodArr = (obj["data"]?["products"] ?? obj["data"]) as JArray;

                var categories = catArr != null
                    ? JsonConvert.DeserializeObject<List<PosCategory>>(catArr.ToString()) ?? new List<PosCategory>()
                    : new List<PosCategory>();

                var products = prodArr != null
                    ? JsonConvert.DeserializeObject<List<PosProduct>>(prodArr.ToString()) ?? new List<PosProduct>()
                    : new List<PosProduct>();

                return (categories, products);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetMenuData error: {ex.Message}");
                return (new List<PosCategory>(), new List<PosProduct>());
            }
        }

        public async Task<List<PosCategory>> GetCategoriesAsync(string? branchId = null)
        {
            var (categories, _) = await GetMenuDataAsync(branchId);
            return categories;
        }

        public async Task<List<PosProduct>> GetProductsAsync()
        {
            var session = Security.SecureSessionManager.LoadSession();
            string branchId = session?.BranchId ?? "DEFAULT";
            return await GetProductsAsync(branchId);
        }

        public async Task<List<PosBuffetPackage>> GetBuffetPackagesAsync(string? branchId = null)
        {
            try
            {
                string effectiveBranch = branchId ?? Security.SecureSessionManager.LoadSession()?.BranchId ?? string.Empty;
                string path = string.IsNullOrWhiteSpace(effectiveBranch) || effectiveBranch == "DEFAULT"
                    ? "/api/buffet/packages?onlyActive=true"
                    : $"/api/buffet/packages?branchId={Uri.EscapeDataString(effectiveBranch)}&onlyActive=true";

                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                if (!res.IsSuccessStatusCode) return new List<PosBuffetPackage>();

                string text = await res.Content.ReadAsStringAsync();
                var obj = JObject.Parse(text);
                var data = obj["data"] as JArray;
                if (data == null) return new List<PosBuffetPackage>();

                return JsonConvert.DeserializeObject<List<PosBuffetPackage>>(data.ToString()) ?? new List<PosBuffetPackage>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[BUFFET] Error loading buffet packages: {ex.Message}");
                return new List<PosBuffetPackage>();
            }
        }

        public async Task<PosCustomer?> SearchMembershipAsync(string phone)
        {
            var customers = await SearchCustomersAsync(phone);
            return customers.Find(c => c.Phone == phone) ?? (customers.Count > 0 ? customers[0] : null);
        }

        public async Task<JObject?> GetInitDataAsync(string? branchId = null)
        {
            try
            {
                string path = string.IsNullOrEmpty(branchId) ? "/api/pos/init" : $"/api/pos/init?branchId={branchId}";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return null;

                var obj = JObject.Parse(text);
                return obj["data"] as JObject;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetInitData error: {ex.Message}");
                return null;
            }
        }

        public async Task<List<PosProduct>> GetProductsAsync(string? branchId = null, string? categoryId = null, string? search = null)
        {
            try
            {
                var q = new List<string>();
                if (!string.IsNullOrEmpty(branchId) && branchId != "DEFAULT") q.Add($"branchId={branchId}");
                if (!string.IsNullOrEmpty(categoryId) && categoryId != "ALL") q.Add($"categoryId={categoryId}");
                if (!string.IsNullOrEmpty(search)) q.Add($"search={Uri.EscapeDataString(search)}");

                string path = q.Count > 0 ? $"/api/pos/products?{string.Join("&", q)}" : "/api/pos/products";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return new List<PosProduct>();

                var obj = JObject.Parse(text);
                var data = (obj["data"]?["products"] ?? obj["data"]) as JArray;
                if (data == null) return new List<PosProduct>();

                return JsonConvert.DeserializeObject<List<PosProduct>>(data.ToString()) ?? new List<PosProduct>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetProducts error: {ex.Message}");
                return new List<PosProduct>();
            }
        }

        public async Task<List<PosTable>> GetTablesAsync(string? branchId = null)
        {
            try
            {
                string targetBranchId = !string.IsNullOrWhiteSpace(branchId) && branchId != "DEFAULT"
                    ? branchId
                    : (Security.SecureSessionManager.LoadSession()?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51");

                string path = $"/api/pos/tables?branchId={targetBranchId}";

                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return new List<PosTable>();

                var obj = JObject.Parse(text);
                var data = (obj["data"]?["tables"] ?? obj["data"]) as JArray;
                if (data == null) return new List<PosTable>();

                return JsonConvert.DeserializeObject<List<PosTable>>(data.ToString()) ?? new List<PosTable>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetTables error: {ex.Message}");
                return new List<PosTable>();
            }
        }

        public async Task<(bool Success, PosOrder? Order, string? Error)> CreateOrderAsync(object dto)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, "/api/pos/orders/create");
                req.Content = new StringContent(JsonConvert.SerializeObject(dto), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode)
                {
                    return (false, null, text);
                }

                var obj = JObject.Parse(text);
                var data = obj["data"];
                var order = data != null ? JsonConvert.DeserializeObject<PosOrder>(data.ToString()) : null;
                return (true, order, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }

        public async Task<(bool Success, PosOrder? Order, string? Error)> UpdateOrderAsync(string orderId, object dto)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Put, $"/api/pos/orders/{orderId}");
                req.Content = new StringContent(JsonConvert.SerializeObject(dto), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode)
                {
                    return (false, null, text);
                }

                var obj = JObject.Parse(text);
                var data = obj["data"];
                var order = data != null ? JsonConvert.DeserializeObject<PosOrder>(data.ToString()) : null;
                return (true, order, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> SendToKitchenAsync(string orderId, object dto)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/pos/orders/{orderId}/send-kitchen");
                req.Content = new StringContent(JsonConvert.SerializeObject(dto), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> ProcessPaymentAsync(string orderId, object dto)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/pos/orders/{orderId}/pay");
                req.Content = new StringContent(JsonConvert.SerializeObject(dto), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> CancelOrderAsync(string orderId, string reason)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/pos/orders/{orderId}/cancel");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { reason }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> MoveTableAsync(string fromTableId, string toTableId, string? orderId = null)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, "/api/pos/orders/move-table");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { fromTableId, toTableId, orderId }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> MergeOrdersAsync(string sourceOrderId, string targetOrderId)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, "/api/pos/orders/merge");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { sourceOrderId, targetOrderId }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> SplitOrderAsync(string orderId, List<object> itemsToMove, string? targetTableId = null)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, "/api/pos/orders/split");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { orderId, items = itemsToMove, targetTableId }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(string? Token, string? Status, string? Error)> GetTableQrSessionAsync(string tableId, string branchId)
        {
            try
            {
                string path = $"/api/qr-order/admin/tables/{Uri.EscapeDataString(tableId)}/qr?branchId={Uri.EscapeDataString(branchId)}";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return (null, null, text);

                var obj = JObject.Parse(text);
                var data = obj["data"];
                if (data == null) return (null, null, "Không có dữ liệu phiên QR");

                string? rawToken = data["rawToken"]?.ToString();
                string? status = data["qrSession"]?["status"]?.ToString() ?? "ACTIVE";
                return (rawToken, status, null);
            }
            catch (Exception ex)
            {
                return (null, null, ex.Message);
            }
        }

        public async Task<(bool Success, string? NewToken, string? Error)> RegenerateTableQrAsync(string tableId, string orderId)
        {
            try
            {
                string path = $"/api/qr-order/admin/tables/{Uri.EscapeDataString(tableId)}/qr/regenerate";
                using var req = CreateRequest(HttpMethod.Post, path);
                req.Content = new StringContent(JsonConvert.SerializeObject(new { orderId }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return (false, null, text);

                var obj = JObject.Parse(text);
                string? newToken = obj["data"]?["rawToken"]?.ToString();
                return (true, newToken, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }

        public async Task<PosCashShift?> GetCurrentShiftAsync(string branchId, string cashierId)
        {
            try
            {
                string path = $"/api/pos/shifts/current?branchId={branchId}&cashierId={cashierId}";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return null;

                var obj = JObject.Parse(text);
                var data = obj["data"];
                return data != null ? JsonConvert.DeserializeObject<PosCashShift>(data.ToString()) : null;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetCurrentShift error: {ex.Message}");
                return null;
            }
        }

        public async Task<(bool Success, PosCashShift? Shift, string? Error)> OpenShiftAsync(string branchId, decimal openingBalance, string? note = null)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/pos/shifts/open?branchId={branchId}");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { openingBalance, note }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return (false, null, text);

                var obj = JObject.Parse(text);
                var data = obj["data"];
                var shift = data != null ? JsonConvert.DeserializeObject<PosCashShift>(data.ToString()) : null;
                return (true, shift, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> CloseShiftAsync(string shiftId, decimal closingBalance, string? note = null)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/pos/shifts/{shiftId}/close");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { closingBalance, note }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<List<PosCustomer>> SearchCustomersAsync(string query)
        {
            try
            {
                string path = $"/api/pos/customers/search?query={Uri.EscapeDataString(query)}";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return new List<PosCustomer>();

                var obj = JObject.Parse(text);
                var data = obj["data"] as JArray;
                if (data == null) return new List<PosCustomer>();

                return JsonConvert.DeserializeObject<List<PosCustomer>>(data.ToString()) ?? new List<PosCustomer>();
            }
            catch
            {
                return new List<PosCustomer>();
            }
        }

        public async Task<string> GetVatPriceModeAsync()
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Get, "/api/home/settings");
                var res = await _http.SendAsync(req);
                if (!res.IsSuccessStatusCode) return "VAT_INCLUDED";
                string text = await res.Content.ReadAsStringAsync();
                var obj = JObject.Parse(text);
                string? mode = obj["vat_price_mode"]?.ToString()?.ToUpper();
                if (mode == "EXCLUDED" || mode == "VAT_EXCLUDED")
                {
                    return "VAT_EXCLUDED";
                }
                return "VAT_INCLUDED";
            }
            catch
            {
                return "VAT_INCLUDED";
            }
        }

        public async Task<PosCustomer?> CreateMemberAsync(string fullName, string phone, string? email = null)
        {
            try
            {
                string path = "/api/pos/members";
                using var req = CreateRequest(HttpMethod.Post, path);
                var payload = new
                {
                    fullName = fullName,
                    phone = phone,
                    email = email
                };
                req.Content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return null;

                var obj = JObject.Parse(text);
                var data = obj["data"];
                if (data == null) return null;

                return JsonConvert.DeserializeObject<PosCustomer>(data.ToString());
            }
            catch
            {
                return null;
            }
        }

        public async Task<List<PosReservation>> GetReservationsAsync(string branchId)
        {
            try
            {
                string path = $"/api/pos/reservations?branchId={branchId}";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return new List<PosReservation>();

                var obj = JObject.Parse(text);
                var data = obj["data"] as JArray;
                if (data == null) return new List<PosReservation>();

                return JsonConvert.DeserializeObject<List<PosReservation>>(data.ToString()) ?? new List<PosReservation>();
            }
            catch
            {
                return new List<PosReservation>();
            }
        }

        public async Task<(bool Success, string? Error)> CheckInReservationAsync(string reservationId, string tableId)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/pos/reservations/{reservationId}/check-in");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { tableId }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<JObject?> ValidateVoucherAsync(string code, decimal subTotal, string branchId, string? userId = null)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, "/api/pos/vouchers/validate");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { code, subTotal, branchId, userId }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return null;

                var obj = JObject.Parse(text);
                return obj["data"] as JObject;
            }
            catch
            {
                return null;
            }
        }

        public async Task<List<PosKitchenTicket>> GetKitchenTicketsAsync(string branchId, string? stationId = null)
        {
            try
            {
                string path = string.IsNullOrEmpty(stationId) || stationId == "ALL"
                    ? $"/api/pos/kitchen/tickets?branchId={branchId}"
                    : $"/api/pos/kitchen/tickets?branchId={branchId}&stationId={stationId}";

                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return new List<PosKitchenTicket>();

                var obj = JObject.Parse(text);
                var data = obj["data"] as JArray;
                if (data == null) return new List<PosKitchenTicket>();

                return JsonConvert.DeserializeObject<List<PosKitchenTicket>>(data.ToString()) ?? new List<PosKitchenTicket>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetKitchenTickets error: {ex.Message}");
                return new List<PosKitchenTicket>();
            }
        }

        public async Task<(bool Success, string? Error)> UpdateKitchenItemStatusAsync(string itemId, string status)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Patch, $"/api/pos/kitchen/items/{itemId}/status");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { status }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return (false, text);

                return (true, null);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<List<PosOrder>> GetActiveOrdersAsync(string branchId)
        {
            try
            {
                string effectiveBranch = string.IsNullOrWhiteSpace(branchId) || branchId == "DEFAULT"
                    ? (Security.SecureSessionManager.LoadSession()?.BranchId ?? string.Empty)
                    : branchId;

                string path = string.IsNullOrWhiteSpace(effectiveBranch)
                    ? "/api/pos/tables"
                    : $"/api/pos/tables?branchId={Uri.EscapeDataString(effectiveBranch)}";

                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    string text = await res.Content.ReadAsStringAsync();
                    var obj = JObject.Parse(text);
                    var activeOrders = obj["data"]?["activeOrders"] as JArray;
                    if (activeOrders != null)
                    {
                        return JsonConvert.DeserializeObject<List<PosOrder>>(activeOrders.ToString()) ?? new List<PosOrder>();
                    }
                }

                // Fallback to sync/snapshot
                string snapPath = string.IsNullOrWhiteSpace(effectiveBranch)
                    ? "/api/pos/sync/snapshot"
                    : $"/api/pos/sync/snapshot?branchId={Uri.EscapeDataString(effectiveBranch)}";
                using var snapReq = CreateRequest(HttpMethod.Get, snapPath);
                var snapRes = await _http.SendAsync(snapReq);
                if (!snapRes.IsSuccessStatusCode) return new List<PosOrder>();

                string snapText = await snapRes.Content.ReadAsStringAsync();
                var snapObj = JObject.Parse(snapText);
                var snapOrders = snapObj["data"]?["activeOrders"] as JArray;
                if (snapOrders == null) return new List<PosOrder>();

                return JsonConvert.DeserializeObject<List<PosOrder>>(snapOrders.ToString()) ?? new List<PosOrder>();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetActiveOrders error: {ex.Message}");
                return new List<PosOrder>();
            }
        }

        public async Task<List<PosQrOrder>> GetPendingQrRoundsAsync(string branchId)
        {
            var result = new List<PosQrOrder>();
            string effectiveBranch = string.IsNullOrWhiteSpace(branchId) || branchId == "DEFAULT"
                ? (Security.SecureSessionManager.LoadSession()?.BranchId ?? string.Empty)
                : branchId;

            if (string.IsNullOrWhiteSpace(effectiveBranch))
                return result;

            try
            {
                string path = $"/api/qr-order/admin/branches/{Uri.EscapeDataString(effectiveBranch)}/qr-rounds/pending";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    string text = await res.Content.ReadAsStringAsync();
                    var obj = JObject.Parse(text);
                    var data = obj["data"] as JArray;
                    if (data != null)
                    {
                        foreach (var roundToken in data)
                        {
                            var round = new PosQrOrder
                            {
                                Id = roundToken["id"]?.ToString() ?? string.Empty,
                                OrderId = roundToken["orderId"]?.ToString() ?? string.Empty,
                                RoundNumber = roundToken["roundNumber"]?.ToObject<int>() ?? 1,
                                GuestName = roundToken["guestName"]?.ToString() ?? "Khách QR",
                                Status = roundToken["status"]?.ToString() ?? "PENDING",
                                RequestedAt = roundToken["createdAt"] != null ? DateTime.Parse(roundToken["createdAt"]!.ToString()) : DateTime.UtcNow,
                                OrderCode = roundToken["order"]?["orderCode"]?.ToString() ?? roundToken["order"]?["temporaryOrderCode"]?.ToString() ?? string.Empty,
                                TableName = roundToken["order"]?["table"]?["name"]?.ToString() ?? roundToken["order"]?["tableName"]?.ToString() ?? "Bàn QR",
                                TableId = roundToken["order"]?["table"]?["id"]?.ToString() ?? string.Empty,
                            };

                            var itemsToken = roundToken["items"] as JArray;
                            if (itemsToken != null)
                            {
                                foreach (var itemToken in itemsToken)
                                {
                                    var cartItem = new PosCartItem
                                    {
                                        Id = itemToken["id"]?.ToString() ?? Guid.NewGuid().ToString(),
                                        ProductId = itemToken["productId"]?.ToString() ?? itemToken["product"]?["id"]?.ToString() ?? string.Empty,
                                        ProductName = itemToken["product"]?["name"]?.ToString() ?? "Món QR",
                                        Quantity = itemToken["quantity"]?.ToObject<int>() ?? 1,
                                        PriceAtSale = itemToken["priceAtSale"]?.ToObject<decimal>() ?? 0,
                                        Note = itemToken["note"]?.ToString(),
                                        OptionsTextSnapshot = itemToken["optionsTextSnapshot"]?.ToString(),
                                    };
                                    round.Items.Add(cartItem);
                                }
                            }
                            result.Add(round);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetPendingQrRounds (rounds) error: {ex.Message}");
            }

            // Also check /api/pos/qr-orders?branchId=... for direct QR orders in PENDING status
            try
            {
                string qrOrdersPath = $"/api/pos/qr-orders?branchId={Uri.EscapeDataString(effectiveBranch)}";
                using var req2 = CreateRequest(HttpMethod.Get, qrOrdersPath);
                var res2 = await _http.SendAsync(req2);
                if (res2.IsSuccessStatusCode)
                {
                    string text2 = await res2.Content.ReadAsStringAsync();
                    var obj2 = JObject.Parse(text2);
                    var qrOrdersArr = (obj2["data"]?["qrOrders"] ?? obj2["data"]) as JArray;
                    if (qrOrdersArr != null)
                    {
                        foreach (var oToken in qrOrdersArr)
                        {
                            string oId = oToken["id"]?.ToString() ?? string.Empty;
                            string oStatus = oToken["status"]?.ToString() ?? "PENDING";
                            if (string.IsNullOrEmpty(oId) || oStatus != "PENDING") continue;
                            if (result.Exists(r => r.Id == oId || r.OrderId == oId)) continue;

                            var directQr = new PosQrOrder
                            {
                                Id = oId,
                                OrderId = oId,
                                RoundNumber = 1,
                                GuestName = "Khách đặt QR tại bàn",
                                Status = oStatus,
                                RequestedAt = oToken["createdAt"] != null ? DateTime.Parse(oToken["createdAt"]!.ToString()) : DateTime.UtcNow,
                                OrderCode = oToken["orderCode"]?.ToString() ?? string.Empty,
                                TableName = oToken["table"]?["name"]?.ToString() ?? "Bàn QR",
                                TableId = oToken["tableId"]?.ToString() ?? oToken["table"]?["id"]?.ToString() ?? string.Empty,
                            };

                            var itemsArr = oToken["items"] as JArray;
                            if (itemsArr != null)
                            {
                                foreach (var it in itemsArr)
                                {
                                    directQr.Items.Add(new PosCartItem
                                    {
                                        Id = it["id"]?.ToString() ?? Guid.NewGuid().ToString(),
                                        ProductId = it["product"]?["id"]?.ToString() ?? string.Empty,
                                        ProductName = it["product"]?["name"]?.ToString() ?? "Món QR",
                                        Quantity = it["quantity"]?.ToObject<int>() ?? 1,
                                        PriceAtSale = it["price"]?.ToObject<decimal>() ?? 0,
                                        Note = it["note"]?.ToString(),
                                        OptionsTextSnapshot = it["optionsTextSnapshot"]?.ToString(),
                                    });
                                }
                            }
                            result.Add(directQr);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[API] GetPendingQrRounds (qr-orders) error: {ex.Message}");
            }

            return result;
        }

        public async Task<(bool Success, string? Error)> ApproveQrRoundAsync(string roundId)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/qr-order/admin/rounds/{roundId}/approve");
                var res = await _http.SendAsync(req);
                if (res.IsSuccessStatusCode) return (true, null);

                // Fallback to direct QR order confirm
                using var req2 = CreateRequest(HttpMethod.Post, $"/api/pos/qr-orders/{roundId}/confirm");
                var res2 = await _http.SendAsync(req2);
                string text2 = await res2.Content.ReadAsStringAsync();
                return (res2.IsSuccessStatusCode, res2.IsSuccessStatusCode ? null : text2);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> RejectQrRoundAsync(string roundId, string reason)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, $"/api/qr-order/admin/rounds/{roundId}/reject");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { reason }), Encoding.UTF8, "application/json");
                var res = await _http.SendAsync(req);
                if (res.IsSuccessStatusCode) return (true, null);

                // Fallback to direct QR order reject
                using var req2 = CreateRequest(HttpMethod.Post, $"/api/pos/qr-orders/{roundId}/reject");
                req2.Content = new StringContent(JsonConvert.SerializeObject(new { reason }), Encoding.UTF8, "application/json");
                var res2 = await _http.SendAsync(req2);
                string text2 = await res2.Content.ReadAsStringAsync();
                return (res2.IsSuccessStatusCode, res2.IsSuccessStatusCode ? null : text2);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }

        public async Task<(bool Success, string? Error)> OpenCashDrawerAsync(string branchId, string? reason = null)
        {
            try
            {
                using var req = CreateRequest(HttpMethod.Post, "/api/pos/cash-drawer/open");
                req.Content = new StringContent(JsonConvert.SerializeObject(new { branchId, reason = reason ?? "Mở két tiền từ AVORA POS Native" }), Encoding.UTF8, "application/json");

                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                return (res.IsSuccessStatusCode, res.IsSuccessStatusCode ? null : text);
            }
            catch (Exception ex)
            {
                return (false, ex.Message);
            }
        }
    }
}
