using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using AvoraPos.NativePrint;
using AvoraPos.Security;
using AvoraPos.Storage;
using Microsoft.Web.WebView2.Core;
using Newtonsoft.Json.Linq;

namespace AvoraPos
{
    public partial class MainWindow : Window
    {
        private readonly PrintBridgeHost _bridgeHost = new PrintBridgeHost();
        private static readonly HttpClient _httpClient = new HttpClient();
        private bool _isFullScreen = false;
        private bool _isCloseApproved = false;
        private bool _isExitDialogOpen = false;
        private string? _currentToken = null;
        private string? _currentUserId = null;
        private string? _currentUserName = null;
        private string? _currentUserEmail = null;
        private bool _isPasswordRevealed = false;
        private static string BackendUrl => Environment.GetEnvironmentVariable("AVORA_BACKEND_URL") ?? "http://127.0.0.1:3001";

        private static readonly Geometry EyeOpenGeometry =
            Geometry.Parse("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z");
        
        private static readonly Geometry EyeClosedGeometry =
            Geometry.Parse("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z");

        #region Win32 Monitor, Window, & HotKey APIs (Directives 11-16)
        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromWindow(IntPtr handle, uint flags);

        [DllImport("user32.dll")]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        private const uint MONITOR_DEFAULTTONEAREST = 0x00000002;
        private const int GWL_STYLE = -16;
        private const int WS_SYSMENU = 0x00080000;

        private const int HOTKEY_ID_ALTF4 = 9001;
        private const uint MOD_ALT = 0x0001;
        private const uint VK_F4 = 0x73;

        private const int WM_CLOSE = 0x0010;
        private const int WM_SYSCOMMAND = 0x0112;
        private const int SC_CLOSE = 0xF060;
        private const int WM_HOTKEY = 0x0312;

