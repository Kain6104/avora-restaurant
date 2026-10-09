using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.ViewModels;

namespace AvoraPosNative.Views
{
    public partial class TableMapView : UserControl
    {
        public TableMapView()
        {
            InitializeComponent();
        }

        private void OnTableCardClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is PosTable table)
            {
                if (DataContext is TableMapViewModel vm)
                {
                    vm.SelectedTable = table;

                    // Double click opens order directly
                    if (e.ClickCount == 2)
                    {
                        vm.OpenTableOrderCommand.Execute(table);
                    }
                }
            }
        }
    }
}
