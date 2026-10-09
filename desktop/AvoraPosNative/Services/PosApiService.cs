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

        public async Task<List<PosCategory>> GetCategoriesAsync(string? branchId = null)
        {
            try
            {
                string path = string.IsNullOrEmpty(branchId) || branchId == "DEFAULT" ? "/api/pos/categories" : $"/api/pos/categories?branchId={branchId}";
                using var req = CreateRequest(HttpMethod.Get, path);
                var res = await _http.SendAsync(req);
                string text = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) return new List<PosCategory>();

                var obj = JObject.Parse(text);
                var data = (obj["data"]?["categories"] ?? obj["data"]) as JArray;
                if (data == null) return new List<PosCategory>();

                return JsonConvert.DeserializeObject<List<PosCategory>>(data.ToString()) ?? new List<PosCategory>();
            }
            catch
            {
                return new List<PosCategory>();
            }
        }

        public async Task<List<PosProduct>> GetProductsAsync()
        {
            var session = Security.SecureSessionManager.LoadSession();
            string branchId = session?.BranchId ?? "DEFAULT";
            return await GetProductsAsync(branchId);
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
                string path = string.IsNullOrWhiteSpace(branchId) || branchId == "DEFAULT"
                    ? "/api/pos/tables"
                    : $"/api/pos/tables?branchId={branchId}";

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
