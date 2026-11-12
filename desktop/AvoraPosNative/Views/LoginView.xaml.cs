using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using AvoraPosNative.ViewModels;

namespace AvoraPosNative.Views
{
    public partial class LoginView : UserControl
    {
        private LoginViewModel? ViewModel => DataContext as LoginViewModel;
        
        private bool _isReturningPasswordRevealed = false;
        private bool _isStandardPasswordRevealed = false;

        private static readonly Geometry EyeOpenGeometry =
            Geometry.Parse("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z");
        
        private static readonly Geometry EyeClosedGeometry =
            Geometry.Parse("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z");

        private static readonly SolidColorBrush FilledBrush = new SolidColorBrush(Color.FromRgb(218, 37, 29)); // #DA251D
        private static readonly SolidColorBrush EmptyBorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)); // #CBD5E1
        private static readonly SolidColorBrush ConnectedBrush = new SolidColorBrush(Color.FromRgb(16, 185, 129)); // #10B981
        private static readonly SolidColorBrush DisconnectedBrush = new SolidColorBrush(Color.FromRgb(239, 68, 68)); // #EF4444

        public LoginView()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            KeyDown += OnViewKeyDown;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (ViewModel == null) return;

            // Wire ViewModel change events
            ViewModel.PropertyChanged += (vs, ve) =>
            {
                Dispatcher.Invoke(() => HandleViewModelPropertyChanged(ve.PropertyName));
            };

            // Initial view update
            UpdateActiveModeView();
            UpdatePinDots();
            UpdateRememberedUserInfo();
            UpdateServerStatus();
            UpdateCapsLockWarning();

            // Set initial focus
            FocusAppropriateControl();
        }

        private void HandleViewModelPropertyChanged(string? propertyName)
        {
            if (ViewModel == null) return;

            switch (propertyName)
            {
                case nameof(LoginViewModel.ActiveLoginMode):
                case nameof(LoginViewModel.IsPinMode):
                case nameof(LoginViewModel.IsReturningUserMode):
                case nameof(LoginViewModel.IsStandardMode):
                    UpdateActiveModeView();
                    FocusAppropriateControl();
                    break;

                case nameof(LoginViewModel.CurrentPin):
                case nameof(LoginViewModel.Dot1Filled):
                case nameof(LoginViewModel.Dot2Filled):
                case nameof(LoginViewModel.Dot3Filled):
                case nameof(LoginViewModel.Dot4Filled):
                case nameof(LoginViewModel.CanSubmitPin):
                    UpdatePinDots();
                    break;

                case nameof(LoginViewModel.PinErrorMessage):
                case nameof(LoginViewModel.HasPinError):
                    if (ViewModel.HasPinError)
                    {
                        txtPinErrorMessage.Text = ViewModel.PinErrorMessage;
                        pinErrorBanner.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        pinErrorBanner.Visibility = Visibility.Collapsed;
                    }
                    break;

                case nameof(LoginViewModel.PinSuccessMessage):
                case nameof(LoginViewModel.HasPinSuccess):
                    if (ViewModel.HasPinSuccess)
                    {
                        txtPinSuccessMessage.Text = ViewModel.PinSuccessMessage;
                        pinSuccessBanner.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        pinSuccessBanner.Visibility = Visibility.Collapsed;
                    }
                    break;

                case nameof(LoginViewModel.RememberedAccount):
                case nameof(LoginViewModel.HasRememberedAccount):
                case nameof(LoginViewModel.RememberedFullName):
                case nameof(LoginViewModel.RememberedEmail):
                case nameof(LoginViewModel.RememberedButtonText):
                case nameof(LoginViewModel.StandardLoginButtonText):
                    UpdateRememberedUserInfo();
                    break;

                case nameof(LoginViewModel.ReturningErrorMessage):
                case nameof(LoginViewModel.HasReturningError):
                    if (ViewModel.HasReturningError)
                    {
                        txtReturningErrorMessage.Text = ViewModel.ReturningErrorMessage;
                        returningErrorBanner.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        returningErrorBanner.Visibility = Visibility.Collapsed;
                    }
                    break;

                case nameof(LoginViewModel.ErrorMessage):
                case nameof(LoginViewModel.HasError):
                    if (ViewModel.HasError)
                    {
                        txtErrorMessage.Text = ViewModel.ErrorMessage;
                        loginErrorBanner.Visibility = Visibility.Visible;
                    }
                    else
                    {
                        loginErrorBanner.Visibility = Visibility.Collapsed;
                    }
                    break;

                case nameof(LoginViewModel.IsLoading):
                    UpdateLoadingState();
                    break;

                case nameof(LoginViewModel.IsGoogleWaiting):
                    txtGoogleStatus.Visibility = ViewModel.IsGoogleWaiting ? Visibility.Visible : Visibility.Collapsed;
                    break;

                case nameof(LoginViewModel.ServerStatus):
                case nameof(LoginViewModel.IsServerConnected):
                    UpdateServerStatus();
                    break;
            }
        }

        private void UpdateActiveModeView()
        {
            if (ViewModel == null) return;

            panelPinLogin.Visibility = ViewModel.IsPinMode ? Visibility.Visible : Visibility.Collapsed;
            panelReturningUser.Visibility = ViewModel.IsReturningUserMode ? Visibility.Visible : Visibility.Collapsed;
            panelStandardLogin.Visibility = ViewModel.IsStandardMode ? Visibility.Visible : Visibility.Collapsed;

            if (ViewModel.IsReturningUserMode)
            {
                LoadReturningUserAvatar();
                txtReturningPassword.Password = string.Empty;
                txtReturningPasswordVisible.Text = string.Empty;
                txtReturningPlaceholder.Visibility = Visibility.Visible;
            }
            else if (ViewModel.IsStandardMode)
            {
                txtEmail.Text = ViewModel.Email;
                txtPassword.Password = string.Empty;
                txtPasswordVisible.Text = string.Empty;
            }

            UpdateCapsLockWarning();
        }

        private void FocusAppropriateControl()
        {
            if (ViewModel == null) return;

            if (ViewModel.IsReturningUserMode)
            {
                if (_isReturningPasswordRevealed)
                    txtReturningPasswordVisible.Focus();
                else
                    txtReturningPassword.Focus();
            }
            else if (ViewModel.IsStandardMode)
            {
                if (string.IsNullOrEmpty(txtEmail.Text))
                    txtEmail.Focus();
                else if (_isStandardPasswordRevealed)
                    txtPasswordVisible.Focus();
                else
                    txtPassword.Focus();
            }
        }

        private void UpdatePinDots()
        {
            if (ViewModel == null) return;

            string pin = ViewModel.CurrentPin;
            dotPin1.Background = pin.Length >= 1 ? FilledBrush : Brushes.Transparent;
            dotPin1.BorderBrush = pin.Length >= 1 ? FilledBrush : EmptyBorderBrush;

            dotPin2.Background = pin.Length >= 2 ? FilledBrush : Brushes.Transparent;
            dotPin2.BorderBrush = pin.Length >= 2 ? FilledBrush : EmptyBorderBrush;

            dotPin3.Background = pin.Length >= 3 ? FilledBrush : Brushes.Transparent;
            dotPin3.BorderBrush = pin.Length >= 3 ? FilledBrush : EmptyBorderBrush;

            dotPin4.Background = pin.Length >= 4 ? FilledBrush : Brushes.Transparent;
            dotPin4.BorderBrush = pin.Length >= 4 ? FilledBrush : EmptyBorderBrush;

            btnPinSubmit.IsEnabled = ViewModel.CanSubmitPin;
        }

        private void UpdateRememberedUserInfo()
        {
            if (ViewModel == null) return;

            bool hasUser = ViewModel.HasRememberedAccount;
            btnPinToRememberedUser.Visibility = hasUser ? Visibility.Visible : Visibility.Collapsed;
            txtPinToRememberedUserLabel.Text = ViewModel.RememberedButtonText;
            txtPinToStandardLabel.Text = ViewModel.StandardLoginButtonText;

            btnBackToRememberedUser.Visibility = hasUser ? Visibility.Visible : Visibility.Collapsed;
            txtBackToRememberedLabel.Text = $"← Quay lại {ViewModel.RememberedFullName}";

            txtRememberedName.Text = ViewModel.RememberedFullName;
            txtRememberedEmail.Text = ViewModel.RememberedEmail;

            LoadReturningUserAvatar();
        }

        private void LoadReturningUserAvatar()
        {
            try
            {
                var account = ViewModel?.RememberedAccount;
                if (account != null && !string.IsNullOrEmpty(account.CachedAvatarPath) && File.Exists(account.CachedAvatarPath))
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.UriSource = new Uri(account.CachedAvatarPath, UriKind.Absolute);
                    bmp.EndInit();
                    bmp.Freeze();

                    imgReturningAvatar.Source = bmp;
                    imgReturningAvatar.Visibility = Visibility.Visible;
                    borderFallbackAvatar.Visibility = Visibility.Collapsed;
                    return;
                }

                if (account != null && !string.IsNullOrEmpty(account.AvatarUrl) &&
                    Uri.TryCreate(account.AvatarUrl, UriKind.Absolute, out var uri) &&
                    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                {
                    var bmp = new BitmapImage();
                    bmp.BeginInit();
                    bmp.CacheOption = BitmapCacheOption.OnLoad;
                    bmp.UriSource = uri;
                    bmp.EndInit();

                    imgReturningAvatar.Source = bmp;
                    imgReturningAvatar.Visibility = Visibility.Visible;
                    borderFallbackAvatar.Visibility = Visibility.Collapsed;
                    return;
                }
            }
            catch { }

            // Fallback Initials circle
            imgReturningAvatar.Visibility = Visibility.Collapsed;
            borderFallbackAvatar.Visibility = Visibility.Visible;
            txtFallbackInitial.Text = ViewModel?.RememberedInitialLetter ?? "A";
        }

        private void UpdateLoadingState()
        {
            if (ViewModel == null) return;
            bool loading = ViewModel.IsLoading;

            // PIN mode
            pinProgress.Visibility = loading && ViewModel.IsPinMode ? Visibility.Visible : Visibility.Collapsed;
            btnPinSubmit.IsEnabled = ViewModel.CanSubmitPin;
            btnPinSubmit.Content = loading && ViewModel.IsPinMode ? "ĐANG XÁC THỰC..." : "ĐĂNG NHẬP";

            // Returning user mode
            returningLoginProgress.Visibility = loading && ViewModel.IsReturningUserMode ? Visibility.Visible : Visibility.Collapsed;
            btnReturningLogin.IsEnabled = !loading;
            btnReturningLogin.Content = loading && ViewModel.IsReturningUserMode ? "ĐANG ĐĂNG NHẬP..." : "ĐĂNG NHẬP";

            // Standard mode
            loginProgress.Visibility = loading && ViewModel.IsStandardMode ? Visibility.Visible : Visibility.Collapsed;
            btnLogin.IsEnabled = !loading;
            btnLogin.Content = loading && ViewModel.IsStandardMode ? "Đang đăng nhập..." : "ĐĂNG NHẬP";
            btnGoogleLogin.IsEnabled = !loading;
        }

        private void UpdateServerStatus()
        {
            if (ViewModel == null) return;
            txtServerStatus.Text = ViewModel.ServerStatus;
            dotStatus.Fill = ViewModel.IsServerConnected ? ConnectedBrush : DisconnectedBrush;
        }

        private void UpdateCapsLockWarning()
        {
            bool isCapsLockOn = Keyboard.IsKeyToggled(Key.CapsLock);
            txtReturningCapsLockWarning.Visibility = isCapsLockOn ? Visibility.Visible : Visibility.Collapsed;
            txtStandardCapsLockWarning.Visibility = isCapsLockOn ? Visibility.Visible : Visibility.Collapsed;
        }

        #region Keyboard & Input Handling
        private void OnViewKeyDown(object sender, KeyEventArgs e)
        {
            UpdateCapsLockWarning();

            // When in PIN mode, physical number keys route straight to PIN keypad
            if (ViewModel != null && ViewModel.IsPinMode && !ViewModel.IsLoading)
            {
                if (e.Key >= Key.D0 && e.Key <= Key.D9)
                {
                    int digit = e.Key - Key.D0;
                    ViewModel.HandlePinKey(digit.ToString());
                    e.Handled = true;
                }
                else if (e.Key >= Key.NumPad0 && e.Key <= Key.NumPad9)
                {
                    int digit = e.Key - Key.NumPad0;
                    ViewModel.HandlePinKey(digit.ToString());
                    e.Handled = true;
                }
                else if (e.Key == Key.Back)
                {
                    ViewModel.HandlePinKey("BACK");
                    e.Handled = true;
                }
                else if (e.Key == Key.Escape)
                {
                    ViewModel.HandlePinKey("CLEAR");
                    e.Handled = true;
                }
                else if (e.Key == Key.Enter && ViewModel.CanSubmitPin)
                {
                    _ = ViewModel.SubmitPinAsync();
                    e.Handled = true;
                }
            }
        }

        private void BtnPinKey_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string tag)
            {
                ViewModel?.HandlePinKey(tag);
            }
        }

        private void BtnPinSubmit_Click(object sender, RoutedEventArgs e)
        {
            _ = ViewModel?.SubmitPinAsync();
        }

        private void BtnPinToRememberedUser_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.SwitchToReturningUserCommand.Execute(null);
        }

        private void BtnPinToStandardLogin_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.SwitchToStandardCommand.Execute(null);
        }

        private void BtnSwitchToPin_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.SwitchToPinCommand.Execute(null);
        }

        private void BtnSwitchToStandard_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.SwitchToStandardCommand.Execute(null);
        }

        private void BtnBackToRememberedUser_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.SwitchToReturningUserCommand.Execute(null);
        }

        private void BtnForgetAccount_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.ForgetAccountCommand.Execute(null);
        }

        private void BtnExitApp_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.ExitCommand.Execute(null);
        }

        private void BtnGoogleLogin_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.GoogleLoginCommand.Execute(null);
        }
        #endregion

        #region Returning User Password Flow
        private async void BtnReturningLogin_Click(object sender, RoutedEventArgs e)
        {
            if (ViewModel == null) return;
            ViewModel.ReturningPassword = _isReturningPasswordRevealed ? txtReturningPasswordVisible.Text : txtReturningPassword.Password;
            await ViewModel.SubmitReturningLoginAsync();
        }

        private void BtnToggleReturningPassword_Click(object sender, RoutedEventArgs e)
        {
            _isReturningPasswordRevealed = !_isReturningPasswordRevealed;
            if (_isReturningPasswordRevealed)
            {
                txtReturningPasswordVisible.Text = txtReturningPassword.Password;
                txtReturningPassword.Visibility = Visibility.Collapsed;
                txtReturningPasswordVisible.Visibility = Visibility.Visible;
                pathReturningEyeIcon.Data = EyeClosedGeometry;
                txtReturningPasswordVisible.Focus();
                txtReturningPasswordVisible.CaretIndex = txtReturningPasswordVisible.Text.Length;
            }
            else
            {
                txtReturningPassword.Password = txtReturningPasswordVisible.Text;
                txtReturningPasswordVisible.Visibility = Visibility.Collapsed;
                txtReturningPassword.Visibility = Visibility.Visible;
                pathReturningEyeIcon.Data = EyeOpenGeometry;
                txtReturningPassword.Focus();
            }
        }

        private void TxtReturningPassword_PasswordChanged(object sender, RoutedEventArgs e)
        {
            txtReturningPlaceholder.Visibility = string.IsNullOrEmpty(txtReturningPassword.Password) ? Visibility.Visible : Visibility.Collapsed;
            UpdateCapsLockWarning();
        }

        private void TxtReturningPasswordVisible_TextChanged(object sender, TextChangedEventArgs e)
        {
            txtReturningPlaceholder.Visibility = string.IsNullOrEmpty(txtReturningPasswordVisible.Text) ? Visibility.Visible : Visibility.Collapsed;
            UpdateCapsLockWarning();
        }

        private void TxtReturningPassword_KeyDown(object sender, KeyEventArgs e)
        {
            UpdateCapsLockWarning();
            if (e.Key == Key.Enter)
            {
                BtnReturningLogin_Click(sender, e);
            }
        }
        #endregion

        #region Standard Login Flow
        private async void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            if (ViewModel == null) return;
            ViewModel.Email = txtEmail.Text.Trim();
            ViewModel.Password = _isStandardPasswordRevealed ? txtPasswordVisible.Text : txtPassword.Password;
            await ViewModel.ExecuteStandardLoginAsync();
        }

        private void BtnTogglePassword_Click(object sender, RoutedEventArgs e)
        {
            _isStandardPasswordRevealed = !_isStandardPasswordRevealed;
            if (_isStandardPasswordRevealed)
            {
                txtPasswordVisible.Text = txtPassword.Password;
                txtPassword.Visibility = Visibility.Collapsed;
                txtPasswordVisible.Visibility = Visibility.Visible;
                pathEyeIcon.Data = EyeClosedGeometry;
                txtPasswordVisible.Focus();
                txtPasswordVisible.CaretIndex = txtPasswordVisible.Text.Length;
            }
            else
            {
                txtPassword.Password = txtPasswordVisible.Text;
                txtPasswordVisible.Visibility = Visibility.Collapsed;
                txtPassword.Visibility = Visibility.Visible;
                pathEyeIcon.Data = EyeOpenGeometry;
                txtPassword.Focus();
            }
        }

        private void TxtPassword_PasswordChanged(object sender, RoutedEventArgs e)
        {
            UpdateCapsLockWarning();
        }

        private void TxtPasswordVisible_TextChanged(object sender, TextChangedEventArgs e)
        {
            UpdateCapsLockWarning();
        }

        private void TxtStandardInput_KeyDown(object sender, KeyEventArgs e)
        {
            UpdateCapsLockWarning();
            if (e.Key == Key.Enter)
            {
                BtnLogin_Click(sender, e);
            }
        }
        #endregion
    }
}
