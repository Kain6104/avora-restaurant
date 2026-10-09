using System.Windows;
using System.Windows.Controls;

namespace AvoraPosNative.Dialogs
{
    public partial class GuestCountDialog : Window
    {
        public int GuestCount { get; private set; } = 2;

        public GuestCountDialog(int currentCount = 2, string? tableName = null)
        {
            InitializeComponent();
            GuestCount = currentCount > 0 ? currentCount : 2;
            txtGuestCount.Text = GuestCount.ToString();
            if (!string.IsNullOrEmpty(tableName))
            {
                txtTitle.Text = $"Chọn Số Khách - {tableName}";
            }
        }

        private void BtnMinus_Click(object sender, RoutedEventArgs e)
        {
            if (GuestCount > 1)
            {
                GuestCount--;
                txtGuestCount.Text = GuestCount.ToString();
            }
        }

        private void BtnPlus_Click(object sender, RoutedEventArgs e)
        {
            if (GuestCount < 100)
            {
                GuestCount++;
                txtGuestCount.Text = GuestCount.ToString();
            }
        }

        private void BtnPreset_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag != null && int.TryParse(btn.Tag.ToString(), out int val))
            {
                GuestCount = val;
                txtGuestCount.Text = GuestCount.ToString();
            }
        }

        private void BtnReset_Click(object sender, RoutedEventArgs e)
        {
            GuestCount = 1;
            txtGuestCount.Text = "1";
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = true;
            Close();
        }
    }
}