        private bool _isHotKeyRegistered = false;

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT
        {
            public int left;
            public int top;
            public int right;
            public int bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MONITORINFO
        {
            public uint cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }
        #endregion

        public MainWindow()
        {
            InitializeComponent();
            SourceInitialized += MainWindow_SourceInitialized;
            Loaded += MainWindow_Loaded;
            Activated += MainWindow_Activated;
            Deactivated += MainWindow_Deactivated;
            KeyDown += MainWindow_KeyDown;
            PreviewKeyDown += MainWindow_KeyDown;
            Closing += MainWindow_Closing;
            Closed += MainWindow_Closed;
        }

        private void MainWindow_SourceInitialized(object? sender, EventArgs e)
        {
            var helper = new WindowInteropHelper(this);
            IntPtr hwnd = helper.Handle;
            if (hwnd != IntPtr.Zero)
            {
                var source = HwndSource.FromHwnd(hwnd);
                source?.AddHook(HwndMessageHook);

                // Restore WS_SYSMENU so Windows treats Alt+F4 as standard system command
                EnsureSystemMenu();

                // Register OS-level Alt+F4 hotkey for this application
                RegisterAltF4HotKey();
            }
        }

        private void MainWindow_Activated(object? sender, EventArgs e)
        {
            RegisterAltF4HotKey();
        }

        private void MainWindow_Deactivated(object? sender, EventArgs e)
        {
            // Only unregister if the exit dialog is not currently displayed
            if (!_isExitDialogOpen)
            {
                UnregisterAltF4HotKey();
            }
        }

        private void MainWindow_Closed(object? sender, EventArgs e)
        {
            UnregisterAltF4HotKey();
        }

        private IntPtr HwndMessageHook(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            // 1. Intercept Win32 OS-level HotKey (Alt + F4)
            if (msg == WM_HOTKEY && wParam.ToInt32() == HOTKEY_ID_ALTF4)
            {
                Debug.WriteLine("[HOTKEY] Intercepted WM_HOTKEY Alt+F4 via HwndSource hook");
                handled = true;
                Dispatcher.InvokeAsync(() => RequestSafeExit());
                return IntPtr.Zero;
            }

            // 2. Intercept WM_SYSCOMMAND SC_CLOSE
            if (msg == WM_SYSCOMMAND && (wParam.ToInt32() & 0xFFF0) == SC_CLOSE)
            {
                Debug.WriteLine("[WIN32] Intercepted WM_SYSCOMMAND SC_CLOSE");
                if (!_isCloseApproved)
                {
                    handled = true;
                    Dispatcher.InvokeAsync(() => RequestSafeExit());
                    return IntPtr.Zero;
                }
            }

            // 3. Intercept WM_CLOSE
            if (msg == WM_CLOSE)
            {
                Debug.WriteLine("[WIN32] Intercepted WM_CLOSE");
                if (!_isCloseApproved)
                {
                    handled = true;
                    Dispatcher.InvokeAsync(() => RequestSafeExit());
                    return IntPtr.Zero;
                }
            }

            return IntPtr.Zero;
        }

        private void RegisterAltF4HotKey()
        {
            if (_isHotKeyRegistered) return;
            try
            {
                var helper = new WindowInteropHelper(this);
                if (helper.Handle != IntPtr.Zero)
                {
                    if (RegisterHotKey(helper.Handle, HOTKEY_ID_ALTF4, MOD_ALT, VK_F4))
                    {
                        _isHotKeyRegistered = true;
                        Debug.WriteLine("[HOTKEY] Registered Alt+F4 hotkey successfully.");
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[HOTKEY] RegisterAltF4HotKey exception: {ex.Message}");
            }
        }

        private void UnregisterAltF4HotKey()
        {
            if (!_isHotKeyRegistered) return;
            try
            {
                var helper = new WindowInteropHelper(this);
                if (helper.Handle != IntPtr.Zero)
                {
                    UnregisterHotKey(helper.Handle, HOTKEY_ID_ALTF4);
                    _isHotKeyRegistered = false;
                    Debug.WriteLine("[HOTKEY] Unregistered Alt+F4 hotkey.");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[HOTKEY] UnregisterAltF4HotKey exception: {ex.Message}");
            }
        }

        private void EnsureSystemMenu()
        {
            try
            {
                var helper = new WindowInteropHelper(this);
                if (helper.Handle != IntPtr.Zero)
                {
                    int currentStyle = GetWindowLong(helper.Handle, GWL_STYLE);
                    SetWindowLong(helper.Handle, GWL_STYLE, currentStyle | WS_SYSMENU);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[WIN32] EnsureSystemMenu error: {ex.Message}");
            }
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            // Enter Kiosk Fullscreen covering physical monitor (no taskbar, no title bar)
            EnterKioskFullscreen();

            // Hook WebView2 control keyboard events as well
            posWebView.PreviewKeyDown += MainWindow_KeyDown;
            posWebView.KeyDown += MainWindow_KeyDown;

            // Register exit handler callback from bridge if POS menu calls it (already confirmed via UI modal)
            _bridgeHost.SetExitRequestedCallback(() =>
            {
                Dispatcher.InvokeAsync(() =>
                {
                    _isCloseApproved = true;
                    Close();
                    Application.Current.Shutdown();
                });
            });

            // Register logout callback from bridge when POS clicks "Đăng xuất"
            _bridgeHost.SetLogoutRequestedCallback(() =>
            {
                Dispatcher.InvokeAsync(async () => await PerformDesktopLogoutAsync());
            });

            // Initialize app state
            await InitializeAppStateAsync();
        }

        #region True Fullscreen & Window Management
        public void EnterKioskFullscreen()
        {
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Topmost = false;
            EnsureSystemMenu();

            try
            {
                var handle = new WindowInteropHelper(this).EnsureHandle();
                var hMonitor = MonitorFromWindow(handle, MONITOR_DEFAULTTONEAREST);
                if (hMonitor != IntPtr.Zero)
                {
                    MONITORINFO mi = new MONITORINFO();
                    mi.cbSize = (uint)Marshal.SizeOf(mi);
                    if (GetMonitorInfo(hMonitor, ref mi))
                    {
                        var source = PresentationSource.FromVisual(this);
                        double dpiX = source?.CompositionTarget?.TransformToDevice.M11 ?? 1.0;
                        double dpiY = source?.CompositionTarget?.TransformToDevice.M22 ?? 1.0;

                        WindowState = WindowState.Normal;
                        Left = mi.rcMonitor.left / dpiX;
                        Top = mi.rcMonitor.top / dpiY;
                        Width = (mi.rcMonitor.right - mi.rcMonitor.left) / dpiX;
                        Height = (mi.rcMonitor.bottom - mi.rcMonitor.top) / dpiY;
                        _isFullScreen = true;
                        return;
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error applying monitor bounds: {ex.Message}");
            }

            // Fallback
            WindowState = WindowState.Maximized;
            _isFullScreen = true;
        }

        public void EnterWindowedDebugMode()
        {
            WindowStyle = WindowStyle.SingleBorderWindow;
            ResizeMode = ResizeMode.CanResize;
            WindowState = WindowState.Normal;
            Width = 1280;
            Height = 800;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            _isFullScreen = false;
            EnsureSystemMenu();
        }

        private void ToggleFullScreen()
        {
            if (!_isFullScreen)
            {
                EnterKioskFullscreen();
            }
            else
            {
                EnterWindowedDebugMode();
            }
        }

        public void FocusAppWindow()
        {
            try
            {
                var handle = new WindowInteropHelper(this).Handle;
                if (handle != IntPtr.Zero)
                {
                    SetForegroundWindow(handle);
                }
                Activate();
            }
            catch
            {
                // Non-fatal
            }
        }
        #endregion

        #region Alt+F4 Safe Exit Dialog via Dedicated WPF Window (Directives 11-16)
        private void MainWindow_Closing(object? sender, CancelEventArgs e)
        {
            if (_isCloseApproved)
                return;

            e.Cancel = true;
            RequestSafeExit();
        }

        public void RequestSafeExit()
        {
            if (_isCloseApproved || _isExitDialogOpen)
                return;

            _isExitDialogOpen = true;

            try
            {
                // Temporarily unregister hotkey while dialog is active so Alt+F4 doesn't trigger recursively
                UnregisterAltF4HotKey();

                // Check if there are active printing jobs or unsafe states
                bool hasActiveJobs = PersistentPrintQueueManager.Instance.HasActiveJobs();

                var exitDialog = new AvoraExitDialog(hasActiveJobs)
                {
                    Owner = this
                };

                bool? result = exitDialog.ShowDialog();
                if (result == true)
                {
                    _isCloseApproved = true;
                    Close();
                }
                else
                {
                    // User cancelled: restore hotkey if window is still active
                    if (IsActive)
                    {
                        RegisterAltF4HotKey();
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error showing exit dialog: {ex.Message}");
            }
            finally
            {
                _isExitDialogOpen = false;
            }
        }
        #endregion

        #region App State Initialization & Native Logout
        private async Task InitializeAppStateAsync()
        {
            txtSplashStatus.Text = "Đang kiểm tra phiên đăng nhập AVORA POS...";

            // Check if launched with initial deep link argument
            if (!string.IsNullOrEmpty(App.InitialDeepLinkArg))
            {
                await HandleDeepLinkAsync(App.InitialDeepLinkArg);
                return;
            }

            // Check stored DPAPI session
            var storedSession = SecureSessionManager.LoadSession();
            if (storedSession != null && !string.IsNullOrWhiteSpace(storedSession.Token))
            {
                Debug.WriteLine("[AUTH] Stored session found, validating profile...");
                bool isValid = await ValidateAndApplySessionAsync(storedSession.Token);
                if (isValid)
                {
                    return; // Transitioned to POS
                }
            }

            // No valid session: Show Native Login
            ShowNativeLogin();
        }

        public async Task PerformDesktopLogoutAsync()
        {
            Debug.WriteLine("[AUTH] DESKTOP_LOGOUT initiated");
            _currentToken = null;
            _currentUserId = null;
            _currentUserName = null;
            _currentUserEmail = null;

            // 1. INSTANTLY transition UI to Native Login (Collapsed hides Win32 HWND immediately)
            posWebViewGrid.Visibility = Visibility.Collapsed;
            splashOverlay.Visibility = Visibility.Collapsed;
            nativeLoginOverlay.Visibility = Visibility.Visible;

            // 2. Clear local DPAPI stored credentials
            SecureSessionManager.ClearSession();

            // 3. Clear WebView2 cookies & navigate away from POS safely
            if (posWebView.CoreWebView2 != null)
            {
                try
                {
                    posWebView.CoreWebView2.CookieManager.DeleteAllCookies();
                    posWebView.CoreWebView2.Navigate("about:blank");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Error clearing WebView2 session: {ex.Message}");
                }
            }

            // 4. Reset Native Login form
            txtPassword.Password = "";
            txtPasswordVisible.Text = "";
            txtPasswordVisible.Visibility = Visibility.Collapsed;
            txtPassword.Visibility = Visibility.Visible;
            _isPasswordRevealed = false;
            pathEyeIcon.Data = EyeOpenGeometry;

            // Tự động render lại Email / Username đã đăng nhập trước đó
            if (string.IsNullOrWhiteSpace(txtEmail.Text))
            {
                txtEmail.Text = SecureSessionManager.GetLastIdentifier() ?? "";
            }

            loginErrorBanner.Visibility = Visibility.Collapsed;
            loginProgress.Visibility = Visibility.Collapsed;
            btnLogin.IsEnabled = true;
            btnLogin.Content = "ĐĂNG NHẬP";
            btnGoogleLogin.IsEnabled = true;

            if (!string.IsNullOrWhiteSpace(txtEmail.Text))
            {
                txtPassword.Focus();
            }
            else
            {
                txtEmail.Focus();
            }

            await CheckServerConnectionAsync();
        }

        private void BtnExitApp_Click(object sender, RoutedEventArgs e)
        {
            RequestSafeExit();
        }

        private void ShowNativeLogin(string? errorMessage = null)
        {
            splashOverlay.Visibility = Visibility.Collapsed;
            posWebViewGrid.Visibility = Visibility.Hidden;
            nativeLoginOverlay.Visibility = Visibility.Visible;

            if (string.IsNullOrWhiteSpace(txtEmail.Text))
            {
                txtEmail.Text = SecureSessionManager.GetLastIdentifier() ?? "";
            }

            if (!string.IsNullOrEmpty(errorMessage))
            {
                txtErrorMessage.Text = errorMessage;
                loginErrorBanner.Visibility = Visibility.Visible;
            }
            else
            {
                loginErrorBanner.Visibility = Visibility.Collapsed;
            }

            if (!string.IsNullOrWhiteSpace(txtEmail.Text))
            {
                txtPassword.Focus();
            }
            else
            {
                txtEmail.Focus();
            }
            _ = CheckServerConnectionAsync();
        }

        private async Task CheckServerConnectionAsync()
        {
            try
            {
                string apiUrl = Environment.GetEnvironmentVariable("AVORA_BACKEND_URL") ?? "http://127.0.0.1:3001";
                var res = await _httpClient.GetAsync($"{apiUrl}/api/health");
                if (res.IsSuccessStatusCode)
                {
                    dotStatus.Fill = new SolidColorBrush(Color.FromRgb(16, 185, 129)); // #10B981
                    txtServerStatus.Text = "Máy chủ: Đã kết nối";
                    return;
                }
            }
            catch { }

            try
            {
                var res = await _httpClient.GetAsync("http://localhost:3001/api/health");
                if (res.IsSuccessStatusCode)
                {
                    dotStatus.Fill = new SolidColorBrush(Color.FromRgb(16, 185, 129)); // #10B981
                    txtServerStatus.Text = "Máy chủ: Đã kết nối";
                    return;
                }
            }
            catch { }

            dotStatus.Fill = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // #EF4444
            txtServerStatus.Text = "Không thể kết nối máy chủ";
        }
        #endregion

        #region Native Login Email / Password Flow
        private async void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            string email = txtEmail.Text.Trim();
            string password = _isPasswordRevealed ? txtPasswordVisible.Text : txtPassword.Password;

            if (string.IsNullOrWhiteSpace(email))
            {
                ShowLoginError("Vui lòng nhập tài khoản email hoặc số điện thoại.");
                txtEmail.Focus();
                return;
            }

            // Ghi nhớ tài khoản để lần sau mở lại tự điền
            SecureSessionManager.SaveLastIdentifier(email);

            if (string.IsNullOrWhiteSpace(password))
            {
                ShowLoginError("Vui lòng nhập mật khẩu.");
                if (_isPasswordRevealed) txtPasswordVisible.Focus(); else txtPassword.Focus();
                return;
            }

            loginErrorBanner.Visibility = Visibility.Collapsed;
            loginProgress.Visibility = Visibility.Visible;
            btnLogin.IsEnabled = false;
            btnLogin.Content = "Đang đăng nhập...";
            btnGoogleLogin.IsEnabled = false;

            Debug.WriteLine("[AUTH] LOGIN_REQUEST_STARTED for user: " + email);

            try
            {
                var payload = new JObject
                {
                    ["email"] = email,
                    ["password"] = password
                };

                var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{BackendUrl}/api/auth/desktop/login", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[AUTH] AUTH_ERROR: HTTP {response.StatusCode} - {responseBody}");
                    string errorMsg = "Email hoặc mật khẩu không chính xác.";

                    try
                    {
                        var errJson = JObject.Parse(responseBody);
                        string? msg = errJson["message"]?.ToString();
                        if (!string.IsNullOrEmpty(msg))
                        {
                            if (msg.Contains("khóa", StringComparison.OrdinalIgnoreCase))
                                errorMsg = "Tài khoản đã bị khóa.";
                            else if (msg.Contains("xác thực", StringComparison.OrdinalIgnoreCase))
                                errorMsg = "Tài khoản chưa được xác thực email.";
                            else
                                errorMsg = msg;
                        }
                    }
                    catch { }

                    ShowLoginError(errorMsg);
                    return;
                }

                Debug.WriteLine("[AUTH] LOGIN_REQUEST_SUCCESS");
                var resultJson = JObject.Parse(responseBody);
                string? token = resultJson["access_token"]?.ToString();

                if (string.IsNullOrEmpty(token))
                {
                    ShowLoginError("Không nhận được token xác thực từ máy chủ.");
                    return;
                }

                Debug.WriteLine("[AUTH] TOKEN_RECEIVED");

                // Validate profile, status, and POS access
                bool valid = await ValidateAndApplySessionAsync(token);
                if (!valid)
                {
                    // Error message already shown by ValidateAndApplySessionAsync
                    return;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] AUTH_ERROR exception: {ex.Message}");
                ShowLoginError($"Lỗi kết nối máy chủ: {ex.Message}");
            }
            finally
            {
                loginProgress.Visibility = Visibility.Collapsed;
                btnLogin.IsEnabled = true;
                btnLogin.Content = "ĐĂNG NHẬP";
                btnGoogleLogin.IsEnabled = true;
            }
        }

        private void ShowLoginError(string message)
        {
            txtErrorMessage.Text = message;
            loginErrorBanner.Visibility = Visibility.Visible;
        }

        private void BtnTogglePassword_Click(object sender, RoutedEventArgs e)
        {
            if (!_isPasswordRevealed)
            {
                txtPasswordVisible.Text = txtPassword.Password;
                txtPassword.Visibility = Visibility.Collapsed;
                txtPasswordVisible.Visibility = Visibility.Visible;
                pathEyeIcon.Data = EyeClosedGeometry;
                _isPasswordRevealed = true;
                txtPasswordVisible.Focus();
                txtPasswordVisible.CaretIndex = txtPasswordVisible.Text.Length;
            }
            else
            {
                txtPassword.Password = txtPasswordVisible.Text;
                txtPasswordVisible.Visibility = Visibility.Collapsed;
                txtPassword.Visibility = Visibility.Visible;
                pathEyeIcon.Data = EyeOpenGeometry;
                _isPasswordRevealed = false;
                txtPassword.Focus();
            }
        }

        private void TxtInput_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                BtnLogin_Click(sender, e);
            }
        }
        #endregion

        #region Google Login External Browser & Deep Link
        private void BtnGoogleLogin_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                string googleAuthUrl = $"{BackendUrl}/api/auth/google?isDesktop=true&redirectURL=avora-pos://auth/callback";

                Debug.WriteLine("[AUTH] Opening Google OAuth in system browser...");
                txtGoogleStatus.Visibility = Visibility.Visible;

                Process.Start(new ProcessStartInfo
                {
                    FileName = googleAuthUrl,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] Failed to launch browser: {ex.Message}");
                ShowLoginError($"Không thể mở trình duyệt: {ex.Message}");
            }
        }

        public async void HandleDeepLink(string uriString)
        {
            Debug.WriteLine($"[AUTH] DeepLink received: {uriString}");
            await HandleDeepLinkAsync(uriString);
        }

        private async Task HandleDeepLinkAsync(string uriString)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(uriString))
                {
                    ShowNativeLogin("Đường dẫn liên kết không được để trống.");
                    return;
                }

                if (!Uri.TryCreate(uriString, UriKind.Absolute, out var uri))
                {
                    ShowNativeLogin("Đường dẫn liên kết không hợp lệ.");
                    return;
                }

                string host = uri.Host.ToLowerInvariant();
                string path = uri.AbsolutePath.ToLowerInvariant();

                // 1. One-time SSO Launch Code: avora-pos://open?code=XYZ
                if (host == "open" || path == "/open" || path.StartsWith("/open/"))
                {
                    var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
                    string? code = query["code"];
                    if (string.IsNullOrWhiteSpace(code))
                    {
                        ShowNativeLogin("Không tìm thấy mã đăng nhập SSO trong liên kết.");
                        return;
                    }
                    await ProcessSsoLaunchCodeAsync(code);
                    return;
                }

                // 2. Google OAuth callback: avora-pos://auth/google/callback?code=XYZ
                if (host == "auth" || path.Contains("google"))
                {
                    await ProcessGoogleCallbackAsync(uriString);
                    return;
                }

                // 3. Fallback: Query contains 'code'
                var fallbackQuery = System.Web.HttpUtility.ParseQueryString(uri.Query);
                string? fallbackCode = fallbackQuery["code"];
                if (!string.IsNullOrWhiteSpace(fallbackCode))
                {
                    await ProcessSsoLaunchCodeAsync(fallbackCode);
                    return;
                }

                ShowNativeLogin("Không nhận diện được tác vụ từ liên kết.");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] Error handling deep link: {ex.Message}");
                ShowNativeLogin($"Lỗi xử lý liên kết: {ex.Message}");
            }
        }

