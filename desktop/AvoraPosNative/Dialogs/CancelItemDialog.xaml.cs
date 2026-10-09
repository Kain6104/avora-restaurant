using System.Windows;
using System.Windows.Controls;

namespace AvoraPosNative.Dialogs
{
    public partial class CancelItemDialog : Window
    {
        public string CancelReason { get; private set; } = "Khách đổi ý";

        public CancelItemDialog(string title = "Hủy Món Ăn", string? subtitle = null)
        {
            InitializeComponent();
            txtDialogTitle.Text = title;
            if (!string.IsNullOrEmpty(subtitle))
            {
                txtItemName.Text = subtitle;
            }
            txtReason.Text = CancelReason;
        }

        private void BtnReason_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Content != null)
            {
                txtReason.Text = btn.Content.ToString();
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            CancelReason = !string.IsNullOrWhiteSpace(txtReason.Text) ? txtReason.Text.Trim() : "Khách đổi ý";
            DialogResult = true;
            Close();
        }
    }
}
