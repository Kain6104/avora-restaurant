using System;
using System.IO;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace AvoraPos.NativePrint
{
    public static class LanPrinterDispatcher
    {
        public static async Task<(bool Success, string? Error)> SendBytesTcpAsync(string ipAddress, int port, byte[] bytes, int timeoutMs = 3500)
        {
            if (string.IsNullOrWhiteSpace(ipAddress))
            {
                return (false, "Địa chỉ IP máy in không hợp lệ");
            }

            if (bytes == null || bytes.Length == 0)
            {
                return (false, "Dữ liệu in trống");
            }

            try
            {
                using var client = new TcpClient();
                var connectTask = client.ConnectAsync(ipAddress, port);
                if (await Task.WhenAny(connectTask, Task.Delay(timeoutMs)) != connectTask)
                {
                    return (false, $"Hết thời gian kết nối tới máy in mạng {ipAddress}:{port} ({timeoutMs}ms)");
                }

                await connectTask; // Propagate exception if failed

                using NetworkStream stream = client.GetStream();
                stream.WriteTimeout = timeoutMs;
                await stream.WriteAsync(bytes, 0, bytes.Length);
                await stream.FlushAsync();

                return (true, null);
            }
            catch (Exception ex)
            {
                return (false, $"Lỗi in mạng TCP: {ex.Message}");
            }
        }
    }
}
