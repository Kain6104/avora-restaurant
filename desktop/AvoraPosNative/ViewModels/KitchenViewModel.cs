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
    public class KitchenViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private string? _branchId;
        private bool _isLoading;
        private string _selectedStation = "ALL";
        private List<PosKitchenTicket> _allTickets = new();

        public ObservableCollection<PosKitchenTicket> FilteredTickets { get; } = new();

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public string SelectedStation
        {
            get => _selectedStation;
            set
            {
                if (SetProperty(ref _selectedStation, value))
                {
                    ApplyFilter();
                }
            }
        }

        public int TicketCount => FilteredTickets.Count;

        public ICommand RefreshCommand { get; }
        public ICommand SelectStationCommand { get; }
        public ICommand CompleteItemCommand { get; }
        public ICommand CompleteTicketCommand { get; }

        public KitchenViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            RefreshCommand = new RelayCommand(async () => await LoadTicketsAsync());
            SelectStationCommand = new RelayCommand(param =>
            {
                if (param is string st) SelectedStation = st;
            });

            CompleteItemCommand = new RelayCommand(async obj =>
            {
                if (obj is PosKitchenItem item)
                {
                    await CompleteItemAsync(item);
                }
            });

            CompleteTicketCommand = new RelayCommand(async obj =>
            {
                if (obj is PosKitchenTicket ticket)
                {
                    await CompleteTicketAsync(ticket);
                }
            });
        }

        public async Task LoadTicketsAsync(string? branchId = null)
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
                _allTickets = await _apiService.GetKitchenTicketsAsync(_branchId);
                App.TraceLog($"[KITCHEN] Loaded {_allTickets.Count} real kitchen tickets from backend");

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
                App.TraceLog($"[KITCHEN] LoadTickets error: {ex.Message}");
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void ApplyFilter()
        {
            FilteredTickets.Clear();
            var list = _selectedStation == "ALL"
                ? _allTickets
                : _allTickets.Where(t => t.Items.Any(it => it.StationId == _selectedStation)).ToList();

            foreach (var t in list)
            {
                FilteredTickets.Add(t);
            }
            OnPropertyChanged(nameof(TicketCount));
        }

        private async Task CompleteItemAsync(PosKitchenItem item)
        {
            try
            {
                var res = await _apiService.UpdateKitchenItemStatusAsync(item.Id, "READY");
                if (res.Success)
                {
                    item.KitchenStatus = "READY";
                    await LoadTicketsAsync();
                }
                else
                {
                    MessageBox.Show($"Không thể cập nhật trạng thái món: {res.Error}", "Bếp KDS", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi: {ex.Message}", "Bếp KDS", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async Task CompleteTicketAsync(PosKitchenTicket ticket)
        {
            try
            {
                foreach (var it in ticket.Items)
                {
                    if (it.KitchenStatus != "READY" && it.KitchenStatus != "SERVED")
                    {
                        await _apiService.UpdateKitchenItemStatusAsync(it.Id, "READY");
                    }
                }
                await LoadTicketsAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi: {ex.Message}", "Bếp KDS", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
