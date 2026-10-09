using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using SocketIOClient;

namespace AvoraPosNative.Services
{
    public class RealtimeService : IDisposable
    {
        private SocketIOClient.SocketIO? _client;
        private string? _currentBranchId;
        private string? _currentCashierId;

        public bool IsConnected => _client?.Connected ?? false;

        public event Action? Connected;
        public event Action? Disconnected;
        public event Action<JObject>? OrderCreated;
        public event Action<JObject>? OrderUpdated;
        public event Action<JObject>? TableStatusChanged;
        public event Action<JObject>? KitchenTicketNew;
        public event Action<JObject>? KitchenItemUpdated;
        public event Action<JObject>? PaymentCompleted;
        public event Action<JObject>? ShiftUpdated;
        public event Action<JObject>? ProductAvailabilityChanged;
        public event Action<JObject>? PrintDispatchReceived;

        public async Task ConnectAsync(string branchId, string cashierId)
        {
            _currentBranchId = branchId;
            _currentCashierId = cashierId;

            string serverUrl = $"{Storage.AppConfig.WsBaseUrl}/pos";

            if (_client != null)
            {
                await _client.DisconnectAsync();
                _client.Dispose();
            }

            _client = new SocketIOClient.SocketIO(serverUrl, new SocketIOOptions
            {
                Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
                Reconnection = true,
                ReconnectionAttempts = int.MaxValue,
                ReconnectionDelay = 1500,
                Auth = GetAuthHeaders(branchId, cashierId)
            });

            _client.OnConnected += async (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine("[REALTIME] Connected to Socket.IO /pos");
                Connected?.Invoke();

                // Join branch room and register as terminal
                await _client.EmitAsync("join_branch", new
                {
                    branchId = _currentBranchId,
                    cashierId = _currentCashierId,
                    clientType = "POS_NATIVE_TERMINAL",
                    isPrintHost = true
                });

                await _client.EmitAsync("register_pos_terminal", new
                {
                    branchId = _currentBranchId
                });
            };

            _client.OnDisconnected += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine($"[REALTIME] Disconnected: {e}");
                Disconnected?.Invoke();
            };

            _client.On("ORDER_CREATED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    OrderCreated?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("ORDER_UPDATED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    OrderUpdated?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("TABLE_STATUS_CHANGED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    TableStatusChanged?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("KITCHEN_TICKET_NEW", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    KitchenTicketNew?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("KITCHEN_ITEM_UPDATED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    KitchenItemUpdated?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("PAYMENT_COMPLETED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    PaymentCompleted?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("SHIFT_UPDATED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    ShiftUpdated?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("PRODUCT_AVAILABILITY_CHANGED", response =>
            {
                try
                {
                    var envelope = JObject.Parse(response.ToString());
                    ProductAvailabilityChanged?.Invoke(envelope["payload"] as JObject ?? envelope);
                }
                catch { }
            });

            _client.On("print_dispatch", response =>
            {
                try
                {
                    var payload = JObject.Parse(response.ToString());
                    PrintDispatchReceived?.Invoke(payload);
                }
                catch { }
            });

            try
            {
                await _client.ConnectAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[REALTIME] Connect failed: {ex.Message}");
            }
        }

        public async Task DisconnectAsync()
        {
            if (_client != null)
            {
                await _client.DisconnectAsync();
            }
        }

        private static Dictionary<string, string> GetAuthHeaders(string branchId, string cashierId)
        {
            var dict = new Dictionary<string, string>
            {
                { "branchId", branchId },
                { "cashierId", cashierId }
            };
            var session = Security.SecureSessionManager.LoadSession();
            if (!string.IsNullOrEmpty(session?.Token))
            {
                dict["token"] = session.Token;
            }
            return dict;
        }

        public void Dispose()
        {
            _client?.Dispose();
        }
    }
}
