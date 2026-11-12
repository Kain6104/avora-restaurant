using System.ComponentModel;
﻿using System;
using System.Collections.Generic;

namespace AvoraPosNative.Models
{
    public class PosBranch
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string BranchCode { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Street { get; set; }
        public string? Ward { get; set; }
        public string? District { get; set; }
        public string? Province { get; set; }
        public bool AutoPrintReceipt { get; set; } = true;
        public bool AutoPrintTempBill { get; set; } = true;
        public bool SplitKitchenTickets { get; set; } = true;
        public string? DefaultPaperSize { get; set; } = "K80";
        public string? DefaultReceiptPrinterId { get; set; }
    }

    public class PosCategory
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Image { get; set; }
        public int ProductCount { get; set; }
    }

    public class PosOptionItem
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal PriceAdjustment { get; set; }
        public bool IsDefault { get; set; }
        public bool Available { get; set; } = true;
    }

    public class PosOptionGroup
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsRequired { get; set; }
        public bool MultipleChoice { get; set; }
        public int MinSelect { get; set; }
        public int MaxSelect { get; set; }
        public List<PosOptionItem> OptionItems { get; set; } = new();
    }

    public class PosProduct
    {
        public string Id { get; set; } = string.Empty;
        public string ItemCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public decimal? DiscountedPrice { get; set; }
        public decimal EffectivePrice { get; set; }
        public bool IsFlashSale { get; set; }
        public string Unit { get; set; } = "Phần";
        public string? ImageUrl { get; set; }
        public bool Available { get; set; } = true;
        public bool IsBestSeller { get; set; }
        public string CategoryId { get; set; } = string.Empty;
        public string? CategoryName { get; set; }
        public decimal? TaxPercentage { get; set; }
        public List<PosOptionGroup> OptionGroups { get; set; } = new();
        public bool IsBuffetTicket { get; set; }
        public string? BuffetTicketPackageId { get; set; }
        public string? BuffetTicketPackageName { get; set; }
        public bool IsBuffetItem { get; set; }

        public string Code => ItemCode;
        public string PriceText => $"{Price:N0}đ";
        public bool IsOutOfStock => !Available;
        public bool HasImage => !string.IsNullOrWhiteSpace(ImageUrl);
        public string? FullImageUrl
        {
            get
            {
                if (string.IsNullOrWhiteSpace(ImageUrl)) return null;
                if (ImageUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || ImageUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    return ImageUrl;
                }
                string baseDomain = "https://avorafnb.com";
                return ImageUrl.StartsWith("/") ? baseDomain + ImageUrl : baseDomain + "/" + ImageUrl;
            }
        }
        public bool HasOptions => OptionGroups != null && OptionGroups.Count > 0;
    }

    public class PosProductOptionItem
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
    }

    public class PosOrderItem : INotifyPropertyChanged
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string ProductId { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;

        private int _quantity = 1;
        public int Quantity
        {
            get => _quantity;
            set
            {
                if (_quantity != value)
                {
                    _quantity = value;
                    OnPropertyChanged(nameof(Quantity));
                    LineTotal = _quantity * _price;
                }
            }
        }

        private decimal _price;
        public decimal Price
        {
            get => _price;
            set
            {
                if (_price != value)
                {
                    _price = value;
                    OnPropertyChanged(nameof(Price));
                    LineTotal = _quantity * _price;
                }
            }
        }

        private decimal _lineTotal;
        public decimal LineTotal
        {
            get => _lineTotal;
            set
            {
                if (_lineTotal != value)
                {
                    _lineTotal = value;
                    OnPropertyChanged(nameof(LineTotal));
                }
            }
        }

        public string? OptionsText { get; set; }
        public List<string> SelectedOptionIds { get; set; } = new();
        public string? Note { get; set; }

        private string _status = "NEW";
        public string Status
        {
            get => _status;
            set
            {
                if (_status != value)
                {
                    _status = value;
                    OnPropertyChanged(nameof(Status));
                }
            }
        }

        private string _pricingMode = "REGULAR";
        public string PricingMode
        {
            get => _pricingMode;
            set
            {
                if (_pricingMode != value)
                {
                    _pricingMode = value;
                    OnPropertyChanged(nameof(PricingMode));
                }
            }
        }

        public event PropertyChangedEventHandler? PropertyChanged;
        protected void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }

    public class PosBuffetTicket
    {
        public string Id { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public PosProduct? Product { get; set; }
    }

    public class PosBuffetPackageItem
    {
        public string Id { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public PosProduct? Product { get; set; }
    }

    public class PosBuffetPackage
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool Active { get; set; } = true;
        public List<PosBuffetTicket> Tickets { get; set; } = new();
        public List<PosBuffetPackageItem> Items { get; set; } = new();
    }

    public class PosCartItemOption
    {
        public string OptionItemId { get; set; } = string.Empty;
        public string NameAtSale { get; set; } = string.Empty;
        public decimal PriceAdjustmentAtSale { get; set; }
    }

    public class PosCartItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string ProductId { get; set; } = string.Empty;
        public PosProduct? Product { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public decimal PriceAtSale { get; set; }
        public decimal OriginalPriceAtSale { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? DiscountReason { get; set; }
        public string? Note { get; set; }
        public string? OptionsTextSnapshot { get; set; }
        public List<PosCartItemOption> SelectedOptions { get; set; } = new();
        public string KitchenStatus { get; set; } = "PENDING"; // PENDING, SENT, PREPARING, READY, SERVED, CANCELLED
        public int SavedQuantity { get; set; }
        public int SentQuantity { get; set; }
        public string PricingMode { get; set; } = "REGULAR"; // REGULAR, BUFFET_TICKET, BUFFET_INCLUDED
        public decimal LineTotal => Math.Max(0, (PriceAtSale * Quantity) - DiscountAmount);
    }

    public class PosArea
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }

    public class PosTable
    {
        public string Id { get; set; } = string.Empty;
        public string? BranchId { get; set; }
        public string TableCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; } = 4;
        public string? AreaId { get; set; }
        public string AreaName { get; set; } = "Chung";
        public string VisualStatus { get; set; } = "VACANT"; // VACANT, OCCUPIED, BILL_PRINTED, RESERVED
        public int ElapsedMinutes { get; set; }
        public PosTableSession? ActiveSession { get; set; }
        public PosTableOrderSummary? CurrentOrder { get; set; }

        public string Status => VisualStatus;
        public int GuestCount => ActiveSession?.GuestCount ?? 0;
        public string DisplayNumber
        {
            get
            {
                if (string.IsNullOrWhiteSpace(Name)) return TableCode;
                string cleaned = System.Text.RegularExpressions.Regex.Replace(Name, @"^bàn\s*", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
                return string.IsNullOrEmpty(cleaned) ? Name : cleaned;
            }
        }
        public string StatusText => VisualStatus switch
        {
            "VACANT" => "Bàn trống",
            "OCCUPIED" => "Đang dùng",
            "BILL_PRINTED" => "Đã in tạm tính",
            "RESERVED" => "Đã đặt trước",
            _ => VisualStatus
        };
        public string ElapsedTimeText => ElapsedMinutes > 0 ? $"{ElapsedMinutes} phút" : string.Empty;
        public string CurrentTotalText => CurrentOrder != null && CurrentOrder.TotalAmount > 0 ? $"{CurrentOrder.TotalAmount:N0}đ" : string.Empty;
    }

    public class PosTableSession
    {
        public string Id { get; set; } = string.Empty;
        public DateTime OpenedAt { get; set; }
        public int GuestCount { get; set; }
        public string? CashierId { get; set; }
    }

    public class PosTableOrderSummary
    {
        public string Id { get; set; } = string.Empty;
        public string OrderCode { get; set; } = string.Empty;
        public string? TemporaryOrderCode { get; set; }
        public int GuestCount { get; set; }
        public decimal SubTotal { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string KitchenStatus { get; set; } = string.Empty;
        public int ItemCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class PosOrder
    {
        public string Id { get; set; } = string.Empty;
        public string? OrderCode { get; set; }
        public string? TableName { get; set; }
        public string? TemporaryOrderCode { get; set; }
        public string BranchId { get; set; } = string.Empty;
        public string? TableId { get; set; }
        public PosTable? Table { get; set; }
        public int GuestCount { get; set; } = 1;
        public string CustomerName { get; set; } = "Khách vãng lai";
        public string? CustomerPhone { get; set; }
        public string? UserId { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? Note { get; set; }
        public string OrderType { get; set; } = "DINE_IN"; // DINE_IN, TAKEAWAY, DELIVERY
        public string Status { get; set; } = "DRAFT"; // DRAFT, HELD, PENDING, CONFIRMED, COMPLETED, CANCELLED
        public string KitchenStatus { get; set; } = "PENDING";
        public string PaymentStatus { get; set; } = "PENDING"; // PENDING, PAID
        public string PaymentMethod { get; set; } = "CASH";
        public decimal SubTotal { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? DiscountReason { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal ShippingFee { get; set; }
        public int PointsUsed { get; set; }
        public string? VoucherId { get; set; }
        public string? DiscountVoucherCodeSnapshot { get; set; }
        public bool IsInvoiceRequested { get; set; }
        public string? InvoiceTaxCode { get; set; }
        public string? InvoiceCompanyName { get; set; }
        public string? InvoiceAddress { get; set; }
        public string? InvoiceEmail { get; set; }
        public List<PosCartItem> OrderItems { get; set; } = new();
        public string? OrderSource { get; set; } = "POS";
        public int ItemCount { get; set; }
        public List<PosOrderItem> Items { get; set; } = new();
        public string? BuffetPackageId { get; set; }
        public string? BuffetPackageName { get; set; }
        public DateTime? BuffetStartedAt { get; set; }
        public int BuffetDurationMinutes { get; set; } = 120;
        public bool HasActiveBuffet => !string.IsNullOrEmpty(BuffetPackageId);

        public bool IsPersistedOnServer =>
            (!string.IsNullOrEmpty(OrderCode) && !OrderCode.StartsWith("OFF-")) ||
            (!string.IsNullOrEmpty(TemporaryOrderCode) && !TemporaryOrderCode.StartsWith("OFF-"));

        public string DisplayCode => !string.IsNullOrEmpty(OrderCode)
            ? OrderCode!
            : (!string.IsNullOrEmpty(TemporaryOrderCode)
                ? TemporaryOrderCode!
                : (Id.Length > 8 ? Id.Substring(0, 8).ToUpperInvariant() : Id));

        public string DisplayTableOrType => !string.IsNullOrEmpty(TableName)
            ? TableName!
            : (!string.IsNullOrEmpty(Table?.Name)
                ? Table!.Name
                : (OrderType == "TAKEAWAY" ? "Mang đi" : OrderType == "DELIVERY" ? "Giao hàng" : "Tại bàn"));

        public string CardHeaderType => OrderType switch
        {
            "TAKEAWAY" => "Mang đi",
            "DELIVERY" => "Giao hàng",
            _ => "Bàn"
        };

        public string CardHeaderIcon => OrderType switch
        {
            "TAKEAWAY" => "👝",
            "DELIVERY" => "🚚",
            _ => "🍽️"
        };

        public string CardHeaderBg => OrderType switch
        {
            "TAKEAWAY" => "#EA580C",
            "DELIVERY" => "#7C3AED",
            _ => "#2563EB"
        };

        public string CardHeaderLightBg => OrderType switch
        {
            "TAKEAWAY" => "#FFF7ED",
            "DELIVERY" => "#F5F3FF",
            _ => "#EFF6FF"
        };

        public string CardTitle => OrderType == "DINE_IN" && (!string.IsNullOrEmpty(TableName) || !string.IsNullOrEmpty(Table?.Name))
            ? (!string.IsNullOrEmpty(TableName) ? TableName! : Table!.Name)
            : DisplayCode;

        public string ElapsedTimeText
        {
            get
            {
                var diff = DateTime.Now - CreatedAt;
                if (diff.TotalSeconds < 0) return "00:00:00";
                return $"{(int)diff.TotalHours:D2}:{diff.Minutes:D2}:{diff.Seconds:D2}";
            }
        }

        public string StatusText => Status switch
        {
            "PENDING" => "Chờ xác nhận",
            "CONFIRMED" => "Đang phục vụ",
            "PREPARING" => "Đang chế biến",
            "HELD" => "Chờ thanh toán",
            "DELIVERING" => "Đang giao",
            "COMPLETED" => "Đã hoàn tất",
            "CANCELLED" => "Đã hủy",
            _ => "Đơn nháp"
        };

        public int TotalItemsCount => ItemCount > 0
            ? ItemCount
            : (OrderItems != null && OrderItems.Count > 0
                ? System.Linq.Enumerable.Sum(OrderItems, i => i.Quantity)
                : (Items != null && Items.Count > 0 ? System.Linq.Enumerable.Sum(Items, i => i.Quantity) : 0));
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class PosCustomer
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string MemberTier { get; set; } = "BRONZE";
        public int LoyaltyPoints { get; set; }
        public decimal TotalSpending { get; set; }
        public string? TaxCode { get; set; }
        public string? CompanyName { get; set; }
        public string? TaxAddress { get; set; }
        public string? InvoiceEmail { get; set; }
    }

    public class PosVoucher
    {
        public string Id { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string DiscountType { get; set; } = "FIXED_AMOUNT"; // FIXED_AMOUNT, PERCENTAGE
        public decimal DiscountValue { get; set; }
        public decimal? MinOrderAmount { get; set; }
        public decimal? MaxDiscountAmount { get; set; }
        public bool IsValid { get; set; } = true;
        public string? Message { get; set; }
    }

    public class PosReservationTable
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }

    public class PosReservation
    {
        public string Id { get; set; } = string.Empty;
        public string ReservationCode { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerPhone { get; set; }
        public string? CustomerEmail { get; set; }
        public int PartySize { get; set; }
        public DateTime? ReservationDate { get; set; }
        public string? ReservationTime { get; set; }
        public string Status { get; set; } = "CONFIRMED";
        public string? TablePreference { get; set; }
        public string? SpecialRequests { get; set; }
        public string? InternalNote { get; set; }
        public string? Source { get; set; }
        public string? BranchName { get; set; }
        public List<PosReservationTable> AssignedTables { get; set; } = new();

        public string AssignedTableNames => AssignedTables != null && AssignedTables.Count > 0
            ? string.Join(", ", System.Linq.Enumerable.Select(AssignedTables, t => t.Name))
            : "Chưa xếp bàn";

        public string DateTimeDisplay => $"{ReservationTime} {ReservationDate:dd/MM/yyyy}".Trim();
        public string StatusDisplayText => (Status ?? string.Empty).ToUpperInvariant() switch
        {
            "CONFIRMED" => "Đã xác nhận",
            "PENDING" => "Chờ xác nhận",
            "CHECKED_IN" or "SEATED" => "Đang dùng bữa",
            "COMPLETED" => "Hoàn tất",
            "CANCELLED" => "Đã hủy",
            "NO_SHOW" => "Không đến",
            _ => Status ?? string.Empty
        };
        public bool CanCheckIn => string.Equals(Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase)
                                  || string.Equals(Status, "PENDING", StringComparison.OrdinalIgnoreCase);
        public string StatusFooterNote => (Status ?? string.Empty).ToUpperInvariant() switch
        {
            "CHECKED_IN" or "SEATED" => "Khách đang dùng bữa tại bàn",
            "COMPLETED" => "Đã hoàn tất thanh toán",
            "CANCELLED" => "Đơn đặt bàn đã hủy",
            "NO_SHOW" => "Khách không đến (No-show)",
            _ => string.Empty
        };
    }

    public class PosKitchenItem
    {
        public string Id { get; set; } = string.Empty;
        public string ProductId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string? Note { get; set; }
        public string? OptionsText { get; set; }
        public string? StationId { get; set; }
        public string KitchenStatus { get; set; } = "SENT";
        public DateTime? SentToKitchenAt { get; set; }
        public DateTime? AcknowledgedAt { get; set; }
        public DateTime? ReadyAt { get; set; }

        public string StatusDisplay => KitchenStatus switch
        {
            "SENT" => "Chờ chế biến",
            "ACKNOWLEDGED" => "Đã tiếp nhận",
            "PREPARING" => "Đang làm",
            "READY" => "Đã xong",
            "SERVED" => "Đã phục vụ",
            _ => KitchenStatus
        };
    }

    public class PosKitchenTicket
    {
        public string Id { get; set; } = string.Empty;
        public string? OrderCode { get; set; }
        public string TableName { get; set; } = "Mang về";
        public int GuestCount { get; set; }
        public string? Note { get; set; }
        public DateTime? SentToKitchenAt { get; set; }
        public int ElapsedSeconds { get; set; }
        public List<PosKitchenItem> Items { get; set; } = new();

        public string ElapsedText
        {
            get
            {
                if (SentToKitchenAt.HasValue)
                {
                    var span = DateTime.UtcNow - SentToKitchenAt.Value;
                    int mins = (int)span.TotalMinutes;
                    return mins > 0 ? $"{mins} phút trước" : "Vừa gọi";
                }
                int m = ElapsedSeconds / 60;
                return m > 0 ? $"{m} phút trước" : "Vừa gọi";
            }
        }
    }

    public class PosCashShift
    {
        public string Id { get; set; } = string.Empty;
        public string BranchId { get; set; } = string.Empty;
        public string CashierId { get; set; } = string.Empty;
        public string? CashierName { get; set; }
        public string Status { get; set; } = "OPEN"; // OPEN, CLOSED
        public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ClosedAt { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal? ClosingBalance { get; set; }
        public decimal? ExpectedBalance { get; set; }
        public decimal? CashDifference { get; set; }
        public decimal TotalRevenue { get; set; }
        public decimal TotalCash { get; set; }
        public decimal TotalCard { get; set; }
        public decimal TotalTransfer { get; set; }
        public int OrderCount { get; set; }
        public string? Note { get; set; }
    }

    public class PosQrOrder
    {
        public string Id { get; set; } = string.Empty;
        public string OrderId { get; set; } = string.Empty;
        public string OrderCode { get; set; } = string.Empty;
        public string TableId { get; set; } = string.Empty;
        public string TableName { get; set; } = string.Empty;
        public string GuestName { get; set; } = "Khách QR";
        public int RoundNumber { get; set; } = 1;
        public string Status { get; set; } = "PENDING";
        public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
        public List<PosCartItem> Items { get; set; } = new();

        public int TotalItemCount
        {
            get
            {
                int count = 0;
                foreach (var item in Items) count += item.Quantity;
                return count;
            }
        }

        public decimal TotalAmount
        {
            get
            {
                decimal sum = 0;
                foreach (var item in Items) sum += item.LineTotal;
                return sum;
            }
        }

        public string TimeElapsedText
        {
            get
            {
                int mins = Math.Max(0, (int)(DateTime.UtcNow - RequestedAt).TotalMinutes);
                return mins < 60 ? $"{mins} phút trước" : $"{mins / 60} giờ trước";
            }
        }
    }
}
