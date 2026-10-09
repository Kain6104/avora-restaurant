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

        public int ReservationCount => FilteredReservations.Count;

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
            var list = _selectedFilter == "ALL"
                ? _allReservations
                : _allReservations.Where(r => r.Status == _selectedFilter).ToList();

            foreach (var r in list)
            {
                FilteredReservations.Add(r);
            }
            OnPropertyChanged(nameof(ReservationCount));
        }

        private async Task CheckInReservationAsync(PosReservation resv)
        {
            string? targetTableId = resv.AssignedTables?.FirstOrDefault()?.Id;
            if (string.IsNullOrEmpty(targetTableId))
            {
                MessageBox.Show("Đặt bàn này chưa được gán bàn trong sơ đồ. Vui lòng chọn bàn trên sơ đồ để nhận khách.", "Nhận bàn", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            try
            {
                var res = await _apiService.CheckInReservationAsync(resv.Id, targetTableId);
                if (res.Success)
                {
                    MessageBox.Show($"Đã nhận khách thành công cho bàn {resv.AssignedTableNames}!", "Nhận bàn", MessageBoxButton.OK, MessageBoxImage.Information);
                    await LoadReservationsAsync();
                }
                else
                {
                    MessageBox.Show($"Không thể nhận bàn: {res.Error}", "Nhận bàn", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi: {ex.Message}", "Nhận bàn", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
