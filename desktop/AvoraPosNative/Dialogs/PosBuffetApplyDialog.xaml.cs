using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Models;

namespace AvoraPosNative.Dialogs
{
    public class BuffetPackageItemUi : INotifyPropertyChanged
    {
        private bool _isSelected;
        public PosBuffetPackage Package { get; }

        public string Id => Package.Id;
        public string Name => Package.Name;
        public string? Description => Package.Description;

        public bool IsSelected
        {
            get => _isSelected;
            set
            {
                if (_isSelected != value)
                {
                    _isSelected = value;
                    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(IsSelected)));
                }
            }
        }

        public string ItemsCountText => $"Gồm {Package.Items?.Count ?? 0} món gọi 0đ";
        public string PriceText
        {
            get
            {
                var minTicket = Package.Tickets?.FirstOrDefault()?.Product?.Price ?? 0;
                return minTicket > 0 ? $"Từ {minTicket:N0}đ" : "Buffet";
            }
        }

        public BuffetPackageItemUi(PosBuffetPackage package, bool isSelected = false)
        {
            Package = package;
            _isSelected = isSelected;
        }

        public event PropertyChangedEventHandler? PropertyChanged;
    }

    public class BuffetTicketItemUi : INotifyPropertyChanged
    {
        private int _quantity;

        public string ProductId { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public PosProduct? Product { get; set; }

        public int Quantity
        {
            get => _quantity;
            set
            {
                if (_quantity != value)
                {
                    _quantity = value;
                    PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(nameof(Quantity)));
                }
            }
        }

        public string PriceText => $"{Price:N0}đ";

        public event PropertyChangedEventHandler? PropertyChanged;
    }

    public partial class PosBuffetApplyDialog : Window
    {
        public ObservableCollection<BuffetPackageItemUi> Packages { get; } = new();
        public ObservableCollection<BuffetTicketItemUi> CurrentTickets { get; } = new();

        public PosBuffetPackage? SelectedPackage { get; private set; }
        public List<PosOrderItem> SelectedTicketOrders { get; private set; } = new();
        public HashSet<string> BuffetItemProductIds { get; private set; } = new();

        public PosBuffetApplyDialog(List<PosBuffetPackage> packages, string tableName = "Bàn", int guestCount = 2)
        {
            InitializeComponent();
            DialogHelper.CenterOnMainWindow(this);
            TxtSubtitle.Text = $"{tableName} • Đang phục vụ {guestCount} khách";

            foreach (var p in packages)
            {
                Packages.Add(new BuffetPackageItemUi(p, false));
            }

            PackagesList.ItemsSource = Packages;
            TicketsList.ItemsSource = CurrentTickets;

            if (Packages.Count > 0)
            {
                SelectPackage(Packages[0], guestCount);
            }

            if (Application.Current?.MainWindow != null && Application.Current.MainWindow.IsVisible)
            {
                Owner = Application.Current.MainWindow;
            }
        }

        private void SelectPackage(BuffetPackageItemUi packageUi, int defaultCount = 1)
        {
            foreach (var p in Packages)
            {
                p.IsSelected = (p.Id == packageUi.Id);
            }

            SelectedPackage = packageUi.Package;
            CurrentTickets.Clear();

            if (SelectedPackage.Tickets != null)
            {
                bool isFirst = true;
                foreach (var t in SelectedPackage.Tickets)
                {
                    CurrentTickets.Add(new BuffetTicketItemUi
                    {
                        ProductId = t.ProductId,
                        ProductName = t.Product?.Name ?? "Vé Buffet",
                        Price = t.Product?.Price ?? 0,
                        Product = t.Product,
                        Quantity = isFirst ? Math.Max(1, defaultCount) : 0
                    });
                    isFirst = false;
                }
            }

            // Collect all 0đ items in this buffet package
            BuffetItemProductIds.Clear();
            if (SelectedPackage.Items != null)
            {
                foreach (var item in SelectedPackage.Items)
                {
                    if (!string.IsNullOrEmpty(item.ProductId))
                    {
                        BuffetItemProductIds.Add(item.ProductId);
                    }
                }
            }

            UpdateTotals();
        }

        private void OnSelectPackageClick(object sender, MouseButtonEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is BuffetPackageItemUi pkgUi)
            {
                SelectPackage(pkgUi, CurrentTickets.Sum(t => t.Quantity));
            }
        }

        private void OnDecreaseTicketClick(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is BuffetTicketItemUi ticket)
            {
                if (ticket.Quantity > 0)
                {
                    ticket.Quantity--;
                    UpdateTotals();
                }
            }
        }

        private void OnIncreaseTicketClick(object sender, RoutedEventArgs e)
        {
            if (sender is FrameworkElement elem && elem.DataContext is BuffetTicketItemUi ticket)
            {
                ticket.Quantity++;
                UpdateTotals();
            }
        }

        private void UpdateTotals()
        {
            int totalTickets = CurrentTickets.Sum(t => t.Quantity);
            decimal totalAmount = CurrentTickets.Sum(t => t.Quantity * t.Price);
            TxtTotalEstimate.Text = $"{totalAmount:N0}đ ({totalTickets} vé)";
        }

        private void OnCloseClick(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void OnConfirmApplyClick(object sender, RoutedEventArgs e)
        {
            int totalTickets = CurrentTickets.Sum(t => t.Quantity);
            if (totalTickets == 0)
            {
                AvoraMessageDialog.Warning("Vui lòng chọn ít nhất 1 vé Buffet!", "Thông báo");
                return;
            }

            SelectedTicketOrders.Clear();
            foreach (var t in CurrentTickets)
            {
                if (t.Quantity > 0)
                {
                    SelectedTicketOrders.Add(new PosOrderItem
                    {
                        Id = Guid.NewGuid().ToString(),
                        ProductId = t.ProductId,
                        ProductName = t.ProductName,
                        Quantity = t.Quantity,
                        Price = t.Price,
                        LineTotal = t.Quantity * t.Price,
                        Status = "NEW",
                        PricingMode = "BUFFET_TICKET"
                    });
                }
            }

            DialogResult = true;
            Close();
        }
    }
}