        private async Task ProcessSsoLaunchCodeAsync(string code)
        {
            splashOverlay.Visibility = Visibility.Visible;
            txtSplashStatus.Text = "Đang đồng bộ phiên làm việc từ Web vào AVORA POS...";
            nativeLoginOverlay.Visibility = Visibility.Collapsed;

            try
            {
                var payload = new JObject
                {
                    ["code"] = code.Trim(),
                    ["deviceId"] = Storage.DeviceIdentifier.GetHardwareFingerprint(),
                    ["appVersion"] = "1.0.1"
                };

                var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{BackendUrl}/api/auth/desktop/exchange-launch-code", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[AUTH] exchange-launch-code failed: {response.StatusCode} - {responseBody}");
                    string errorMessage = "Liên kết đăng nhập đã hết hạn. Vui lòng thử mở lại AVORA POS từ trang web.";

                    try
                    {
                        var errJson = JObject.Parse(responseBody);
                        string? codeErr = errJson["code"]?.ToString();
                        string? msg = errJson["message"]?.ToString();

                        if (codeErr == "DESKTOP_SSO_CODE_EXPIRED")
                        {
                            errorMessage = "Liên kết đăng nhập đã hết hạn (quá 60 giây). Vui lòng thử mở lại từ trang web.";
                        }
                        else if (codeErr == "DESKTOP_SSO_CODE_ALREADY_USED")
                        {
                            errorMessage = "Mã xác thực đăng nhập này đã được sử dụng trước đó.";
                        }
                        else if (!string.IsNullOrEmpty(msg))
                        {
                            errorMessage = msg;
                        }
                    }
                    catch { }

                    ShowNativeLogin(errorMessage);
                    return;
                }

