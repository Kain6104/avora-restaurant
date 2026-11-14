using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;
using AvoraPosNative.Security;
using AvoraPosNative.Storage;
using Newtonsoft.Json;

namespace AvoraPosNative.Services
{
    public class OfflineOrderEngine
    {
        private static readonly Lazy<OfflineOrderEngine> _instance = new(() => new OfflineOrderEngine());
        public static OfflineOrderEngine Instance => _instance.Value;

        private readonly string _deviceId;

        private OfflineOrderEngine()
        {
            _deviceId = DeviceIdentifier.GetMachineId();
        }

        public async Task<(bool Success, OfflineOrderRecord? Order, string? Error)> RegisterSendToKitchenOfflineAsync(
            PosTable? table,
            List<PosOrderItem> allItems,
            List<PosOrderItem> newItems,
            string branchId,
            string cashierName,
            string? existingClientOrderId = null,
            string? existingLocalCode = null)
        {
            try
            {
                string clientOrderId = !string.IsNullOrEmpty(existingClientOrderId) ? existingClientOrderId : Guid.NewGuid().ToString();
                string localOrderCode = !string.IsNullOrEmpty(existingLocalCode)
                    ? existingLocalCode
                    : await OfflineOrderRepository.GenerateLocalOrderCodeAsync(_deviceId);

                decimal subTotal = allItems.Sum(i => i.LineTotal);
                decimal tax = Math.Round(subTotal * 0.08m, 0);
                decimal total = subTotal + tax;

                var orderRecord = new OfflineOrderRecord
                {
                    ClientOrderId = clientOrderId,
                    LocalOrderCode = localOrderCode,
                    BranchId = branchId,
                    TableId = table?.Id,
                    TableName = table?.Name ?? "Mang về",
                    OrderType = table != null ? "DINE_IN" : "TAKEAWAY",
                    GuestCount = table?.Capacity > 0 ? table.Capacity : 2,
                    SubTotal = subTotal,
                    TaxAmount = tax,
                    TotalAmount = total,
                    SyncStatus = OfflineSyncStatus.PENDING_SYNC,
                    CashierName = cashierName,
                    DeviceId = _deviceId,
                    CreatedOfflineAt = DateTime.UtcNow.ToString("o")
                };

                // Prepare order payload
                var payloadObj = new
                {
                    clientOrderId,
                    localOrderCode,
                    branchId,
                    tableId = table?.Id,
                    tableName = table?.Name,
                    orderType = orderRecord.OrderType,
                    guestCount = orderRecord.GuestCount,
                    subTotal,
                    taxAmount = tax,
                    totalAmount = total,
                    items = allItems.Select(i => new
                    {
                        productId = i.ProductId,
                        productName = i.ProductName,
                        quantity = i.Quantity,
                        price = i.Price,
                        lineTotal = i.LineTotal,
                        selectedOptionIds = i.SelectedOptionIds,
                        optionsText = i.OptionsText,
                        note = i.Note,
                        status = i.Status
                    }).ToList()
                };
                orderRecord.PayloadJson = JsonConvert.SerializeObject(payloadObj);

                // 2. Outbox Event
                string idempotencyKey = $"{branchId}:{_deviceId}:{clientOrderId}:create";
                var outboxEvent = new OutboxEventRecord
                {
                    Id = Guid.NewGuid().ToString(),
                    EventType = OutboxEventType.CREATE_ORDER,
                    AggregateId = clientOrderId,
                    IdempotencyKey = idempotencyKey,
                    PayloadJson = orderRecord.PayloadJson,
                    Status = OutboxEventStatus.PENDING,
                    CreatedAt = DateTime.UtcNow.ToString("o")
                };

                // 3. Print Kitchen Ticket Job
                var printItems = newItems.Select(i => new PrintJobItem
                {
                    ProductName = i.ProductName,
                    Quantity = i.Quantity,
                    Price = i.Price,
                    LineTotal = i.LineTotal,
                    OptionsText = i.OptionsText,
                    Note = i.Note
                }).ToList();

                byte[] rasterBytes = RasterTextEngine.BuildKitchenTicketRasterBytes(
                    tableName: table?.Name ?? "Mang về",
                    orderCode: localOrderCode,
                    items: printItems,
                    cashier: cashierName,
                    widthDots: 576
                );

                string printKey = $"print_k_{clientOrderId}_{DateTime.UtcNow.Ticks}";
                var printJobs = new List<OfflinePrintJobQueueItem>
                {
                    new OfflinePrintJobQueueItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        IdempotencyKey = printKey,
                        PrinterId = "DEFAULT_KITCHEN",
                        PayloadBytes = rasterBytes,
                        DocName = $"KITCHEN-{localOrderCode}"
                    }
                };

                // 4. ATOMIC SAVE in SQLite
                await OfflineOrderRepository.SaveOrderAtomicallyAsync(orderRecord, outboxEvent, printJobs);

                // 5. Trigger print queue worker
                PersistentPrintQueue.Instance.NotifyAllWorkers();

                return (true, orderRecord, null);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[OFFLINE ENGINE] Send to kitchen failed: {ex.Message}");
                return (false, null, ex.Message);
            }
        }

