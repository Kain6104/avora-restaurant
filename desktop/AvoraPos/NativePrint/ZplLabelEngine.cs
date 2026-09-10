using System;
using System.Text;
using AvoraPos.Models;

namespace AvoraPos.NativePrint
{
    public static class ZplLabelEngine
    {
        public static byte[] BuildZplLabel(LabelPrintItemPayload label, PrinterProfile profile)
        {
            var sb = new StringBuilder();

            sb.AppendLine("^XA");
            sb.AppendLine("^CI28"); // UTF-8 Encoding in ZPL

            // Restaurant Title
            sb.AppendLine("^FO20,20^A0N,28,28^FDAVORA RESTAURANT^FS");

            // Table & Order
            string tableStr = string.IsNullOrWhiteSpace(label.TableName) ? "Mang di" : label.TableName;
            sb.AppendLine($"^FO20,55^A0N,22,22^FDBan: {label.TableName} | {label.OrderCode}^FS");

            // Line
            sb.AppendLine($"^FO20,82^GB{profile.PrintableWidthDots - 40},2,2^FS");

            // Item Name
            sb.AppendLine($"^FO20,95^A0N,30,30^FD{label.ItemName}^FS");

            // Options
            if (!string.IsNullOrWhiteSpace(label.OptionsText))
            {
                sb.AppendLine($"^FO20,135^A0N,22,22^FD+ {label.OptionsText}^FS");
            }

            // Price & Copy
            string priceStr = label.Price > 0 ? $"{label.Price:N0}d" : "Kem theo";
            string copyStr = label.TotalCopies > 1 ? $"[{label.CopyNumber}/{label.TotalCopies}]" : "";
            sb.AppendLine($"^FO20,165^A0N,24,24^FDGia: {priceStr} {copyStr}^FS");

            // Barcode
            if (!string.IsNullOrWhiteSpace(label.Barcode))
            {
                sb.AppendLine($"^FO20,200^BY2,2,40^BCN,40,Y,N,N^FD{label.Barcode}^FS");
            }
            else if (!string.IsNullOrWhiteSpace(label.QrCode))
            {
                sb.AppendLine($"^FO20,195^BQN,2,4^FDQA,{label.QrCode}^FS");
            }

            sb.AppendLine("^XZ");

            return Encoding.UTF8.GetBytes(sb.ToString());
        }
    }
}
