using System;
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
                    // 1-Click Instant Order Opening (100% parity with /admin/pos TableMap.tsx)
                    vm.SelectTableCommand.Execute(table);
                }
            }
        }

        private void OnScrollUpClick(object sender, RoutedEventArgs e)
        {
            TablesScrollViewer?.ScrollToVerticalOffset(Math.Max(0, TablesScrollViewer.VerticalOffset - 240));
        }

        private void OnScrollDownClick(object sender, RoutedEventArgs e)
        {
            TablesScrollViewer?.ScrollToVerticalOffset(TablesScrollViewer.VerticalOffset + 240);
        }
    }
}
