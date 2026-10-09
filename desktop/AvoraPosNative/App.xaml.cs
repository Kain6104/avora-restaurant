using System;
using System.IO;
using System.Threading;
using System.Windows;
using AvoraPosNative.IPC;
using AvoraPosNative.Storage;
using Microsoft.Win32;

namespace AvoraPosNative
{
    public partial class App : Application
    {
        private const string MutexName = "AVORA_POS_NATIVE_SINGLE_INSTANCE";
        private Mutex? _mutex;
        private SingleInstancePipe? _pipeServer;
        private MainWindow? _mainWindow;

        public static void TraceLog(string msg)
        {
            try
            {
                string logDir = AppDataPaths.LogsDir;
                Directory.CreateDirectory(logDir);
                string logFile = Path.Combine(logDir, "trace.log");
                File.AppendAllText(logFile, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}] [PID {Environment.ProcessId}] {msg}\n");
            }
            catch { }
        }

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            TraceLog("App.OnStartup called");

            // 1. Global Exception Handling first so any early errors are caught and logged
            AppDomain.CurrentDomain.UnhandledException += (s, args) =>
            {
                TraceLog($"UnhandledException: {args.ExceptionObject}");
                LogUnhandledException(args.ExceptionObject as Exception);
            };

            DispatcherUnhandledException += (s, args) =>
            {
                TraceLog($"DispatcherUnhandledException: {args.Exception}");
                LogUnhandledException(args.Exception);

                // If it is an ApplicationException related to Mutex/Synchronization during shutdown, suppress it
                if (args.Exception is ApplicationException appEx && appEx.Message.Contains("synchronization", StringComparison.OrdinalIgnoreCase))
                {
                    args.Handled = true;
                    return;
                }

                if (_mainWindow == null || !_mainWindow.IsLoaded)
                {
                    // Fatal startup exception: notify user and shut down cleanly
                    try
                    {
                        MessageBox.Show(
                            $"Không thể khởi động AVORA POS Native:\n\n{args.Exception.Message}\n\nVui lòng kiểm tra nhật ký lỗi trong thư mục Logs.",
                            "Lỗi Khởi Động",
                            MessageBoxButton.OK,
                            MessageBoxImage.Error
                        );
                    }
                    catch { }
                    args.Handled = false;
                    Shutdown(-1);
                }
                else
                {
                    args.Handled = true; // Non-fatal UI error during runtime
                }
            };

            // 2. Single Instance check (Directive requirement: must NOT conflict with old hybrid app)
            bool createdNew;
            _mutex = new Mutex(true, MutexName, out createdNew);
            TraceLog($"Mutex check: createdNew={createdNew}");

            if (!createdNew)
            {
                // We do NOT own the mutex -> dispose and null out so OnExit never tries to call ReleaseMutex
                try { _mutex.Dispose(); } catch { }
                _mutex = null;

                // Another instance is already running -> send activation command to bring it to front
                string activationMsg = e.Args.Length > 0 ? e.Args[0] : "ACTIVATE";
                TraceLog($"Sending activationMsg={activationMsg} to existing instance and shutting down");
                SingleInstancePipe.SendArgsToExistingInstance(activationMsg);
                Shutdown();
                return;
            }

            // 3. Register Windows URI Scheme (avora-pos-native://)
            RegisterCustomUriScheme();

            // 4. Initialize SQLite DB for persistent print jobs and settings
            LocalDatabase.Initialize();
            TraceLog("LocalDatabase initialized");

            // 5. Start Named Pipe Server for deep links and activation
            _pipeServer = new SingleInstancePipe();
            _pipeServer.DeepLinkReceived += (msg) =>
            {
                Dispatcher.Invoke(() =>
                {
                    if (_mainWindow != null)
                    {
                        if (_mainWindow.WindowState == WindowState.Minimized)
                        {
                            _mainWindow.WindowState = WindowState.Maximized;
                        }
                        _mainWindow.Show();
                        _mainWindow.Activate();
                        _mainWindow.Focus();

                        if (msg.StartsWith("avora-pos-native://", StringComparison.OrdinalIgnoreCase))
                        {
                            _mainWindow.HandleDeepLink(msg);
                        }
                    }
                });
            };
            _pipeServer.StartServer();
            TraceLog("SingleInstancePipe server started");

            // 6. Launch Main Window
            TraceLog("Creating MainWindow...");
            _mainWindow = new MainWindow();
            _mainWindow.Show();
            TraceLog("MainWindow shown");

            // Check if launched with deep link in startup arguments
            if (e.Args.Length > 0 && e.Args[0].StartsWith("avora-pos-native://", StringComparison.OrdinalIgnoreCase))
            {
                _mainWindow.HandleDeepLink(e.Args[0]);
            }
        }

        private static void RegisterCustomUriScheme()
        {
            try
            {
                string exePath = Environment.ProcessPath ?? Path.Combine(AppContext.BaseDirectory, "AvoraPosNative.exe");
                using var key = Registry.CurrentUser.CreateSubKey(@"Software\Classes\avora-pos-native");
                key.SetValue(string.Empty, "URL:AVORA POS Native Protocol");
                key.SetValue("URL Protocol", string.Empty);

                using var defaultIcon = key.CreateSubKey("DefaultIcon");
                defaultIcon.SetValue(string.Empty, $"\"{exePath}\",0");

                using var commandKey = key.CreateSubKey(@"shell\open\command");
                commandKey.SetValue(string.Empty, $"\"{exePath}\" \"%1\"");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[URI REG] Failed to register URI scheme: {ex.Message}");
            }
        }

        private static void LogUnhandledException(Exception? ex)
        {
            if (ex == null) return;
            try
            {
                string logDir = AppDataPaths.LogsDir;
                string logFile = Path.Combine(logDir, $"crash_{DateTime.UtcNow:yyyyMMdd}.log");
                File.AppendAllText(logFile, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] {ex}\n\n");
            }
            catch { }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            TraceLog($"OnExit called. ExitCode={e.ApplicationExitCode}");
            try
            {
                _pipeServer?.Stop();
            }
            catch { }

            if (_mutex != null)
            {
                try
                {
                    _mutex.ReleaseMutex();
                }
                catch { }

                try
                {
                    _mutex.Dispose();
                }
                catch { }
                _mutex = null;
            }
            base.OnExit(e);
        }
    }
}