        public async Task<(bool Success, OfflineOrderRecord? Order, string? Error)> RegisterCashPaymentOfflineAsync(
            PosTable? table,
            List<PosOrderItem> items,
            string branchId,
            string cashierName,
            decimal subTotal,
            decimal discountAmount,
            decimal taxAmount,
            decimal shippingFee,
            decimal totalAmount,
            decimal receivedAmount,
            decimal changeAmount,
            string? customerName = null,
            string? customerPhone = null,
            string? discountVoucherCode = null,
            string? existingClientOrderId = null,
            string? existingLocalCode = null)
        {
            try
            {
                string clientOrderId = !string.IsNullOrEmpty(existingClientOrderId) ? existingClientOrderId : Guid.NewGuid().ToString();
                string localOrderCode = !string.IsNullOrEmpty(existingLocalCode)
                    ? existingLocalCode
                    : await OfflineOrderRepository.GenerateLocalOrderCodeAsync(_deviceId);

                var orderRecord = new OfflineOrderRecord
                {
                    ClientOrderId = clientOrderId,
                    LocalOrderCode = localOrderCode,
                    BranchId = branchId,
                    TableId = table?.Id,
                    TableName = table?.Name ?? "Mang về",
                    OrderType = table != null ? "DINE_IN" : "TAKEAWAY",
                    GuestCount = table?.Capacity > 0 ? table.Capacity : 1,
                    CustomerName = customerName ?? "Khách vãng lai",
                    CustomerPhone = customerPhone,
                    SubTotal = subTotal,
                    DiscountAmount = discountAmount,
                    DiscountVoucherCode = discountVoucherCode,
                    TaxAmount = taxAmount,
                    ShippingFee = shippingFee,
                    TotalAmount = totalAmount,
                    PaymentMethod = "CASH",
                    PaymentStatus = "PAID",
                    ReceivedAmount = receivedAmount,
                    ChangeAmount = changeAmount,
                    SyncStatus = OfflineSyncStatus.PENDING_SYNC,
                    CashierName = cashierName,
                    DeviceId = _deviceId,
                    CreatedOfflineAt = DateTime.UtcNow.ToString("o")
                };

                var payloadObj = new
                {
                    clientOrderId,
                    localOrderCode,
                    branchId,
                    tableId = table?.Id,
                    tableName = table?.Name,
                    orderType = orderRecord.OrderType,
                    guestCount = orderRecord.GuestCount,
                    customerName = orderRecord.CustomerName,
                    customerPhone = orderRecord.CustomerPhone,
                    subTotal,
                    discountAmount,
                    discountVoucherCode,
                    taxAmount,
                    shippingFee,
                    totalAmount,
                    paymentMethod = "CASH",
                    receivedAmount,
                    changeAmount,
                    paymentStatus = "PAID",
                    items = items.Select(i => new
                    {
                        productId = i.ProductId,
                        productName = i.ProductName,
                        quantity = i.Quantity,
                        price = i.Price,
                        lineTotal = i.LineTotal,
                        selectedOptionIds = i.SelectedOptionIds,
                        optionsText = i.OptionsText,
                        note = i.Note,
                        status = "SERVED"
                    }).ToList()
                };
                orderRecord.PayloadJson = JsonConvert.SerializeObject(payloadObj);

                // 2. Outbox Event
                string idempotencyKey = $"{branchId}:{_deviceId}:{clientOrderId}:pay";
                var outboxEvent = new OutboxEventRecord
                {
                    Id = Guid.NewGuid().ToString(),
                    EventType = OutboxEventType.PAY_ORDER,
                    AggregateId = clientOrderId,
                    IdempotencyKey = idempotencyKey,
                    PayloadJson = orderRecord.PayloadJson,
                    Status = OutboxEventStatus.PENDING,
                    CreatedAt = DateTime.UtcNow.ToString("o")
                };

                // 3. Receipt Print Job with Drawer Kick
                var printPayload = new PrintJobPayload
                {
                    Title = "HÓA ĐƠN THANH TOÁN (OFFLINE)",
                    OrderCode = localOrderCode,
                    TableName = table?.Name ?? "Mang về",
                    CashierName = cashierName,
                    CustomerName = customerName ?? "Khách vãng lai",
                    CreatedAt = DateTime.Now,
                    SubTotal = subTotal,
                    DiscountAmount = discountAmount,
                    TaxAmount = taxAmount,
                    ShippingFee = shippingFee,
                    TotalAmount = totalAmount,
                    PaymentMethod = "TIỀN MẶT",
                    ReceivedAmount = receivedAmount,
                    ChangeAmount = changeAmount,
                    CutPaper = true,
                    OpenCashDrawer = true,
                    FooterNote = "Giao dịch bán offline - Đã bảo lưu trên thiết bị",
                    Items = items.Select(i => new PrintJobItem
                    {
                        ProductName = i.ProductName,
                        Quantity = i.Quantity,
                        Price = i.Price,
                        LineTotal = i.LineTotal,
                        OptionsText = i.OptionsText,
                        Note = i.Note
                    }).ToList()
                };

                byte[] receiptBytes = RasterTextEngine.BuildReceiptRasterBytes(printPayload, 576);

                string printKey = $"print_rec_{clientOrderId}_{DateTime.UtcNow.Ticks}";
                var printJobs = new List<OfflinePrintJobQueueItem>
                {
                    new OfflinePrintJobQueueItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        IdempotencyKey = printKey,
                        PrinterId = "DEFAULT_RECEIPT",
                        PayloadBytes = receiptBytes,
                        DocName = $"RECEIPT-{localOrderCode}"
                    }
                };

                // 4. ATOMIC SAVE in SQLite
                await OfflineOrderRepository.SaveOrderAtomicallyAsync(orderRecord, outboxEvent, printJobs);

                // 5. Trigger print worker
                PersistentPrintQueue.Instance.NotifyAllWorkers();

                return (true, orderRecord, null);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[OFFLINE ENGINE] Cash payment failed: {ex.Message}");
                return (false, null, ex.Message);
            }
        }
    }
}
