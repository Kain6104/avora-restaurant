using System;
using System.Collections.Generic;

namespace AvoraPos.Models
{
    public class ReceiptItemPayload
    {
        public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal OriginalPrice { get; set; }
        public decimal TotalPrice { get; set; }
        public decimal DiscountAmount { get; set; }
        public string? Note { get; set; }
        public List<string> Options { get; set; } = new List<string>();
        public bool IsBuffetIncluded { get; set; }
    }

    public class ReceiptPrintPayload
    {
        public string OrderId { get; set; } = string.Empty;
        public string OrderCode { get; set; } = string.Empty;
        public string? TableName { get; set; }
        public string OrderType { get; set; } = "DINE_IN"; // DINE_IN, TAKEAWAY, DELIVERY
        public string? CashierName { get; set; }
        public string? WaiterName { get; set; }
        public int GuestCount { get; set; } = 1;
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public int? MemberPointsBalance { get; set; }
        public int? PointsEarned { get; set; }
        public int? PointsUsed { get; set; }

        public string RestaurantName { get; set; } = "AVORA RESTAURANT";
        public string? BranchName { get; set; }
        public string? BranchAddress { get; set; }
        public string? BranchPhone { get; set; }

        public DateTime OrderTime { get; set; } = DateTime.Now;
        public DateTime PrintTime { get; set; } = DateTime.Now;

        public List<ReceiptItemPayload> Items { get; set; } = new List<ReceiptItemPayload>();

        public decimal SubTotal { get; set; }
        public decimal ItemDiscountTotal { get; set; }
        public decimal OrderDiscountAmount { get; set; }
        public string? VoucherCode { get; set; }
        public decimal PointsDiscountAmount { get; set; }
        public decimal ServiceChargeTotal { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal ShippingFee { get; set; }
        public decimal TotalAmount { get; set; }

        // Payment info
        public string PaymentMethod { get; set; } = "CASH";
        public decimal AmountReceived { get; set; }
        public decimal ChangeAmount { get; set; }

        // Invoice / VAT details
        public bool IsInvoiceRequested { get; set; }
        public string? InvoiceTaxCode { get; set; }
        public string? InvoiceCompanyName { get; set; }
        public string? InvoiceAddress { get; set; }
        public string? InvoiceEmail { get; set; }

        public string? QrData { get; set; }
        public string? BarcodeData { get; set; }
        public string? FooterNote { get; set; } = "Cảm ơn Quý khách & Hẹn gặp lại!";

        public bool IsProForma { get; set; } // true if tạm tính
        public bool CutPaper { get; set; } = true;
        public bool OpenDrawer { get; set; } = false;
        public int Copies { get; set; } = 1;
        public string? TargetPrinterId { get; set; }
    }

    public class KitchenTicketItemPayload
    {
        public string ItemId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Quantity { get; set; } = 1;
        public string? Note { get; set; }
        public List<string> Options { get; set; } = new List<string>();
        public string StationName { get; set; } = string.Empty;
        public bool IsNew { get; set; } = true;
        public bool IsCancelled { get; set; } = false;
        public string? CancelReason { get; set; }
    }

    public class KitchenPrintPayload
    {
        public string OrderId { get; set; } = string.Empty;
        public string OrderCode { get; set; } = string.Empty;
        public string TableName { get; set; } = string.Empty;
        public string OrderType { get; set; } = "DINE_IN";
        public string? CashierOrWaiterName { get; set; }
        public DateTime SentTime { get; set; } = DateTime.Now;
        public string StationId { get; set; } = string.Empty;
        public string StationName { get; set; } = string.Empty;
        public bool IsCancelTicket { get; set; } = false;
        public string? GeneralCancelReason { get; set; }
        public List<KitchenTicketItemPayload> Items { get; set; } = new List<KitchenTicketItemPayload>();
        public string? TargetPrinterId { get; set; }
    }

    public class LabelPrintItemPayload
    {
        public string ItemName { get; set; } = string.Empty;
        public string? OptionsText { get; set; }
        public decimal Price { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string TableName { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public string? Barcode { get; set; }
        public string? QrCode { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public int CopyNumber { get; set; } = 1;
        public int TotalCopies { get; set; } = 1;
    }

    public class LabelPrintPayload
    {
        public List<LabelPrintItemPayload> Labels { get; set; } = new List<LabelPrintItemPayload>();
        public string? TargetPrinterId { get; set; }
    }
}
