using System;
using System.Windows;
using System.Windows.Media.Imaging;
using AvoraPosNative.Models;
using AvoraPosNative.Services;

namespace AvoraPosNative.Dialogs
{
    public partial class TableQrDialog : Window
    {
        private readonly PosApiService _apiService;
        private readonly PosTable _table;
        private readonly string _branchId;
        private readonly string? _orderId;
        private string? _rawToken;
        private string? _fullUrl;

        public TableQrDialog(PosTable table, string branchId, PosApiService apiService, string? orderId = null)
        {
            InitializeComponent();
            DialogHelper.CenterOnMainWindow(this);
            _table = table;
            _branchId = branchId;
            _apiService = apiService;
            _orderId = orderId;

            txtTableName.Text = $"{table.Name} ({table.AreaName})";
            Loaded += async (s, e) => await LoadQrSessionAsync();
        }

        private async System.Threading.Tasks.Task LoadQrSessionAsync()
        {
            try
            {
                var (token, status, err) = await _apiService.GetTableQrSessionAsync(_table.Id, _branchId);
                if (!string.IsNullOrEmpty(token))
                {
                    _rawToken = token;
                    _fullUrl = $"https://avorafnb.com/qr-order/{token}";
                    txtQrUrl.Text = _fullUrl;
                    txtStatus.Text = $"Đang hoạt động ({status ?? "ACTIVE"})";

                    string qrImgUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={Uri.EscapeDataString(_fullUrl)}";
                    imgQrCode.Source = new BitmapImage(new Uri(qrImgUrl, UriKind.Absolute));
                }
                else
                {
                    txtStatus.Text = "Chưa có phiên QR";
                    AvoraMessageDialog.Warning($"Không thể lấy phiên QR: {err ?? "Bàn chưa mở đơn"}", "Thông báo");
                }
            }
            catch (Exception ex)
            {
                AvoraMessageDialog.Error($"Lỗi tải mã QR: {ex.Message}", "Lỗi");
            }
        }

        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void BtnCopy_Click(object sender, RoutedEventArgs e)
        {
            if (!string.IsNullOrEmpty(_fullUrl))
            {
                try
                {
                    Clipboard.SetText(_fullUrl);
                    AvoraMessageDialog.Success("Đã sao chép liên kết gọi món vào bộ nhớ tạm!", "Thành công");
                }
                catch { }
            }
        }

        private async void BtnPrint_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(_fullUrl))
            {
                AvoraMessageDialog.Warning("Chưa có mã QR để in!", "Thông báo");
                return;
            }

            try
            {
                // In phiếu QR bàn ăn 80mm
                var payload = new PrintJobPayload
                {
                    Title = "MÃ QR GỌI MÓN TẠI BÀN",
                    OrderCode = _orderId ?? "QR-TABLE",
                    TableName = _table.Name,
                    CashierName = "Hệ thống POS",
                    CustomerName = "Khách tại bàn",
                    CreatedAt = DateTime.Now,
                    FooterNote = $"Quét mã QR bằng camera điện thoại để xem menu và gọi món trực tiếp.\nLink: {_fullUrl}",
                    CutPaper = true,
                    OpenCashDrawer = false
                };

                await PrintService.PrintReceiptAsync(payload);
                AvoraMessageDialog.Success($"Đã gửi lệnh in mã QR bàn {_table.Name} ra máy in bill!", "In thành công");
            }
            catch (Exception ex)
            {
                AvoraMessageDialog.Error($"Lỗi khi in: {ex.Message}", "Lỗi");
            }
        }

        private async void BtnRegenerate_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(_orderId))
            {
                AvoraMessageDialog.Warning("Bàn này chưa có đơn hàng để tạo lại mã QR!", "Thông báo");
                return;
            }

            if (!AvoraMessageDialog.Confirm("Bạn có chắc chắn muốn tạo mới mã QR cho bàn này? Khách cũ sẽ không thể gọi món bằng mã trước đó.", "Xác nhận tạo lại mã QR"))
            {
                return;
            }

            try
            {
                var (success, newToken, err) = await _apiService.RegenerateTableQrAsync(_table.Id, _orderId);
                if (success && !string.IsNullOrEmpty(newToken))
                {
                    _rawToken = newToken;
                    _fullUrl = $"https://avorafnb.com/qr-order/{newToken}";
                    txtQrUrl.Text = _fullUrl;
                    string qrImgUrl = $"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data={Uri.EscapeDataString(_fullUrl)}";
                    imgQrCode.Source = new BitmapImage(new Uri(qrImgUrl, UriKind.Absolute));
                    AvoraMessageDialog.Success("Đã tạo mới mã QR bàn thành công!", "Thành công");
                }
                else
                {
                    AvoraMessageDialog.Error($"Lỗi tạo lại mã: {err}", "Lỗi");
                }
            }
            catch (Exception ex)
            {
                AvoraMessageDialog.Error($"Lỗi: {ex.Message}", "Lỗi");
            }
        }
    }
}

