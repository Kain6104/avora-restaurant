using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.ViewModels;

namespace AvoraPosNative.Views
{
    public partial class OrderListView : UserControl
    {
        public OrderListView()
        {
            InitializeComponent();
        }

        private void OnResetAllFilterClick(object sender, RoutedEventArgs e)
        {
            if (DataContext is OrderListViewModel vm)
            {
                vm.StatusFilter = "ALL";
                vm.TypeFilter = "ALL";
            }
        }

        private void OnOrderCardClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is PosOrder order)
            {
                if (DataContext is OrderListViewModel vm)
                {
                    // 1-Click Instant Order Opening (100% parity with /admin/pos OrdersListPanel.tsx)
                    vm.SelectOrderCommand.Execute(order);
                }
            }
        }

        private void OnScrollUpClick(object sender, RoutedEventArgs e)
        {
            OrdersScrollViewer?.ScrollToVerticalOffset(Math.Max(0, OrdersScrollViewer.VerticalOffset - 240));
        }

        private void OnScrollDownClick(object sender, RoutedEventArgs e)
        {
            OrdersScrollViewer?.ScrollToVerticalOffset(OrdersScrollViewer.VerticalOffset + 240);
        }
    }
}
