using System;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Security;
using AvoraPosNative.Services;

namespace AvoraPosNative.ViewModels
{
    public class LoginViewModel : ViewModelBase
    {
        private readonly AuthService _authService;

        private string _email = string.Empty;
        private string _password = string.Empty;
        private bool _isPasswordVisible = false;
        private bool _isLoading = false;
        private string _errorMessage = string.Empty;
        private bool _hasError = false;
        private bool _isGoogleWaiting = false;
        private string _serverStatus = "Máy chủ: Đã kết nối";
        private bool _isServerConnected = true;

        public event Action<UserProfile>? LoginSucceeded;
        public event Action? RequestExit;

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

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
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

        public string VersionText => "AVORA POS Native v1.0.0";

        public ICommand LoginCommand { get; }
        public ICommand GoogleLoginCommand { get; }
        public ICommand TogglePasswordCommand { get; }
        public ICommand ExitCommand { get; }

        public LoginViewModel(AuthService authService)
        {
            _authService = authService;

            // Load last used email
            string? lastEmail = SecureSessionManager.GetLastIdentifier();
            if (!string.IsNullOrEmpty(lastEmail))
            {
                _email = lastEmail;
            }

            LoginCommand = new RelayCommand(async () => await ExecuteLoginAsync(), () => !IsLoading);
            GoogleLoginCommand = new RelayCommand(ExecuteGoogleLogin, () => !IsLoading);
            TogglePasswordCommand = new RelayCommand(() => IsPasswordVisible = !IsPasswordVisible);
            ExitCommand = new RelayCommand(() => RequestExit?.Invoke());
        }

        public async Task ExecuteLoginAsync()
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
                if (qIdx >= 0)
                {
                    string query = uri.Substring(qIdx + 1);
                    foreach (var part in query.Split('&'))
                    {
                        var kv = part.Split('=');
                        if (kv.Length == 2)
                        {
                            string key = kv[0];
                            string val = Uri.UnescapeDataString(kv[1]);
                            if (key.Equals("code", StringComparison.OrdinalIgnoreCase))
                            {
                                _ = HandleCallbackCodeAsync(val);
                                return;
                            }
                            else if (key.Equals("launchCode", StringComparison.OrdinalIgnoreCase))
                            {
                                _ = HandleSsoLaunchCodeAsync(val);
                                return;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Deep link error: {ex.Message}";
            }
        }
    }
}
