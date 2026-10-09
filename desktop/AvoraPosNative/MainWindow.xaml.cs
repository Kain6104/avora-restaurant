using System;
using System.ComponentModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Dialogs;
using AvoraPosNative.Security;
using AvoraPosNative.Services;
using AvoraPosNative.ViewModels;
using AvoraPosNative.Views;

namespace AvoraPosNative
{
    public partial class MainWindow : Window
    {
        private readonly AuthService _authService;
        private readonly PosApiService _apiService;
        private readonly RealtimeService _realtimeService;

        private LoginView? _loginView;
        private PosShellView? _posShellView;
        private PosShellViewModel? _shellVm;
        private bool _allowClose = false;

        public MainWindow()
        {
            InitializeComponent();

            try
            {
                var iconUri = new Uri("pack://application:,,,/Assets/avora_logo_desktop.ico", UriKind.RelativeOrAbsolute);
                this.Icon = System.Windows.Media.Imaging.BitmapFrame.Create(iconUri);
            }
            catch { }

            _authService = new AuthService();
            _apiService = new PosApiService();
            _realtimeService = new RealtimeService();

            Loaded += async (s, e) => await InitializeApplicationAsync();
        }

        private async Task InitializeApplicationAsync()
        {
            App.TraceLog($"InitializeApplicationAsync start. HasActiveSession={SecureSessionManager.HasActiveSession()}");
            if (SecureSessionManager.HasActiveSession())
            {
                var session = SecureSessionManager.LoadSession();
                App.TraceLog($"Loaded session: UserId={session?.UserId}, Role={session?.Role}");
                if (session != null && !string.IsNullOrWhiteSpace(session.AccessToken))
                {
                    // Audit RBAC with backend as Single Source of Truth (Directive 2)
                    var meResult = await _authService.VerifyCurrentSessionAsync(session.AccessToken);
                    App.TraceLog($"VerifyCurrentSessionAsync result: HasPosAccess={meResult?.HasPosAccess}");
                    if (meResult != null && meResult.HasPosAccess)
                    {
                        NavigateToPosShell();
                        return;
                    }
                }
            }

            App.TraceLog("Navigating to login screen");
            NavigateToLogin();
        }

        public void NavigateToLogin()
        {
            var loginVm = new LoginViewModel(_authService);
            loginVm.LoginSucceeded += (profile) =>
            {
                NavigateToPosShell();
            };

            _loginView = new LoginView { DataContext = loginVm };
            MainContentHost.Content = _loginView;
        }

        public void NavigateToPosShell()
        {
            Dispatcher.Invoke(() =>
            {
                _shellVm = new PosShellViewModel(_apiService, _realtimeService);
                _shellVm.LogoutRequested += () =>
                {
                    SecureSessionManager.ClearSession();
                    NavigateToLogin();
                };

                _posShellView = new PosShellView { DataContext = _shellVm };
                MainContentHost.Content = _posShellView;

                _ = _shellVm.InitializeAsync();
            });
        }

        public void HandleDeepLink(string uri)
        {
            Dispatcher.Invoke(() =>
            {
                if (_loginView?.DataContext is LoginViewModel loginVm)
                {
                    loginVm.HandleDeepLink(uri);
                }
            });
        }

        private void OnWindowKeyDown(object sender, KeyEventArgs e)
        {
            // F11: Toggle Fullscreen
            if (e.Key == Key.F11)
            {
                if (WindowStyle == WindowStyle.None)
                {
                    WindowStyle = WindowStyle.SingleBorderWindow;
                    WindowState = WindowState.Normal;
                }
                else
                {
                    WindowStyle = WindowStyle.None;
                    WindowState = WindowState.Maximized;
                }
                e.Handled = true;
                return;
            }

            // Route operational shortcuts when in PosShell
            if (_shellVm != null && MainContentHost.Content is PosShellView)
            {
                switch (e.Key)
                {
                    case Key.F1:
                        _shellVm.ActiveTab = "TABLES";
                        e.Handled = true;
                        break;
                    case Key.F2:
                        _shellVm.ActiveTab = "ORDER";
                        e.Handled = true;
                        break;
                    case Key.F3:
                        _shellVm.ActiveTab = "KITCHEN";
                        e.Handled = true;
                        break;
                    case Key.F4:
                        _shellVm.ActiveTab = "RESERVATIONS";
                        e.Handled = true;
                        break;
                    case Key.F5:
                        if (_shellVm.ActiveTab == "ORDER")
                        {
                            _shellVm.OrderVm.PaymentCommand.Execute(null);
                        }
                        else
                        {
                            _shellVm.ActiveTab = "SHIFT";
                        }
                        e.Handled = true;
                        break;
                    case Key.F6:
                        _shellVm.ActiveTab = "SETTINGS";
                        e.Handled = true;
                        break;
                }
            }
        }

        private void OnWindowClosing(object sender, CancelEventArgs e)
        {
            App.TraceLog($"OnWindowClosing called. _allowClose={_allowClose}, IsLoaded={this.IsLoaded}, IsVisible={this.IsVisible}");
            if (_allowClose) return;

            if (!this.IsLoaded || !this.IsVisible)
            {
                _allowClose = true;
                return;
            }

            e.Cancel = true;

            try
            {
                var exitDialog = new ExitDialog();
                if (this.IsVisible)
                {
                    exitDialog.Owner = this;
                }

                if (exitDialog.ShowDialog() == true)
                {
                    _allowClose = true;
                    Application.Current.Shutdown();
                }
            }
            catch
            {
                _allowClose = true;
                Application.Current.Shutdown();
            }
        }
    }
}
