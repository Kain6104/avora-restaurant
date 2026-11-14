using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace AvoraPosNative.Views
{
    public partial class PosSettingsDrawerView : UserControl
    {
        public PosSettingsDrawerView()
        {
            InitializeComponent();
        }

        private void OnQuickNavClicked(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string tabName && DataContext is ViewModels.PosShellViewModel vm)
            {
                vm.SwitchTabCommand.Execute(tabName);
            }
        }

        private void OnTabSelected(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string tag)
            {
                ResetTabButtons();
                btn.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D"));
                btn.Foreground = Brushes.White;

                PanelPrinters.Visibility = tag == "PRINTERS" ? Visibility.Visible : Visibility.Collapsed;
                PanelShift.Visibility = tag == "SHIFT" ? Visibility.Visible : Visibility.Collapsed;
                PanelKitchen.Visibility = tag == "KITCHEN" ? Visibility.Visible : Visibility.Collapsed;
                PanelSync.Visibility = tag == "SYNC" ? Visibility.Visible : Visibility.Collapsed;
                PanelGeneral.Visibility = tag == "GENERAL" ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        private void ResetTabButtons()
        {
            var transparent = Brushes.Transparent;
            var darkText = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#334155"));

            BtnTabPrinters.Background = transparent;
            BtnTabPrinters.Foreground = darkText;

            BtnTabShift.Background = transparent;
            BtnTabShift.Foreground = darkText;

            BtnTabKitchen.Background = transparent;
            BtnTabKitchen.Foreground = darkText;

            BtnTabSync.Background = transparent;
            BtnTabSync.Foreground = darkText;

            BtnTabGeneral.Background = transparent;
            BtnTabGeneral.Foreground = darkText;
        }
    }
}
