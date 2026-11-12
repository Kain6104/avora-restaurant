using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Input;
using System.Windows.Threading;
using AvoraPosNative.Models;
using AvoraPosNative.Security;
using AvoraPosNative.Services;
using AvoraPosNative.Storage;

namespace AvoraPosNative.ViewModels
{
    public class LoginViewModel : ViewModelBase
    {
        private readonly AuthService _authService;

        // Modes: "PIN", "RETURNING_USER", "STANDARD"
        private string _activeLoginMode = "PIN";

        // Mode 1: PIN
        private string _currentPin = string.Empty;
        private int _pinRateLimitRemainingSec = 0;
        private DispatcherTimer? _rateLimitTimer;
        private string _pinErrorMessage = string.Empty;
        private bool _hasPinError = false;
        private string _pinSuccessMessage = string.Empty;
        private bool _hasPinSuccess = false;

        // Mode 2: Returning User
        private RememberedAccount? _rememberedAccount;
        private string _returningPassword = string.Empty;
        private bool _isReturningPasswordVisible = false;
        private string _returningErrorMessage = string.Empty;
        private bool _hasReturningError = false;

        // Mode 3: Standard Login
        private string _email = string.Empty;
        private string _password = string.Empty;
        private bool _isPasswordVisible = false;
        private string _errorMessage = string.Empty;
        private bool _hasError = false;

        // Common
        private bool _isLoading = false;
        private bool _isGoogleWaiting = false;
        private string _serverStatus = "Máy chủ: Đang kiểm tra...";
        private bool _isServerConnected = true;

        public event Action<UserProfile>? LoginSucceeded;
        public event Action? RequestExit;

        #region Properties
        public string ActiveLoginMode
        {
            get => _activeLoginMode;
            set
            {
                if (SetProperty(ref _activeLoginMode, value))
                {
                    OnPropertyChanged(nameof(IsPinMode));
                    OnPropertyChanged(nameof(IsReturningUserMode));
                    OnPropertyChanged(nameof(IsStandardMode));
                }
            }
        }

        public bool IsPinMode => ActiveLoginMode == "PIN";
        public bool IsReturningUserMode => ActiveLoginMode == "RETURNING_USER";
        public bool IsStandardMode => ActiveLoginMode == "STANDARD";

        // PIN Properties
        public string CurrentPin
        {
            get => _currentPin;
            set
            {
                if (SetProperty(ref _currentPin, value))
                {
                    OnPropertyChanged(nameof(Dot1Filled));
                    OnPropertyChanged(nameof(Dot2Filled));
                    OnPropertyChanged(nameof(Dot3Filled));
                    OnPropertyChanged(nameof(Dot4Filled));
                    OnPropertyChanged(nameof(CanSubmitPin));
                }
            }
        }

        public bool Dot1Filled => CurrentPin.Length >= 1;
        public bool Dot2Filled => CurrentPin.Length >= 2;
        public bool Dot3Filled => CurrentPin.Length >= 3;
        public bool Dot4Filled => CurrentPin.Length >= 4;
        public bool CanSubmitPin => CurrentPin.Length == 4 && _pinRateLimitRemainingSec <= 0 && !IsLoading;

        public int PinRateLimitRemainingSec
        {
            get => _pinRateLimitRemainingSec;
            set
            {
                if (SetProperty(ref _pinRateLimitRemainingSec, value))
                {
                    OnPropertyChanged(nameof(IsRateLimited));
                    OnPropertyChanged(nameof(CanSubmitPin));
                }
            }
        }

        public bool IsRateLimited => _pinRateLimitRemainingSec > 0;

        public string PinErrorMessage
        {
            get => _pinErrorMessage;
            set
            {
                SetProperty(ref _pinErrorMessage, value);
                HasPinError = !string.IsNullOrWhiteSpace(value);
            }
        }

        public bool HasPinError
        {
            get => _hasPinError;
            set => SetProperty(ref _hasPinError, value);
        }

