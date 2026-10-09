using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AvoraPosNative.Models;

namespace AvoraPosNative.Dialogs
{
    public partial class ProductOptionDialog : Window
    {
        private readonly PosProduct _product;
        private readonly List<PosCartItemOption> _selectedOptions = new();
        private readonly Dictionary<string, List<CheckBox>> _groupCheckBoxes = new();
        private readonly Dictionary<string, List<RadioButton>> _groupRadioButtons = new();

        public List<PosCartItemOption> SelectedOptions => _selectedOptions;
        public string? ItemNote => txtNote.Text.Trim();
        public decimal FinalUnitPrice { get; private set; }

        public ProductOptionDialog(PosProduct product, string? existingNote = null)
        {
            InitializeComponent();
            _product = product;
            FinalUnitPrice = product.EffectivePrice;

            txtProductName.Text = product.Name;
            txtProductBasePrice.Text = $"Đơn giá cơ bản: {product.EffectivePrice:N0}đ";
            if (!string.IsNullOrEmpty(existingNote))
            {
                txtNote.Text = existingNote;
            }

            BuildOptionGroupsUI();
            RecalculatePrice();
        }

        private void BuildOptionGroupsUI()
        {
            pnlOptionGroups.Children.Clear();

            foreach (var group in _product.OptionGroups)
            {
                var groupBorder = new Border
                {
                    Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F8FAFC")),
                    BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E2E8F0")),
                    BorderThickness = new Thickness(1),
                    CornerRadius = new CornerRadius(10),
                    Padding = new Thickness(14, 10, 14, 12),
                    Margin = new Thickness(0, 0, 0, 12)
                };

                var sp = new StackPanel();

                var headerSp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 0, 0, 8) };
                var titleText = new TextBlock
                {
                    Text = group.Name,
                    FontWeight = FontWeights.Bold,
                    FontSize = 14,
                    Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A")),
                    Margin = new Thickness(0, 0, 8, 0)
                };
                headerSp.Children.Add(titleText);

                if (group.IsRequired)
                {
                    var reqBadge = new Border
                    {
                        Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FEE2E2")),
                        BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FECACA")),
                        BorderThickness = new Thickness(1),
                        CornerRadius = new CornerRadius(4),
                        Padding = new Thickness(6, 2, 6, 2)
                    };
                    reqBadge.Child = new TextBlock { Text = "Bắt buộc", FontSize = 10, Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DC2626")), FontWeight = FontWeights.Bold };
                    headerSp.Children.Add(reqBadge);
                }
                sp.Children.Add(headerSp);

                if (group.MultipleChoice)
                {
                    _groupCheckBoxes[group.Id] = new List<CheckBox>();
                    foreach (var item in group.OptionItems)
                    {
                        string priceText = item.PriceAdjustment > 0 ? $" (+{item.PriceAdjustment:N0}đ)" : "";
                        var cb = new CheckBox
                        {
                            Content = $"{item.Name}{priceText}",
                            Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#334155")),
                            FontSize = 13,
                            Margin = new Thickness(0, 4, 0, 4),
                            IsChecked = item.IsDefault,
                            Tag = item
                        };
                        cb.Checked += (s, e) => RecalculatePrice();
                        cb.Unchecked += (s, e) => RecalculatePrice();
                        _groupCheckBoxes[group.Id].Add(cb);
                        sp.Children.Add(cb);
                    }
                }
                else
                {
                    _groupRadioButtons[group.Id] = new List<RadioButton>();
                    string groupName = $"Group_{group.Id}";
                    foreach (var item in group.OptionItems)
                    {
                        string priceText = item.PriceAdjustment > 0 ? $" (+{item.PriceAdjustment:N0}đ)" : "";
                        var rb = new RadioButton
                        {
                            GroupName = groupName,
                            Content = $"{item.Name}{priceText}",
                            Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#334155")),
                            FontSize = 13,
                            Margin = new Thickness(0, 4, 0, 4),
                            IsChecked = item.IsDefault,
                            Tag = item
                        };
                        rb.Checked += (s, e) => RecalculatePrice();
                        rb.Unchecked += (s, e) => RecalculatePrice();
                        _groupRadioButtons[group.Id].Add(rb);
                        sp.Children.Add(rb);
                    }
                }

                groupBorder.Child = sp;
                pnlOptionGroups.Children.Add(groupBorder);
            }
        }

        private void RecalculatePrice()
        {
            decimal adj = 0;
            _selectedOptions.Clear();

            foreach (var kvp in _groupCheckBoxes)
            {
                foreach (var cb in kvp.Value)
                {
                    if (cb.IsChecked == true && cb.Tag is PosOptionItem item)
                    {
                        adj += item.PriceAdjustment;
                        _selectedOptions.Add(new PosCartItemOption
                        {
                            OptionItemId = item.Id,
                            NameAtSale = item.Name,
                            PriceAdjustmentAtSale = item.PriceAdjustment
                        });
                    }
                }
            }

            foreach (var kvp in _groupRadioButtons)
            {
                foreach (var rb in kvp.Value)
                {
                    if (rb.IsChecked == true && rb.Tag is PosOptionItem item)
                    {
                        adj += item.PriceAdjustment;
                        _selectedOptions.Add(new PosCartItemOption
                        {
                            OptionItemId = item.Id,
                            NameAtSale = item.Name,
                            PriceAdjustmentAtSale = item.PriceAdjustment
                        });
                    }
                }
            }

            FinalUnitPrice = _product.EffectivePrice + adj;
            txtEffectivePrice.Text = $"{FinalUnitPrice:N0}đ";
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnConfirm_Click(object sender, RoutedEventArgs e)
        {
            // Validate required groups
            foreach (var group in _product.OptionGroups)
            {
                if (group.IsRequired)
                {
                    bool selected = false;
                    if (group.MultipleChoice && _groupCheckBoxes.ContainsKey(group.Id))
                    {
                        selected = _groupCheckBoxes[group.Id].Exists(cb => cb.IsChecked == true);
                    }
                    else if (!group.MultipleChoice && _groupRadioButtons.ContainsKey(group.Id))
                    {
                        selected = _groupRadioButtons[group.Id].Exists(rb => rb.IsChecked == true);
                    }

                    if (!selected)
                    {
                        MessageBox.Show($"Vui lòng chọn tùy chọn cho nhóm: {group.Name}", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }
                }
            }

            DialogResult = true;
            Close();
        }
    }
}
