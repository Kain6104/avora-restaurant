using System;
using System.Net.Http;
using System.Net.NetworkInformation;
using System.Threading;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Storage;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.Services
{
    public class BackgroundSyncWorker : IDisposable
    {
        private static readonly Lazy<BackgroundSyncWorker> _instance = new(() => new BackgroundSyncWorker());
        public static BackgroundSyncWorker Instance => _instance.Value;

        private readonly HttpClient _http = new();
        private readonly PosApiService _apiService;
        private readonly CancellationTokenSource _cts = new();
        private Task? _syncTask;
        private bool _isOnline = false;
        private bool _isSyncing = false;

        public bool IsOnline => _isOnline;
        public event Action<bool>? ConnectivityChanged;
        public event Action<int, int, int, int>? SyncStatsUpdated; // Pending, Synced, Failed, Conflict
        public event Action<OfflineOrderRecord>? OrderSynced;

        private BackgroundSyncWorker()
        {
            _apiService = new PosApiService();
            NetworkChange.NetworkAvailabilityChanged += (s, e) =>
            {
                _ = CheckConnectivityAsync();
            };
        }

        public void Start()
        {
            if (_syncTask != null) return;
            _syncTask = Task.Run(WorkerLoopAsync);
            System.Diagnostics.Debug.WriteLine("[SYNC WORKER] Background Sync Worker started");
        }

        public async Task<bool> CheckConnectivityAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(2500);
                string url = $"{AppConfig.ApiBaseUrl}/api/pos/init?branchId=ping";
                var req = new HttpRequestMessage(HttpMethod.Get, url);
                var res = await _http.SendAsync(req, cts.Token);
                bool online = res.IsSuccessStatusCode || res.StatusCode == System.Net.HttpStatusCode.Unauthorized || res.StatusCode == System.Net.HttpStatusCode.Forbidden;
                SetOnline(online);
                return online;
            }
            catch
            {
                SetOnline(false);
                return false;
            }
        }

        private void SetOnline(bool online)
        {
            if (_isOnline != online)
            {
                _isOnline = online;
                ConnectivityChanged?.Invoke(online);
                System.Diagnostics.Debug.WriteLine($"[SYNC WORKER] Network status changed: {(online ? "ONLINE" : "OFFLINE")}");
            }
        }

        private async Task WorkerLoopAsync()
        {
            while (!_cts.Token.IsCancellationRequested)
            {
                try
                {
                    bool online = await CheckConnectivityAsync();
                    if (online && !_isSyncing)
                    {
                        await ProcessPendingSyncAsync();
                    }

                    // Update dashboard stats
                    var (pending, synced, failed, conflict) = await OutboxRepository.GetEventCountsAsync();
                    SyncStatsUpdated?.Invoke(pending, synced, failed, conflict);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[SYNC WORKER] Exception in sync loop: {ex.Message}");
                }

                try
                {
                    await Task.Delay(5000, _cts.Token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        public async Task TriggerSyncNowAsync()
        {
            if (!_isSyncing)
            {
                await ProcessPendingSyncAsync();
            }
        }

        private async Task ProcessPendingSyncAsync()
        {
            _isSyncing = true;
            try
            {
                var pendingEvents = await OutboxRepository.GetPendingEventsAsync(10);
                if (pendingEvents.Count == 0) return;

                foreach (var evt in pendingEvents)
                {
                    if (_cts.Token.IsCancellationRequested) break;

                    await OutboxRepository.UpdateEventStatusAsync(evt.Id, OutboxEventStatus.IN_PROGRESS);

                    try
                    {
                        bool success = await ProcessSingleEventAsync(evt);
                        if (!success)
                        {
                            // If network failure, stop batch to avoid spamming
                            if (!_isOnline) break;
                        }
                    }
                    catch (Exception ex)
                    {
                        await OutboxRepository.UpdateEventStatusAsync(evt.Id, OutboxEventStatus.FAILED, ex.Message, incrementRetry: true);
                    }
                }
            }
            finally
            {
                _isSyncing = false;
            }
        }

        private async Task<bool> ProcessSingleEventAsync(OutboxEventRecord evt)
        {
            var payload = JObject.Parse(evt.PayloadJson);
            string clientOrderId = evt.AggregateId;
            string idempotencyKey = evt.IdempotencyKey;

            if (evt.EventType == OutboxEventType.CREATE_ORDER || evt.EventType == OutboxEventType.PAY_ORDER)
            {
                // 1. Create order on server
                var createDto = new
                {
                    branchId = payload["branchId"]?.ToString(),
                    tableId = payload["tableId"]?.ToString(),
                    orderType = payload["orderType"]?.ToString() ?? "DINE_IN",
                    guestCount = payload["guestCount"]?.Value<int>() ?? 1,
                    customerName = payload["customerName"]?.ToString() ?? "Khách vãng lai",
                    customerPhone = payload["customerPhone"]?.ToString(),
                    deliveryAddress = payload["deliveryAddress"]?.ToString(),
                    discountAmount = payload["discountAmount"]?.Value<decimal>() ?? 0,
                    idempotencyKey = idempotencyKey,
                    items = payload["items"]?.ToObject<object>()
                };

                var (createSuccess, createdOrder, createErr) = await _apiService.CreateOrderAsync(createDto);

                if (!createSuccess || createdOrder == null)
                {
                    // Check if error is conflict
                    if (createErr != null && (createErr.Contains("409") || createErr.Contains("CONFLICT") || createErr.Contains("không tồn tại")))
                    {
                        await OutboxRepository.UpdateEventStatusAsync(evt.Id, OutboxEventStatus.CONFLICT, createErr);
                        await OfflineOrderRepository.UpdateOrderSyncStatusAsync(clientOrderId, OfflineSyncStatus.SYNC_CONFLICT, error: createErr);
                        return false;
                    }

                    await OutboxRepository.UpdateEventStatusAsync(evt.Id, OutboxEventStatus.FAILED, createErr, incrementRetry: true);
                    await OfflineOrderRepository.UpdateOrderSyncStatusAsync(clientOrderId, OfflineSyncStatus.SYNC_FAILED, error: createErr);
                    return false;
                }

                string serverOrderId = createdOrder.Id;
                string serverOrderCode = createdOrder.OrderCode ?? createdOrder.TemporaryOrderCode ?? string.Empty;

                // 2. If it was a paid order, process payment on server
                if (evt.EventType == OutboxEventType.PAY_ORDER)
                {
                    decimal totalAmount = payload["totalAmount"]?.Value<decimal>() ?? 0;
                    decimal receivedAmount = payload["receivedAmount"]?.Value<decimal>() ?? totalAmount;
                    decimal changeAmount = payload["changeAmount"]?.Value<decimal>() ?? 0;

                    var payDto = new
                    {
                        idempotencyKey = $"{idempotencyKey}:pay",
                        payments = new[]
                        {
                            new
                            {
                                paymentMethod = "CASH",
                                amount = totalAmount,
                                cashReceived = receivedAmount,
                                cashChange = changeAmount
                            }
                        }
                    };

                    var (paySuccess, payErr) = await _apiService.ProcessPaymentAsync(serverOrderId, payDto);
                    if (!paySuccess)
                    {
                        System.Diagnostics.Debug.WriteLine($"[SYNC WORKER] Notice on payment step for {serverOrderId}: {payErr}");
                    }
                }

                // 3. Mark success
                await OutboxRepository.UpdateEventStatusAsync(evt.Id, OutboxEventStatus.COMPLETED);
                await OfflineOrderRepository.UpdateOrderSyncStatusAsync(
                    clientOrderId,
                    OfflineSyncStatus.SYNCED,
                    serverOrderId: serverOrderId,
                    serverOrderCode: serverOrderCode
                );

                var updatedOrder = await OfflineOrderRepository.GetOrderByClientIdAsync(clientOrderId);
                if (updatedOrder != null)
                {
                    OrderSynced?.Invoke(updatedOrder);
                }

                System.Diagnostics.Debug.WriteLine($"[SYNC WORKER] Successfully synced order {clientOrderId} -> Server Order {serverOrderCode} ({serverOrderId})");
                return true;
            }

            return true;
        }

        public void Dispose()
        {
            _cts.Cancel();
            _cts.Dispose();
            _http.Dispose();
        }
    }
}

