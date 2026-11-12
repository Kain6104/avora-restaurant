using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;

namespace AvoraPosNative.Services
{
    public class PrintService
    {
        public static async Task PrintReceiptAsync(PrintJobPayload payload, string? printerTarget = null)
        {
            try
            {
                byte[] rasterBytes = RasterTextEngine.BuildReceiptRasterBytes(payload, 576);

                string target = !string.IsNullOrWhiteSpace(printerTarget) ? printerTarget : GetDefaultPrinter();
                if (string.IsNullOrWhiteSpace(target)) return;

                var connType = target.StartsWith("tcp://", StringComparison.OrdinalIgnoreCase)
                    ? PrinterConnectionType.TCP_LAN_RAW
                    : PrinterConnectionType.USB_WINDOWS_SPOOLER;

                await PersistentPrintQueue.Instance.EnqueuePrintJobAsync(target, target, connType, rasterBytes, "AVORA RECEIPT");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PRINT SERVICE] Print receipt failed: {ex.Message}");
            }
        }

        public static async Task PrintKitchenTicketAsync(string tableName, string orderCode, List<PrintJobItem> items, string? cashier = null, string? printerTarget = null)
        {
            try
            {
                byte[] rasterBytes = RasterTextEngine.BuildKitchenTicketRasterBytes(tableName, orderCode, items, cashier, 576);

                string target = !string.IsNullOrWhiteSpace(printerTarget) ? printerTarget : GetDefaultPrinter();
                if (string.IsNullOrWhiteSpace(target)) return;

                var connType = target.StartsWith("tcp://", StringComparison.OrdinalIgnoreCase)
                    ? PrinterConnectionType.TCP_LAN_RAW
                    : PrinterConnectionType.USB_WINDOWS_SPOOLER;

                await PersistentPrintQueue.Instance.EnqueuePrintJobAsync(target, target, connType, rasterBytes, "AVORA KITCHEN");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PRINT SERVICE] Print kitchen ticket failed: {ex.Message}");
            }
        }

        public static async Task PrintLabelAsync(string title, string itemName, string? options, decimal price, string? orderCode, string? printerTarget = null)
        {
            try
            {
                byte[] tsplBytes = TsplEngine.BuildLabel(title, itemName, options, price, orderCode);

                string target = !string.IsNullOrWhiteSpace(printerTarget) ? printerTarget : GetDefaultPrinter();
                if (string.IsNullOrWhiteSpace(target)) return;

                var connType = target.StartsWith("tcp://", StringComparison.OrdinalIgnoreCase)
                    ? PrinterConnectionType.TCP_LAN_RAW
                    : PrinterConnectionType.USB_WINDOWS_SPOOLER;

                await PersistentPrintQueue.Instance.EnqueuePrintJobAsync(target, target, connType, tsplBytes, "AVORA LABEL");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PRINT SERVICE] Print label failed: {ex.Message}");
            }
        }

        public static async Task OpenCashDrawerAsync(string? printerTarget = null)
        {
            string target = !string.IsNullOrWhiteSpace(printerTarget) ? printerTarget : GetDefaultPrinter();
            if (string.IsNullOrWhiteSpace(target)) return;

            var connType = target.StartsWith("tcp://", StringComparison.OrdinalIgnoreCase)
                ? PrinterConnectionType.TCP_LAN_RAW
                : PrinterConnectionType.USB_WINDOWS_SPOOLER;

            // Standard ESC/POS Cash Drawer Pulse (ESC p 0 25 250)
            byte[] pulseBytes = new byte[] { 0x1B, 0x70, 0x00, 0x19, 0xFA };
            await PersistentPrintQueue.Instance.EnqueuePrintJobAsync(target, target, connType, pulseBytes, "AVORA CASH DRAWER");
        }

        private static string GetDefaultPrinter()
        {
            var printers = WinSpoolNative.GetInstalledPrinters();
            var def = printers.Find(p => p.IsDefault && !p.IsVirtual);
            if (def != null) return def.Name;

            var nonVirtual = printers.Find(p => !p.IsVirtual);
            if (nonVirtual != null) return nonVirtual.Name;

            return printers.Count > 0 ? printers[0].Name : string.Empty;
        }
    }
}
