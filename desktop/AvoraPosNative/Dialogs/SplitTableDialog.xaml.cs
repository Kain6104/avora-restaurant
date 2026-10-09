using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AvoraPosNative.Models;

namespace AvoraPosNative.Dialogs
{
    public class SplitItemSelection
    {
        public PosCartItem Item { get; set; } = null!;
        public int SplitQuantity { get; set; } = 1;
        public bool IsSelected { get; set; } = false;
    }

    public partial class SplitTableDialog : Window
    {
        private readonly List<SplitItemSelection> _selections = new();
        public List<SplitItemSelection> SelectedItemsToMove => _selections.FindAll(s => s.IsSelected && s.SplitQuantity > 0);
        public PosTable? SelectedDestinationTable { get; private set; }

        public SplitTableDialog(PosOrder order, List<PosTable> allTables)
            : this(
                order.OrderItems.Count > 0
                    ? order.OrderItems
                    : order.Items.ConvertAll(i => new PosCartItem { ProductId = i.ProductId, ProductName = i.ProductName, Quantity = i.Quantity, PriceAtSale = i.Price }),
                allTables.FindAll(t => t.VisualStatus == "VACANT" && t.Id != order.TableId))
        {
        }

        public SplitTableDialog(List<PosCartItem> orderItems, List<PosTable> vacantTables)
        {
            InitializeComponent();

            pnlItems.Children.Clear();
            foreach (var item in orderItems)
            {
                var sel = new SplitItemSelection { Item = item, SplitQuantity = item.Quantity, IsSelected = false };
                _selections.Add(sel);

                var row = new Grid { Margin = new Thickness(0, 4, 0, 4) };
                row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(30) });
                row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
                row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(110) });

                var cb = new CheckBox { VerticalAlignment = VerticalAlignment.Center };
                cb.Checked += (s, e) => sel.IsSelected = true;
                cb.Unchecked += (s, e) => sel.IsSelected = false;
                Grid.SetColumn(cb, 0);

                var titleSp = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
                titleSp.Children.Add(new TextBlock { Text = item.ProductName, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")), FontWeight = FontWeights.Bold, FontSize = 13 });
                titleSp.Children.Add(new TextBlock { Text = $"{item.PriceAtSale:N0}đ • Gốc: {item.Quantity}", Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#64748B")), FontSize = 11 });
                Grid.SetColumn(titleSp, 1);

                var qtySp = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
                var btnMinus = new Button { Content = "-", Width = 30, Height = 30, Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F1F5F9")), Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")), BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1")), BorderThickness = new Thickness(1) };
                var txtQty = new TextBlock { Text = sel.SplitQuantity.ToString(), Width = 35, TextAlignment = TextAlignment.Center, VerticalAlignment = VerticalAlignment.Center, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")), FontWeight = FontWeights.Bold };
                var btnPlus = new Button { Content = "+", Width = 30, Height = 30, Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F1F5F9")), Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")), BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1")), BorderThickness = new Thickness(1) };

                btnMinus.Click += (s, e) =>
                {
                    if (sel.SplitQuantity > 1)
                    {
                        sel.SplitQuantity--;
                        txtQty.Text = sel.SplitQuantity.ToString();
                    }
                };

                btnPlus.Click += (s, e) =>
                {
                    if (sel.SplitQuantity < item.Quantity)
                    {
                        sel.SplitQuantity++;
                        txtQty.Text = sel.SplitQuantity.ToString();
                    }
                };

                qtySp.Children.Add(btnMinus);
                qtySp.Children.Add(txtQty);
                qtySp.Children.Add(btnPlus);
                Grid.SetColumn(qtySp, 2);

                row.Children.Add(cb);
                row.Children.Add(titleSp);
                row.Children.Add(qtySp);

                pnlItems.Children.Add(row);
            }

            cboDestinationTable.Items.Clear();
            foreach (var table in vacantTables)
            {
                var cbi = new ComboBoxItem
                {
                    Content = $"{table.Name} ({table.AreaName} - {table.Capacity} khách)",
                    Tag = table
                };
                cboDestinationTable.Items.Add(cbi);
            }
            if (cboDestinationTable.Items.Count > 0)
            {
                cboDestinationTable.SelectedIndex = 0;
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            var selected = SelectedItemsToMove;
            if (selected.Count == 0)
            {
                MessageBox.Show("Vui lòng tích chọn ít nhất 1 món để tách.", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (cboDestinationTable.SelectedItem is ComboBoxItem cbi && cbi.Tag is PosTable dest)
            {
                SelectedDestinationTable = dest;
            }

            if (SelectedDestinationTable == null)
            {
                MessageBox.Show("Vui lòng chọn bàn chuyển đến.", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DialogResult = true;
            Close();
        }
    }
}
