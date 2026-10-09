using System;
using System.Collections.Generic;

namespace AvoraPosNative.Models
{
    public enum PrinterCommandSet
    {
        ESC_POS,
        TSPL,
        ZPL,
        EPL
    }

    public enum PrinterConnectionType
    {
        USB_WINDOWS_SPOOLER,
        TCP_LAN_RAW
    }

    /// <summary>
    /// Model cấu hình máy in chuẩn hóa 15 trường dữ liệu theo Directive 5
    /// </summary>
    public class PrinterProfile
    {
        public string PrinterId { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string DriverName { get; set; } = string.Empty;
        public string PortName { get; set; } = string.Empty;
        public PrinterConnectionType ConnectionType { get; set; } = PrinterConnectionType.USB_WINDOWS_SPOOLER;
        public PrinterCommandSet CommandSet { get; set; } = PrinterCommandSet.ESC_POS;
        public int Dpi { get; set; } = 203;
        public int PaperWidthMm { get; set; } = 80;
        public int PrintableWidthDots { get; set; } = 576; // 576 dots for K80, 384 dots for K57
        public int CodePage { get; set; } = 1258; // 1258: Windows-1258 Vietnamese
        public bool SupportsCut { get; set; } = true;
        public bool SupportsDrawer { get; set; } = true;
        public bool SupportsQr { get; set; } = true;
        public bool SupportsBarcode { get; set; } = true;
        public string LabelCommandLanguage { get; set; } = "TSPL"; // TSPL, ZPL, EPL

        // Network specifics
        public string? IpAddress { get; set; }
        public int TcpPort { get; set; } = 9100;
        public bool IsEnabled { get; set; } = true;
    }

    /// <summary>
    /// Bản ghi tác vụ in lưu trữ persistent trong SQLite theo Directive 7
    /// </summary>
    public class PrintJobRecord
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();
        public string PrinterId { get; set; } = string.Empty;
        public string Status { get; set; } = "QUEUED"; // QUEUED, PRINTING, COMPLETED, FAILED
        public int Attempts { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? PrintingAt { get; set; }
        public DateTime? PrintedAt { get; set; }
        public string? Error { get; set; }
        public byte[] PayloadBytes { get; set; } = Array.Empty<byte>();
        public string DocName { get; set; } = "AVORA POS PRINT JOB";
    }

    public class PrintJobItem
    {
        public string ProductName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public decimal LineTotal { get; set; }
        public string? OptionsText { get; set; }
        public string? Note { get; set; }
    }

    public class PrintJobPayload
    {
        public string JobId { get; set; } = Guid.NewGuid().ToString();
        public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString();
        public string Title { get; set; } = "HÓA ĐƠN THANH TOÁN";
        public string? BranchName { get; set; }
        public string? BranchAddress { get; set; }
        public string? BranchPhone { get; set; }
        public string? OrderCode { get; set; }
        public string? TableName { get; set; }
        public string? CashierName { get; set; }
        public string? CustomerName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public List<PrintJobItem> Items { get; set; } = new();
        public decimal SubTotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal ShippingFee { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal ReceivedAmount { get; set; }
        public decimal ChangeAmount { get; set; }
        public string? PaymentMethod { get; set; }
        public string? FooterNote { get; set; }
        public bool OpenCashDrawer { get; set; } = false;
        public bool CutPaper { get; set; } = true;
    }
}
