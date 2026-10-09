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

            var def = printers.Find(p => p.IsDefault && !p.IsVirtual) ?? (printers.Count > 0 ? printers[0] : null);
            if (def != null)
            {
                PrintersListBox.SelectedItem = def;
                TxtDriverName.Text = def.DriverName;
                TxtPortName.Text = def.PortName;
            }
        }

        private void OnRefreshPrintersClick(object sender, RoutedEventArgs e)
        {
            LoadInstalledPrinters();
        }

        private void OnPrinterSelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (PrintersListBox.SelectedItem is InstalledPrinterInfo printer)
            {
                TxtDriverName.Text = printer.DriverName;
                TxtPortName.Text = printer.PortName;
                TxtProfileName.Text = $"Cấu hình [{printer.Name}]";
            }
        }

        private void OnTestPrintXp80cClick(object sender, RoutedEventArgs e)
        {
            var selected = PrintersListBox.SelectedItem as InstalledPrinterInfo;
            string printerName = selected?.Name ?? WinSpoolNative.GetInstalledPrinters().Find(p => p.IsDefault)?.Name ?? string.Empty;

            if (string.IsNullOrWhiteSpace(printerName))
            {
                MessageBox.Show("Vui lòng chọn hoặc cài đặt một máy in trước khi in test.", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                // Xây dựng test print payload theo Directive 9
                var testPayload = new PrintJobPayload
                {
                    Title = "TEST ĐỘ NÉT XP-80C THẬT (RAW NATIVE)",
                    OrderCode = "TEST-XP80C-001",
                    TableName = "Bàn Test 80mm",
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
                    FooterNote = "Tiếng Việt UTF-8 Segoe UI - Đường kẻ bảng chuẩn - In trực tiếp RAW WinSpool",
                    CutPaper = ChkSupportsCut.IsChecked == true,
                    OpenCashDrawer = ChkSupportsDrawer.IsChecked == true,
                    Items = new List<PrintJobItem>
                    {
                        new() { ProductName = "Phở Bò Tái Lăn Hà Nội", Quantity = 1, Price = 65000, LineTotal = 65000, Note = "Thêm ớt, ít bánh" },
                        new() { ProductName = "Trà Hoa Cúc Mật Ong Đá", Quantity = 2, Price = 35000, LineTotal = 70000, OptionsText = "50% Đường, 70% Đá" },
                        new() { ProductName = "Bánh Flan Trứng Nướng", Quantity = 1, Price = 50000, LineTotal = 50000 }
                    }
                };

                byte[] rasterBytes = RasterTextEngine.BuildReceiptRasterBytes(testPayload, 576);

                var (success, error) = WinSpoolNative.SendRawBytes(printerName, rasterBytes, "TEST XP-80C NATIVE");
                if (success)
                {
                    MessageBox.Show($"Đã gửi lệnh in test thành công tới máy in [{printerName}]!\nHóa đơn hiển thị tiếng Việt sắc nét, đường kẻ thẳng, tự động cắt giấy.", "Thành công", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    MessageBox.Show($"In test thất bại: {error}", "Lỗi in ấn", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi in test: {ex.Message}", "Lỗi ngoại lệ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void OnTestCashDrawerClick(object sender, RoutedEventArgs e)
        {
            var selected = PrintersListBox.SelectedItem as InstalledPrinterInfo;
            string printerName = selected?.Name ?? WinSpoolNative.GetInstalledPrinters().Find(p => p.IsDefault)?.Name ?? string.Empty;

            if (string.IsNullOrWhiteSpace(printerName))
            {
                MessageBox.Show("Vui lòng chọn máy in để kích két.", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                var (success, error) = WinSpoolNative.SendRawBytes(printerName, EscPosEngine.OpenCashDrawer, "KICK CASH DRAWER");
                if (success)
                {
                    MessageBox.Show($"Đã gửi xung kích két (Pin 2, 50ms) tới máy in [{printerName}]!", "Két tiền", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    MessageBox.Show($"Kích két thất bại: {error}", "Lỗi kích két", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi: {ex.Message}", "Lỗi ngoại lệ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
