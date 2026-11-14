using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using AvoraPosNative.Models;
using AvoraPosNative.Services;

namespace AvoraPosNative.Dialogs
{
    public partial class CustomerSelectDialog : Window
    {
        private readonly PosApiService _apiService;
        public PosCustomer? SelectedCustomer { get; private set; }
        public bool IsCleared { get; private set; }

        public CustomerSelectDialog()
        {
            InitializeComponent();
            _apiService = new PosApiService();

            if (Application.Current?.MainWindow != null && Application.Current.MainWindow.IsVisible)
            {
                Owner = Application.Current.MainWindow;
                WindowStartupLocation = WindowStartupLocation.CenterOwner;
            }
            else
            {
                WindowStartupLocation = WindowStartupLocation.CenterScreen;
            }

            Loaded += (s, e) =>
            {
                txtSearch.Focus();
            };
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void TxtSearch_KeyDown(object sender, KeyEventArgs e)
        {
            txtPlaceholder.Visibility = string.IsNullOrEmpty(txtSearch.Text) ? Visibility.Visible : Visibility.Collapsed;
            if (e.Key == Key.Enter)
            {
                DoSearch();
            }
        }

        private void BtnSearch_Click(object sender, RoutedEventArgs e)
        {
            DoSearch();
        }

        private async void DoSearch()
        {
            string keyword = txtSearch.Text?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(keyword))
            {
                AvoraMessageDialog.Warning("Vui lòng nhập SĐT, Tên hoặc Mã thẻ để tìm kiếm!", "Thông báo");
                return;
            }

            pnlResults.Children.Clear();
            var loadingText = new TextBlock
            {
                Text = "⏳ Đang tra cứu dữ liệu khách hàng...",
                FontSize = 13,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#64748B")),
                HorizontalAlignment = HorizontalAlignment.Center,
                Margin = new Thickness(0, 30, 0, 0)
            };
            pnlResults.Children.Add(loadingText);

            try
            {
                var customers = await _apiService.SearchCustomersAsync(keyword);
                pnlResults.Children.Clear();

                if (customers == null || customers.Count == 0)
                {
                    var emptyBorder = new Border
                    {
                        Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFFBEB")),
                        BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FDE68A")),
                        BorderThickness = new Thickness(1),
                        CornerRadius = new CornerRadius(10),
                        Padding = new Thickness(16),
                        Margin = new Thickness(0, 10, 0, 10)
                    };
                    var emptyStack = new StackPanel();
                    emptyStack.Children.Add(new TextBlock
                    {
                        Text = "Không tìm thấy khách hàng nào khớp với từ khóa!",
                        FontWeight = FontWeights.Bold,
                        Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#92400E")),
                        HorizontalAlignment = HorizontalAlignment.Center
                    });
                    emptyStack.Children.Add(new TextBlock
                    {
                        Text = "Bạn có thể tạo nhanh hội viên mới ở khung phía dưới.",
                        FontSize = 11.5,
                        Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#B45309")),
                        HorizontalAlignment = HorizontalAlignment.Center,
                        Margin = new Thickness(0, 4, 0, 0)
                    });
                    emptyBorder.Child = emptyStack;
                    pnlResults.Children.Add(emptyBorder);

                    // Show quick create form with pre-filled phone or name if applicable
                    pnlCreateNew.Visibility = Visibility.Visible;
                    if (keyword.StartsWith("0") || (keyword.Length >= 8 && long.TryParse(keyword, out _)))
                    {
                        txtNewPhone.Text = keyword;
                        txtNewName.Focus();
                    }
                    else
                    {
                        txtNewName.Text = keyword;
                        txtNewPhone.Focus();
                    }
                    return;
                }

                // Show found customers
                pnlCreateNew.Visibility = Visibility.Collapsed;
                foreach (var cust in customers)
                {
                    pnlResults.Children.Add(CreateCustomerCard(cust));
                }
            }
            catch (Exception ex)
            {
                pnlResults.Children.Clear();
                pnlResults.Children.Add(new TextBlock
                {
                    Text = $"Lỗi tìm kiếm: {ex.Message}",
                    Foreground = Brushes.Red,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    Margin = new Thickness(0, 20, 0, 0)
                });
            }
        }

        private Border CreateCustomerCard(PosCustomer cust)
        {
            var card = new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F8FAFC")),
                BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E2E8F0")),
                BorderThickness = new Thickness(1.5),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(14),
                Margin = new Thickness(0, 0, 0, 10)
            };

