using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;
using AvoraPosNative.Security;
using AvoraPosNative.Services;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace AvoraPosNative.ViewModels
{
    public class PosShellViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private readonly RealtimeService _realtimeService;
        private string _activeTab = "TABLES"; // SALE, TABLES, ORDERS, RESERVATIONS, QR_ORDERS, KITCHEN, SETTINGS
        private bool _isSettingsDrawerOpen = false;
        private string _settingsSection = "PRINTER"; // PRINTER, SHIFT, KDS, SYNC, GENERAL
        private string _systemClockText = DateTime.Now.ToString("HH:mm:ss");
        private string _systemDateText = DateTime.Now.ToString("dd/MM/yyyy");
        private System.Windows.Threading.DispatcherTimer? _clockTimer;
        private string _cashierName = "Thu ngân";
        private string _cashierRole = "CASHIER";
        private string _currentBranchId = string.Empty;
        private string _branchName = "AVORA Restaurant";
        private bool _canSwitchBranch = false;
        private bool _isBranchSelectorOpen = false;
        private bool _isRealtimeConnected = false;
        private bool _isNetworkOnline = true;
        private int _notificationCount = 0;
        private int _pendingSyncCount = 0;
        private int _syncedCount = 0;
        private int _failedSyncCount = 0;
        private int _conflictCount = 0;
        private string _syncStatusText = "Đã đồng bộ";

        public ObservableCollection<PosBranch> AllowedBranches { get; } = new();

        public TableMapViewModel TableMapVm { get; }
        public ProductMenuViewModel ProductMenuVm { get; }
        public OrderViewModel OrderVm { get; }
        public KitchenViewModel KitchenVm { get; }
        public ReservationViewModel ReservationVm { get; }
        public CashShiftViewModel CashShiftVm { get; }
        public OrderListViewModel OrderListVm { get; }
        public QrOrderViewModel QrOrderVm { get; }

        public string ActiveTab
        {
            get => _activeTab;
            set
            {
                if (SetProperty(ref _activeTab, value))
                {
                    OnPropertyChanged(nameof(IsDetailMode));
                }
            }
        }

        public bool IsSettingsDrawerOpen
        {
            get => _isSettingsDrawerOpen;
            set => SetProperty(ref _isSettingsDrawerOpen, value);
        }

        public string SettingsSection
        {
            get => _settingsSection;
            set => SetProperty(ref _settingsSection, value);
        }

        public string SystemClockText
        {
            get => _systemClockText;
            set => SetProperty(ref _systemClockText, value);
        }

        public string SystemDateText
        {
            get => _systemDateText;
            set => SetProperty(ref _systemDateText, value);
        }

        public bool IsDetailMode => ActiveTab == "SALE" && (OrderVm.CurrentTable != null || OrderVm.Items.Count > 0);

        public int AllOrdersCount => OrderListVm.AllCount;
        public int QrOrdersCount => QrOrderVm.PendingCount;
        public int ReservationsCount => ReservationVm.ActiveReservationCount;
        public int KitchenTicketsCount => KitchenVm.TicketCount;

        public string CashierName
        {
            get => _cashierName;
            set => SetProperty(ref _cashierName, value);
        }

        public string CashierRole
        {
            get => _cashierRole;
            set
            {
                if (SetProperty(ref _cashierRole, value))
                {
                    OnPropertyChanged(nameof(CashierRoleDisplay));
                    OnPropertyChanged(nameof(IsAdminRole));
                }
            }
        }

        public bool IsAdminRole => string.Equals(CashierRole, "ADMIN", StringComparison.OrdinalIgnoreCase)
                                   || string.Equals(CashierRole, "SUPER_ADMIN", StringComparison.OrdinalIgnoreCase);

        public string CashierRoleDisplay => (CashierRole ?? string.Empty).ToUpperInvariant() switch
        {
            "ADMIN" or "SUPER_ADMIN" => "Quản trị viên",
            "MANAGER" or "BRANCH_MANAGER" => "Quản lý chi nhánh",
            "CASHIER" => "Thu ngân",
            "WAITER" or "STAFF" => "Phục vụ",
            "KITCHEN" or "CHEF" => "Bếp / Bar",
            _ => CashierRole ?? "Thu ngân"
        };

        public string CurrentBranchId
        {
            get => _currentBranchId;
            set => SetProperty(ref _currentBranchId, value);
        }

        public string BranchName
        {
            get => _branchName;
            set => SetProperty(ref _branchName, value);
        }

        public bool CanSwitchBranch
        {
            get => _canSwitchBranch;
            set => SetProperty(ref _canSwitchBranch, value);
        }

        public bool IsBranchSelectorOpen
        {
            get => _isBranchSelectorOpen;
            set => SetProperty(ref _isBranchSelectorOpen, value);
        }

        public bool IsRealtimeConnected
        {
            get => _isRealtimeConnected;
            set => SetProperty(ref _isRealtimeConnected, value);
        }

        public bool IsNetworkOnline
        {
            get => _isNetworkOnline;
            set
            {
                if (SetProperty(ref _isNetworkOnline, value))
                {
                    OnPropertyChanged(nameof(NetworkStatusText));
                    OnPropertyChanged(nameof(NetworkStatusColor));
                }
            }
        }

        public string NetworkStatusText => IsNetworkOnline ? "ONLINE" : "OFFLINE";
        public string NetworkStatusColor => IsNetworkOnline ? "#10B981" : "#F59E0B";

        public int NotificationCount
        {
            get => _notificationCount;
            set => SetProperty(ref _notificationCount, value);
        }

        public int PendingSyncCount
        {
            get => _pendingSyncCount;
            set => SetProperty(ref _pendingSyncCount, value);
        }

        public int SyncedCount
        {
            get => _syncedCount;
            set => SetProperty(ref _syncedCount, value);
        }

        public int FailedSyncCount
        {
            get => _failedSyncCount;
            set => SetProperty(ref _failedSyncCount, value);
        }

        public int ConflictCount
        {
            get => _conflictCount;
            set => SetProperty(ref _conflictCount, value);
        }

        public string SyncStatusText
        {
            get => _syncStatusText;
            set => SetProperty(ref _syncStatusText, value);
        }

        public ICommand SwitchTabCommand { get; }
        public ICommand SwitchSettingsSectionCommand { get; }
        public ICommand SwitchBranchCommand { get; }
        public ICommand ToggleBranchSelectorCommand { get; }
        public ICommand OpenCashDrawerQuickCommand { get; }
        public ICommand CreateNewOrderCommand { get; }
        public ICommand LogoutCommand { get; }
        public ICommand TriggerSyncCommand { get; }
        public ICommand ToggleSettingsDrawerCommand { get; }
        public ICommand ExitDetailModeCommand { get; }
        public ICommand MinimizeWindowCommand { get; }
        public ICommand ToggleFullscreenCommand { get; }
        public ICommand ExitAppCommand { get; }

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
            OrderListVm = new OrderListViewModel(_apiService);
            QrOrderVm = new QrOrderViewModel(_apiService);

            // Table Operations Wiring (Phase 2 Master Plan)
            OrderVm.GetTablesCallback = () => TableMapVm.AllTables;
            OrderVm.BranchIdCallback = () => CurrentBranchId;
            OrderVm.TableOperationCompleted += () =>
            {
                _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
            };
            ProductMenuVm.OpenGuestCountCommand = OrderVm.OpenGuestCountCommand;

            // Clock timer for real-time live clock
            _clockTimer = new System.Windows.Threading.DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _clockTimer.Tick += (s, e) =>
            {
                var now = DateTime.Now;
                SystemClockText = now.ToString("HH:mm:ss");
                SystemDateText = now.ToString("dd/MM/yyyy");
            };
            _clockTimer.Start();

            // Wiring events:
            TableMapVm.TableOrderRequested += (table) =>
            {
                IsSettingsDrawerOpen = false;
                OrderVm.LoadTableOrder(table);
                ActiveTab = "SALE";
                OnPropertyChanged(nameof(IsDetailMode));
            };

            OrderListVm.OrderSelected += (order) =>
            {
                IsSettingsDrawerOpen = false;
                OrderVm.CurrentTable = order.Table;
                OrderVm.CurrentOrder = order;
                OrderVm.OrderType = !string.IsNullOrEmpty(order.OrderType) ? order.OrderType : "DINE_IN";
                OrderVm.Items.Clear();
                if (order.OrderItems != null && order.OrderItems.Count > 0)
                {
                    foreach (var it in order.OrderItems)
                    {
                        OrderVm.Items.Add(new PosOrderItem
                        {
                            Id = it.Id,
                            ProductId = it.ProductId,
                            ProductName = it.ProductName,
                            Quantity = it.Quantity,
                            Price = it.PriceAtSale,
                            LineTotal = it.LineTotal,
                            OptionsText = it.OptionsTextSnapshot,
                            Note = it.Note,
                            Status = "SENT_KITCHEN"
                        });
                    }
                }
                else if (order.Items != null && order.Items.Count > 0)
                {
                    foreach (var it in order.Items)
                    {
                        OrderVm.Items.Add(new PosOrderItem
                        {
                            Id = it.Id,
                            ProductId = it.ProductId,
                            ProductName = it.ProductName,
                            Quantity = it.Quantity,
                            Price = it.Price,
                            LineTotal = it.Price * it.Quantity,
                            OptionsText = it.OptionsText,
                            Note = it.Note,
                            Status = "SENT_KITCHEN"
                        });
                    }
                }
                OrderVm.RecalculateTotals();
                ActiveTab = "SALE";
                OnPropertyChanged(nameof(IsDetailMode));
            };

            OrderListVm.CreateNewOrderRequested += () =>
            {
                string targetType = OrderListVm.TypeFilter switch
                {
                    "TAKEAWAY" => "TAKEAWAY",
                    "DELIVERY" => "DELIVERY",
                    "DINE_IN" => "DINE_IN",
                    _ => "TAKEAWAY"
                };
                StartFreshOrder(targetType);
            };

            OrderListVm.OrderPayRequested += (order) =>
            {
                OrderListVm.SelectOrderCommand.Execute(order);
                OrderVm.PaymentCommand.Execute(null);
            };

            ReservationVm.ReservationSeated += (resv, tableId) =>
            {
                if (string.IsNullOrEmpty(tableId))
                {
                    ActiveTab = "TABLES";
                    return;
                }
                var tbl = TableMapVm.FilteredTables.FirstOrDefault(t => t.Id == tableId)
                          ?? new PosTable { Id = tableId, Name = resv.AssignedTableNames, Capacity = resv.PartySize };
                OrderVm.LoadTableOrder(tbl);
                if (OrderVm.CurrentOrder != null)
                {
                    OrderVm.CurrentOrder.GuestCount = resv.PartySize > 0 ? resv.PartySize : 1;
                }
                ActiveTab = "SALE";
                OnPropertyChanged(nameof(IsDetailMode));
                _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
            };

            OrderListVm.OrdersUpdated += () =>
            {
                OnPropertyChanged(nameof(AllOrdersCount));
            };

            QrOrderVm.RoundsUpdated += () =>
            {
                OnPropertyChanged(nameof(QrOrdersCount));
            };

            ReservationVm.ReservationsUpdated += () =>
            {
                OnPropertyChanged(nameof(ReservationsCount));
            };

            OrderVm.BackToTableRequested += () =>
            {
                ActiveTab = "TABLES";
                _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
            };

            OrderVm.OrderCompleted += () =>
            {
                ActiveTab = "TABLES";
                _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
            };

            ProductMenuVm.ProductSelected += (product) =>
            {
                if (product.HasOptions && product.OptionGroups != null && product.OptionGroups.Count > 0)
                {
                    var dlg = new Dialogs.ProductOptionDialog(product);
                    if (dlg.ShowDialog() == true)
                    {
                        var optItems = dlg.SelectedOptions.Select(o => new PosProductOptionItem
                        {
                            Id = o.OptionItemId,
                            Name = o.NameAtSale,
                            Price = o.PriceAdjustmentAtSale
                        }).ToList();
                        OrderVm.AddProduct(product, 1, optItems, dlg.ItemNote);
                        OnPropertyChanged(nameof(IsDetailMode));
                    }
                }
                else
                {
                    OrderVm.AddProduct(product);
                    OnPropertyChanged(nameof(IsDetailMode));
                }
            };

            SwitchTabCommand = new RelayCommand(tab =>
            {
                if (tab is string s)
                {
                    IsSettingsDrawerOpen = false;
                    IsBranchSelectorOpen = false;
                    ActiveTab = s;
                    if (s == "SALE")
                    {
                        _ = ProductMenuVm.LoadMenuAsync(CurrentBranchId);
                    }
                    else if (s == "TABLES")
                    {
                        _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                    }
                    else if (s == "ORDERS")
                    {
                        _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                    }
                    else if (s == "RESERVATIONS")
                    {
                        _ = ReservationVm.LoadReservationsAsync(CurrentBranchId);
                    }
                    else if (s == "QR_ORDERS")
                    {
                        _ = QrOrderVm.LoadPendingRoundsAsync(CurrentBranchId);
                    }
                    else if (s == "KITCHEN")
                    {
                        _ = KitchenVm.LoadTicketsAsync(CurrentBranchId);
                    }
                    else if (s == "SHIFT")
                    {
                        _ = CashShiftVm.LoadShiftAsync(CurrentBranchId);
                    }
                    OnPropertyChanged(nameof(IsDetailMode));
                }
            });

            SwitchSettingsSectionCommand = new RelayCommand(sec =>
            {
                if (sec is string section)
                {
                    if (section == "TABLES" || section == "ORDERS" || section == "RESERVATIONS" || section == "QR_ORDERS" || section == "SALE")
                    {
                        SwitchTabCommand.Execute(section);
                        return;
                    }
                    SettingsSection = section;
                    IsSettingsDrawerOpen = true;
                    if (section == "SHIFT")
                    {
                        _ = CashShiftVm.LoadShiftAsync(CurrentBranchId);
                    }
                    else if (section == "KDS")
                    {
                        _ = KitchenVm.LoadTicketsAsync(CurrentBranchId);
                    }
                }
            });

            ToggleBranchSelectorCommand = new RelayCommand(_ =>
            {
                if (CanSwitchBranch && AllowedBranches.Count > 1)
                {
                    IsBranchSelectorOpen = !IsBranchSelectorOpen;
                }
            });

            SwitchBranchCommand = new RelayCommand(async param =>
            {
                if (param is PosBranch branch && !string.IsNullOrEmpty(branch.Id))
                {
                    IsBranchSelectorOpen = false;
                    if (branch.Id == CurrentBranchId) return;

                    CurrentBranchId = branch.Id;
                    BranchName = branch.Name;
                    SecureSessionManager.UpdateSessionBranch(branch.Id, branch.Name);

                    var session = SecureSessionManager.LoadSession();
                    await _realtimeService.ConnectAsync(branch.Id, session?.UserId ?? string.Empty);
                    await ReloadAllBranchDataAsync(branch.Id, session?.UserId);
                }
            });

            OpenCashDrawerQuickCommand = new RelayCommand(async _ =>
            {
                try
                {
                    await PrintService.OpenCashDrawerAsync();
                    if (!string.IsNullOrEmpty(CurrentBranchId))
                    {
                        _ = _apiService.OpenCashDrawerAsync(CurrentBranchId, "Mở két tiền nhanh từ Menu POS Native");
                    }
                    AvoraPosNative.Dialogs.AvoraMessageDialog.Success("Đã gửi xung điện mở két tiền thành công!", "Mở két tiền");
                }
                catch (Exception ex)
                {
                    AvoraPosNative.Dialogs.AvoraMessageDialog.Warning($"Không thể mở két tiền: {ex.Message}", "Mở két tiền");
                }
            });

            CreateNewOrderCommand = new RelayCommand(_ => StartFreshOrder());

            LogoutCommand = new RelayCommand(_ =>
            {
                IsSettingsDrawerOpen = false;
                LogoutRequested?.Invoke();
            });

            TriggerSyncCommand = new RelayCommand(async _ =>
            {
                await BackgroundSyncWorker.Instance.TriggerSyncNowAsync();
            });

            ToggleSettingsDrawerCommand = new RelayCommand(_ =>
            {
                IsBranchSelectorOpen = false;
                IsSettingsDrawerOpen = !IsSettingsDrawerOpen;
            });

            ExitDetailModeCommand = new RelayCommand(_ =>
            {
                ActiveTab = "TABLES";
                OnPropertyChanged(nameof(IsDetailMode));
            });

            MinimizeWindowCommand = new RelayCommand(_ =>
            {
                if (Application.Current?.MainWindow is MainWindow mw)
                {
                    mw.MinimizeWindow();
                }
            });

            ToggleFullscreenCommand = new RelayCommand(_ =>
            {
                if (Application.Current?.MainWindow is MainWindow mw)
                {
                    mw.ToggleFullscreenWindow();
                }
            });

            ExitAppCommand = new RelayCommand(_ =>
            {
                Application.Current?.MainWindow?.Close();
            });

            // 100% Real-time WebSocket Event Wiring
            _realtimeService.Connected += () =>
            {
                App.Current?.Dispatcher.Invoke(() => IsRealtimeConnected = true);
            };
            _realtimeService.Disconnected += () =>
            {
                App.Current?.Dispatcher.Invoke(() => IsRealtimeConnected = false);
            };

            _realtimeService.TableStatusChanged += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                });
            };

            _realtimeService.OrderCreated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    NotificationCount++;
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                    _ = KitchenVm.LoadTicketsAsync(CurrentBranchId);
                });
            };

            _realtimeService.OrderUpdated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                    _ = KitchenVm.LoadTicketsAsync(CurrentBranchId);
                });
            };

            _realtimeService.KitchenTicketNew += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    NotificationCount++;
                    _ = KitchenVm.LoadTicketsAsync(CurrentBranchId);
                    OnPropertyChanged(nameof(KitchenTicketsCount));
                });
            };

            _realtimeService.KitchenItemUpdated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = KitchenVm.LoadTicketsAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                    OnPropertyChanged(nameof(KitchenTicketsCount));
                });
            };

            _realtimeService.PaymentCompleted += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                    _ = CashShiftVm.LoadShiftAsync(CurrentBranchId);
                });
            };

            _realtimeService.ShiftUpdated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = CashShiftVm.LoadShiftAsync(CurrentBranchId);
                });
            };

            _realtimeService.ProductAvailabilityChanged += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    string? pId = payload["productId"]?.ToString() ?? payload["id"]?.ToString();
                    bool avail = payload["available"]?.Value<bool>() ?? true;
                    if (!string.IsNullOrEmpty(pId))
                    {
                        ProductMenuVm.UpdateProductAvailabilityRealtime(pId, avail);
                    }
                    else
                    {
                        _ = ProductMenuVm.LoadMenuAsync(CurrentBranchId);
                    }
                });
            };

            _realtimeService.QrOrderUpdated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    NotificationCount++;
                    _ = QrOrderVm.LoadPendingRoundsAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                });
            };

            _realtimeService.ReservationUpdated += payload =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    NotificationCount++;
                    _ = ReservationVm.LoadReservationsAsync(CurrentBranchId);
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                });
            };

            _realtimeService.PosNotificationReceived += (type, envelope) =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    NotificationCount++;
                });
            };

            // Background Sync Worker events
            IsNetworkOnline = BackgroundSyncWorker.Instance.IsOnline;
            BackgroundSyncWorker.Instance.ConnectivityChanged += online =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    IsNetworkOnline = online;
                    if (online && !string.IsNullOrEmpty(CurrentBranchId))
                    {
                        _ = ReloadAllBranchDataAsync(CurrentBranchId);
                    }
                });
            };

            BackgroundSyncWorker.Instance.SyncStatsUpdated += (pending, synced, failed, conflict) =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    PendingSyncCount = pending;
                    SyncedCount = synced;
                    FailedSyncCount = failed;
                    ConflictCount = conflict;

                    if (conflict > 0)
                    {
                        SyncStatusText = $"Xung đột: {conflict} đơn";
                    }
                    else if (pending > 0)
                    {
                        SyncStatusText = $"Chờ đồng bộ: {pending} đơn";
                    }
                    else if (failed > 0)
                    {
                        SyncStatusText = $"Lỗi đồng bộ: {failed} đơn";
                    }
                    else
                    {
                        SyncStatusText = "Đã đồng bộ";
                    }
                });
            };

            BackgroundSyncWorker.Instance.OrderSynced += order =>
            {
                App.Current?.Dispatcher.Invoke(() =>
                {
                    _ = TableMapVm.LoadTablesAsync(CurrentBranchId);
                    _ = OrderListVm.LoadOrdersAsync(CurrentBranchId);
                });
            };
        }

        private void StartFreshOrder(string orderType = "TAKEAWAY")
        {
            IsSettingsDrawerOpen = false;
            OrderVm.CurrentTable = null;
            OrderVm.CurrentOrder = new PosOrder
            {
                Id = Guid.NewGuid().ToString(),
                BranchId = CurrentBranchId,
                OrderType = orderType,
                Status = "DRAFT",
                CreatedAt = DateTime.Now
            };
            OrderVm.OrderType = orderType;
            OrderVm.Items.Clear();
            OrderVm.RecalculateTotals();
            ActiveTab = "SALE";
            OnPropertyChanged(nameof(IsDetailMode));
        }

        public async Task InitializeAsync()
        {
            var session = SecureSessionManager.LoadSession();
            string? branchId = session?.BranchId;
            string? branchName = session?.BranchName;

            if (session != null)
            {
                CashierName = session.FullName ?? "Thu ngân";
                CashierRole = session.Role ?? "STAFF";
            }

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

                    var branchesArr = initData["branches"] as JArray;
                    if (branchesArr != null)
                    {
                        var list = JsonConvert.DeserializeObject<System.Collections.Generic.List<PosBranch>>(branchesArr.ToString());
                        if (list != null)
                        {
                            AllowedBranches.Clear();
                            foreach (var b in list)
                            {
                                AllowedBranches.Add(b);
                            }
                            if (string.IsNullOrEmpty(branchId) && AllowedBranches.Count > 0)
                            {
                                branchId = AllowedBranches[0].Id;
                                branchName = AllowedBranches[0].Name;
                            }
                        }
                    }

                    var staffObj = initData["staff"] as JObject;
                    if (staffObj != null)
                    {
                        string? sName = staffObj["fullName"]?.ToString();
                        string? sRole = staffObj["role"]?.ToString();
                        if (!string.IsNullOrEmpty(sName)) CashierName = sName;
                        if (!string.IsNullOrEmpty(sRole)) CashierRole = sRole;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SHELL] InitializeAsync error: {ex.Message}");
            }

            CurrentBranchId = !string.IsNullOrWhiteSpace(branchId) ? branchId : "4d69e8f9-4abf-4499-b2b4-6769228bbb51";
            BranchName = !string.IsNullOrWhiteSpace(branchName) ? branchName : "Avora Hoàn Kiếm";
            CanSwitchBranch = IsAdminRole || AllowedBranches.Count > 1;

            if (!string.IsNullOrEmpty(CurrentBranchId))
            {
                SecureSessionManager.UpdateSessionBranch(CurrentBranchId, BranchName);
                await _realtimeService.ConnectAsync(CurrentBranchId, session?.UserId ?? string.Empty);
            }

            await ReloadAllBranchDataAsync(CurrentBranchId, session?.UserId);
        }

        private async Task ReloadAllBranchDataAsync(string branchId, string? userId = null)
        {
            await Task.WhenAll(
                TableMapVm.LoadTablesAsync(branchId),
                ProductMenuVm.LoadMenuAsync(branchId),
                KitchenVm.LoadTicketsAsync(branchId),
                ReservationVm.LoadReservationsAsync(branchId),
                CashShiftVm.LoadShiftAsync(branchId, userId),
                OrderListVm.LoadOrdersAsync(branchId),
                QrOrderVm.LoadPendingRoundsAsync(branchId)
            );
            OnPropertyChanged(nameof(AllOrdersCount));
            OnPropertyChanged(nameof(QrOrdersCount));
            OnPropertyChanged(nameof(ReservationsCount));
            OnPropertyChanged(nameof(KitchenTicketsCount));
        }
    }
}
