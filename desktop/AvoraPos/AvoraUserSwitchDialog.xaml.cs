using System.Windows;
using System.Windows.Input;

namespace AvoraPos
{
    public partial class AvoraUserSwitchDialog : Window
    {
        public AvoraUserSwitchDialog(string currentUserName, string currentUserEmail, string incomingUserName, string incomingUserEmail)
        {
            InitializeComponent();

            txtCurrentUser.Text = $"{currentUserName} ({currentUserEmail})";
            txtIncomingUser.Text = $"{incomingUserName} ({incomingUserEmail})";

            KeyDown += AvoraUserSwitchDialog_KeyDown;
        }

        private void AvoraUserSwitchDialog_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                DialogResult = false;
                Close();
            }
        }

        private void BtnKeepCurrent_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnSwitchUser_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = true;
            Close();
        }
    }
}
