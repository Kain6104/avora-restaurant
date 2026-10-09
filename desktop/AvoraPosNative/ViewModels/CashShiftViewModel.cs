using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;
using AvoraPosNative.Security;
using AvoraPosNative.Services;

namespace AvoraPosNative.ViewModels
{
    public class CashShiftViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private string? _branchId;
        private string? _cashierId;
        private string? _cashierName;
        private string? _branchName;
        private bool _isLoading;
        private PosCashShift? _currentShift;
        private decimal _openingCashInput = 1000000m;
        private string? _openNoteInput;

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public PosCashShift? CurrentShift
        {
            get => _currentShift;
            set
            {
                if (SetProperty(ref _currentShift, value))
                {
                    OnPropertyChanged(nameof(HasOpenShift));
                    OnPropertyChanged(nameof(ShiftStatusDisplay));
                    OnPropertyChanged(nameof(OpeningBalanceText));
                    OnPropertyChanged(nameof(TotalCashText));
                    OnPropertyChanged(nameof(TotalCardTransferText));
                    OnPropertyChanged(nameof(ExpectedBalanceText));
                    OnPropertyChanged(nameof(OrderCountText));
                    OnPropertyChanged(nameof(OpenedAtDisplay));
                }
            }
        }

        public bool HasOpenShift => CurrentShift != null && CurrentShift.Status == "OPEN";

        public string ShiftStatusDisplay => HasOpenShift ? "CA ĐANG MỞ" : "CHƯA MỞ CA";

        public string OpeningBalanceText => CurrentShift != null ? $"{CurrentShift.OpeningBalance:N0}đ" : "0đ";
        public string TotalCashText => CurrentShift != null ? $"{CurrentShift.TotalCash:N0}đ" : "0đ";
        public string TotalCardTransferText => CurrentShift != null ? $"{(CurrentShift.TotalTransfer + CurrentShift.TotalCard):N0}đ" : "0đ";
        public string ExpectedBalanceText => CurrentShift != null ? $"{(CurrentShift.OpeningBalance + CurrentShift.TotalCash):N0}đ" : "0đ";
        public string OrderCountText => CurrentShift != null ? $"{CurrentShift.OrderCount} đơn" : "0 đơn";
        public string OpenedAtDisplay => CurrentShift != null ? CurrentShift.OpenedAt.ToLocalTime().ToString("HH:mm - dd/MM/yyyy") : "--";

        public string CashierDisplay => _cashierName ?? "Thu ngân";
        public string BranchDisplay => _branchName ?? "Avora Hoàn Kiếm";

        public decimal OpeningCashInput
        {
            get => _openingCashInput;
            set => SetProperty(ref _openingCashInput, value);
        }

        public string? OpenNoteInput
        {
            get => _openNoteInput;
            set => SetProperty(ref _openNoteInput, value);
        }

        public ICommand RefreshCommand { get; }
        public ICommand OpenShiftCommand { get; }
        public ICommand CloseShiftCommand { get; }
        public ICommand OpenDrawerCommand { get; }

        public CashShiftViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            RefreshCommand = new RelayCommand(async () => await LoadShiftAsync());

