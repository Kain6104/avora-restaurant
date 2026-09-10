using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using AvoraPos.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AvoraPos.Storage
{
    public class OfflineSyncEngine
    {
        private static OfflineSyncEngine? _instance;
        public static OfflineSyncEngine Instance => _instance ??= new OfflineSyncEngine();

        public event Action<bool>? NetworkStatusChanged;
        public bool IsOnline { get; private set; } = true;
        public string BackendBaseUrl { get; set; } = "http://localhost:3001";
        public string? AuthToken { get; set; }

        private readonly HttpClient _httpClient = new HttpClient();
        private readonly Timer _syncTimer;
        private bool _isSyncing = false;

        public OfflineSyncEngine()
        {
            NetworkChange.NetworkAvailabilityChanged += (s, e) =>
            {
                _ = Task.Run(async () => await CheckConnectivityAsync());
            };

            // Periodic sync every 10 seconds
            _syncTimer = new Timer(async _ => await SyncPendingOrdersAsync(), null, 5000, 10000);
        }

        public async Task<bool> CheckConnectivityAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(2500);
                var response = await _httpClient.GetAsync($"{BackendBaseUrl}/api/pos/init?branchId=ping", cts.Token);
                bool online = response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.Unauthorized || response.StatusCode == System.Net.HttpStatusCode.Forbidden;
                SetOnlineStatus(online);
                return online;
            }
            catch
            {
                SetOnlineStatus(false);
                return false;
            }
        }

        private void SetOnlineStatus(bool online)
        {
            if (IsOnline != online)
            {
                IsOnline = online;
                NetworkStatusChanged?.Invoke(online);
            }
        }

        public async Task SyncPendingOrdersAsync()
        {
            if (_isSyncing || !IsOnline || string.IsNullOrWhiteSpace(AuthToken)) return;
            _isSyncing = true;

            try
            {
                var pendingOrders = LocalDatabase.Instance.GetPendingSyncOrders();
                foreach (var order in pendingOrders)
                {
                    await SyncSingleOrderAsync(order);
                }
            }
            finally
            {
                _isSyncing = false;
            }
        }

        private async Task SyncSingleOrderAsync(OfflineOrderRecord order)
        {
            order.LastSyncAttemptAt = DateTime.UtcNow;

            try
            {
                var request = new HttpRequestMessage();
                request.Headers.Add("Authorization", $"Bearer {AuthToken}");
                request.Headers.Add("X-Idempotency-Key", order.IdempotencyKey);
                request.Headers.Add("X-Mutation-Id", order.ClientMutationId);

                if (string.IsNullOrWhiteSpace(order.ServerOrderId))
                {
                    // Create order on server
                    request.Method = HttpMethod.Post;
                    request.RequestUri = new Uri($"{BackendBaseUrl}/api/pos/orders/create");
                    request.Content = new StringContent(order.OrderDataJson, Encoding.UTF8, "application/json");
                }
                else
                {
                    // Update order on server
                    request.Method = HttpMethod.Put;
                    request.RequestUri = new Uri($"{BackendBaseUrl}/api/pos/orders/{order.ServerOrderId}");
                    request.Content = new StringContent(order.OrderDataJson, Encoding.UTF8, "application/json");
                }

                var res = await _httpClient.SendAsync(request);
                string responseBody = await res.Content.ReadAsStringAsync();

                if (res.IsSuccessStatusCode)
                {
                    var json = JObject.Parse(responseBody);
                    string? serverId = json["data"]?["id"]?.ToString();
                    int serverVersion = json["data"]?["version"]?.Value<int>() ?? order.BaseVersion + 1;

                    order.ServerOrderId = serverId ?? order.ServerOrderId;
                    order.BaseVersion = serverVersion;
                    order.LocalVersion = serverVersion;
                    order.SyncStatus = SyncStatus.SYNCED;
                    order.ErrorMessage = null;
                }
                else if ((int)res.StatusCode == 409 || responseBody.Contains("ORDER_VERSION_CONFLICT"))
                {
                    // Optimistic concurrency conflict
                    order.SyncStatus = SyncStatus.CONFLICT;
                    order.ErrorMessage = "Xung đột phiên bản đơn hàng (đã được sửa bởi thiết bị khác)";
                }
                else
                {
                    order.SyncStatus = SyncStatus.FAILED;
                    order.ErrorMessage = $"Lỗi HTTP {(int)res.StatusCode}: {responseBody}";
                }
            }
            catch (Exception ex)
            {
                order.ErrorMessage = ex.Message;
            }

            LocalDatabase.Instance.UpsertOfflineOrder(order);
        }
    }
}
