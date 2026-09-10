using System;

namespace AvoraPos.Models
{
    public enum PrinterType
    {
        CASHIER,
        KITCHEN,
        BAR,
        LABEL
    }

    public enum PrinterConnectionType
    {
        WINDOWS_RAW,
        TCP_RAW
    }

    public enum PrinterCommandSet
    {
        ESC_POS,
        TSPL,
        ZPL,
        EPL,
        WINDOWS_DRIVER
    }

    public enum LabelCommandLanguage
    {
        TSPL,
        ZPL,
        EPL,
        WINDOWS_DRIVER
    }

    public class PrinterProfile
    {
        public string PrinterId { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string DriverName { get; set; } = string.Empty;
        public string PortName { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; } = PrinterType.CASHIER;
        public PrinterConnectionType ConnectionType { get; set; } = PrinterConnectionType.WINDOWS_RAW;
        public PrinterCommandSet CommandSet { get; set; } = PrinterCommandSet.ESC_POS;
        public int Dpi { get; set; } = 203;
        public int PaperWidthMm { get; set; } = 80;
        public int PrintableWidthDots { get; set; } = 576; // e.g. 576 for 80mm@203dpi, 384 for 58mm@203dpi
        public int CodePage { get; set; } = 1258; // Windows-1258 or -1 for raster fallback
        public bool SupportsNativeText { get; set; } = false; // If false, uses RasterTextEngine
        public bool SupportsQr { get; set; } = true;
        public bool SupportsBarcode { get; set; } = true;
        public bool SupportsCut { get; set; } = true;
        public bool SupportsDrawer { get; set; } = true;

        // Cash drawer pulse config (Directive 8)
        public int DrawerPin { get; set; } = 2; // 2 or 5
        public int PulseOn { get; set; } = 50; // ms
        public int PulseOff { get; set; } = 500; // ms

        // Label config (Directive 7)
        public LabelCommandLanguage LabelCommandLanguage { get; set; } = LabelCommandLanguage.TSPL;
        public int LabelWidthMm { get; set; } = 50;
        public int LabelHeightMm { get; set; } = 30;
        public int LabelGapMm { get; set; } = 3;
        public int Darkness { get; set; } = 8;
        public int PrintSpeed { get; set; } = 4;

        // Network connection (for TCP_RAW)
        public string? IpAddress { get; set; }
        public int TcpPort { get; set; } = 9100;

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
