using System;
using System.Collections.Generic;
using System.Drawing.Printing;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

namespace AvoraPosNative.Printing
{
    public class PrinterInfoModel
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string DriverName { get; set; } = string.Empty;
        public string PortName { get; set; } = string.Empty;
        public string Status { get; set; } = "ONLINE";
        public bool IsDefault { get; set; }
        public bool IsVirtual { get; set; }
    }

    public class InstalledPrinterInfo : PrinterInfoModel
    {
    }

    public static class WinSpoolNative
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDocName = string.Empty;

            [MarshalAs(UnmanagedType.LPStr)]
            public string? pOutputFile = null;

            [MarshalAs(UnmanagedType.LPStr)]
            public string pDataType = "RAW";
        }

        [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

        public static (bool Success, string? Error) SendRawBytes(string printerName, byte[] bytes, string docName = "AVORA POS NATIVE RAW")
        {
            if (string.IsNullOrWhiteSpace(printerName))
            {
                return (false, "Tên máy in không được để trống");
            }

            if (bytes == null || bytes.Length == 0)
            {
                return (false, "Dữ liệu in trống");
            }

            IntPtr hPrinter = IntPtr.Zero;
            var docInfo = new DOCINFOA
            {
                pDocName = docName,
                pDataType = "RAW"
            };

            try
            {
                if (!OpenPrinter(printerName.Normalize(), out hPrinter, IntPtr.Zero))
                {
                    int err = Marshal.GetLastWin32Error();
                    return (false, $"Không thể mở kết nối tới máy in '{printerName}'. Mã lỗi Win32: {err}");
                }

                if (StartDocPrinter(hPrinter, 1, docInfo) == 0)
                {
                    int err = Marshal.GetLastWin32Error();
                    return (false, $"Không thể bắt đầu lệnh in (StartDocPrinter). Mã lỗi Win32: {err}");
                }

                if (!StartPagePrinter(hPrinter))
                {
                    int err = Marshal.GetLastWin32Error();
                    EndDocPrinter(hPrinter);
                    return (false, $"Không thể tạo trang in (StartPagePrinter). Mã lỗi Win32: {err}");
                }

                IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);

                bool writeSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out int dwWritten);
                Marshal.FreeCoTaskMem(pUnmanagedBytes);

                EndPagePrinter(hPrinter);
                EndDocPrinter(hPrinter);

                if (!writeSuccess || dwWritten != bytes.Length)
                {
                    int err = Marshal.GetLastWin32Error();
                    return (false, $"Ghi dữ liệu máy in thất bại ({dwWritten}/{bytes.Length} bytes). Mã lỗi Win32: {err}");
                }

                return (true, null);
            }
            catch (Exception ex)
            {
                return (false, $"Ngoại lệ khi gửi lệnh in: {ex.Message}");
            }
            finally
            {
                if (hPrinter != IntPtr.Zero)
                {
                    ClosePrinter(hPrinter);
                }
            }
        }

        public static List<InstalledPrinterInfo> GetInstalledPrinters()
        {
            var result = new List<InstalledPrinterInfo>();
            string defaultPrinter = string.Empty;

            try
            {
                var printDoc = new PrintDocument();
                defaultPrinter = printDoc.PrinterSettings.PrinterName;
            }
            catch { }

            foreach (string printerName in PrinterSettings.InstalledPrinters)
            {
                bool isVirtual = Regex.IsMatch(printerName, @"(pdf|onenote|xps|fax|portprompt|nul:|anydesk|print to)", RegexOptions.IgnoreCase);
                string id = Regex.Replace(printerName.ToLowerInvariant(), @"[^a-z0-9]+", "_");

                result.Add(new InstalledPrinterInfo
                {
                    Id = id,
                    Name = printerName,
                    DriverName = printerName,
                    PortName = "USB001",
                    Status = "ONLINE",
                    IsDefault = string.Equals(printerName, defaultPrinter, StringComparison.OrdinalIgnoreCase),
                    IsVirtual = isVirtual
                });
            }

            return result;
        }
    }
}
