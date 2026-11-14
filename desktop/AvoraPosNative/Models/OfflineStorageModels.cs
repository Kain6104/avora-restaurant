using System;
using System.Collections.Generic;

namespace AvoraPosNative.Models
{
    public static class OfflineSyncStatus
    {
        public const string LOCAL_SAVED = "LOCAL_SAVED";
        public const string PENDING_SYNC = "PENDING_SYNC";
        public const string SYNCED = "SYNCED";
        public const string SYNC_FAILED = "SYNC_FAILED";
        public const string SYNC_CONFLICT = "SYNC_CONFLICT";
    }

    public static class OutboxEventStatus
    {
        public const string PENDING = "PENDING";
        public const string IN_PROGRESS = "IN_PROGRESS";
        public const string COMPLETED = "COMPLETED";
        public const string FAILED = "FAILED";
        public const string CONFLICT = "CONFLICT";
    }

    public static class OutboxEventType
    {
        public const string CREATE_ORDER = "CREATE_ORDER";
        public const string SEND_KITCHEN = "SEND_KITCHEN";
        public const string PAY_ORDER = "PAY_ORDER";
        public const string CANCEL_ORDER = "CANCEL_ORDER";
    }

    public class OfflineOrderRecord
    {
        public string ClientOrderId { get; set; } = Guid.NewGuid().ToString();
        public string LocalOrderCode { get; set; } = string.Empty;
        public string? ServerOrderId { get; set; }
        public string? ServerOrderCode { get; set; }
        public string BranchId { get; set; } = string.Empty;
        public string? TableId { get; set; }
        public string? TableName { get; set; }
        public string OrderType { get; set; } = "DINE_IN";
        public int GuestCount { get; set; } = 1;
        public string CustomerName { get; set; } = "Khách vãng lai";
        public string? CustomerPhone { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Note { get; set; }
        public decimal SubTotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? DiscountVoucherCode { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal ShippingFee { get; set; }
        public decimal TotalAmount { get; set; }
        public string? PaymentMethod { get; set; }
        public string PaymentStatus { get; set; } = "PENDING";
        public decimal ReceivedAmount { get; set; }
        public decimal ChangeAmount { get; set; }
        public string SyncStatus { get; set; } = OfflineSyncStatus.PENDING_SYNC;
        public int SyncAttempts { get; set; }
        public string? LastSyncError { get; set; }
        public string PayloadJson { get; set; } = "{}";
        public string CreatedOfflineAt { get; set; } = DateTime.UtcNow.ToString("o");
        public string? SyncedAt { get; set; }
        public string? CashierId { get; set; }
        public string? CashierName { get; set; }
        public string DeviceId { get; set; } = string.Empty;
    }

    public class OutboxEventRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string EventType { get; set; } = OutboxEventType.CREATE_ORDER;
        public string AggregateId { get; set; } = string.Empty; // ClientOrderId
        public string IdempotencyKey { get; set; } = string.Empty;
        public string PayloadJson { get; set; } = "{}";
        public string Status { get; set; } = OutboxEventStatus.PENDING;
        public int RetryCount { get; set; }
        public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");
        public string? LastAttemptAt { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class MenuSnapshotInfo
    {
        public string BranchId { get; set; } = string.Empty;
        public string SnapshotVersion { get; set; } = "1.0";
        public int ProductCount { get; set; }
        public int CategoryCount { get; set; }
        public DateTime SyncedAt { get; set; }
        public string Status { get; set; } = "ACTIVE";
    }

    public class OfflinePrintJobQueueItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();
        public string PrinterId { get; set; } = "DEFAULT_PRINTER";
        public byte[] PayloadBytes { get; set; } = Array.Empty<byte>();
        public string DocName { get; set; } = "AVORA TICKET";
    }
}

