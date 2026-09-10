using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows;
using AvoraPos.IPC;
using AvoraPos.NativePrint;
using Microsoft.Win32;

namespace AvoraPos
{
    public partial class App : Application
    {
        private static Mutex? _instanceMutex;
        private const string MutexName = "AVORA_POS_DESKTOP_SINGLE_INSTANCE_MUTEX";
        private static SingleInstancePipe? _pipeServer;
        public static string? InitialDeepLinkArg { get; private set; }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr FindWindow(string? lpClassName, string lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        private const int SW_RESTORE = 9;

        protected override void OnStartup(StartupEventArgs e)
        {
            // Auto register URI protocol in HKCU (Directive 11)
            RegisterCustomUriScheme();

            // CLI Hardware Test Arguments (Directives 12, 13)
            if (e.Args.Length > 0)
            {
                string arg = e.Args[0].ToLowerInvariant();
                var bridge = new PrintBridgeHost();

                if (arg == "--list-printers")
                {
                    Console.WriteLine(bridge.GetPrintersJson());
                    Shutdown(0);
                    return;
                }
                else if (arg == "--test-receipt")
                {
                    string target = e.Args.Length > 1 ? e.Args[1] : "XP-80C";
                    string result = bridge.TestPrint(target, "RECEIPT");
                    Console.WriteLine(result);
                    Shutdown(0);
                    return;
                }
                else if (arg == "--test-label")
                {
                    string target = e.Args.Length > 1 ? e.Args[1] : "Xprinter XP-350B";
                    string result = bridge.TestPrint(target, "LABEL");
                    Console.WriteLine(result);
                    Shutdown(0);
                    return;
                }
            }

            // Single Instance Mutex enforcement
            bool createdNew;
            _instanceMutex = new Mutex(true, MutexName, out createdNew);
            if (!createdNew)
            {
                // Relay argument to running instance via Named Pipe
                if (e.Args.Length > 0)
                {
                    SingleInstancePipe.SendArgsToExistingInstance(e.Args[0]);
                }

                // Focus existing instance
                IntPtr hWnd = FindWindow(null, "AVORA POS - Bán Hàng Nhà Hàng Thông Minh");
                if (hWnd == IntPtr.Zero)
                {
                    hWnd = FindWindow(null, "AVORA POS");
                }

                if (hWnd != IntPtr.Zero)
                {
                    ShowWindow(hWnd, SW_RESTORE);
                    SetForegroundWindow(hWnd);
                }

                Shutdown(0);
                return;
            }

            // Start named pipe server for subsequent instances / deep links
            _pipeServer = new SingleInstancePipe();
            _pipeServer.DeepLinkReceived += (arg) =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (MainWindow is MainWindow main)
                    {
                        main.HandleDeepLink(arg);
                        main.FocusAppWindow();
                    }
                });
            };
            _pipeServer.StartServer();

            if (e.Args.Length > 0 && e.Args[0].StartsWith("avora-pos://", StringComparison.OrdinalIgnoreCase))
            {
                InitialDeepLinkArg = e.Args[0];
            }

            // Initialize singleton engines
            _ = PersistentPrintQueueManager.Instance;

            base.OnStartup(e);
        }

        private static void RegisterCustomUriScheme()
        {
            try
            {
                string? exePath = Environment.ProcessPath;
                if (string.IsNullOrEmpty(exePath))
                {
                    exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
                }

                if (string.IsNullOrEmpty(exePath)) return;

                using var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\avora-pos");
                if (key != null)
                {
                    key.SetValue("", "URL:AVORA POS Protocol");
                    key.SetValue("URL Protocol", "");

                    using var iconKey = key.CreateSubKey("DefaultIcon");
                    iconKey?.SetValue("", $"\"{exePath}\",0");

                    using var cmdKey = key.CreateSubKey(@"shell\open\command");
                    cmdKey?.SetValue("", $"\"{exePath}\" \"%1\"");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to register URI scheme in registry: {ex.Message}");
            }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            try
            {
                _pipeServer?.Stop();
                PersistentPrintQueueManager.Instance.Stop();
                if (_instanceMutex != null)
                {
                    _instanceMutex.ReleaseMutex();
                    _instanceMutex.Dispose();
                }
            }
            catch
            {
                // Non-fatal
            }
            base.OnExit(e);
        }
    }
}
