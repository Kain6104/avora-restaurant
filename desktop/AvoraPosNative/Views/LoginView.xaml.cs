using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using AvoraPosNative.ViewModels;

namespace AvoraPosNative.Views
{
    public partial class LoginView : UserControl
    {
        private LoginViewModel? ViewModel => DataContext as LoginViewModel;
        private bool _isPasswordRevealed = false;

        private static readonly Geometry EyeOpenGeometry =
            Geometry.Parse("M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z");
        
        private static readonly Geometry EyeClosedGeometry =
            Geometry.Parse("M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z");

        public LoginView()
        {
            InitializeComponent();
            Loaded += (s, e) =>
            {
                if (ViewModel != null)
                {
                    txtEmail.Text = ViewModel.Email;
                    if (!string.IsNullOrEmpty(txtEmail.Text))
                    {
                        txtPassword.Focus();
                    }
                    else
                    {
                        txtEmail.Focus();
                    }

                    ViewModel.PropertyChanged += (vs, ve) =>
                    {
                        if (ve.PropertyName == nameof(LoginViewModel.ErrorMessage))
                        {
                            if (string.IsNullOrEmpty(ViewModel.ErrorMessage))
                            {
                                loginErrorBanner.Visibility = Visibility.Collapsed;
                            }
                            else
                            {
                                txtErrorMessage.Text = ViewModel.ErrorMessage;
                                loginErrorBanner.Visibility = Visibility.Visible;
                            }
                        }
                        else if (ve.PropertyName == nameof(LoginViewModel.IsLoading))
                        {
                            loginProgress.Visibility = ViewModel.IsLoading ? Visibility.Visible : Visibility.Collapsed;
                            btnLogin.IsEnabled = !ViewModel.IsLoading;
                            btnLogin.Content = ViewModel.IsLoading ? "Đang đăng nhập..." : "ĐĂNG NHẬP";
                            btnGoogleLogin.IsEnabled = !ViewModel.IsLoading;
                        }
                        else if (ve.PropertyName == nameof(LoginViewModel.IsGoogleWaiting))
                        {
                            txtGoogleStatus.Visibility = ViewModel.IsGoogleWaiting ? Visibility.Visible : Visibility.Collapsed;
                        }
                        else if (ve.PropertyName == nameof(LoginViewModel.ServerStatus))
                        {
                            txtServerStatus.Text = ViewModel.ServerStatus;
                        }
                    };
                }
            };
        }

        private async void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            if (ViewModel == null) return;
            ViewModel.Email = txtEmail.Text.Trim();
            ViewModel.Password = _isPasswordRevealed ? txtPasswordVisible.Text : txtPassword.Password;
            await ViewModel.ExecuteLoginAsync();
        }

        private void BtnGoogleLogin_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.GoogleLoginCommand.Execute(null);
        }

        private void BtnExitApp_Click(object sender, RoutedEventArgs e)
        {
            ViewModel?.ExitCommand.Execute(null);
        }

        private void BtnTogglePassword_Click(object sender, RoutedEventArgs e)
        {
            _isPasswordRevealed = !_isPasswordRevealed;
            if (_isPasswordRevealed)
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

        private void TxtInput_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                BtnLogin_Click(sender, e);
            }
        }
    }
}
