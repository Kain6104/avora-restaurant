using System.Windows;

namespace AvoraPosNative.Dialogs
{
    public static class DialogHelper
    {
        public static void CenterOnMainWindow(Window window)
        {
            if (Application.Current?.MainWindow != null && Application.Current.MainWindow.IsVisible)
            {
                window.Owner = Application.Current.MainWindow;
                window.WindowStartupLocation = WindowStartupLocation.CenterOwner;
            }
            else
            {
                window.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            }
        }
    }
}

