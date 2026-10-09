using System.Windows;

namespace AvoraPosNative.Dialogs
{
    public partial class ExitDialog : Window
    {
        public bool IsConfirmed { get; private set; } = false;

        public ExitDialog(bool hasPendingTasks = false)
        {
            InitializeComponent();
            if (hasPendingTasks)
            {
                pnlUnsafeWarning.Visibility = Visibility.Visible;
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            IsConfirmed = false;
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            IsConfirmed = true;
            DialogResult = true;
            Close();
        }
    }
}