            var grid = new Grid();
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(44) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // Avatar circle
            var avatarBorder = new Border
            {
                Width = 40,
                Height = 40,
                CornerRadius = new CornerRadius(20),
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FEE2E2")),
                HorizontalAlignment = HorizontalAlignment.Left,
                VerticalAlignment = VerticalAlignment.Center
            };
            var avatarText = new TextBlock
            {
                Text = !string.IsNullOrEmpty(cust.FullName) ? cust.FullName.Substring(0, 1).ToUpper() : "👤",
                FontWeight = FontWeights.Black,
                FontSize = 16,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D")),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            avatarBorder.Child = avatarText;
            Grid.SetColumn(avatarBorder, 0);
            grid.Children.Add(avatarBorder);

            // Info Stack
            var infoStack = new StackPanel { VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(6, 0, 10, 0) };
            var nameBlock = new TextBlock
            {
                Text = cust.FullName,
                FontWeight = FontWeights.Bold,
                FontSize = 13.5,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0F172A"))
            };
            infoStack.Children.Add(nameBlock);

            var metaStack = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 3, 0, 0) };
            if (!string.IsNullOrEmpty(cust.Phone))
            {
                metaStack.Children.Add(new TextBlock
                {
                    Text = $"📞 {cust.Phone}",
                    FontSize = 11.5,
                    Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#475569")),
                    Margin = new Thickness(0, 0, 12, 0)
                });
            }
            metaStack.Children.Add(new TextBlock
            {
                Text = $"⭐ {cust.LoyaltyPoints:N0} điểm",
                FontSize = 11.5,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#D97706")),
                Margin = new Thickness(0, 0, 12, 0)
            });
            if (!string.IsNullOrEmpty(cust.MemberTier))
            {
                metaStack.Children.Add(new TextBlock
                {
                    Text = $"🏷️ {cust.MemberTier}",
                    FontSize = 11,
                    FontWeight = FontWeights.SemiBold,
                    Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2563EB"))
                });
            }
            infoStack.Children.Add(metaStack);
            Grid.SetColumn(infoStack, 1);
            grid.Children.Add(infoStack);

            // Select Button
            var selectBtn = new Button
            {
                Content = "Chọn",
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#DA251D")),
                Foreground = Brushes.White,
                FontWeight = FontWeights.Bold,
                FontSize = 12,
                Padding = new Thickness(14, 8, 14, 8),
                Cursor = Cursors.Hand
            };
            var btnTemplate = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Button.BackgroundProperty));
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));
            borderFactory.SetValue(Border.PaddingProperty, new TemplateBindingExtension(Button.PaddingProperty));
            var contentPresenter = new FrameworkElementFactory(typeof(ContentPresenter));
            contentPresenter.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            contentPresenter.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(contentPresenter);
            btnTemplate.VisualTree = borderFactory;
            selectBtn.Template = btnTemplate;

            selectBtn.Click += (s, e) =>
            {
                SelectedCustomer = cust;
                IsCleared = false;
                DialogResult = true;
                Close();
            };
            Grid.SetColumn(selectBtn, 2);
            grid.Children.Add(selectBtn);

            card.Child = grid;
            return card;
        }

        private async void BtnCreateAndSelect_Click(object sender, RoutedEventArgs e)
        {
            string name = txtNewName.Text?.Trim() ?? string.Empty;
            string phone = txtNewPhone.Text?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(phone))
            {
                AvoraMessageDialog.Warning("Số điện thoại không được để trống!", "Lỗi nhập liệu");
                return;
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                name = "Khách hàng " + phone;
            }

            try
            {
                var created = await _apiService.CreateMemberAsync(name, phone);
                if (created != null)
                {
                    SelectedCustomer = created;
                    IsCleared = false;
                    DialogResult = true;
                    Close();
                }
                else
                {
                    AvoraMessageDialog.Error("Không thể tạo khách hàng mới trên máy chủ!", "Lỗi");
                }
            }
            catch (Exception ex)
            {
                AvoraMessageDialog.Error($"Lỗi tạo thành viên: {ex.Message}", "Lỗi");
            }
        }

        private void BtnClearCustomer_Click(object sender, RoutedEventArgs e)
        {
            SelectedCustomer = null;
            IsCleared = true;
            DialogResult = true;
            Close();
        }
    }
}

