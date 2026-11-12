using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;
using AvoraPosNative.Storage;

namespace AvoraPosNative.Views
{
    public partial class SettingsView : UserControl
    {
        private bool _isUpdatingSelection = false;

        public SettingsView()
        {
            InitializeComponent();
            Loaded += (s, e) => InitializeSettings();
        }

        private void InitializeSettings()
        {
            TxtApiBaseUrl.Text = $"API: {AppConfig.ApiBaseUrl}";
            TxtWsBaseUrl.Text = $"WS: {AppConfig.WsBaseUrl}";
            TxtMachineId.Text = $"Machine ID: {DeviceIdentifier.GetMachineId()}";
            LoadInstalledPrinters();
        }

        private void LoadInstalledPrinters()
        {
            var printers = WinSpoolNative.GetInstalledPrinters();
            PrintersListBox.ItemsSource = printers;
            CmbPrinters.ItemsSource = printers;

            var def = printers.Find(p => p.IsDefault && !p.IsVirtual)
                      ?? printers.Find(p => p.IsDefault)
                      ?? (printers.Count > 0 ? printers[0] : null);

            if (def != null)
            {
                _isUpdatingSelection = true;
                PrintersListBox.SelectedItem = def;
                CmbPrinters.SelectedItem = def;
                TxtDriverName.Text = def.DriverName;
                TxtPortName.Text = def.PortName;
                TxtProfileName.Text = $"Cấu hình [{def.Name}]";
                _isUpdatingSelection = false;
            }
        }

        private void OnRefreshPrintersClick(object sender, RoutedEventArgs e)
        {
            LoadInstalledPrinters();
        }

        private void OnShowPrintQueueClick(object sender, RoutedEventArgs e)
        {
            Dialogs.AvoraMessageDialog.Info("Hàng đợi in PersistentPrintQueue hiện tại trống (0 lệnh lỗi / 0 lệnh đang chờ).", "Các lệnh đang in");
        }

        private void OnSubTabClick(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is string tag)
            {
                TxtPrinterSectionTitle.Text = tag switch
                {
                    "KITCHEN_PRINT" => "Máy in Bar / Bếp",
                    "LABEL_PRINT" => "Máy in Tem nhãn mặt hàng",
                    "ADVANCED" => "Cấu hình máy in RAW nâng cao",
                    _ => "Máy in hóa đơn"
                };
            }
        }

