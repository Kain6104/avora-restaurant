using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.ViewModels;

namespace AvoraPosNative.Views
{
    public partial class ProductMenuView : UserControl
    {
        public ProductMenuView()
        {
            InitializeComponent();
        }

        private void OnProductCardClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is PosProduct product)
            {
                if (DataContext is ProductMenuViewModel vm)
                {
                    vm.SelectProductCommand.Execute(product);
                }
            }
        }

        private void OnCategoryScrollUpClick(object sender, RoutedEventArgs e)
        {
            CategoryScrollViewer?.ScrollToVerticalOffset(CategoryScrollViewer.VerticalOffset - 120);
        }

        private void OnCategoryScrollDownClick(object sender, RoutedEventArgs e)
        {
            CategoryScrollViewer?.ScrollToVerticalOffset(CategoryScrollViewer.VerticalOffset + 120);
        }
    }
}
