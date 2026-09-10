using System.Windows;
using System.Windows.Input;

namespace AvoraPos
{
    public partial class AvoraExitDialog : Window
    {
        public AvoraExitDialog(bool hasUnsafeTasks = false)
        {
            InitializeComponent();

            if (hasUnsafeTasks)
            {
                pnlUnsafeWarning.Visibility = Visibility.Visible;
                Height = 420;
            }
            else
            {
                pnlUnsafeWarning.Visibility = Visibility.Collapsed;
                Height = 340;
            }

            KeyDown += AvoraExitDialog_KeyDown;
        }

        private void AvoraExitDialog_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                DialogResult = false;
                Close();
            }
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
