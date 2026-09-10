using System;
using System.IO;
using System.Text;
using AvoraPos.Models;

namespace AvoraPos.NativePrint
{
    public static class TsplLabelEngine
    {
        public static byte[] BuildTsplLabel(LabelPrintItemPayload label, PrinterProfile profile)
        {
            var sb = new StringBuilder();

            int width = profile.LabelWidthMm > 0 ? profile.LabelWidthMm : 50;
            int height = profile.LabelHeightMm > 0 ? profile.LabelHeightMm : 30;
            int gap = profile.LabelGapMm > 0 ? profile.LabelGapMm : 3;
            int darkness = Math.Clamp(profile.Darkness, 1, 15);
            int speed = Math.Clamp(profile.PrintSpeed, 1, 6);

            sb.AppendLine($"SIZE {width} mm, {height} mm");
            sb.AppendLine($"GAP {gap} mm, 0 mm");
            sb.AppendLine("DIRECTION 1");
            sb.AppendLine($"DENSITY {darkness}");
            sb.AppendLine($"SPEED {speed}");
            sb.AppendLine("CLS");

            // Restaurant Tag
            sb.AppendLine("TEXT 16, 16, \"2\", 0, 1, 1, \"AVORA RESTAURANT\"");

            // Table & Order Code
            string tableStr = string.IsNullOrWhiteSpace(label.TableName) ? "Mang di" : label.TableName;
            sb.AppendLine($"TEXT 16, 42, \"2\", 0, 1, 1, \"Ban: {SanitizeTspl(tableStr)} | {SanitizeTspl(label.OrderCode)}\"");

            // Divider
            sb.AppendLine($"BAR 16, 70, {width * 8 - 32}, 2");

            // Item Name (Bold Font 3)
            string itemName = SanitizeTspl(label.ItemName);
            if (itemName.Length > 24) itemName = itemName.Substring(0, 24);
            sb.AppendLine($"TEXT 16, 80, \"3\", 0, 1, 1, \"{itemName}\"");

            // Options (Topping / Sweetness / Ice)
            if (!string.IsNullOrWhiteSpace(label.OptionsText))
            {
                string opt = SanitizeTspl(label.OptionsText);
                if (opt.Length > 32) opt = opt.Substring(0, 32);
                sb.AppendLine($"TEXT 16, 120, \"2\", 0, 1, 1, \"+ {opt}\"");
            }

            // Price & Copy Index
            string priceStr = label.Price > 0 ? $"{label.Price:N0}d" : "Kem theo";
            string copyStr = label.TotalCopies > 1 ? $"[{label.CopyNumber}/{label.TotalCopies}]" : "";
            sb.AppendLine($"TEXT 16, 150, \"2\", 0, 1, 1, \"Gia: {priceStr} {copyStr}\"");

            // Barcode or QR
            if (!string.IsNullOrWhiteSpace(label.Barcode))
            {
                sb.AppendLine($"BARCODE 16, 180, \"128\", 35, 1, 0, 2, 2, \"{SanitizeTspl(label.Barcode)}\"");
            }
            else if (!string.IsNullOrWhiteSpace(label.QrCode))
            {
                sb.AppendLine($"QRCODE 16, 175, L, 3, A, 0, \"{SanitizeTspl(label.QrCode)}\"");
            }

            sb.AppendLine("PRINT 1, 1");

            // TSPL uses Windows-1258 or ASCII encoding
            Encoding enc;
            try
            {
                enc = Encoding.GetEncoding(profile.CodePage > 0 ? profile.CodePage : 1258);
            }
            catch
            {
                enc = Encoding.ASCII;
            }

            return enc.GetBytes(sb.ToString());
        }

        private static string SanitizeTspl(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            return input.Replace("\"", "'").Replace("\r", "").Replace("\n", " ").Trim();
        }
    }
}