        public string PinSuccessMessage
        {
            get => _pinSuccessMessage;
            set
            {
                SetProperty(ref _pinSuccessMessage, value);
                HasPinSuccess = !string.IsNullOrWhiteSpace(value);
            }
        }

        public bool HasPinSuccess
        {
            get => _hasPinSuccess;
            set => SetProperty(ref _hasPinSuccess, value);
        }

        // Returning User Properties
        public RememberedAccount? RememberedAccount
        {
            get => _rememberedAccount;
            set
            {
                if (SetProperty(ref _rememberedAccount, value))
                {
                    OnPropertyChanged(nameof(HasRememberedAccount));
                    OnPropertyChanged(nameof(RememberedFullName));
                    OnPropertyChanged(nameof(RememberedEmail));
                    OnPropertyChanged(nameof(RememberedInitialLetter));
                    OnPropertyChanged(nameof(RememberedButtonText));
                    OnPropertyChanged(nameof(StandardLoginButtonText));
                }
            }
        }

        public bool HasRememberedAccount => RememberedAccount != null && !string.IsNullOrWhiteSpace(RememberedAccount.FullName);
        public string RememberedFullName => RememberedAccount?.FullName ?? "HTP Official";
        public string RememberedEmail => RememberedAccount?.Email ?? string.Empty;
        public string RememberedInitialLetter => RememberedAccount?.GetInitialLetter() ?? "A";
        public string RememberedButtonText => HasRememberedAccount ? $"Đăng nhập với {RememberedFullName}" : "Đăng nhập với HTP Official";
        public string StandardLoginButtonText => HasRememberedAccount ? "Đăng nhập tài khoản khác" : "Đăng nhập bằng mật khẩu";

        public string ReturningPassword
        {
            get => _returningPassword;
            set => SetProperty(ref _returningPassword, value);
        }

        public bool IsReturningPasswordVisible
        {
            get => _isReturningPasswordVisible;
            set => SetProperty(ref _isReturningPasswordVisible, value);
        }

        public string ReturningErrorMessage
        {
            get => _returningErrorMessage;
            set
            {
                SetProperty(ref _returningErrorMessage, value);
                HasReturningError = !string.IsNullOrWhiteSpace(value);
            }
        }

        public bool HasReturningError
        {
            get => _hasReturningError;
            set => SetProperty(ref _hasReturningError, value);
        }

        // Standard Login Properties
        public string Email
        {
            get => _email;
            set => SetProperty(ref _email, value);
        }

        public string Password
        {
            get => _password;
            set => SetProperty(ref _password, value);
        }

        public bool IsPasswordVisible
        {
            get => _isPasswordVisible;
            set => SetProperty(ref _isPasswordVisible, value);
        }

        public string ErrorMessage
        {
            get => _errorMessage;
            set
            {
                SetProperty(ref _errorMessage, value);
                HasError = !string.IsNullOrWhiteSpace(value);
            }
        }

        public bool HasError
        {
            get => _hasError;
            set => SetProperty(ref _hasError, value);
        }

        public bool IsLoading
        {
            get => _isLoading;
            set
            {
                if (SetProperty(ref _isLoading, value))
                {
                    OnPropertyChanged(nameof(CanSubmitPin));
                }
            }
        }

        public bool IsGoogleWaiting
        {
            get => _isGoogleWaiting;
            set => SetProperty(ref _isGoogleWaiting, value);
        }

        public string ServerStatus
        {
            get => _serverStatus;
            set => SetProperty(ref _serverStatus, value);
        }

        public bool IsServerConnected
        {
            get => _isServerConnected;
            set => SetProperty(ref _isServerConnected, value);
        }

        public string VersionText
        {
            get
            {
                try
                {
                    var asm = System.Reflection.Assembly.GetExecutingAssembly();
                    var ver = asm.GetName().Version;
                    if (ver != null) return $"AVORA POS Native v{ver.Major}.{ver.Minor}.{ver.Build}";
                }
                catch { }
                return $"AVORA POS Native v{AppConfig.Version}";
            }
        }
        #endregion

