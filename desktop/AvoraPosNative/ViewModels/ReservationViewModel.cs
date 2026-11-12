using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Security;
using AvoraPosNative.Services;

namespace AvoraPosNative.ViewModels
{
    public class ReservationViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private string? _branchId;
        private bool _isLoading;
        private string _selectedFilter = "ALL";
        private string _searchQuery = string.Empty;
        private List<PosReservation> _allReservations = new();

        public ObservableCollection<PosReservation> FilteredReservations { get; } = new();

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public string SelectedFilter
        {
            get => _selectedFilter;
            set
            {
                if (SetProperty(ref _selectedFilter, value))
                {
                    ApplyFilter();
                }
            }
        }

        public string SearchQuery
        {
            get => _searchQuery;
            set
            {
                if (SetProperty(ref _searchQuery, value))
                {
                    ApplyFilter();
                }
            }
        }

        public int ReservationCount => FilteredReservations.Count;
        public int ActiveReservationCount => _allReservations.Count(r => r.CanCheckIn);
        public event Action? ReservationsUpdated;
        public event Action<PosReservation, string>? ReservationSeated;

        public ICommand RefreshCommand { get; }
        public ICommand SelectFilterCommand { get; }
        public ICommand CheckInCommand { get; }

        public ReservationViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            RefreshCommand = new RelayCommand(async () => await LoadReservationsAsync());
            SelectFilterCommand = new RelayCommand(param =>
            {
                if (param is string f) SelectedFilter = f;
            });

            CheckInCommand = new RelayCommand(async obj =>
            {
                if (obj is PosReservation resv)
                {
                    await CheckInReservationAsync(resv);
                }
            });
        }

        public async Task LoadReservationsAsync(string? branchId = null)
        {
            if (!string.IsNullOrEmpty(branchId)) _branchId = branchId;
            if (string.IsNullOrEmpty(_branchId))
            {
                _branchId = SecureSessionManager.LoadSession()?.BranchId;
            }
            if (string.IsNullOrEmpty(_branchId)) return;

            IsLoading = true;
            try
            {
                _allReservations = await _apiService.GetReservationsAsync(_branchId);
                App.TraceLog($"[RESERVATIONS] Loaded {_allReservations.Count} real reservations from backend");

                void updateUi()
                {
                    ApplyFilter();
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
                App.TraceLog($"[RESERVATIONS] LoadReservations error: {ex.Message}");
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void ApplyFilter()
        {
            FilteredReservations.Clear();
            IEnumerable<PosReservation> list = _allReservations;

            if (_selectedFilter != "ALL")
            {
                list = list.Where(r => string.Equals(r.Status, _selectedFilter, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(_searchQuery))
            {
                string q = _searchQuery.Trim().ToLowerInvariant();
                list = list.Where(r =>
                    (r.CustomerName != null && r.CustomerName.ToLowerInvariant().Contains(q)) ||
                    (r.CustomerPhone != null && r.CustomerPhone.ToLowerInvariant().Contains(q)) ||
                    (r.ReservationCode != null && r.ReservationCode.ToLowerInvariant().Contains(q)));
            }

            foreach (var r in list)
            {
                FilteredReservations.Add(r);
            }
            OnPropertyChanged(nameof(ReservationCount));
            OnPropertyChanged(nameof(ActiveReservationCount));
            ReservationsUpdated?.Invoke();
        }

        private async Task CheckInReservationAsync(PosReservation resv)
        {
            if (!resv.CanCheckIn) return;

            string? targetTableId = resv.AssignedTables?.FirstOrDefault()?.Id;
            if (string.IsNullOrEmpty(targetTableId))
            {
                Dialogs.AvoraMessageDialog.Info("Đặt bàn này chưa được gán bàn trước. Hệ thống sẽ mở Sơ đồ bàn để bạn chọn bàn trống cho khách.", "Chọn bàn phục vụ");
                ReservationSeated?.Invoke(resv, string.Empty);
                return;
            }

            try
            {
                var res = await _apiService.CheckInReservationAsync(resv.Id, targetTableId);
                if (res.Success)
                {
                    await LoadReservationsAsync();
                    ReservationSeated?.Invoke(resv, targetTableId);
                }
                else
                {
                    Dialogs.AvoraMessageDialog.Warning($"Không thể nhận bàn: {res.Error}", "Nhận bàn");
                }
            }
            catch (Exception ex)
            {
                Dialogs.AvoraMessageDialog.Error($"Lỗi: {ex.Message}", "Nhận bàn");
            }
        }
    }
}
