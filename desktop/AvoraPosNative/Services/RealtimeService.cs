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

        private readonly HashSet<string> _processedEventIds = new();
        private readonly Queue<string> _eventIdOrder = new();
        private readonly object _dedupLock = new();

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
        public event Action<JObject>? QrOrderUpdated;
        public event Action<JObject>? ReservationUpdated;
        public event Action<JObject>? AuthorizationUpdated;
        public event Action<string, JObject>? PosNotificationReceived;
        public event Action<JObject>? PrintDispatchReceived;

        private JObject? ParseSocketEnvelope(SocketIOResponse response, out JObject payload, out string eventType)
        {
            payload = new JObject();
            eventType = string.Empty;
            try
            {
                string raw = response.ToString();
                if (string.IsNullOrWhiteSpace(raw)) return null;

                var token = JToken.Parse(raw);
                JObject? envelope = null;
                if (token is JArray arr && arr.Count > 0)
                {
                    envelope = arr[0] as JObject;
                }
                else
                {
                    envelope = token as JObject;
                }

                if (envelope == null) return null;

                string? eventId = envelope["eventId"]?.ToString() ?? envelope["id"]?.ToString();
                if (!string.IsNullOrEmpty(eventId))
                {
                    lock (_dedupLock)
                    {
                        if (_processedEventIds.Contains(eventId))
                        {
                            return null; // Already handled via pos_event or named event
                        }
                        _processedEventIds.Add(eventId);
                        _eventIdOrder.Enqueue(eventId);
                        while (_eventIdOrder.Count > 250)
                        {
                            string oldest = _eventIdOrder.Dequeue();
                            _processedEventIds.Remove(oldest);
                        }
                    }
                }

                // Filter out events explicitly for another branch if branchId is specified on envelope
                string? envBranchId = envelope["branchId"]?.ToString() ?? envelope["payload"]?["branchId"]?.ToString();
                if (!string.IsNullOrEmpty(envBranchId) &&
                    !string.IsNullOrEmpty(_currentBranchId) &&
                    _currentBranchId != "DEFAULT" &&
                    !string.Equals(envBranchId, _currentBranchId, StringComparison.OrdinalIgnoreCase))
                {
                    return null;
                }

                eventType = envelope["type"]?.ToString() ?? envelope["eventType"]?.ToString() ?? string.Empty;
                payload = (envelope["payload"] as JObject) ?? envelope;
                return envelope;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[REALTIME] ParseSocketEnvelope error: {ex.Message}");
                return null;
            }
        }

        private void DispatchRealtimeEvent(string fallbackType, SocketIOResponse response)
        {
            var envelope = ParseSocketEnvelope(response, out var payload, out var parsedType);
            if (envelope == null) return;

            string type = !string.IsNullOrEmpty(parsedType) ? parsedType : fallbackType;

            switch (type)
            {
                case "ORDER_CREATED":
                    OrderCreated?.Invoke(payload);
                    break;
                case "ORDER_UPDATED":
                    OrderUpdated?.Invoke(payload);
                    break;
                case "TABLE_STATUS_CHANGED":
                case "TABLE_TRANSFERRED":
                case "ORDER_MERGED":
                case "ORDER_SPLIT":
                    TableStatusChanged?.Invoke(payload);
                    OrderUpdated?.Invoke(payload);
                    break;
                case "KITCHEN_TICKET_NEW":
                    KitchenTicketNew?.Invoke(payload);
                    break;
                case "KITCHEN_ITEM_UPDATED":
                case "KITCHEN_ITEM_STATUS_CHANGED":
                case "KITCHEN_ITEM_READY":
                    KitchenItemUpdated?.Invoke(payload);
                    OrderUpdated?.Invoke(payload);
                    if (type == "KITCHEN_ITEM_READY")
                    {
                        PosNotificationReceived?.Invoke(type, envelope);
                    }
                    break;
                case "PAYMENT_COMPLETED":
                    PaymentCompleted?.Invoke(payload);
                    OrderUpdated?.Invoke(payload);
                    TableStatusChanged?.Invoke(payload);
                    break;
                case "SHIFT_OPENED":
                case "SHIFT_CLOSED":
                case "SHIFT_UPDATED":
                    ShiftUpdated?.Invoke(payload);
                    break;
                case "PRODUCT_AVAILABILITY_CHANGED":
                    ProductAvailabilityChanged?.Invoke(payload);
                    break;
                case "QR_ORDER_ROUND_SUBMITTED":
                case "QR_ROUND_STATUS_CHANGED":
                case "QR_ORDER_CREATED":
                    QrOrderUpdated?.Invoke(payload);
                    OrderUpdated?.Invoke(payload);
                    TableStatusChanged?.Invoke(payload);
                    PosNotificationReceived?.Invoke(type, envelope);
                    break;
                case "RESERVATION_CREATED":
                case "RESERVATION_UPDATED":
                case "RESERVATION_CHECKED_IN":
                    ReservationUpdated?.Invoke(payload);
                    TableStatusChanged?.Invoke(payload);
                    PosNotificationReceived?.Invoke(type, envelope);
                    break;
                case "PAYMENT_REQUESTED":
                case "CUSTOMER_HELP_REQUESTED":
                    TableStatusChanged?.Invoke(payload);
                    OrderUpdated?.Invoke(payload);
                    PosNotificationReceived?.Invoke(type, envelope);
                    break;
                case "AUTHORIZATION_UPDATED":
                    AuthorizationUpdated?.Invoke(payload);
                    break;
                default:
                    OrderUpdated?.Invoke(payload);
                    break;
            }
        }

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

            // Listen to universal pos_event envelope and all specific POS/QR/KDS/Reservation events
            string[] eventNames = new[]
            {
                "pos_event",
                "ORDER_CREATED",
                "ORDER_UPDATED",
                "TABLE_STATUS_CHANGED",
                "TABLE_TRANSFERRED",
                "ORDER_MERGED",
                "ORDER_SPLIT",
                "KITCHEN_TICKET_NEW",
                "KITCHEN_ITEM_UPDATED",
                "KITCHEN_ITEM_STATUS_CHANGED",
                "KITCHEN_ITEM_READY",
                "PAYMENT_COMPLETED",
                "SHIFT_OPENED",
                "SHIFT_CLOSED",
                "SHIFT_UPDATED",
                "PRODUCT_AVAILABILITY_CHANGED",
                "QR_ORDER_ROUND_SUBMITTED",
                "QR_ROUND_STATUS_CHANGED",
                "QR_ORDER_CREATED",
                "RESERVATION_CREATED",
                "RESERVATION_UPDATED",
                "RESERVATION_CHECKED_IN",
                "PAYMENT_REQUESTED",
                "CUSTOMER_HELP_REQUESTED",
                "AUTHORIZATION_UPDATED"
            };

            foreach (var evName in eventNames)
            {
                string capturedName = evName;
                _client.On(capturedName, response => DispatchRealtimeEvent(capturedName, response));
            }

            _client.On("print_dispatch", response =>
            {
                try
                {
                    var envelope = ParseSocketEnvelope(response, out var payload, out _);
                    if (envelope != null)
                    {
                        PrintDispatchReceived?.Invoke(payload);
                    }
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
