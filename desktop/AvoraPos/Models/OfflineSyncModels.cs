using System;

namespace AvoraPos.Models
{
    public enum SyncStatus
    {
        PENDING_CREATION,
        PENDING_UPDATE,
        SYNCED,
        CONFLICT,
        FAILED
    }

    public enum OfflineOperationPolicy
    {
        SAFE_OFFLINE,       // Xem menu, thao tác giỏ local, mở bàn local, in bếp local
        SERVER_DEPENDENT    // Xác nhận payment online, voucher live, số dư điểm hội viên, flash sale quota
    }

    public class OfflineOrderRecord
    {
        public string LocalOrderId { get; set; } = Guid.NewGuid().ToString();
        public string? ServerOrderId { get; set; }
        public string ClientMutationId { get; set; } = Guid.NewGuid().ToString();
        public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();
        public int BaseVersion { get; set; } = 1;
        public int LocalVersion { get; set; } = 1;
        public SyncStatus SyncStatus { get; set; } = SyncStatus.PENDING_CREATION;
        public string OrderDataJson { get; set; } = "{}";
        public DateTime CreatedOfflineAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastSyncAttemptAt { get; set; }
        public string? ErrorMessage { get; set; }
        public string BranchId { get; set; } = string.Empty;
    }

    public class OfflineMutationRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string LocalOrderId { get; set; } = string.Empty;
        public string MutationType { get; set; } = string.Empty; // OPEN_TABLE, ADD_ITEMS, CANCEL_ITEM, UPDATE_ORDER, PAY_OFFLINE
        public string PayloadJson { get; set; } = "{}";
        public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();
        public SyncStatus Status { get; set; } = SyncStatus.PENDING_UPDATE;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? SyncedAt { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class OfflineSnapshotRecord
    {
        public string BranchId { get; set; } = string.Empty;
        public string SnapshotType { get; set; } = string.Empty; // PRODUCTS, CATEGORIES, TABLES, AREAS, USERS, PRINT_SETTINGS
        public string DataJson { get; set; } = "{}";
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
