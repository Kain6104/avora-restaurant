using System;
using System.Text;

namespace AvoraPosNative.Printing
{
    public static class TsplEngine
    {
        public static byte[] BuildLabel(string title, string itemName, string? options, decimal price, string? orderCode, int widthMm = 50, int heightMm = 30)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"SIZE {widthMm} mm, {heightMm} mm");
            sb.AppendLine("GAP 3 mm, 0 mm");
            sb.AppendLine("DIRECTION 1");
            sb.AppendLine("DENSITY 10");
            sb.AppendLine("SPEED 4");
            sb.AppendLine("CLS");

            sb.AppendLine($"TEXT 16, 16, \"2\", 0, 1, 1, \"{Sanitize(title)}\"");
            if (!string.IsNullOrWhiteSpace(orderCode))
            {
                sb.AppendLine($"TEXT 16, 42, \"2\", 0, 1, 1, \"Don: {Sanitize(orderCode)}\"");
            }

            sb.AppendLine($"BAR 16, 68, {widthMm * 8 - 32}, 2");
            sb.AppendLine($"TEXT 16, 78, \"3\", 0, 1, 1, \"{Sanitize(itemName)}\"");

            if (!string.IsNullOrWhiteSpace(options))
            {
                sb.AppendLine($"TEXT 16, 116, \"2\", 0, 1, 1, \"+ {Sanitize(options)}\"");
            }

            sb.AppendLine($"TEXT 16, 146, \"2\", 0, 1, 1, \"Gia: {price:N0}d\"");
            sb.AppendLine("PRINT 1, 1");

            return Encoding.ASCII.GetBytes(sb.ToString());
        }

        private static string Sanitize(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            return input.Replace("\"", "'").Replace("\r", "").Replace("\n", " ").Trim();
        }
    }

    public static class ZplEngine
    {
        public static byte[] BuildLabel(string title, string itemName, string? options, decimal price, int widthDots = 400, int heightDots = 240)
        {
            var sb = new StringBuilder();
            sb.AppendLine("^XA");
            sb.AppendLine($"^PW{widthDots}");
            sb.AppendLine($"^LL{heightDots}");
            sb.AppendLine("^FO20,20^A0N,28,28^FD" + Sanitize(title) + "^FS");
            sb.AppendLine("^FO20,55^GB360,2,2^FS");
            sb.AppendLine("^FO20,70^A0N,32,32^FD" + Sanitize(itemName) + "^FS");

            if (!string.IsNullOrWhiteSpace(options))
            {
                sb.AppendLine("^FO20,110^A0N,22,22^FD+ " + Sanitize(options) + "^FS");
            }

            sb.AppendLine("^FO20,145^A0N,26,26^FDGia: " + price.ToString("N0") + "d^FS");
            sb.AppendLine("^XZ");

            return Encoding.ASCII.GetBytes(sb.ToString());
        }

        private static string Sanitize(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            return input.Replace("^", "").Replace("~", "").Trim();
        }
    }
}
