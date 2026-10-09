using System;
using System.Threading.Tasks;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Security;
using AvoraPosNative.Services;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.ViewModels
{
    public class PosShellViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private readonly RealtimeService _realtimeService;
        private string _activeTab = "TABLES"; // TABLES, ORDER, KITCHEN, RESERVATIONS, SHIFT, SETTINGS
        private string _cashierName = "Thu ngân";
        private string _cashierRole = "CASHIER";
        private string _branchName = "AVORA Restaurant";
        private bool _isRealtimeConnected = false;
        private int _notificationCount = 0;

        public TableMapViewModel TableMapVm { get; }
        public ProductMenuViewModel ProductMenuVm { get; }
        public OrderViewModel OrderVm { get; }
        public KitchenViewModel KitchenVm { get; }
        public ReservationViewModel ReservationVm { get; }
        public CashShiftViewModel CashShiftVm { get; }

        public string ActiveTab
        {
            get => _activeTab;
            set => SetProperty(ref _activeTab, value);
        }

        public string CashierName
        {
            get => _cashierName;
            set => SetProperty(ref _cashierName, value);
        }

        public string CashierRole
        {
            get => _cashierRole;
            set => SetProperty(ref _cashierRole, value);
        }

        public string BranchName
        {
            get => _branchName;
            set => SetProperty(ref _branchName, value);
        }

        public bool IsRealtimeConnected
        {
            get => _isRealtimeConnected;
            set => SetProperty(ref _isRealtimeConnected, value);
        }

        public int NotificationCount
        {
            get => _notificationCount;
            set => SetProperty(ref _notificationCount, value);
        }

        public ICommand SwitchTabCommand { get; }
        public ICommand LogoutCommand { get; }

        public event Action? LogoutRequested;

        public PosShellViewModel(PosApiService apiService, RealtimeService realtimeService)
        {
            _apiService = apiService;
            _realtimeService = realtimeService;

            TableMapVm = new TableMapViewModel(_apiService);
            ProductMenuVm = new ProductMenuViewModel(_apiService);
            OrderVm = new OrderViewModel(_apiService);
            KitchenVm = new KitchenViewModel(_apiService);
            ReservationVm = new ReservationViewModel(_apiService);
            CashShiftVm = new CashShiftViewModel(_apiService);

            // Wiring events:
            TableMapVm.TableOrderRequested += (table) =>
            {
                OrderVm.LoadTableOrder(table);
                ActiveTab = "ORDER";
            };

            OrderVm.BackToTableRequested += () =>
            {
                ActiveTab = "TABLES";
                _ = TableMapVm.LoadTablesAsync();
            };

            OrderVm.OrderCompleted += () =>
            {
                ActiveTab = "TABLES";
                _ = TableMapVm.LoadTablesAsync();
            };

            ProductMenuVm.ProductSelected += (product) =>
            {
                OrderVm.AddProduct(product);
            };

            SwitchTabCommand = new RelayCommand(tab =>
            {
                if (tab is string s)
                {
                    ActiveTab = s;
                    if (s == "ORDER")
                    {
                        _ = ProductMenuVm.LoadMenuAsync();
                    }
                    else if (s == "TABLES")
                    {
                        _ = TableMapVm.LoadTablesAsync();
                    }
                    else if (s == "KITCHEN")
                    {
                        _ = KitchenVm.LoadTicketsAsync();
                    }
                    else if (s == "RESERVATIONS")
                    {
                        _ = ReservationVm.LoadReservationsAsync();
                    }
                    else if (s == "SHIFT")
                    {
                        _ = CashShiftVm.LoadShiftAsync();
                    }
                }
            });

            LogoutCommand = new RelayCommand(_ =>
            {
                LogoutRequested?.Invoke();
            });

            _realtimeService.Connected += () => IsRealtimeConnected = true;
            _realtimeService.Disconnected += () => IsRealtimeConnected = false;

            _realtimeService.TableStatusChanged += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = TableMapVm.LoadTablesAsync();
                });
            };

            _realtimeService.OrderCreated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    NotificationCount++;
                    _ = TableMapVm.LoadTablesAsync();
                    _ = KitchenVm.LoadTicketsAsync();
                });
            };
        }

        public async Task InitializeAsync()
        {
            var session = SecureSessionManager.LoadSession();
            string? branchId = session?.BranchId;
            string? branchName = session?.BranchName;

            try
            {
                var initData = await _apiService.GetInitDataAsync(branchId);
                if (initData != null)
                {
                    var curBranch = initData["currentBranch"] as JObject;
                    if (curBranch != null)
                    {
                        string? bId = curBranch["id"]?.ToString();
                        string? bName = curBranch["name"]?.ToString();
                        if (!string.IsNullOrEmpty(bId)) branchId = bId;
                        if (!string.IsNullOrEmpty(bName)) branchName = bName;
                    }
                }
            }
            catch { }

            if (session != null)
            {
                CashierName = session.FullName ?? "Thu ngân";
                CashierRole = session.Role ?? "STAFF";
            }
            BranchName = !string.IsNullOrWhiteSpace(branchName) ? branchName : "Avora Hoàn Kiếm";

            if (!string.IsNullOrEmpty(branchId))
            {
                await _realtimeService.ConnectAsync(branchId, session?.UserId ?? string.Empty);
            }

            await TableMapVm.LoadTablesAsync(branchId);
            await ProductMenuVm.LoadMenuAsync(branchId);
            await KitchenVm.LoadTicketsAsync(branchId);
            await ReservationVm.LoadReservationsAsync(branchId);
            await CashShiftVm.LoadShiftAsync(branchId, session?.UserId);
        }
    }
}