                var result = JObject.Parse(responseBody);
                string? newToken = result["access_token"]?.ToString();
                var incomingUser = result["user"] as JObject;

                if (string.IsNullOrEmpty(newToken) || incomingUser == null)
                {
                    ShowNativeLogin("Không nhận được dữ liệu phiên làm việc từ máy chủ.");
                    return;
                }

                string incomingUserId = incomingUser["id"]?.ToString() ?? "";
                string incomingUserName = incomingUser["fullName"]?.ToString() ?? incomingUser["email"]?.ToString() ?? "Người dùng Web";
                string incomingUserEmail = incomingUser["email"]?.ToString() ?? "";

                // Case 1: Desktop is already logged in with another user
                bool isDesktopAlreadyLoggedIn = !string.IsNullOrEmpty(_currentToken) && posWebViewGrid.Visibility == Visibility.Visible;
                bool isDifferentUser = isDesktopAlreadyLoggedIn && !string.IsNullOrEmpty(_currentUserId) && _currentUserId != incomingUserId;

                if (isDifferentUser)
                {
                    splashOverlay.Visibility = Visibility.Collapsed;
                    posWebViewGrid.Visibility = Visibility.Visible;

                    var switchDialog = new AvoraUserSwitchDialog(
                        _currentUserName ?? "Tài khoản hiện tại",
                        _currentUserEmail ?? "",
                        incomingUserName,
                        incomingUserEmail
                    )
                    {
                        Owner = this
                    };

                    bool? switchApproved = switchDialog.ShowDialog();
                    if (switchApproved != true)
                    {
                        // Keep current user B, ignore switch request
                        FocusAppWindow();
                        return;
                    }

                    // User approved switch: Perform safe logout of user B and switch to A
                    await PerformDesktopLogoutAsync();
                }