            OpenShiftCommand = new RelayCommand(async () =>
            {
                if (string.IsNullOrEmpty(_branchId)) return;
                try
                {
                    var res = await _apiService.OpenShiftAsync(_branchId, OpeningCashInput, OpenNoteInput);
                    if (res.Success && res.Shift != null)
                    {
                        CurrentShift = res.Shift;
                        MessageBox.Show($"Mở ca làm việc thành công! Số tiền đầu ca: {res.Shift.OpeningBalance:N0}đ", "Mở ca", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        MessageBox.Show($"Không thể mở ca: {res.Error}", "Mở ca", MessageBoxButton.OK, MessageBoxImage.Warning);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Lỗi: {ex.Message}", "Mở ca", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            });

            CloseShiftCommand = new RelayCommand(async () =>
            {
                if (CurrentShift == null) return;
                var keypad = new Dialogs.NumericKeypadDialog("Nhập tổng tiền mặt thực tế kiểm đếm được trong két:");
                if (keypad.ShowDialog() == true)
                {
                    decimal actualCash = keypad.ResultValue;
                    decimal expected = CurrentShift.OpeningBalance + CurrentShift.TotalCash;
                    decimal diff = actualCash - expected;

                    string diffText = diff >= 0 ? $"+{diff:N0}đ (Dư)" : $"{diff:N0}đ (Thiếu)";
                    var confirm = MessageBox.Show(
                        $"Tổng kiểm đếm: {actualCash:N0}đ\nTiền dự kiến: {expected:N0}đ\nChênh lệch: {diffText}\n\nXác nhận đóng ca và in phiếu kiểm kê?",
                        "Xác nhận đóng ca",
                        MessageBoxButton.YesNo,
                        MessageBoxImage.Question);

                    if (confirm == MessageBoxResult.Yes)
                    {
                        try
                        {
                            var res = await _apiService.CloseShiftAsync(CurrentShift.Id, actualCash, $"Kiểm đếm két: {diffText}");
                            if (res.Success)
                            {
                                MessageBox.Show("Đã đóng ca làm việc thành công!", "Đóng ca", MessageBoxButton.OK, MessageBoxImage.Information);
                                await LoadShiftAsync();
                            }
                            else
                            {
                                MessageBox.Show($"Không thể đóng ca: {res.Error}", "Đóng ca", MessageBoxButton.OK, MessageBoxImage.Warning);
                            }
                        }
                        catch (Exception ex)
                        {
                            MessageBox.Show($"Lỗi: {ex.Message}", "Đóng ca", MessageBoxButton.OK, MessageBoxImage.Error);
                        }
                    }
                }
            });

            OpenDrawerCommand = new RelayCommand(async () =>
            {
                try
                {
                    // 1. Send RAW kick to default ESC/POS printer
                    var printers = WinSpoolNative.GetInstalledPrinters();
                    var target = printers.Find(p => p.IsDefault && !p.IsVirtual)?.Name ?? (printers.Count > 0 ? printers[0].Name : null);
                    if (!string.IsNullOrWhiteSpace(target))
                    {
                        WinSpoolNative.SendRawBytes(target, EscPosEngine.OpenCashDrawer, "OPEN DRAWER");
                    }

                    // 2. Audit backend
                    if (!string.IsNullOrEmpty(_branchId))
                    {
                        await _apiService.OpenCashDrawerAsync(_branchId, "Thu ngân yêu cầu mở két tiền qua POS Native");
                    }

                    MessageBox.Show("Đã gửi lệnh bật két tiền thành công!", "Két tiền", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Lỗi mở két: {ex.Message}", "Két tiền", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            });
        }

        public async Task LoadShiftAsync(string? branchId = null, string? cashierId = null)
        {
            var session = SecureSessionManager.LoadSession();
            if (!string.IsNullOrEmpty(branchId)) _branchId = branchId;
            else if (string.IsNullOrEmpty(_branchId)) _branchId = session?.BranchId;

            if (!string.IsNullOrEmpty(cashierId)) _cashierId = cashierId;
            else if (string.IsNullOrEmpty(_cashierId)) _cashierId = session?.UserId;

            _cashierName = session?.FullName ?? "Thu ngân";
            _branchName = session?.BranchName ?? "Avora Hoàn Kiếm";
            OnPropertyChanged(nameof(CashierDisplay));
            OnPropertyChanged(nameof(BranchDisplay));

            if (string.IsNullOrEmpty(_branchId) || string.IsNullOrEmpty(_cashierId)) return;

            IsLoading = true;
            try
            {
                var shift = await _apiService.GetCurrentShiftAsync(_branchId, _cashierId);
                App.TraceLog($"[SHIFT] Loaded real shift status: {(shift != null ? $"OPEN id={shift.Id}" : "NONE OPEN")}");

                void updateUi()
                {
                    CurrentShift = shift;
                }

                if (App.Current?.Dispatcher != null && !App.Current.Dispatcher.CheckAccess())
                {
                    App.Current.Dispatcher.Invoke(updateUi);
                }
                else
                {
                    updateUi();
                }
            }
            catch (Exception ex)
            {
                App.TraceLog($"[SHIFT] LoadShift error: {ex.Message}");
            }
            finally
            {
                IsLoading = false;
            }
        }
    }
}