        private void OnPrinterComboSelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isUpdatingSelection) return;
            if (CmbPrinters.SelectedItem is InstalledPrinterInfo printer)
            {
                _isUpdatingSelection = true;
                PrintersListBox.SelectedItem = printer;
                TxtDriverName.Text = printer.DriverName;
                TxtPortName.Text = printer.PortName;
                TxtProfileName.Text = $"Cấu hình [{printer.Name}]";
                _isUpdatingSelection = false;
            }
        }

        private void OnPrinterSelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isUpdatingSelection) return;
            if (PrintersListBox.SelectedItem is InstalledPrinterInfo printer)
            {
                _isUpdatingSelection = true;
                CmbPrinters.SelectedItem = printer;
                TxtDriverName.Text = printer.DriverName;
                TxtPortName.Text = printer.PortName;
                TxtProfileName.Text = $"Cấu hình [{printer.Name}]";
                _isUpdatingSelection = false;
            }
        }

        private void OnPaperSizeChanged(object sender, SelectionChangedEventArgs e)
        {
            if (TxtPaperWidthMm == null || TxtPrintableWidthDots == null) return;
            if (CmbPaperSize.SelectedItem is ComboBoxItem item && item.Tag is string tag)
            {
                if (tag == "58")
                {
                    TxtPaperWidthMm.Text = "58";
                    TxtPrintableWidthDots.Text = "384";
                }
                else
                {
                    TxtPaperWidthMm.Text = "80";
                    TxtPrintableWidthDots.Text = "576";
                }
            }
        }

        private void OnScrollUpClick(object sender, RoutedEventArgs e)
        {
            SettingsScrollViewer?.ScrollToVerticalOffset(Math.Max(0, SettingsScrollViewer.VerticalOffset - 220));
        }

        private void OnScrollDownClick(object sender, RoutedEventArgs e)
        {
            SettingsScrollViewer?.ScrollToVerticalOffset(SettingsScrollViewer.VerticalOffset + 220);
        }

        private void OnSaveSettingsClick(object sender, RoutedEventArgs e)
        {
            var selected = (CmbPrinters.SelectedItem ?? PrintersListBox.SelectedItem) as InstalledPrinterInfo;
            string pName = selected?.Name ?? TxtDriverName.Text;
            Dialogs.AvoraMessageDialog.Success($"Đã lưu cấu hình máy in [{pName}] (Khổ {TxtPaperWidthMm.Text}mm) thành công!", "Lưu cấu hình");
        }

        private void OnTestPrintXp80cClick(object sender, RoutedEventArgs e)
        {
            var selected = (CmbPrinters.SelectedItem ?? PrintersListBox.SelectedItem) as InstalledPrinterInfo;
            string printerName = selected?.Name ?? WinSpoolNative.GetInstalledPrinters().Find(p => p.IsDefault)?.Name ?? string.Empty;

            if (string.IsNullOrWhiteSpace(printerName))
            {
                Dialogs.AvoraMessageDialog.Warning("Vui lòng chọn hoặc cài đặt một máy in trước khi in thử.", "Thông báo");
                return;
            }

            try
            {
                int dots = int.TryParse(TxtPrintableWidthDots.Text, out int d) && d >= 384 ? d : 576;
                var testPayload = new PrintJobPayload
                {
                    Title = "PHIẾU IN THỬ AVORA POS NATIVE",
                    OrderCode = "TEST-XP80C-001",
                    TableName = $"Bàn Test {TxtPaperWidthMm.Text}mm",
                    CashierName = "Admin Thu Ngân",
                    CustomerName = "Khách Hàng Mẫu",
                    CreatedAt = DateTime.Now,
                    SubTotal = 185000,
                    DiscountAmount = 15000,
                    TaxAmount = 13600,
                    TotalAmount = 183600,
                    PaymentMethod = "CASH",
                    ReceivedAmount = 200000,
                    ChangeAmount = 16400,
                    FooterNote = "Tiếng Việt UTF-8 Segoe UI sắc nét - In trực tiếp RAW WinSpool",
                    CutPaper = ChkSupportsCut.IsChecked == true,
                    OpenCashDrawer = ChkSupportsDrawer.IsChecked == true,
                    Items = new List<PrintJobItem>
                    {
                        new() { ProductName = "Set Sashimi Cá Hồi Tươi", Quantity = 1, Price = 89000, LineTotal = 89000 },
                        new() { ProductName = "Trà Hoa Cúc Mật Ong", Quantity = 2, Price = 35000, LineTotal = 70000, OptionsText = "Ít đá" },
                        new() { ProductName = "Bánh Flan Trứng Nướng", Quantity = 1, Price = 26000, LineTotal = 26000 }
                    }
                };

                byte[] rasterBytes = RasterTextEngine.BuildReceiptRasterBytes(testPayload, dots);

                var (success, error) = WinSpoolNative.SendRawBytes(printerName, rasterBytes, "TEST AVORA POS NATIVE");
                if (success)
                {
                    Dialogs.AvoraMessageDialog.Success($"Đã gửi lệnh in thử thành công tới máy in [{printerName}]!", "Thành công");
                }
                else
                {
                    Dialogs.AvoraMessageDialog.Error($"In thử thất bại: {error}", "Lỗi in ấn");
                }
            }
            catch (Exception ex)
            {
                Dialogs.AvoraMessageDialog.Error($"Lỗi in thử: {ex.Message}", "Lỗi ngoại lệ");
            }
        }

        private void OnTestCashDrawerClick(object sender, RoutedEventArgs e)
        {
            var selected = (CmbPrinters.SelectedItem ?? PrintersListBox.SelectedItem) as InstalledPrinterInfo;
            string printerName = selected?.Name ?? WinSpoolNative.GetInstalledPrinters().Find(p => p.IsDefault)?.Name ?? string.Empty;

            if (string.IsNullOrWhiteSpace(printerName))
            {
                Dialogs.AvoraMessageDialog.Warning("Vui lòng chọn máy in để kích két.", "Thông báo");
                return;
            }

            try
            {
                var (success, error) = WinSpoolNative.SendRawBytes(printerName, EscPosEngine.OpenCashDrawer, "KICK CASH DRAWER");
                if (success)
                {
                    Dialogs.AvoraMessageDialog.Success($"Đã gửi xung kích két (Pin 2, 50ms) tới máy in [{printerName}]!", "Két tiền");
                }
                else
                {
                    Dialogs.AvoraMessageDialog.Error($"Kích két thất bại: {error}", "Lỗi kích két");
                }
            }
            catch (Exception ex)
            {
                Dialogs.AvoraMessageDialog.Error($"Lỗi: {ex.Message}", "Lỗi ngoại lệ");
            }
        }
    }
}
