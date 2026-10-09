using System;
using System.IO;
using System.Text;

namespace AvoraPosNative.Printing
{
    public static class EscPosEngine
    {
        public static readonly byte[] Initialize = new byte[] { 0x1B, 0x40 };
        public static readonly byte[] AlignLeft = new byte[] { 0x1B, 0x61, 0x00 };
        public static readonly byte[] AlignCenter = new byte[] { 0x1B, 0x61, 0x01 };
        public static readonly byte[] AlignRight = new byte[] { 0x1B, 0x61, 0x02 };
        public static readonly byte[] BoldOn = new byte[] { 0x1B, 0x45, 0x01 };
        public static readonly byte[] BoldOff = new byte[] { 0x1B, 0x45, 0x00 };
        public static readonly byte[] DoubleHeightWidth = new byte[] { 0x1D, 0x21, 0x11 };
        public static readonly byte[] NormalSize = new byte[] { 0x1D, 0x21, 0x00 };
        public static readonly byte[] CutPaper = new byte[] { 0x1D, 0x56, 0x42, 0x00 }; // Full cut with feed
        public static readonly byte[] OpenDrawer = new byte[] { 0x1B, 0x70, 0x00, 0x19, 0xFA }; // Pin 2 impulse
        public static readonly byte[] OpenCashDrawer = OpenDrawer;

        public static byte[] BuildSimpleReceipt(string text, bool cut = true, bool drawer = false)
        {
            using var ms = new MemoryStream();
            ms.Write(Initialize, 0, Initialize.Length);

            if (drawer)
            {
                ms.Write(OpenDrawer, 0, OpenDrawer.Length);
            }

            // UTF-8 or CP1258 encoding
            byte[] textBytes = Encoding.UTF8.GetBytes(text);
            ms.Write(textBytes, 0, textBytes.Length);

            // Feed 3 lines
            ms.Write(new byte[] { 0x1B, 0x64, 0x03 }, 0, 3);

            if (cut)
            {
                ms.Write(CutPaper, 0, CutPaper.Length);
            }

            return ms.ToArray();
        }
    }
}
