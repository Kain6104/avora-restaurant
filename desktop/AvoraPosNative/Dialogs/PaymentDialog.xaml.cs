using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using AvoraPosNative.Models;

namespace AvoraPosNative.Dialogs
{
    public class PaymentResult
    {
        public string PaymentMethod { get; set; } = "CASH";
        public decimal TotalAmount { get; set; }
        public decimal ReceivedAmount { get; set; }
        public decimal ChangeAmount { get; set; }
        public string? DiscountVoucherCode { get; set; }
        public string? ShippingVoucherCode { get; set; }
        public bool IsInvoiceRequested { get; set; }
        public bool AutoPrintReceipt { get; set; } = true;
    }

    public partial class PaymentDialog : Window
    {
        private readonly PosOrder _order;
        private string _selectedMethod = "CASH";
        private decimal _baseTotalAmount = 0;
        private decimal _discountVoucherAmount = 0;
        private decimal _shippingVoucherAmount = 0;

        public PaymentResult? Result { get; private set; }

        public PaymentDialog(PosOrder order)
        {
            InitializeComponent();
            _order = order;
            _baseTotalAmount = order.TotalAmount;

            txtOrderInfo.Text = $"Bàn: {order.Table?.Name ?? "Mang đi"} • {order.OrderCode ?? "Đơn tạm"}";
            UpdateTotals();

            // Default cash received equals total
            txtReceivedAmount.Text = ((long)_baseTotalAmount).ToString();
        }

        private void UpdateTotals()
        {
            decimal netTotal = Math.Max(0, _baseTotalAmount - _discountVoucherAmount - _shippingVoucherAmount);
            txtTotalDue.Text = $"{netTotal:N0}đ";
            CalculateChange();
        }

        private void CalculateChange()
        {
            decimal netTotal = Math.Max(0, _baseTotalAmount - _discountVoucherAmount - _shippingVoucherAmount);
            if (decimal.TryParse(txtReceivedAmount.Text.Replace(",", "").Replace(".", ""), out decimal received))
            {
                decimal change = Math.Max(0, received - netTotal);
                txtChangeAmount.Text = $"{change:N0}đ";
            }
            else
            {
                txtChangeAmount.Text = "0đ";
            }
        }

        private void BtnMethod_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag != null)
            {
                _selectedMethod = btn.Tag.ToString()!;

                // Reset button styles
                btnMethodCash.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F1F5F9"));
                btnMethodCash.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#334155"));
                btnMethodCash.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1"));

                btnMethodQr.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F1F5F9"));
                btnMethodQr.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#334155"));
                btnMethodQr.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1"));

                btnMethodCard.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F1F5F9"));
                btnMethodCard.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#334155"));
                btnMethodCard.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#CBD5E1"));

                btn.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E11D48"));
                btn.Foreground = Brushes.White;
                btn.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E11D48"));

                if (_selectedMethod == "CASH")
                {
                    pnlCashInput.Visibility = Visibility.Visible;
                    pnlChange.Visibility = Visibility.Visible;
                    pnlQrDisplay.Visibility = Visibility.Collapsed;
                }
                else if (_selectedMethod == "BANK_TRANSFER")
                {
                    pnlCashInput.Visibility = Visibility.Collapsed;
                    pnlChange.Visibility = Visibility.Collapsed;
                    pnlQrDisplay.Visibility = Visibility.Visible;
                    LoadVietQr();
                }
                else
                {
                    pnlCashInput.Visibility = Visibility.Collapsed;
                    pnlChange.Visibility = Visibility.Collapsed;
                    pnlQrDisplay.Visibility = Visibility.Collapsed;
                }
            }
        }

        private void LoadVietQr()
        {
            try
            {
                decimal netTotal = Math.Max(0, _baseTotalAmount - _discountVoucherAmount - _shippingVoucherAmount);
                string memo = _order.OrderCode ?? "AVORA";
                string qrUrl = $"https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount={(long)netTotal}&addInfo={Uri.EscapeDataString(memo)}&accountName=AVORA%20RESTAURANT";
                imgQrCode.Source = new BitmapImage(new Uri(qrUrl, UriKind.Absolute));
            }
            catch { }
        }

        private void TxtReceivedAmount_TextChanged(object sender, TextChangedEventArgs e)
        {
            CalculateChange();
        }

        private void BtnPresetExact_Click(object sender, RoutedEventArgs e)
        {
            decimal netTotal = Math.Max(0, _baseTotalAmount - _discountVoucherAmount - _shippingVoucherAmount);
            txtReceivedAmount.Text = ((long)netTotal).ToString();
        }

        private void BtnPresetNum_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag != null && long.TryParse(btn.Tag.ToString(), out long val))
            {
                txtReceivedAmount.Text = val.ToString();
            }
        }

        private void BtnApplyDiscountVoucher_Click(object sender, RoutedEventArgs e)
        {
            string code = txtDiscountVoucher.Text.Trim().ToUpper();
            if (string.IsNullOrEmpty(code))
            {
                _discountVoucherAmount = 0;
                UpdateTotals();
                return;
            }

            // Simple demo discount calculation or full API validation
            _discountVoucherAmount = Math.Min(50000, _baseTotalAmount * 0.1m);
            MessageBox.Show($"Đã áp dụng mã giảm giá {code}: -{_discountVoucherAmount:N0}đ", "Khuyến Mãi", MessageBoxButton.OK, MessageBoxImage.Information);
            UpdateTotals();
        }

        private void BtnApplyShippingVoucher_Click(object sender, RoutedEventArgs e)
        {
            string code = txtShippingVoucher.Text.Trim().ToUpper();
            if (string.IsNullOrEmpty(code))
            {
                _shippingVoucherAmount = 0;
                UpdateTotals();
                return;
            }

            _shippingVoucherAmount = Math.Min(30000, _order.ShippingFee > 0 ? _order.ShippingFee : 30000);
            MessageBox.Show($"Đã áp dụng mã freeship {code}: -{_shippingVoucherAmount:N0}đ", "Khuyến Mãi", MessageBoxButton.OK, MessageBoxImage.Information);
            UpdateTotals();
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }

        private void BtnSubmitPayment_Click(object sender, RoutedEventArgs e)
        {
            decimal netTotal = Math.Max(0, _baseTotalAmount - _discountVoucherAmount - _shippingVoucherAmount);
            decimal received = netTotal;

            if (_selectedMethod == "CASH")
            {
                if (!decimal.TryParse(txtReceivedAmount.Text.Replace(",", "").Replace(".", ""), out received) || received < netTotal)
                {
                    MessageBox.Show("Số tiền khách đưa chưa đủ để thanh toán hóa đơn!", "Cảnh báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }
            }

            decimal change = Math.Max(0, received - netTotal);

            Result = new PaymentResult
            {
                PaymentMethod = _selectedMethod,
                TotalAmount = netTotal,
                ReceivedAmount = received,
                ChangeAmount = change,
                DiscountVoucherCode = !string.IsNullOrWhiteSpace(txtDiscountVoucher.Text) ? txtDiscountVoucher.Text.Trim().ToUpper() : null,
                ShippingVoucherCode = !string.IsNullOrWhiteSpace(txtShippingVoucher.Text) ? txtShippingVoucher.Text.Trim().ToUpper() : null,
                IsInvoiceRequested = chkInvoice.IsChecked == true,
                AutoPrintReceipt = chkAutoPrint.IsChecked == true
            };

            DialogResult = true;
            Close();
        }
    }
}
