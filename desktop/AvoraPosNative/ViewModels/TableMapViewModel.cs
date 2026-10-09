using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Services;

namespace AvoraPosNative.ViewModels
{
    public class TableMapViewModel : ViewModelBase
    {
        private readonly PosApiService _api;
        private string _selectedAreaId = "ALL";
        private PosTable? _selectedTable;
        private bool _isLoading = false;

        public event Action<PosTable>? TableSelected;
        public event Action<PosTable>? TableOpenRequested;
        public event Action<PosTable>? TableOrderRequested
        {
            add => TableOpenRequested += value;
            remove => TableOpenRequested -= value;
        }

        public ObservableCollection<PosArea> Areas { get; } = new();
        public ObservableCollection<PosTable> FilteredTables { get; } = new();
        private List<PosTable> _allTables = new();

        public int TotalTablesCount => _allTables.Count;
        public int VacantCount => _allTables.Count(t => t.VisualStatus == "VACANT");
        public int OccupiedCount => _allTables.Count(t => t.VisualStatus == "OCCUPIED");
        public int BillPrintedCount => _allTables.Count(t => t.VisualStatus == "BILL_PRINTED");
        public int ReservedCount => _allTables.Count(t => t.VisualStatus == "RESERVED");

        public string SelectedAreaId
        {
            get => _selectedAreaId;
            set
            {
                if (SetProperty(ref _selectedAreaId, value))
                {
                    ApplyFilter();
                }
            }
        }

        public PosTable? SelectedTable
        {
            get => _selectedTable;
            set => SetProperty(ref _selectedTable, value);
        }

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public ICommand SelectTableCommand { get; }
        public ICommand RefreshCommand { get; }
        public ICommand OpenTableOrderCommand { get; }
        public ICommand MoveTableCommand { get; }
        public ICommand MergeTableCommand { get; }
        public ICommand SplitTableCommand { get; }
        public ICommand SelectAreaCommand { get; }

        public TableMapViewModel(PosApiService api)
        {
            _api = api;
            SelectTableCommand = new RelayCommand(obj =>
            {
                if (obj is PosTable table)
                {
                    SelectedTable = table;
                    TableSelected?.Invoke(table);
                }
            });

            OpenTableOrderCommand = new RelayCommand(obj =>
            {
                var table = obj as PosTable ?? SelectedTable;
                if (table != null)
                {
                    TableOpenRequested?.Invoke(table);
                }
            });

            MoveTableCommand = new RelayCommand(_ =>
            {
                if (SelectedTable == null) return;
                var dlg = new Dialogs.MoveTableDialog(SelectedTable, _allTables);
                if (dlg.ShowDialog() == true && !string.IsNullOrWhiteSpace(dlg.SelectedTargetTableId))
                {
                    _ = _api.MoveTableAsync(SelectedTable.Id, dlg.SelectedTargetTableId);
                    _ = LoadTablesAsync();
                }
            });

            MergeTableCommand = new RelayCommand(_ =>
            {
                if (SelectedTable == null) return;
                var dlg = new Dialogs.MergeTableDialog(SelectedTable, _allTables);
                if (dlg.ShowDialog() == true && !string.IsNullOrWhiteSpace(dlg.SelectedTargetTableId))
                {
                    _ = _api.MergeOrdersAsync(SelectedTable.Id, dlg.SelectedTargetTableId);
                    _ = LoadTablesAsync();
                }
            });

            SplitTableCommand = new RelayCommand(_ =>
            {
                if (SelectedTable == null || SelectedTable.CurrentOrder == null) return;
                var dummyOrder = new PosOrder { Id = SelectedTable.CurrentOrder.Id, Table = SelectedTable };
                var dlg = new Dialogs.SplitTableDialog(dummyOrder, _allTables);
                if (dlg.ShowDialog() == true)
                {
                    _ = LoadTablesAsync();
                }
            });

            SelectAreaCommand = new RelayCommand(param =>
            {
                if (param is PosArea a) SelectedAreaId = a.Id;
                else if (param is string s) SelectedAreaId = s;
            });

            RefreshCommand = new RelayCommand(async () => await LoadTablesAsync());
        }

        public async Task LoadTablesAsync(string? branchId = null)
        {
            if (string.IsNullOrEmpty(branchId))
            {
                branchId = Security.SecureSessionManager.LoadSession()?.BranchId ?? "DEFAULT";
            }
            IsLoading = true;
            try
            {
                var tables = await _api.GetTablesAsync(branchId);
                _allTables = tables;

                // Extract areas
                var distinctAreas = tables
                    .Where(t => !string.IsNullOrEmpty(t.AreaId))
                    .Select(t => new { Id = t.AreaId!, Name = t.AreaName })
                    .Distinct()
                    .OrderBy(a => a.Name)
                    .Select(a => new PosArea { Id = a.Id, Name = a.Name })
                    .ToList();

                void updateUi()
                {
                    Areas.Clear();
                    Areas.Add(new PosArea { Id = "ALL", Name = "Tất cả khu vực" });
                    foreach (var a in distinctAreas) Areas.Add(a);

                    ApplyFilter();
                    OnPropertyChanged(nameof(TotalTablesCount));
                    OnPropertyChanged(nameof(VacantCount));
                    OnPropertyChanged(nameof(OccupiedCount));
                    OnPropertyChanged(nameof(BillPrintedCount));
                    OnPropertyChanged(nameof(ReservedCount));
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
            finally
            {
                IsLoading = false;
            }
        }

        public void ApplyFilter()
        {
            void doFilter()
            {
                FilteredTables.Clear();
                var list = _selectedAreaId == "ALL"
                    ? _allTables
                    : _allTables.Where(t => t.AreaId == _selectedAreaId);

                foreach (var t in list)
                {
                    FilteredTables.Add(t);
                }
            }

            if (App.Current?.Dispatcher != null && !App.Current.Dispatcher.CheckAccess())
            {
                App.Current.Dispatcher.Invoke(doFilter);
            }
            else
            {
                doFilter();
            }
        }

        public void UpdateTableRealtime(string tableId, string status, PosTableOrderSummary? orderSummary)
        {
            var existing = _allTables.FirstOrDefault(t => t.Id == tableId);
            if (existing != null)
            {
                existing.VisualStatus = status;
                if (orderSummary != null)
                {
                    existing.CurrentOrder = orderSummary;
                }
                ApplyFilter();
                OnPropertyChanged(nameof(VacantCount));
                OnPropertyChanged(nameof(OccupiedCount));
                OnPropertyChanged(nameof(BillPrintedCount));
                OnPropertyChanged(nameof(ReservedCount));
            }
        }
    }
}