        #region Commands
        public ICommand PinKeyCommand { get; }
        public ICommand SubmitPinCommand { get; }
        public ICommand SwitchToReturningUserCommand { get; }
        public ICommand SwitchToStandardCommand { get; }
        public ICommand SwitchToPinCommand { get; }
        public ICommand ReturningLoginCommand { get; }
        public ICommand ForgetAccountCommand { get; }
        public ICommand ToggleReturningPasswordCommand { get; }
        public ICommand LoginCommand { get; }
        public ICommand GoogleLoginCommand { get; }
        public ICommand TogglePasswordCommand { get; }
        public ICommand ExitCommand { get; }
        #endregion

        public LoginViewModel(AuthService authService)
        {
            _authService = authService;

            // Load remembered account
            RememberedAccount = SecureSessionManager.GetRememberedAccount();

            // Default fast login mode
            ActiveLoginMode = "PIN";

            // Load last used email
            string? lastEmail = SecureSessionManager.GetLastIdentifier();
            if (!string.IsNullOrEmpty(lastEmail))
            {
                _email = lastEmail;
            }

            // PIN Keypad command
            PinKeyCommand = new RelayCommand(param =>
            {
                if (param is string key)
                {
                    HandlePinKey(key);
                }
            });

            SubmitPinCommand = new RelayCommand(async () => await SubmitPinAsync(), () => CanSubmitPin);

            SwitchToReturningUserCommand = new RelayCommand(() =>
            {
                if (RememberedAccount == null)
                {
                    RememberedAccount = SecureSessionManager.GetRememberedAccount();
                }

                if (RememberedAccount != null)
                {
                    ReturningPassword = string.Empty;
                    ReturningErrorMessage = string.Empty;
                    ActiveLoginMode = "RETURNING_USER";
                }
                else
                {
                    ActiveLoginMode = "STANDARD";
                }
            });

            SwitchToStandardCommand = new RelayCommand(() =>
            {
                ErrorMessage = string.Empty;
                ActiveLoginMode = "STANDARD";
            });

            SwitchToPinCommand = new RelayCommand(() =>
            {
                CurrentPin = string.Empty;
                PinErrorMessage = string.Empty;
                PinSuccessMessage = string.Empty;
                ActiveLoginMode = "PIN";
            });

            ReturningLoginCommand = new RelayCommand(async () => await SubmitReturningLoginAsync(), () => !IsLoading);

            ForgetAccountCommand = new RelayCommand(() =>
            {
                SecureSessionManager.ClearRememberedAccount();
                RememberedAccount = null;
                ActiveLoginMode = "STANDARD";
                ErrorMessage = "Đã xóa thông tin tài khoản ghi nhớ trên thiết bị này.";
            });

            ToggleReturningPasswordCommand = new RelayCommand(() => IsReturningPasswordVisible = !IsReturningPasswordVisible);

            LoginCommand = new RelayCommand(async () => await ExecuteStandardLoginAsync(), () => !IsLoading);
            GoogleLoginCommand = new RelayCommand(ExecuteGoogleLogin, () => !IsLoading);
            TogglePasswordCommand = new RelayCommand(() => IsPasswordVisible = !IsPasswordVisible);
            ExitCommand = new RelayCommand(() => RequestExit?.Invoke());

            // Check server health
            _ = ProbeServerConnectionAsync();
        }