                // Case 2: Desktop is already logged in with SAME user
                if (isDesktopAlreadyLoggedIn && _currentUserId == incomingUserId)
                {
                    splashOverlay.Visibility = Visibility.Collapsed;
                    posWebViewGrid.Visibility = Visibility.Visible;
                    FocusAppWindow();
                    return;
                }

                // Case 3: Apply new session for User A
                bool valid = await ValidateAndApplySessionAsync(newToken);
                if (valid)
                {
                    FocusAppWindow();
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] Exception in ProcessSsoLaunchCodeAsync: {ex.Message}");
                ShowNativeLogin($"Lỗi xác thực đăng nhập tự động: {ex.Message}");
            }
        }

        private async Task ProcessGoogleCallbackAsync(string callbackUri)
        {
            try
            {
                txtGoogleStatus.Visibility = Visibility.Collapsed;

                if (!Uri.TryCreate(callbackUri, UriKind.Absolute, out var uri))
                {
                    ShowLoginError("URI callback không hợp lệ.");
                    return;
                }

                // Extract query parameter "code"
                var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
                string? code = queryParams["code"];

                if (string.IsNullOrEmpty(code))
                {
                    ShowLoginError("Không tìm thấy mã xác thực Google.");
                    return;
                }

                splashOverlay.Visibility = Visibility.Visible;
                txtSplashStatus.Text = "Đang xác thực tài khoản Google từ trình duyệt...";
                nativeLoginOverlay.Visibility = Visibility.Collapsed;

                Debug.WriteLine("[AUTH] Exchanging one-time authorization code with backend...");
                var payload = new JObject { ["code"] = code };
                var content = new StringContent(payload.ToString(), Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{BackendUrl}/api/auth/desktop/exchange-code", content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[AUTH] exchange-code failed: {responseBody}");
                    ShowNativeLogin("Mã xác thực Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.");
                    return;
                }

                var result = JObject.Parse(responseBody);
                string? token = result["access_token"]?.ToString();

                if (string.IsNullOrEmpty(token))
                {
                    ShowNativeLogin("Không nhận được token từ máy chủ.");
                    return;
                }

                Debug.WriteLine("[AUTH] TOKEN_RECEIVED via Google exchange");
                bool valid = await ValidateAndApplySessionAsync(token);
                if (!valid)
                {
                    // ValidateAndApplySessionAsync showed error
                    return;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] Error processing Google callback: {ex.Message}");
                ShowNativeLogin($"Lỗi xác thực Google: {ex.Message}");
            }
        }
        #endregion

        #region Session Validation & WebView Launch
        private async Task<bool> ValidateAndApplySessionAsync(string token)
        {
            try
            {
                Debug.WriteLine("[AUTH] PROFILE_FETCH_STARTED");
                using var request = new HttpRequestMessage(HttpMethod.Get, $"{BackendUrl}/api/auth/me");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(request);
                string body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Debug.WriteLine($"[AUTH] PROFILE_FETCH failed: HTTP {response.StatusCode}");
                    SecureSessionManager.ClearSession();
                    ShowNativeLogin("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
                    return false;
                }

                Debug.WriteLine("[AUTH] PROFILE_FETCH_SUCCESS");
                var profile = JObject.Parse(body);
                _currentUserId = profile["id"]?.ToString();
                _currentUserName = profile["fullName"]?.ToString() ?? profile["email"]?.ToString() ?? "Người dùng";
                _currentUserEmail = profile["email"]?.ToString() ?? "";

                // 1. Account locked check
                bool isLocked = profile["isAccountLocked"]?.Value<bool>() ?? false;
                if (isLocked)
                {
                    Debug.WriteLine("[AUTH] Account is locked!");
                    SecureSessionManager.ClearSession();
                    ShowNativeLogin("Tài khoản đã bị khóa.");
                    return false;
                }

                // 2. POS Access check (RBAC)
                string? role = profile["role"]?.ToString();
                var permissions = profile["permissions"] as JArray;
                bool hasPosAccess = role == "ADMIN";

                if (!hasPosAccess && permissions != null)
                {
                    foreach (var p in permissions)
                    {
                        if (p.ToString() == "pos.access")
                        {
                            hasPosAccess = true;
                            break;
                        }
                    }
                }

                if (!hasPosAccess)
                {
                    Debug.WriteLine("[AUTH] POS_ACCESS_CHECK: DENIED");
                    SecureSessionManager.ClearSession();
                    ShowNativeLogin("Bạn không có quyền truy cập AVORA POS.");
                    return false;
                }
                Debug.WriteLine("[AUTH] POS_ACCESS_CHECK: GRANTED");

                // 3. Branch access check
                var allBranches = profile["allBranches"] as JArray;
                string? branchId = profile["branchId"]?.ToString();
                bool hasBranch = (allBranches != null && allBranches.Count > 0) || !string.IsNullOrEmpty(branchId) || role == "ADMIN";

                if (!hasBranch)
                {
                    Debug.WriteLine("[AUTH] BRANCH_ACCESS_CHECK: DENIED");
                    SecureSessionManager.ClearSession();
                    ShowNativeLogin("Bạn chưa được phân quyền tại chi nhánh nào.");
                    return false;
                }
                Debug.WriteLine("[AUTH] BRANCH_ACCESS_CHECK: OK");

                // Store valid session securely
                _currentToken = token;
                SecureSessionManager.SaveSession(token, body);
                if (!string.IsNullOrWhiteSpace(_currentUserEmail))
                {
                    SecureSessionManager.SaveLastIdentifier(_currentUserEmail);
                }
                Debug.WriteLine("[AUTH] TOKEN_STORED with DPAPI");

                // Initialize WebView2 & Inject Session
                await LaunchPosWebViewAsync(token);
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] Validation error: {ex.Message}");
                SecureSessionManager.ClearSession();
                ShowNativeLogin($"Lỗi kiểm tra quyền: {ex.Message}");
                return false;
            }
        }

        private async Task LaunchPosWebViewAsync(string token)
        {
            Debug.WriteLine("[AUTH] WEBVIEW_AUTH_INJECTION started");
            txtSplashStatus.Text = "Đang đồng bộ phiên bảo mật & khởi động POS...";
            splashOverlay.Visibility = Visibility.Visible;
            nativeLoginOverlay.Visibility = Visibility.Collapsed;

            try
            {
                // Ensure CoreWebView2 initialized
                if (posWebView.CoreWebView2 == null)
                {
                    string userDataFolder = AppDataPaths.WebView2DataDir;
                    var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder, new CoreWebView2EnvironmentOptions());
                    await posWebView.EnsureCoreWebView2Async(env);

                    // WebView2 Security Settings
                    if (posWebView.CoreWebView2?.Settings != null)
                    {
                        posWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                        posWebView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                        posWebView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                        posWebView.CoreWebView2.Settings.IsZoomControlEnabled = true;
                    }

                    // Add PrintBridgeHost
                    posWebView.CoreWebView2!.AddHostObjectToScript("nativePrintService", _bridgeHost);

                    // WebMessageReceived: Bulletproof channel for exit, logout, open external browser
                    posWebView.CoreWebView2.WebMessageReceived += (s, args) =>
                    {
                        try
                        {
                            string msg = string.Empty;
                            try { msg = args.TryGetWebMessageAsString(); } catch { }
                            if (string.IsNullOrEmpty(msg))
                            {
                                try { msg = args.WebMessageAsJson; } catch { }
                            }

                            if (msg.Contains("EXIT_APP", StringComparison.OrdinalIgnoreCase))
                            {
                                Dispatcher.InvokeAsync(() =>
                                {
                                    _isCloseApproved = true;
                                    Close();
                                    Application.Current.Shutdown();
                                });
                            }
                            else if (msg.Contains("LOGOUT", StringComparison.OrdinalIgnoreCase))
                            {
                                Dispatcher.InvokeAsync(async () => await PerformDesktopLogoutAsync());
                            }
                            else if (msg.Contains("OPEN_EXTERNAL", StringComparison.OrdinalIgnoreCase))
                            {
                                try
                                {
                                    var parsed = JObject.Parse(msg);
                                    string? targetUrl = parsed["url"]?.ToString();
                                    if (!string.IsNullOrEmpty(targetUrl))
                                    {
                                        OpenInDefaultBrowser(targetUrl);
                                    }
                                }
                                catch { }
                            }
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine($"[WebMessageReceived] Error: {ex.Message}");
                        }
                    };

                    // Add desktop indicators, shortcut locks, and client-side route interception script
                    await posWebView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                        window.IS_AVORA_DESKTOP = true;
                        window.AVORA_DESKTOP_VERSION = '1.0.1';
                        window.AVORA_DESKTOP_BUILD = '101';
                        console.log('AVORA POS 1.0.1 Connected.');

                        // Global Exit App helper for Web code
                        window.AVORA_EXIT_APP = function() {
                            try {
                                if (window.chrome && window.chrome.webview) {
                                    window.chrome.webview.postMessage({ type: 'EXIT_APP' });
                                }
                            } catch(e) {}
                            try {
                                if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects && window.chrome.webview.hostObjects.nativePrintService) {
                                    window.chrome.webview.hostObjects.nativePrintService.RequestAppExit();
                                }
                            } catch(e) {}
                        };

                        (function() {
                            function checkAdminOrExternalNav(targetUrl) {
                                if (!targetUrl) return false;
                                try {
                                    var resolved = new URL(targetUrl, window.location.href);
                                    var path = resolved.pathname.toLowerCase();

                                    // 1. Allowed internal POS routes: ONLY /admin/pos and /admin/pos/*
                                    if (path === '/admin/pos' || path.startsWith('/admin/pos/')) {
                                        return false; // allow internal POS navigation
                                    }

                                    // 2. /login: MUST trigger desktop native logout
                                    if (path === '/login' || path.startsWith('/login/')) {
                                        console.log('[GUARD] Intercepting /login route in JS');
                                        if (window.chrome && window.chrome.webview) {
                                            window.chrome.webview.postMessage({ type: 'LOGOUT' });
                                        }
                                        return true; // prevent client navigation
                                    }

                                    // 3. ALL OTHER ROUTES (Customer routes: /orders/*, /tin-tuc-va-uu-dai/*, /, /menu, Admin routes: /admin/dashboard, external hosts)
                                    // MUST OPEN IN WINDOWS DEFAULT BROWSER!
                                    console.log('[GUARD] Intercepting non-POS route in JS, opening in external browser:', resolved.href);
                                    if (window.chrome && window.chrome.webview) {
                                        window.chrome.webview.postMessage({ type: 'OPEN_EXTERNAL', url: resolved.href });
                                    }
                                    if (window.chrome && window.chrome.webview && window.chrome.webview.hostObjects && window.chrome.webview.hostObjects.nativePrintService) {
                                        try { window.chrome.webview.hostObjects.nativePrintService.OpenExternalBrowser(resolved.href); } catch(e) {}
                                    }
                                    return true; // prevent client navigation inside POS Desktop
                                } catch(e) {
                                    console.error('[GUARD] Error parsing target URL:', e);
                                }
                                return false;
                            }

                            // Next.js Router safe interception: BLOCK non-POS routes from changing client URL
                            var origPush = history.pushState;
                            history.pushState = function(state, title, url) {
                                if (url && checkAdminOrExternalNav(url)) {
                                    return; // BLOCKED! DO NOT NAVIGATE NEXT.JS TO NON-POS PAGE
                                }
                                return origPush.apply(this, arguments);
                            };

                            var origReplace = history.replaceState;
                            history.replaceState = function(state, title, url) {
                                if (url && checkAdminOrExternalNav(url)) {
                                    return; // BLOCKED! DO NOT NAVIGATE NEXT.JS TO NON-POS PAGE
                                }
                                return origReplace.apply(this, arguments);
                            };

                            // Intercept window.open
                            var origOpen = window.open;
                            window.open = function(url, target, features) {
                                if (url && checkAdminOrExternalNav(url)) {
                                    return null;
                                }
                                try {
                                    return origOpen.call(window, url, target, features);
                                } catch(e) {
                                    return null;
                                }
                            };

                            // Intercept anchor clicks (target='_blank', admin links, external)
                            document.addEventListener('click', function(e) {
                                var anchor = e.target && e.target.closest ? e.target.closest('a') : null;
                                if (anchor && anchor.href) {
                                    if (checkAdminOrExternalNav(anchor.href)) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.stopImmediatePropagation();
                                    }
                                }
                            }, true);

                            // Key Blockers: F12, DevTools, Alt+F4 (Ctrl + zoom is explicitly allowed)
                            window.addEventListener('keydown', function(e) {
                                // 1. Block F12 and DevTools (Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
                                if (e.key === 'F12' || e.keyCode === 123 ||
                                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
                                    (e.ctrlKey && (e.key === 'u' || e.key === 'U'))) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();
                                    return false;
                                }

                                // 2. Intercept Alt+F4
                                if (e.altKey && (e.key === 'F4' || e.keyCode === 115)) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    window.AVORA_EXIT_APP();
                                }
                            }, true);
                        })();
                    ");

                    // Strict Navigation Guard handlers
                    posWebView.CoreWebView2.NavigationStarting += CoreWebView2_NavigationStarting;
                    posWebView.CoreWebView2.NewWindowRequested += CoreWebView2_NewWindowRequested;

                    posWebView.CoreWebView2.NavigationCompleted += (s, args) =>
                    {
                        // Do not show WebView2 if logged out or navigating to about:blank
                        if (string.IsNullOrEmpty(_currentToken) || posWebView.CoreWebView2?.Source == "about:blank")
                        {
                            return;
                        }

                        // Once navigation to /admin/pos completes, show WebView2 and hide splash/login
                        splashOverlay.Visibility = Visibility.Collapsed;
                        nativeLoginOverlay.Visibility = Visibility.Collapsed;
                        posWebViewGrid.Visibility = Visibility.Visible;
                        Debug.WriteLine("[AUTH] NAVIGATE_ADMIN_POS completed successfully");
                    };
                }

                // Inject auth cookies into WebView2
                InjectAuthCookie("localhost", token);
                InjectAuthCookie("127.0.0.1", token);

                // Target POS URL (Directive 6: /admin/pos)
                string posUrl = Environment.GetEnvironmentVariable("AVORA_POS_URL")
                    ?? "http://localhost:3000/admin/pos";

                Debug.WriteLine($"[AUTH] Navigating to allowed route: {posUrl}");
                posWebView.CoreWebView2.Navigate(posUrl);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AUTH] Error launching WebView2: {ex.Message}");
                MessageBox.Show($"Lỗi khởi động WebView2: {ex.Message}", "Lỗi AVORA POS", MessageBoxButton.OK, MessageBoxImage.Error);
                ShowNativeLogin();
            }
        }

        private void InjectAuthCookie(string domain, string token)
        {
            try
            {
                var cookieManager = posWebView.CoreWebView2.CookieManager;
                var cookie = cookieManager.CreateCookie("token", token, domain, "/");
                cookie.IsHttpOnly = true;
                cookie.SameSite = CoreWebView2CookieSameSiteKind.Lax;
                cookie.IsSecure = false;
                cookieManager.AddOrUpdateCookie(cookie);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to inject cookie for {domain}: {ex.Message}");
            }
        }
        #endregion

        #region Strict Desktop Navigation Guard
        private void CoreWebView2_NavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(e.Uri)) return;

            // 1. Allow about:blank (used for session reset & logout)
            if (e.Uri == "about:blank" || e.Uri.StartsWith("about:"))
            {
                return;
            }

            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri)) return;

            string host = uri.Host.ToLowerInvariant();
            string path = uri.AbsolutePath.ToLowerInvariant();

            // 2. Allow static resources, Next.js chunks, fonts, media, and local APIs
            if (path.StartsWith("/_next") ||
                path.StartsWith("/api") ||
                path.EndsWith(".js") || path.EndsWith(".css") ||
                path.EndsWith(".png") || path.EndsWith(".svg") ||
                path.EndsWith(".jpg") || path.EndsWith(".jpeg") ||
                path.EndsWith(".ico") || path.EndsWith(".mp4") ||
                path.EndsWith(".woff") || path.EndsWith(".woff2"))
            {
                return;
            }

            // 3. POS Whitelist: MUST ALLOW /admin/pos and /admin/pos/*
            if (path == "/admin/pos" || path.StartsWith("/admin/pos/"))
            {
                return;
            }

            // 4. User logged out or sent to /login -> Return to Native Login
            if (path == "/login" || path.StartsWith("/login/"))
            {
                e.Cancel = true;
                Dispatcher.InvokeAsync(async () =>
                {
                    await PerformDesktopLogoutAsync();
                });
                return;
            }

            // 5. ALL OTHER ROUTES (Customer pages /orders/*, /cart, /, Admin pages /admin/dashboard, external sites)
            // MUST NEVER OPEN INSIDE POS! CANCEL & OPEN IN EXTERNAL BROWSER!
            e.Cancel = true;
            Debug.WriteLine($"[GUARD] CoreWebView2_NavigationStarting blocked non-POS URI: {e.Uri}");
            OpenInDefaultBrowser(e.Uri);
        }

        private void CoreWebView2_NewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;

            if (string.IsNullOrWhiteSpace(e.Uri)) return;

            // All external window requests open in default browser
            OpenInDefaultBrowser(e.Uri);
        }

        private static void OpenInDefaultBrowser(string url)
        {
            try
            {
                string fullUrl = url.Trim();
                if (fullUrl.StartsWith("/"))
                {
                    string baseWeb = Environment.GetEnvironmentVariable("AVORA_POS_URL") ?? "http://localhost:3000";
                    if (Uri.TryCreate(baseWeb, UriKind.Absolute, out var baseUri))
                    {
                        fullUrl = $"{baseUri.Scheme}://{baseUri.Authority}{fullUrl}";
                    }
                    else
                    {
                        fullUrl = $"http://localhost:3000{fullUrl}";
                    }
                }

                Process.Start(new ProcessStartInfo
                {
                    FileName = fullUrl,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to open external browser for {url}: {ex.Message}");
            }
        }
        #endregion

        #region Keyboard Shortcuts (F11 Fullscreen, ESC)
        private void MainWindow_KeyDown(object sender, KeyEventArgs e)
        {
            // Alt+F4 interception (supports Key.System and Alt modifier combinations)
            bool isAltPressed = (Keyboard.Modifiers & ModifierKeys.Alt) == ModifierKeys.Alt;
            if ((e.Key == Key.System && e.SystemKey == Key.F4) ||
                (isAltPressed && (e.Key == Key.F4 || e.SystemKey == Key.F4)))
            {
                e.Handled = true;
                RequestSafeExit();
                return;
            }

            // F11: Toggle Kiosk Fullscreen <-> Windowed Debug Mode (Directive 4)
            if (e.Key == Key.F11)
            {
                ToggleFullScreen();
                e.Handled = true;
                return;
            }

            // ESC: DO NOT intercept! Allow it to bubble down to React POS Web UI (Directive 13)
        }
        #endregion
    }
}
