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
    public class OrderListViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private List<PosOrder> _allOrders = new();
        private PosOrder? _selectedOrder;
        private string _searchKeyword = string.Empty;
        private string _statusFilter = "ALL"; // ALL, PAYMENT_REQUESTED, SERVING
        private string _typeFilter = "ALL"; // ALL, DINE_IN, TAKEAWAY, DELIVERY, ONLINE
        private bool _isLoading = false;
        private string? _currentBranchId;

        public ObservableCollection<PosOrder> FilteredOrders { get; } = new();

        public PosOrder? SelectedOrder
        {
            get => _selectedOrder;
            set => SetProperty(ref _selectedOrder, value);
        }

        public string SearchKeyword
        {
            get => _searchKeyword;
            set
            {
                if (SetProperty(ref _searchKeyword, value))
                {
                    ApplyFilters();
                }
            }
        }

        public string StatusFilter
        {
            get => _statusFilter;
            set
            {
                if (SetProperty(ref _statusFilter, value))
                {
                    ApplyFilters();
                }
            }
        }

        public string TypeFilter
        {
            get => _typeFilter;
            set
            {
                if (SetProperty(ref _typeFilter, value))
                {
                    ApplyFilters();
                }
            }
        }

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public int TotalOrderCount => FilteredOrders.Count;
        public int AllCount => _allOrders.Count;
        public int PaymentRequestedCount => _allOrders.Count(o => o.PaymentStatus == "PAYMENT_REQUESTED" || o.Status == "HELD");
        public int WaitingConfirmCount => _allOrders.Count(o => o.Status == "PENDING" || o.Status == "NEW" || o.Status == "SUBMITTED");
        public int ServingCount => _allOrders.Count(o => o.Status != "COMPLETED" && o.Status != "CANCELLED" && o.Status != "HELD");
        public int DineInCount => _allOrders.Count(o => o.OrderType == "DINE_IN" && o.OrderSource != "QR_ORDER" && o.OrderSource != "ONLINE");
        public int TakeawayCount => _allOrders.Count(o => o.OrderType == "TAKEAWAY");
        public int DeliveryCount => _allOrders.Count(o => o.OrderType == "DELIVERY");
        public int OnlineCount => _allOrders.Count(o => o.OrderSource == "QR_ORDER" || o.OrderSource == "ONLINE" || o.OrderType == "ONLINE");

        private bool _inRestaurantOrdersChecked = true;
        public bool InRestaurantOrdersChecked
        {
            get => _inRestaurantOrdersChecked;
            set
            {
                if (SetProperty(ref _inRestaurantOrdersChecked, value))
                {
                    ApplyFilters();
                }
            }
        }

        private bool _onlineOrdersChecked = true;
        public bool OnlineOrdersChecked
        {
            get => _onlineOrdersChecked;
            set
            {
                if (SetProperty(ref _onlineOrdersChecked, value))
                {
                    ApplyFilters();
                }
            }
        }

        public ICommand RefreshCommand { get; }
        public ICommand SelectOrderCommand { get; }
        public ICommand PayOrderCommand { get; }
        public ICommand PrintTempBillCommand { get; }
        public ICommand SetStatusFilterCommand { get; }
        public ICommand SetTypeFilterCommand { get; }
        public ICommand CreateNewOrderCommand { get; }

        public event Action<PosOrder>? OrderSelected;
        public event Action<PosOrder>? OrderPayRequested;
        public event Action? CreateNewOrderRequested;
        public event Action? OrdersUpdated;

        public OrderListViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            RefreshCommand = new RelayCommand(async _ => await LoadOrdersAsync(_currentBranchId));

            SelectOrderCommand = new RelayCommand(param =>
            {
                if (param is PosOrder order)
                {
                    SelectedOrder = order;
                    OrderSelected?.Invoke(order);
                }
            });

            PayOrderCommand = new RelayCommand(param =>
            {
                if (param is PosOrder order)
                {
                    SelectedOrder = order;
                    OrderPayRequested?.Invoke(order);
                }
            });

            PrintTempBillCommand = new RelayCommand(async param =>
            {
                if (param is PosOrder order)
                {
                    var payload = new PrintJobPayload
                    {
                        Title = "PHIẾU TẠM TÍNH",
                        BranchName = "AVORA Restaurant",
                        TableName = order.TableName ?? "Mang về",
                        OrderCode = order.OrderCode ?? "TẠM TÍNH",
                        CashierName = "Thu ngân",
                        SubTotal = order.SubTotal,
                        DiscountAmount = order.DiscountAmount,
                        TaxAmount = order.TaxAmount,
                        TotalAmount = order.TotalAmount,
                        Items = order.OrderItems != null ? order.OrderItems.Select(i => new PrintJobItem
                        {
                            ProductName = i.ProductName,
                            Quantity = i.Quantity,
                            Price = i.PriceAtSale,
                            LineTotal = i.LineTotal
                        }).ToList() : new List<PrintJobItem>()
                    };
                    await PrintService.PrintReceiptAsync(payload);
                }
            });

            SetStatusFilterCommand = new RelayCommand(param =>
            {
                if (param is string status)
                {
                    StatusFilter = status;
                }
            });

            SetTypeFilterCommand = new RelayCommand(param =>
            {
                if (param is string type)
                {
                    TypeFilter = type;
                }
            });

            CreateNewOrderCommand = new RelayCommand(_ =>
            {
                CreateNewOrderRequested?.Invoke();
            });
        }

        public async Task LoadOrdersAsync(string? branchId = null)
        {
            if (!string.IsNullOrEmpty(branchId))
            {
                _currentBranchId = branchId;
            }
            if (string.IsNullOrEmpty(_currentBranchId))
            {
                var session = Security.SecureSessionManager.LoadSession();
                _currentBranchId = session?.BranchId;
            }
            if (string.IsNullOrEmpty(_currentBranchId)) return;

            IsLoading = true;
            try
            {
                var orders = await _apiService.GetActiveOrdersAsync(_currentBranchId);
                _allOrders = orders;

                void updateUi()
                {
                    ApplyFilters();
                    OnPropertyChanged(nameof(AllCount));
                    OnPropertyChanged(nameof(PaymentRequestedCount));
                    OnPropertyChanged(nameof(WaitingConfirmCount));
                    OnPropertyChanged(nameof(ServingCount));
                    OnPropertyChanged(nameof(DineInCount));
                    OnPropertyChanged(nameof(TakeawayCount));
                    OnPropertyChanged(nameof(DeliveryCount));
                    OnPropertyChanged(nameof(OnlineCount));
                    OrdersUpdated?.Invoke();
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

        private void ApplyFilters()
        {
            FilteredOrders.Clear();
            var q = _allOrders.AsEnumerable();

            // Status filter
            if (StatusFilter == "PAYMENT_REQUESTED")
            {
                q = q.Where(o => o.PaymentStatus == "PAYMENT_REQUESTED" || o.Status == "HELD");
            }
            else if (StatusFilter == "WAITING_CONFIRM")
            {
                q = q.Where(o => o.Status == "PENDING" || o.Status == "NEW" || o.Status == "SUBMITTED");
            }
            else if (StatusFilter == "SERVING")
            {
                q = q.Where(o => o.Status != "COMPLETED" && o.Status != "CANCELLED" && o.Status != "HELD");
            }

            // InRestaurant / Online checkboxes
            if (!InRestaurantOrdersChecked)
            {
                q = q.Where(o => o.OrderSource == "QR_ORDER" || o.OrderSource == "ONLINE" || o.OrderType == "ONLINE");
            }
            if (!OnlineOrdersChecked)
            {
                q = q.Where(o => o.OrderSource != "QR_ORDER" && o.OrderSource != "ONLINE" && o.OrderType != "ONLINE");
            }

            // Type filter
            if (TypeFilter != "ALL")
            {
                if (TypeFilter == "ONLINE")
                {
                    q = q.Where(o => o.OrderSource == "QR_ORDER" || o.OrderSource == "ONLINE" || o.OrderType == "ONLINE");
                }
                else if (TypeFilter == "DINE_IN")
                {
                    q = q.Where(o => o.OrderType == "DINE_IN" && o.OrderSource != "QR_ORDER" && o.OrderSource != "ONLINE");
                }
                else
                {
                    q = q.Where(o => o.OrderType == TypeFilter);
                }
            }

            // Search keyword
            if (!string.IsNullOrWhiteSpace(SearchKeyword))
            {
                string kw = SearchKeyword.Trim().ToLowerInvariant();
                q = q.Where(o =>
                    (o.OrderCode?.ToLowerInvariant().Contains(kw) == true) ||
                    (o.TemporaryOrderCode?.ToLowerInvariant().Contains(kw) == true) ||
                    (o.TableName?.ToLowerInvariant().Contains(kw) == true) ||
                    (o.Table?.Name?.ToLowerInvariant().Contains(kw) == true) ||
                    ((o.CustomerName ?? string.Empty).ToLowerInvariant().Contains(kw)) ||
                    (o.CustomerPhone?.Contains(kw) == true));
            }

            foreach (var order in q.OrderByDescending(o => o.CreatedAt))
            {
                FilteredOrders.Add(order);
            }

            OnPropertyChanged(nameof(TotalOrderCount));
        }
    }
}
