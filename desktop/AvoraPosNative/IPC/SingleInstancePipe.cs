using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace AvoraPosNative.IPC
{
    public class SingleInstancePipe
    {
        private const string PipeName = "AVORA_POS_NATIVE_DEEP_LINK_PIPE";
        private CancellationTokenSource? _cts;
        public event Action<string>? DeepLinkReceived;

        public void StartServer()
        {
            _cts = new CancellationTokenSource();
            Task.Run(() => ServerLoop(_cts.Token));
        }

        private async Task ServerLoop(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    using var server = new NamedPipeServerStream(
                        PipeName,
                        PipeDirection.In,
                        1,
                        PipeTransmissionMode.Byte,
                        PipeOptions.Asynchronous);

                    await server.WaitForConnectionAsync(cancellationToken);

                    using var reader = new StreamReader(server, Encoding.UTF8);
                    string? line = await reader.ReadLineAsync();

                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        DeepLinkReceived?.Invoke(line);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[IPC] Pipe server error: {ex.Message}");
                    await Task.Delay(500, cancellationToken);
                }
            }
        }

        public void Stop()
        {
            _cts?.Cancel();
            _cts?.Dispose();
        }

        public static bool SendArgsToExistingInstance(string arg)
        {
            try
            {
                using var client = new NamedPipeClientStream(".", PipeName, PipeDirection.Out);
                client.Connect(1500); // 1.5 second timeout

                using var writer = new StreamWriter(client, Encoding.UTF8) { AutoFlush = true };
                writer.WriteLine(arg);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[IPC] Failed to send args to existing instance: {ex.Message}");
                return false;
            }
        }
    }
}