        #region Logic Handlers
        public void HandlePinKey(string actionOrDigit)
        {
            if (IsRateLimited || IsLoading) return;

            PinErrorMessage = string.Empty;

            if (actionOrDigit == "CLEAR")
            {
                CurrentPin = string.Empty;
            }
            else if (actionOrDigit == "BACK")
            {
                if (CurrentPin.Length > 0)
                {
                    CurrentPin = CurrentPin.Substring(0, CurrentPin.Length - 1);
                }
            }
            else if (actionOrDigit.Length == 1 && char.IsDigit(actionOrDigit[0]))
            {
                if (CurrentPin.Length < 4)
                {
                    CurrentPin += actionOrDigit[0];
                }
            }

            if (CurrentPin.Length == 4)
            {
                _ = SubmitPinAsync();
            }
        }

        public async Task SubmitPinAsync()
        {
            if (CurrentPin.Length != 4 || IsLoading) return;

            string pinToSubmit = CurrentPin;
            IsLoading = true;
            PinErrorMessage = string.Empty;

            try
            {
                var (success, error, retryAfter, profile) = await _authService.LoginWithPinAsync(pinToSubmit);

                if (!success || profile == null)
                {
                    CurrentPin = string.Empty;

                    if (retryAfter > 0)
                    {
                        StartRateLimitCountdown(retryAfter);
                    }

                    PinErrorMessage = error ?? "Mã PIN không chính xác.";
                    return;
                }

                RememberedAccount = SecureSessionManager.GetRememberedAccount();
                PinSuccessMessage = $"✓ Xin chào, {profile.FullName}!";
                await Task.Delay(350); // Smooth UX transition

                LoginSucceeded?.Invoke(profile);
            }
            catch (Exception ex)
            {
                CurrentPin = string.Empty;
                PinErrorMessage = $"Không thể kết nối đến máy chủ AVORA ({ex.Message}).";
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void StartRateLimitCountdown(int seconds)
        {
            PinRateLimitRemainingSec = seconds;
            _rateLimitTimer?.Stop();

            _rateLimitTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _rateLimitTimer.Tick += (s, e) =>
            {
                PinRateLimitRemainingSec--;
                if (PinRateLimitRemainingSec <= 0)
                {
                    _rateLimitTimer?.Stop();
                    PinErrorMessage = string.Empty;
                }
                else
                {
                    PinErrorMessage = $"Bạn đã nhập sai quá số lần. Vui lòng thử lại sau {PinRateLimitRemainingSec} giây.";
                }
            };
            _rateLimitTimer.Start();
        }

        public async Task SubmitReturningLoginAsync()
        {
            if (RememberedAccount == null || string.IsNullOrWhiteSpace(RememberedAccount.Email))
            {
                ActiveLoginMode = "STANDARD";
                return;
            }

            if (string.IsNullOrWhiteSpace(ReturningPassword))
            {
                ReturningErrorMessage = "Vui lòng nhập mật khẩu.";
                return;
            }

            IsLoading = true;
            ReturningErrorMessage = string.Empty;

            try
            {
                var (success, error, profile) = await _authService.LoginWithEmailAsync(RememberedAccount.Email, ReturningPassword);
                if (!success || profile == null)
                {
                    ReturningErrorMessage = error ?? "Mật khẩu không chính xác.";
                    return;
                }

                LoginSucceeded?.Invoke(profile);
            }
            finally
            {
                IsLoading = false;
            }
        }

        public async Task ExecuteStandardLoginAsync()
        {
            ErrorMessage = string.Empty;

            if (string.IsNullOrWhiteSpace(Email))
            {
                ErrorMessage = "Vui lòng nhập tài khoản email hoặc tên đăng nhập.";
                return;
            }

            if (string.IsNullOrWhiteSpace(Password))
            {
                ErrorMessage = "Vui lòng nhập mật khẩu.";
                return;
            }

            IsLoading = true;
            try
            {
                SecureSessionManager.SaveLastIdentifier(Email.Trim());

                var (success, error, profile) = await _authService.LoginWithEmailAsync(Email, Password);
                if (!success || profile == null)
                {
                    ErrorMessage = error ?? "Sai tài khoản hoặc mật khẩu.";
                    return;
                }

                // Update remembered account
                RememberedAccount = new RememberedAccount
                {
                    UserId = profile.Id,
                    FullName = profile.FullName,
                    Email = profile.Email,
                    AvatarUrl = profile.AvatarUrl,
                    LastLoginAt = DateTime.UtcNow
                };
                SecureSessionManager.SaveRememberedAccount(RememberedAccount);

                LoginSucceeded?.Invoke(profile);
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void ExecuteGoogleLogin()
        {
            try
            {
                IsGoogleWaiting = true;
                string googleAuthUrl = $"{AuthService.BackendUrl}/api/auth/google?isDesktop=true&redirectURL=avora-pos-native://auth/callback";

                Process.Start(new ProcessStartInfo
                {
                    FileName = googleAuthUrl,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                IsGoogleWaiting = false;
                ErrorMessage = $"Không thể mở trình duyệt: {ex.Message}";
            }
        }

        public async Task ProbeServerConnectionAsync()
        {
            bool online = await _authService.CheckServerConnectionAsync();
            IsServerConnected = online;
            ServerStatus = online ? "Máy chủ: Đã kết nối" : "Không thể kết nối máy chủ";
        }

        public async Task HandleCallbackCodeAsync(string code)
        {
            IsGoogleWaiting = false;
            IsLoading = true;
            ErrorMessage = string.Empty;

            try
            {
                var (success, error, profile) = await _authService.ExchangeGoogleCodeAsync(code);
                if (!success || profile == null)
                {
                    ErrorMessage = error ?? "Xác thực Google thất bại hoặc mã đã hết hạn.";
                    return;
                }

                LoginSucceeded?.Invoke(profile);
            }
            finally
            {
                IsLoading = false;
            }
        }

        public async Task HandleSsoLaunchCodeAsync(string code)
        {
            IsLoading = true;
            ErrorMessage = string.Empty;

            try
            {
                var (success, error, profile) = await _authService.ExchangeLaunchCodeAsync(code);
                if (!success || profile == null)
                {
                    ErrorMessage = error ?? "Xác thực SSO thất bại hoặc mã đã hết hạn.";
                    return;
                }

                LoginSucceeded?.Invoke(profile);
            }
            finally
            {
                IsLoading = false;
            }
        }

        public void HandleDeepLink(string uri)
        {
            if (string.IsNullOrWhiteSpace(uri)) return;
            try
            {
                int qIdx = uri.IndexOf('?');
                if (qIdx < 0) return;

                string pathPart = uri.Substring(0, qIdx).ToLowerInvariant();
                string query = uri.Substring(qIdx + 1);
                string? codeVal = null;
                string? launchCodeVal = null;

                foreach (var part in query.Split('&'))
                {
                    var kv = part.Split('=');
                    if (kv.Length == 2)
                    {
                        string key = kv[0];
                        string val = Uri.UnescapeDataString(kv[1]);
                        if (key.Equals("code", StringComparison.OrdinalIgnoreCase))
                        {
                            codeVal = val;
                        }
                        else if (key.Equals("launchCode", StringComparison.OrdinalIgnoreCase))
                        {
                            launchCodeVal = val;
                        }
                    }
                }

                // 1. Explicit launchCode parameter
                if (!string.IsNullOrEmpty(launchCodeVal))
                {
                    _ = HandleSsoLaunchCodeAsync(launchCodeVal);
                    return;
                }

                // 2. Code parameter routing based on URL path/scheme
                if (!string.IsNullOrEmpty(codeVal))
                {
                    if (pathPart.Contains("open"))
                    {
                        // Web POS SSO: avora-pos://open?code=XYZ or avora-pos-native://open?code=XYZ
                        _ = HandleSsoLaunchCodeAsync(codeVal);
                    }
                    else
                    {
                        // Google OAuth callback: avora-pos-native://auth/callback?code=XYZ
                        _ = HandleCallbackCodeAsync(codeVal);
                    }
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Deep link error: {ex.Message}";
            }
        }
        #endregion
    }
}
