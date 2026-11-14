using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace AvoraPosNative.Dialogs
{
    public enum AvoraDialogType
    {
        Info,
        Success,
        Warning,
        Error,
        Confirm
    }

    public partial class AvoraMessageDialog : Window
    {
        public bool Confirmed { get; private set; } = false;

        public AvoraMessageDialog(string message, string title = "Thông báo", AvoraDialogType type = AvoraDialogType.Info, string okText = "Đồng ý", string? cancelText = null)
        {
            InitializeComponent();
            TxtTitle.Text = title;
            TxtMessage.Text = message;
            BtnOk.Content = okText;

            ConfigureType(type, cancelText);
            DialogHelper.CenterOnMainWindow(this);
        }

        private void ConfigureType(AvoraDialogType type, string? cancelText)
        {
            switch (type)
            {
                case AvoraDialogType.Success:
                    IconBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#ECFDF5"));
                    IconBadge.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#A7F3D0"));
                    IconBadge.BorderThickness = new Thickness(1);
                    TxtIcon.Text = "✓";
                    TxtIcon.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#059669"));
                    BtnOk.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#059669"));
                    break;

                case AvoraDialogType.Warning:
                    IconBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFBEB"));
                    IconBadge.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FDE68A"));
                    IconBadge.BorderThickness = new Thickness(1);
                    TxtIcon.Text = "⚠️";
                    TxtIcon.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#D97706"));
                    BtnOk.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#D97706"));
                    break;

                case AvoraDialogType.Error:
                    IconBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FEF2F2"));
                    IconBadge.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FECDD3"));
                    IconBadge.BorderThickness = new Thickness(1);
                    TxtIcon.Text = "✕";
                    TxtIcon.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D"));
                    BtnOk.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D"));
                    break;

                case AvoraDialogType.Confirm:
                    IconBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EFF6FF"));
                    IconBadge.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#BFDBFE"));
                    IconBadge.BorderThickness = new Thickness(1);
                    TxtIcon.Text = "❓";
                    TxtIcon.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2563EB"));
                    BtnOk.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D"));

                    BtnCancel.Visibility = Visibility.Visible;
                    BtnCancel.Content = string.IsNullOrEmpty(cancelText) ? "Hủy bỏ" : cancelText;
                    Grid.SetColumnSpan(BtnOk, 1);
                    break;

                case AvoraDialogType.Info:
                default:
                    IconBadge.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F8FAFC"));
                    IconBadge.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E2E8F0"));
                    IconBadge.BorderThickness = new Thickness(1);
                    TxtIcon.Text = "ℹ️";
                    TxtIcon.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2563EB"));
                    BtnOk.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D"));
                    break;
            }

            if (type != AvoraDialogType.Confirm)
            {
                BtnCancel.Visibility = Visibility.Collapsed;
                Grid.SetColumn(BtnOk, 0);
                Grid.SetColumnSpan(BtnOk, 2);
                BtnOk.HorizontalAlignment = HorizontalAlignment.Center;
                BtnOk.MinWidth = 160;
            }
        }

        private void OnOkClick(object sender, RoutedEventArgs e)
        {
            Confirmed = true;
            DialogResult = true;
            Close();
        }

        private void OnCancelClick(object sender, RoutedEventArgs e)
        {
            Confirmed = false;
            DialogResult = false;
            Close();
        }

        // =========================================================================
        // STATIC CONVENIENCE METHODS
        // =========================================================================

        public static void Show(string message, string title = "Thông báo", AvoraDialogType type = AvoraDialogType.Info)
        {
            Application.Current?.Dispatcher.Invoke(() =>
            {
                var dlg = new AvoraMessageDialog(message, title, type);
                dlg.ShowDialog();
            });
        }

        public static void Success(string message, string title = "Thành công")
        {
            Show(message, title, AvoraDialogType.Success);
        }

        public static void Warning(string message, string title = "Cảnh báo")
        {
            Show(message, title, AvoraDialogType.Warning);
        }

        public static void Error(string message, string title = "Lỗi")
        {
            Show(message, title, AvoraDialogType.Error);
        }

        public static void Info(string message, string title = "Thông báo")
        {
            Show(message, title, AvoraDialogType.Info);
        }

        public static bool Confirm(string message, string title = "Xác nhận", string okText = "Đồng ý", string cancelText = "Hủy bỏ")
        {
            return Application.Current?.Dispatcher.Invoke(() =>
            {
                var dlg = new AvoraMessageDialog(message, title, AvoraDialogType.Confirm, okText, cancelText);
                return dlg.ShowDialog() == true && dlg.Confirmed;
            }) ?? false;
        }
    }
}
