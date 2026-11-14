using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Services;

namespace AvoraPosNative.ViewModels
{
    public class QrOrderViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private PosQrOrder? _selectedRound;
        private bool _isLoading = false;
        private string? _currentBranchId;

        public ObservableCollection<PosQrOrder> PendingRounds { get; } = new();

        public PosQrOrder? SelectedRound
        {
            get => _selectedRound;
            set => SetProperty(ref _selectedRound, value);
        }

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public int PendingCount => PendingRounds.Count;

        public ICommand RefreshCommand { get; }
        public ICommand ApproveRoundCommand { get; }
        public ICommand RejectRoundCommand { get; }

        public event Action? RoundsUpdated;

        public QrOrderViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            RefreshCommand = new RelayCommand(async _ => await LoadPendingRoundsAsync(_currentBranchId));

            ApproveRoundCommand = new RelayCommand(async param =>
            {
                if (param is PosQrOrder round)
                {
                    var (success, error) = await _apiService.ApproveQrRoundAsync(round.Id);
                    if (success)
                    {
                        PendingRounds.Remove(round);
                        OnPropertyChanged(nameof(PendingCount));
                        RoundsUpdated?.Invoke();
                    }
                }
            });

            RejectRoundCommand = new RelayCommand(async param =>
            {
                if (param is PosQrOrder round)
                {
                    var (success, error) = await _apiService.RejectQrRoundAsync(round.Id, "Từ chối từ POS Native");
                    if (success)
                    {
                        PendingRounds.Remove(round);
                        OnPropertyChanged(nameof(PendingCount));
                        RoundsUpdated?.Invoke();
                    }
                }
            });
        }

        public async Task LoadPendingRoundsAsync(string? branchId = null)
        {
            if (string.IsNullOrEmpty(branchId))
            {
                var session = Security.SecureSessionManager.LoadSession();
                branchId = session?.BranchId;
            }
            _currentBranchId = branchId;
            if (string.IsNullOrEmpty(branchId)) return;

            IsLoading = true;
            try
            {
                var rounds = await _apiService.GetPendingQrRoundsAsync(branchId);
                PendingRounds.Clear();
                foreach (var r in rounds)
                {
                    PendingRounds.Add(r);
                }
                OnPropertyChanged(nameof(PendingCount));
            }
            finally
            {
                IsLoading = false;
            }
        }
    }
}

