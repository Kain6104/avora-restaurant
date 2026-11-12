using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Dialogs;
using AvoraPosNative.Models;
using AvoraPosNative.Printing;
using AvoraPosNative.Security;
using AvoraPosNative.Services;
using AvoraPosNative.Storage;

namespace AvoraPosNative.ViewModels
{
    public class OrderViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private PosTable? _currentTable;
        private PosOrder? _currentOrder;
        private bool _hasUnsavedChanges = false;
        private bool _isBusy = false;
        private string? _customerPhone;
        private string? _customerName;
        private int _customerPoints = 0;
        private string? _customerTier;
        private string? _discountVoucherCode;
        private string? _shippingVoucherCode;
        private decimal _discountAmount = 0;
        private decimal _shippingFee = 0;
        private decimal _taxAmount = 0;
        private string _orderType = "DINE_IN";
        private string _orderNote = string.Empty;
        private string _tempOrderNote = string.Empty;
        private bool _isEditingNote = false;
        private bool _isBreakdownOpen = false;
        private bool _isMoreMenuOpen = false;
        private bool _isOrderTypeMenuOpen = false;

        public ObservableCollection<PosOrderItem> Items { get; } = new();

        public event Action? OrderCompleted;
        public event Action? BackToTableRequested;

        public string OrderType
        {
            get => _orderType;
            set
            {
                if (SetProperty(ref _orderType, value))
                {
                    OnPropertyChanged(nameof(OrderTypeDisplay));
                    OnPropertyChanged(nameof(OrderTitle));
                }
            }
        }

        public string OrderTypeDisplay => OrderType switch
        {
            "TAKEAWAY" => "Mang về",
            "DELIVERY" => "Giao hàng",
            _ => "Tại bàn"
        };

        public string OrderTitle
        {
            get
            {
                if (CurrentTable != null && !string.IsNullOrWhiteSpace(CurrentTable.Name))
                    return CurrentTable.Name;
                string code = CurrentOrder?.OrderCode ?? "ĐƠN MỚI";
                return $"{OrderTypeDisplay} #{code}";
            }
        }

        public string OrderNote
        {
            get => _orderNote;
            set => SetProperty(ref _orderNote, value);
        }

        public string TempOrderNote
        {
            get => _tempOrderNote;
            set => SetProperty(ref _tempOrderNote, value);
        }

        public bool IsEditingNote
        {
            get => _isEditingNote;
            set => SetProperty(ref _isEditingNote, value);
        }

        public bool IsBreakdownOpen
        {
            get => _isBreakdownOpen;
            set => SetProperty(ref _isBreakdownOpen, value);
        }

        public bool IsMoreMenuOpen
        {
            get => _isMoreMenuOpen;
            set => SetProperty(ref _isMoreMenuOpen, value);
        }

        public bool IsOrderTypeMenuOpen
        {
            get => _isOrderTypeMenuOpen;
            set => SetProperty(ref _isOrderTypeMenuOpen, value);
        }

        public int UnsentKitchenCount => Items.Count(i => i.Status == "NEW");
        public bool HasUnsentItems => UnsentKitchenCount > 0;
        public int TotalItemCount => Items.Sum(i => i.Quantity);

        public PosTable? CurrentTable
        {
            get => _currentTable;
            set => SetProperty(ref _currentTable, value);
        }

        public PosOrder? CurrentOrder
        {
            get => _currentOrder;
            set => SetProperty(ref _currentOrder, value);
        }

        public bool HasUnsavedChanges
        {
            get => _hasUnsavedChanges;
            set => SetProperty(ref _hasUnsavedChanges, value);
        }

        public bool IsBusy
        {
            get => _isBusy;
            set => SetProperty(ref _isBusy, value);
        }

        public string? CustomerPhone
        {
            get => _customerPhone;
            set => SetProperty(ref _customerPhone, value);
        }

        public string? CustomerName
        {
            get => _customerName;
            set => SetProperty(ref _customerName, value);
        }

        public int CustomerPoints
        {
            get => _customerPoints;
            set => SetProperty(ref _customerPoints, value);
        }

        public string? CustomerTier
        {
            get => _customerTier;
            set => SetProperty(ref _customerTier, value);
        }

        public string? DiscountVoucherCode
        {
            get => _discountVoucherCode;
            set => SetProperty(ref _discountVoucherCode, value);
        }

        public string? ShippingVoucherCode
        {
            get => _shippingVoucherCode;
            set => SetProperty(ref _shippingVoucherCode, value);
        }

        public decimal SubTotal => Items.Sum(i => i.LineTotal);

        public decimal DiscountAmount
        {
            get => _discountAmount;
            set
            {
                if (SetProperty(ref _discountAmount, value))
                {
                    OnPropertyChanged(nameof(TotalAmount));
            OnPropertyChanged(nameof(UnsentKitchenCount));
            OnPropertyChanged(nameof(HasUnsentItems));
            OnPropertyChanged(nameof(TotalItemCount));
            OnPropertyChanged(nameof(OrderTitle));
                }
            }
        }

        public decimal ShippingFee
        {
            get => _shippingFee;
            set
            {
                if (SetProperty(ref _shippingFee, value))
                {
                    OnPropertyChanged(nameof(TotalAmount));
                }
            }
        }

        private string _vatPriceMode = "VAT_INCLUDED";
        public string VatPriceMode
        {
            get => _vatPriceMode;
            set
            {
                if (SetProperty(ref _vatPriceMode, value))
                {
                    RecalculateTotals();
                }
            }
        }

        private decimal _vatRate = 8m;
        public decimal VatRate
        {
            get => _vatRate;
            set
            {
                if (SetProperty(ref _vatRate, value))
                {
                    RecalculateTotals();
                }
            }
        }

        public decimal TaxAmount
        {
            get => _taxAmount;
            set
            {
                if (SetProperty(ref _taxAmount, value))
                {
                    OnPropertyChanged(nameof(TotalAmount));
                }
            }
        }

        public decimal TotalAmount
        {
            get
            {
                decimal netAmount = Math.Max(0, SubTotal - DiscountAmount);
                if (VatPriceMode == "VAT_EXCLUDED")
                {
                    decimal total = netAmount + TaxAmount + ShippingFee;
                    return total > 0 ? total : 0;
                }
                else
                {
                    decimal total = netAmount + ShippingFee;
                    return total > 0 ? total : 0;
                }
            }
        }

        public ICommand IncreaseQuantityCommand { get; }
        public ICommand DecreaseQuantityCommand { get; }
        public ICommand SetQuantityKeypadCommand { get; }
        public ICommand RemoveItemCommand { get; }
        public ICommand SendKitchenCommand { get; }
        public ICommand TempBillCommand { get; }
        public ICommand PaymentCommand { get; }
        public ICommand BackCommand { get; }
        public ICommand SearchCustomerCommand { get; }
        public ICommand SetOrderTypeCommand { get; }
        public ICommand ToggleBreakdownCommand { get; }
        public ICommand ToggleEditNoteCommand { get; }
        public ICommand SaveOrderNoteCommand { get; }
        public ICommand CancelEditNoteCommand { get; }
        public ICommand SaveOrderCommand { get; }
        public ICommand ClearCartCommand { get; }
        public ICommand CancelOrderCommand { get; }
        public ICommand ToggleMoreMenuCommand { get; }
        public ICommand ToggleOrderTypeMenuCommand { get; }
        public ICommand RedeemPointsCommand { get; }
        public ICommand OrderDiscountCommand { get; }
        public ICommand OrderFeesCommand { get; }
        public ICommand ApplyBuffetCommand { get; }
        public ICommand CancelBuffetCommand { get; }
        public ICommand OpenMoveTableCommand { get; }
        public ICommand OpenMergeTableCommand { get; }
        public ICommand OpenSplitTableCommand { get; }
        public ICommand OpenTableQrCommand { get; }
        public ICommand OpenGuestCountCommand { get; }

        public Func<List<PosTable>>? GetTablesCallback { get; set; }
        public Func<string>? BranchIdCallback { get; set; }
        public event Action? TableOperationCompleted;

        private string? _activeBuffetPackageId;
        private string? _activeBuffetPackageName;
        private DateTime? _buffetStartedAt;
        private HashSet<string> _buffetItemProductIds = new();

        public string? ActiveBuffetPackageId
        {
            get => _activeBuffetPackageId;
            set => SetProperty(ref _activeBuffetPackageId, value);
        }

        public string? ActiveBuffetPackageName
        {
            get => _activeBuffetPackageName;
            set
            {
                if (SetProperty(ref _activeBuffetPackageName, value))
                {
                    OnPropertyChanged(nameof(HasActiveBuffet));
                    OnPropertyChanged(nameof(BuffetRemainingText));
                }
            }
        }

        public DateTime? BuffetStartedAt
        {
            get => _buffetStartedAt;
            set => SetProperty(ref _buffetStartedAt, value);
        }

        public HashSet<string> BuffetItemProductIds
        {
            get => _buffetItemProductIds;
            set => _buffetItemProductIds = value;
        }

        public bool HasActiveBuffet => !string.IsNullOrEmpty(ActiveBuffetPackageName);
        public string GuestCountText => $"{(CurrentOrder?.GuestCount > 0 ? CurrentOrder.GuestCount : (CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 2))} Khách";
        public string BuffetRemainingText
        {
            get
            {
                if (!BuffetStartedAt.HasValue) return "Thời gian: 120 phút";
                var elapsed = DateTime.Now - BuffetStartedAt.Value;
                int remainingMinutes = Math.Max(0, 120 - (int)elapsed.TotalMinutes);
                return $"Còn {remainingMinutes} phút";
            }
        }

        public OrderViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            IncreaseQuantityCommand = new RelayCommand(param =>
            {
                if (param is PosOrderItem item)
                {
                    item.Quantity++;
                    item.LineTotal = item.Quantity * item.Price;
                    RecalculateTotals();
                    HasUnsavedChanges = true;
                }
            });

            DecreaseQuantityCommand = new RelayCommand(param =>
            {
                if (param is PosOrderItem item)
                {
                    if (item.Quantity > 1)
                    {
                        item.Quantity--;
                        item.LineTotal = item.Quantity * item.Price;
                        RecalculateTotals();
                        HasUnsavedChanges = true;
                    }
                    else
                    {
                        PromptRemoveItem(item);
                    }
                }
            });

            SetQuantityKeypadCommand = new RelayCommand(param =>
            {
                if (param is PosOrderItem item)
                {
                    var dlg = new NumericKeypadDialog($"Số lượng: {item.ProductName}", item.Quantity, 1, 999);
                    if (dlg.ShowDialog() == true && dlg.ResultValue > 0)
                    {
                        item.Quantity = (int)dlg.ResultValue;
                        item.LineTotal = item.Quantity * item.Price;
                        RecalculateTotals();
                        HasUnsavedChanges = true;
                    }
                }
            });

            RemoveItemCommand = new RelayCommand(param =>
            {
                if (param is PosOrderItem item)
                {
                    PromptRemoveItem(item);
                }
            });

            SendKitchenCommand = new RelayCommand(async _ => await SendToKitchenAsync());
            TempBillCommand = new RelayCommand(async _ => await PrintTempBillAsync());
            PaymentCommand = new RelayCommand(_ => OpenPaymentDialog());
            BackCommand = new RelayCommand(_ => BackToTableRequested?.Invoke());
            SearchCustomerCommand = new RelayCommand(_ => LookupCustomerAsync());

            SetOrderTypeCommand = new RelayCommand(param =>
            {
                if (param is string type)
                {
                    OrderType = type;
                    IsOrderTypeMenuOpen = false;
                }
            });

            ToggleBreakdownCommand = new RelayCommand(_ => IsBreakdownOpen = !IsBreakdownOpen);

            ToggleEditNoteCommand = new RelayCommand(_ =>
            {
                TempOrderNote = OrderNote;
                IsEditingNote = !IsEditingNote;
            });

            SaveOrderNoteCommand = new RelayCommand(_ =>
            {
                OrderNote = TempOrderNote.Trim();
                IsEditingNote = false;
                HasUnsavedChanges = true;
            });

            CancelEditNoteCommand = new RelayCommand(_ => IsEditingNote = false);

            SaveOrderCommand = new RelayCommand(async _ => await SaveOrderDraftAsync());

            ClearCartCommand = new RelayCommand(_ =>
            {
                if (AvoraMessageDialog.Confirm("Bạn có chắc muốn xóa toàn bộ món trong giỏ hàng?", "Xác nhận xóa giỏ"))
                {
                    Items.Clear();
                    RecalculateTotals();
                    HasUnsavedChanges = true;
                }
            });

            CancelOrderCommand = new RelayCommand(async _ => await CancelCurrentOrderAsync());

            ToggleMoreMenuCommand = new RelayCommand(_ => IsMoreMenuOpen = !IsMoreMenuOpen);
            ToggleOrderTypeMenuCommand = new RelayCommand(_ => IsOrderTypeMenuOpen = !IsOrderTypeMenuOpen);

            RedeemPointsCommand = new RelayCommand(_ =>
            {
                AvoraMessageDialog.Info($"Khách hàng có {CustomerPoints:N0} điểm thưởng tích lũy.", "Đổi điểm thưởng");
            });

            OrderDiscountCommand = new RelayCommand(_ =>
            {
                var dlg = new NumericKeypadDialog("Nhập % chiết khấu đơn:", 10, 0, 100);
                if (dlg.ShowDialog() == true && dlg.ResultValue >= 0)
                {
                    DiscountAmount = Math.Round(SubTotal * (dlg.ResultValue / 100m), 0);
                    RecalculateTotals();
                }
            });

            OrderFeesCommand = new RelayCommand(_ =>
            {
                AvoraMessageDialog.Info($"Chi tiết thuế VAT (8%): {TaxAmount:N0}đ\nPhụ thu dịch vụ: {ShippingFee:N0}đ", "Phụ thu & Thuế");
            });

            OpenGuestCountCommand = new RelayCommand(_ => OpenGuestCount());
            OpenMoveTableCommand = new RelayCommand(async _ => await OpenMoveTableAsync());
            OpenMergeTableCommand = new RelayCommand(async _ => await OpenMergeTableAsync());
            OpenSplitTableCommand = new RelayCommand(async _ => await OpenSplitTableAsync());
            OpenTableQrCommand = new RelayCommand(_ => OpenTableQr());

            ApplyBuffetCommand = new RelayCommand(async _ =>
            {
                try
                {
                    var session = SecureSessionManager.LoadSession();
                    string branchId = session?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51";
                    var packages = await _apiService.GetBuffetPackagesAsync(branchId);
                    if (packages.Count == 0)
                    {
                        AvoraMessageDialog.Warning("Chưa có gói Buffet nào được cấu hình cho chi nhánh này.", "Thông báo");
                        return;
                    }

                    int guestCount = (CurrentOrder != null && CurrentOrder.GuestCount > 0) ? CurrentOrder.GuestCount : (CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 2);
                    string tblName = CurrentTable?.Name ?? "Đơn gọi món";
                    var dlg = new PosBuffetApplyDialog(packages, tblName, guestCount);
                    if (dlg.ShowDialog() == true && dlg.SelectedPackage != null)
                    {
                        ActiveBuffetPackageId = dlg.SelectedPackage.Id;
                        ActiveBuffetPackageName = dlg.SelectedPackage.Name;
                        BuffetStartedAt = DateTime.Now;
                        BuffetItemProductIds = dlg.BuffetItemProductIds;

                        foreach (var ticket in dlg.SelectedTicketOrders)
                        {
                            Items.Add(ticket);
                        }

                        foreach (var item in Items)
                        {
                            if (BuffetItemProductIds.Contains(item.ProductId))
                            {
                                item.Price = 0;
                                item.LineTotal = 0;
                                item.PricingMode = "BUFFET_INCLUDED";
                            }
                        }

                        RecalculateTotals();
                        HasUnsavedChanges = true;
                        OnPropertyChanged(nameof(HasActiveBuffet));
                        OnPropertyChanged(nameof(ActiveBuffetPackageName));
                        OnPropertyChanged(nameof(BuffetRemainingText));

                        AvoraMessageDialog.Success($"Đã kích hoạt gói {ActiveBuffetPackageName} thành công cho {tblName}!", "Kích hoạt Buffet");
                    }
                }
                catch (Exception ex)
                {
                    AvoraMessageDialog.Error($"Không thể tải gói Buffet: {ex.Message}", "Lỗi");
                }
            });

            CancelBuffetCommand = new RelayCommand(_ =>
            {
                if (AvoraMessageDialog.Confirm("Bạn có chắc muốn hủy gói Buffet đang áp dụng cho bàn này?", "Hủy gói Buffet"))
                {
                    ActiveBuffetPackageId = null;
                    ActiveBuffetPackageName = null;
                    BuffetStartedAt = null;
                    BuffetItemProductIds.Clear();

                    var ticketsToRemove = Items.Where(i => i.PricingMode == "BUFFET_TICKET").ToList();
                    foreach (var t in ticketsToRemove) Items.Remove(t);

                    RecalculateTotals();
                    HasUnsavedChanges = true;
                    OnPropertyChanged(nameof(HasActiveBuffet));
                    OnPropertyChanged(nameof(ActiveBuffetPackageName));
                }
            });

            _ = LoadVatSettingsAsync();
        }

        public void LoadTableOrder(PosTable table)
        {
            CurrentTable = table;
            Items.Clear();
            HasUnsavedChanges = false;
            DiscountAmount = 0;
            ShippingFee = 0;
            DiscountVoucherCode = null;
            ShippingVoucherCode = null;
            CustomerPhone = null;
            CustomerName = null;
            CustomerPoints = 0;
            CustomerTier = null;

            if (table.CurrentOrder != null)
            {
                CurrentOrder = new PosOrder
                {
                    Id = table.CurrentOrder.Id,
                    OrderCode = table.CurrentOrder.OrderCode,
                    TemporaryOrderCode = table.CurrentOrder.TemporaryOrderCode,
                    TableId = table.Id,
                    TableName = table.Name,
                    GuestCount = table.CurrentOrder.GuestCount > 0 ? table.CurrentOrder.GuestCount : (table.GuestCount > 0 ? table.GuestCount : 1),
                    SubTotal = table.CurrentOrder.SubTotal,
                    TotalAmount = table.CurrentOrder.TotalAmount,
                    Status = table.CurrentOrder.Status,
                    CreatedAt = table.CurrentOrder.CreatedAt
                };
            }
            else
            {
                CurrentOrder = new PosOrder
                {
                    Id = Guid.NewGuid().ToString(),
                    OrderCode = null,
                    TemporaryOrderCode = null,
                    TableId = table.Id,
                    TableName = table.Name,
                    Status = "PENDING",
                    GuestCount = table.GuestCount > 0 ? table.GuestCount : 1,
                    CreatedAt = DateTime.Now
                };
            }

            RecalculateTotals();
        }

        public void AddProduct(PosProduct product, int quantity = 1, List<PosProductOptionItem>? selectedOptions = null, string? note = null)
        {
            decimal unitPrice = product.EffectivePrice > 0 ? product.EffectivePrice : product.Price;
            string pricingMode = "REGULAR";

            if (HasActiveBuffet && BuffetItemProductIds.Contains(product.Id))
            {
                unitPrice = 0;
                pricingMode = "BUFFET_INCLUDED";
            }

            string optionsDesc = string.Empty;

            if (selectedOptions != null && selectedOptions.Count > 0)
            {
                unitPrice += selectedOptions.Sum(o => o.Price);
                optionsDesc = string.Join(", ", selectedOptions.Select(o => o.Name));
            }

            var existing = Items.FirstOrDefault(i =>
                i.ProductId == product.Id &&
                (i.OptionsText ?? string.Empty) == optionsDesc &&
                (i.Note ?? string.Empty) == (note ?? string.Empty) &&
                i.Status == "NEW" &&
                i.PricingMode == pricingMode);

            if (existing != null)
            {
                existing.Quantity += quantity;
                existing.LineTotal = existing.Quantity * existing.Price;
            }
            else
            {
                var newItem = new PosOrderItem
                {
                    Id = Guid.NewGuid().ToString(),
                    ProductId = product.Id,
                    ProductName = product.Name,
                    Quantity = quantity,
                    Price = unitPrice,
                    LineTotal = unitPrice * quantity,
                    OptionsText = optionsDesc,
                    Note = note,
                    Status = "NEW",
                    PricingMode = pricingMode
                };
                if (selectedOptions != null && selectedOptions.Count > 0)
                {
                    newItem.SelectedOptionIds = selectedOptions.Select(o => o.Id).ToList();
                }
                Items.Add(newItem);
            }

            RecalculateTotals();
            HasUnsavedChanges = true;
        }

        private void PromptRemoveItem(PosOrderItem item)
        {
            var dlg = new CancelItemDialog(item.ProductName, $"Số lượng hủy: {item.Quantity}");
            if (dlg.ShowDialog() == true)
            {
                Items.Remove(item);
                RecalculateTotals();
                HasUnsavedChanges = true;
            }
        }

        public void RecalculateTotals()
        {
            decimal net = Math.Max(0, SubTotal - DiscountAmount);
            if (VatPriceMode == "VAT_EXCLUDED")
            {
                TaxAmount = Math.Round(net * (_vatRate / 100m), 0);
            }
            else
            {
                TaxAmount = Math.Round((net * _vatRate) / (100m + _vatRate), 0);
            }
            OnPropertyChanged(nameof(SubTotal));
            OnPropertyChanged(nameof(TotalAmount));
        }

        private async Task LoadVatSettingsAsync()
        {
            try
            {
                var mode = await _apiService.GetVatPriceModeAsync();
                if (!string.IsNullOrEmpty(mode))
                {
                    VatPriceMode = mode;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[VAT] Could not load mode: {ex.Message}");
            }
        }

        private async Task SaveOrderDraftAsync()
        {
            if (Items.Count == 0)
            {
                AvoraMessageDialog.Warning("Chưa có món nào để lưu!", "Thông báo");
                return;
            }

            var session = SecureSessionManager.LoadSession();
            string branchId = !string.IsNullOrWhiteSpace(CurrentTable?.BranchId)
                ? CurrentTable.BranchId
                : (!string.IsNullOrWhiteSpace(BranchIdCallback?.Invoke())
                    ? BranchIdCallback.Invoke()
                    : (session?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51"));
            string cashierName = session?.FullName ?? "Thu ngân";

            // If online, save/update directly via server POS API
            if (BackgroundSyncWorker.Instance.IsOnline)
            {
                try
                {
                    int effectiveGuests = (CurrentOrder != null && CurrentOrder.GuestCount > 0) ? CurrentOrder.GuestCount : (CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 1);
                    string? effTableId = (OrderType == "TAKEAWAY" || OrderType == "DELIVERY") ? null : CurrentTable?.Id;
                    bool isExistingOnlineOrder = CurrentOrder != null && CurrentOrder.IsPersistedOnServer;

                    if (isExistingOnlineOrder)
                    {
                        var updateDto = new
                        {
                            guestCount = effectiveGuests,
                            customerName = string.IsNullOrEmpty(CustomerName) ? "Khách lẻ" : CustomerName,
                            customerPhone = string.IsNullOrWhiteSpace(CustomerPhone) ? null : CustomerPhone,
                            userId = CurrentOrder!.UserId,
                            orderType = OrderType == "TAKEAWAY" ? "TAKEAWAY" : (OrderType == "DELIVERY" ? "DELIVERY" : "DINE_IN"),
                            note = string.IsNullOrWhiteSpace(OrderNote) ? null : OrderNote,
                            discountAmount = DiscountAmount,
                            items = Items.Select(i => new
                            {
                                id = (i.Id.Length == 36 && !i.Id.StartsWith("OFF-")) ? i.Id : null,
                                productId = i.ProductId,
                                quantity = i.Quantity,
                                note = string.IsNullOrWhiteSpace(i.Note) ? null : i.Note,
                                selectedOptionIds = i.SelectedOptionIds ?? new List<string>(),
                                pricingMode = i.PricingMode ?? "REGULAR"
                            }).ToList()
                        };

                        var (success, updatedOrder, err) = await _apiService.UpdateOrderAsync(CurrentOrder.Id, updateDto);
                        if (success)
                        {
                            if (updatedOrder != null) CurrentOrder = updatedOrder;
                            HasUnsavedChanges = false;
                            string displayCode = CurrentOrder?.OrderCode ?? CurrentOrder?.TemporaryOrderCode ?? CurrentOrder?.DisplayCode ?? "";
                            AvoraMessageDialog.Success($"Đã cập nhật đơn hàng #{displayCode} thành công!", "Thành công");
                            return;
                        }
                        else
                        {
                            bool isNetFail = err != null && (err.Contains("HttpRequestException") || err.Contains("timed out") || err.Contains("Connection refused"));
                            if (!isNetFail)
                            {
                                AvoraMessageDialog.Error($"Máy chủ từ chối cập nhật đơn: {err}", "Lỗi Cập Nhật Đơn");
                                return;
                            }
                        }
                    }
                    else
                    {
                        var createDto = new
                        {
                            branchId = branchId,
                            tableId = effTableId,
                            guestCount = effectiveGuests,
                            customerName = string.IsNullOrEmpty(CustomerName) ? "Khách lẻ" : CustomerName,
                            customerPhone = string.IsNullOrWhiteSpace(CustomerPhone) ? null : CustomerPhone,
                            userId = CurrentOrder?.UserId,
                            orderType = OrderType == "TAKEAWAY" ? "TAKEAWAY" : (OrderType == "DELIVERY" ? "DELIVERY" : "DINE_IN"),
                            note = string.IsNullOrWhiteSpace(OrderNote) ? null : OrderNote,
                            discountAmount = DiscountAmount,
                            items = Items.Select(i => new
                            {
                                productId = i.ProductId,
                                quantity = i.Quantity,
                                note = string.IsNullOrWhiteSpace(i.Note) ? null : i.Note,
                                selectedOptionIds = i.SelectedOptionIds ?? new List<string>(),
                                pricingMode = i.PricingMode ?? "REGULAR"
                            }).ToList()
                        };

                        var (success, createdOrder, err) = await _apiService.CreateOrderAsync(createDto);
                        if (success && createdOrder != null)
                        {
                            CurrentOrder = createdOrder;
                            HasUnsavedChanges = false;
                            string displayCode = createdOrder.OrderCode ?? createdOrder.TemporaryOrderCode ?? createdOrder.DisplayCode;
                            AvoraMessageDialog.Success($"Đã lưu đơn thành công! Mã đơn: #{displayCode}", "Thành công");
                            return;
                        }
                        else
                        {
                            bool isNetFail = err != null && (err.Contains("HttpRequestException") || err.Contains("timed out") || err.Contains("Connection refused"));
                            if (!isNetFail)
                            {
                                AvoraMessageDialog.Error($"Máy chủ từ chối tạo đơn: {err}", "Lỗi Tạo Đơn");
                                return;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ONLINE SAVE ORDER] Server call failed: {ex.Message}");
                }
            }

            // If we are online, do NOT drop to offline store
            if (BackgroundSyncWorker.Instance.IsOnline)
            {
                AvoraMessageDialog.Error("Không thể lưu đơn lên hệ thống máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thông tin đơn hàng!", "Lỗi lưu đơn");
                return;
            }

            // Fallback to offline store only when truly offline
            var (saved, offlineOrder, error) = await OfflineOrderEngine.Instance.RegisterSendToKitchenOfflineAsync(
                table: CurrentTable,
                allItems: Items.ToList(),
                newItems: Items.Where(i => i.Status == "NEW").ToList(),
                branchId: branchId,
                cashierName: cashierName,
                existingClientOrderId: CurrentOrder?.Id,
                existingLocalCode: CurrentOrder?.OrderCode
            );

            if (saved && offlineOrder != null)
            {
                if (CurrentOrder != null)
                {
                    CurrentOrder.Id = offlineOrder.ClientOrderId;
                    CurrentOrder.OrderCode = offlineOrder.LocalOrderCode;
                }
                HasUnsavedChanges = false;
                AvoraMessageDialog.Info($"Mất kết nối server. Đơn được lưu ngoại tuyến: {offlineOrder.LocalOrderCode}\nSẽ tự động đồng bộ khi có mạng lại.", "Lưu Ngoại Tuyến");
            }
            else
            {
                AvoraMessageDialog.Error($"Lỗi lưu đơn: {error}", "Lỗi");
            }
        }

        private async Task CancelCurrentOrderAsync()
        {
            if (CurrentOrder == null || string.IsNullOrEmpty(CurrentOrder.Id))
            {
                Items.Clear();
                RecalculateTotals();
                return;
            }

            if (AvoraMessageDialog.Confirm($"Bạn có chắc chắn muốn hủy đơn hàng #{CurrentOrder.OrderCode}?", "Xác nhận hủy đơn", "Hủy đơn", "Bỏ qua"))
            {
                var (success, err) = await _apiService.CancelOrderAsync(CurrentOrder.Id, "Hủy đơn từ POS Native");
                if (success)
                {
                    AvoraMessageDialog.Success("Đã hủy đơn hàng thành công!", "Thông báo");
                    BackToTableRequested?.Invoke();
                }
                else
                {
                    AvoraMessageDialog.Error($"Không thể hủy đơn: {err}", "Lỗi");
                }
            }
        }

        private async Task SendToKitchenAsync()
        {
            if (Items.Count == 0)
            {
                AvoraMessageDialog.Warning("Chưa có món nào trong đơn!", "Thông báo");
                return;
            }

            var newItems = Items.Where(i => i.Status == "NEW").ToList();
            if (newItems.Count == 0)
            {
                AvoraMessageDialog.Info("Tất cả các món đã được gửi bếp trước đó!", "Thông báo");
                return;
            }

            IsBusy = true;
            try
            {
                var session = SecureSessionManager.LoadSession();
                string branchId = !string.IsNullOrWhiteSpace(CurrentTable?.BranchId)
                    ? CurrentTable.BranchId
                    : (!string.IsNullOrWhiteSpace(BranchIdCallback?.Invoke())
                        ? BranchIdCallback.Invoke()
                        : (session?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51"));
                string cashierName = session?.FullName ?? "Thu ngân";
                bool isOnline = BackgroundSyncWorker.Instance.IsOnline;

                bool onlineSuccess = false;
                if (isOnline)
                {
                    try
                    {
                        bool isExisting = CurrentOrder != null && CurrentOrder.IsPersistedOnServer;
                        if (!isExisting)
                        {
                            string deviceId = DeviceIdentifier.GetMachineId();
                            string clientOrderId = Guid.NewGuid().ToString();
                            string idempotencyKey = $"{branchId}:{deviceId}:{clientOrderId}:create";

                            var createDto = new
                            {
                                branchId = branchId,
                                tableId = CurrentTable?.Id,
                                orderType = "DINE_IN",
                                guestCount = CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 2,
                                idempotencyKey = idempotencyKey,
                                items = Items.Select(i => new
                                {
                                    productId = i.ProductId,
                                    quantity = i.Quantity,
                                    note = i.Note,
                                    selectedOptionIds = i.SelectedOptionIds
                                }).ToList()
                            };

                            var (success, createdOrder, err) = await _apiService.CreateOrderAsync(createDto);
                            if (success && createdOrder != null)
                            {
                                CurrentOrder = createdOrder;
                                onlineSuccess = true;
                            }
                        }
                        else if (CurrentOrder != null)
                        {
                            var sendKitchenDto = new
                            {
                                orderId = CurrentOrder.Id,
                                items = newItems.Select(i => new { productId = i.ProductId, quantity = i.Quantity, note = i.Note }).ToList()
                            };
                            var (success, _) = await _apiService.SendToKitchenAsync(CurrentOrder.Id, sendKitchenDto);
                            if (success) onlineSuccess = true;
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[ONLINE SEND KITCHEN] Server unreachable: {ex.Message}");
                        onlineSuccess = false;
                    }
                }

                if (isOnline && !onlineSuccess)
                {
                    AvoraMessageDialog.Error("Không thể gửi món đến bếp trên máy chủ. Vui lòng kiểm tra lại!", "Lỗi gửi bếp");
                    return;
                }

                if (onlineSuccess)
                {
                    // Print kitchen ticket
                    var printItems = newItems.Select(i => new PrintJobItem
                    {
                        ProductName = i.ProductName,
                        Quantity = i.Quantity,
                        Price = i.Price,
                        LineTotal = i.LineTotal,
                        OptionsText = i.OptionsText,
                        Note = i.Note
                    }).ToList();

                    await PrintService.PrintKitchenTicketAsync(
                        tableName: CurrentTable?.Name ?? "Mang về",
                        orderCode: CurrentOrder?.OrderCode ?? "ORD-ONLINE",
                        items: printItems,
                        cashier: cashierName
                    );

                    foreach (var it in newItems) it.Status = "SENT_KITCHEN";
                    HasUnsavedChanges = false;
                    AvoraMessageDialog.Success("Đã gửi đơn xuống bếp thành công!", "Bếp nhận món");
                }
                else
                {
                    // OFFLINE TRANSACTIONAL FLOW: Save to SQLite + Outbox + Print Job in ONE atomic transaction
                    var (saved, offlineOrder, error) = await OfflineOrderEngine.Instance.RegisterSendToKitchenOfflineAsync(
                        table: CurrentTable,
                        allItems: Items.ToList(),
                        newItems: newItems,
                        branchId: branchId,
                        cashierName: cashierName,
                        existingClientOrderId: CurrentOrder?.Id,
                        existingLocalCode: CurrentOrder?.OrderCode
                    );

                    if (!saved || offlineOrder == null)
                    {
                        AvoraMessageDialog.Error($"LỖI LƯU TRỮ CỤC BỘ: {error}\nKhông thể gửi bếp. Vui lòng thử lại!", "Lỗi nghiêm trọng");
                        return;
                    }

                    if (CurrentOrder != null)
                    {
                        CurrentOrder.Id = offlineOrder.ClientOrderId;
                        CurrentOrder.OrderCode = offlineOrder.LocalOrderCode;
                    }

                    foreach (var it in newItems) it.Status = "SENT_KITCHEN";
                    HasUnsavedChanges = false;

                    AvoraMessageDialog.Warning(
                        $"Mất kết nối máy chủ. Đơn hàng đã được lưu an toàn trên thiết bị (Mã: {offlineOrder.LocalOrderCode}) và đẩy lệnh in bếp.\nĐang chờ tự động đồng bộ khi có mạng.",
                        "Lưu Ngoại Tuyến");
                }
            }
            catch (Exception ex)
            {
                AvoraMessageDialog.Error($"Lỗi gửi bếp: {ex.Message}", "Lỗi");
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task PrintTempBillAsync()
        {
            if (Items.Count == 0)
            {
                AvoraMessageDialog.Warning("Đơn hàng chưa có món!", "Thông báo");
                return;
            }

            IsBusy = true;
            try
            {
                var payload = new PrintJobPayload
                {
                    Title = "PHIẾU TẠM TÍNH",
                    OrderCode = CurrentOrder?.OrderCode ?? "ORD-TEMP",
                    TableName = CurrentTable?.Name ?? "Bàn ăn",
                    CashierName = "Thu ngân",
                    CustomerName = CustomerName,
                    CreatedAt = DateTime.Now,
                    SubTotal = SubTotal,
                    DiscountAmount = DiscountAmount,
                    TaxAmount = TaxAmount,
                    ShippingFee = ShippingFee,
                    TotalAmount = TotalAmount,
                    FooterNote = "Phiếu tạm tính dùng để đối chiếu - Không có giá trị thay thế hóa đơn VAT",
                    CutPaper = true,
                    OpenCashDrawer = false,
                    Items = Items.Select(i => new PrintJobItem
                    {
                        ProductName = i.ProductName,
                        Quantity = i.Quantity,
                        Price = i.Price,
                        LineTotal = i.LineTotal,
                        OptionsText = i.OptionsText,
                        Note = i.Note
                    }).ToList()
                };

                await PrintService.PrintReceiptAsync(payload);
                AvoraMessageDialog.Success("Đã in phiếu tạm tính thành công!", "Thông báo");
            }
            catch (Exception ex)
            {
                AvoraMessageDialog.Error($"Lỗi in tạm tính: {ex.Message}", "Lỗi");
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async void OpenPaymentDialog()
        {
            if (Items.Count == 0)
            {
                AvoraMessageDialog.Warning("Đơn hàng chưa có món để thanh toán!", "Thông báo");
                return;
            }

            var orderToPay = CurrentOrder ?? new PosOrder
            {
                Id = Guid.NewGuid().ToString(),
                TableId = CurrentTable?.Id,
                TableName = CurrentTable?.Name,
                SubTotal = SubTotal,
                TotalAmount = TotalAmount
            };
            orderToPay.TotalAmount = TotalAmount;
            orderToPay.SubTotal = SubTotal;

            var dlg = new PaymentDialog(orderToPay);

            if (dlg.ShowDialog() == true && dlg.Result != null)
            {
                var res = dlg.Result;
                var session = SecureSessionManager.LoadSession();
                string branchId = !string.IsNullOrWhiteSpace(CurrentTable?.BranchId)
                    ? CurrentTable.BranchId
                    : (!string.IsNullOrWhiteSpace(BranchIdCallback?.Invoke())
                        ? BranchIdCallback.Invoke()
                        : (session?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51"));
                string cashierName = session?.FullName ?? "Thu ngân";
                bool isOnline = BackgroundSyncWorker.Instance.IsOnline;

                if (res.PaymentMethod != "CASH" && !isOnline)
                {
                    AvoraMessageDialog.Warning(
                        "Không có kết nối Internet! Các phương thức chuyển khoản/quẹt thẻ yêu cầu kết nối mạng.\nVui lòng chọn TIỀN MẶT để thanh toán ngoại tuyến.",
                        "Cảnh báo kết nối");
                    return;
                }

                IsBusy = true;
                try
                {
                    bool onlineSuccess = false;

                    // ONLINE FLOW: Create order on server if not yet created, then process payment
                    if (isOnline)
                    {
                        try
                        {
                            // 1. If order does not exist on server, create it first
                            bool isLocalOrder = CurrentOrder == null || !CurrentOrder.IsPersistedOnServer;

                            if (isLocalOrder)
                            {
                                var createDto = new
                                {
                                    branchId = branchId,
                                    tableId = CurrentTable?.Id,
                                    orderType = OrderType,
                                    guestCount = (CurrentOrder != null && CurrentOrder.GuestCount > 0) ? CurrentOrder.GuestCount : (CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 1),
                                    customerName = CustomerName ?? "Khách vãng lai",
                                    customerPhone = CustomerPhone,
                                    discountAmount = DiscountAmount,
                                    items = Items.Select(i => new
                                    {
                                        productId = i.ProductId,
                                        quantity = i.Quantity,
                                        note = i.Note,
                                        selectedOptionIds = i.SelectedOptionIds
                                    }).ToList()
                                };

                                var (createOk, createdOrder, _) = await _apiService.CreateOrderAsync(createDto);
                                if (createOk && createdOrder != null)
                                {
                                    CurrentOrder = createdOrder;
                                }
                            }

                            // 2. Process payment on server
                            if (CurrentOrder != null && !string.IsNullOrEmpty(CurrentOrder.Id) && !CurrentOrder.Id.StartsWith("OFF-"))
                            {
                                var payDto = new
                                {
                                    payments = new[]
                                    {
                                        new
                                        {
                                            paymentMethod = res.PaymentMethod,
                                            amount = res.TotalAmount,
                                            cashReceived = res.ReceivedAmount,
                                            cashChange = res.ChangeAmount
                                        }
                                    },
                                    discountVoucherCode = DiscountVoucherCode,
                                    shippingVoucherCode = ShippingVoucherCode
                                };

                                var (paySuccess, _) = await _apiService.ProcessPaymentAsync(CurrentOrder.Id, payDto);
                                if (paySuccess) onlineSuccess = true;
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[ONLINE PAYMENT] Error: {ex.Message}");
                            onlineSuccess = false;
                        }
                    }

                    if (onlineSuccess)
                    {
                        // Print online receipt
                        var payload = new PrintJobPayload
                        {
                            Title = "HÓA ĐƠN THANH TOÁN",
                            OrderCode = CurrentOrder?.OrderCode ?? "ORD-PAID",
                            TableName = CurrentTable?.Name ?? "Bàn ăn",
                            CashierName = cashierName,
                            CustomerName = CustomerName,
                            CreatedAt = DateTime.Now,
                            SubTotal = SubTotal,
                            DiscountAmount = res.TotalAmount < SubTotal ? SubTotal - res.TotalAmount : 0,
                            TaxAmount = TaxAmount,
                            ShippingFee = ShippingFee,
                            TotalAmount = res.TotalAmount,
                            PaymentMethod = res.PaymentMethod,
                            ReceivedAmount = res.ReceivedAmount,
                            ChangeAmount = res.ChangeAmount,
                            CutPaper = true,
                            OpenCashDrawer = true,
                            Items = Items.Select(i => new PrintJobItem
                            {
                                ProductName = i.ProductName,
                                Quantity = i.Quantity,
                                Price = i.Price,
                                LineTotal = i.LineTotal,
                                OptionsText = i.OptionsText,
                                Note = i.Note
                            }).ToList()
                        };

                        await PrintService.PrintReceiptAsync(payload);
                        AvoraMessageDialog.Success($"Thanh toán thành công đơn hàng #{CurrentOrder?.OrderCode}!", "Thanh toán thành công");
                        OrderCompleted?.Invoke();
                    }
                    else
                    {
                        // ATOMIC OFFLINE CASH PAYMENT:
                        // Save Order + Outbox + Print Job inside SQLite transaction
                        var (saved, offlineOrder, error) = await OfflineOrderEngine.Instance.RegisterCashPaymentOfflineAsync(
                            table: CurrentTable,
                            items: Items.ToList(),
                            branchId: branchId,
                            cashierName: cashierName,
                            subTotal: SubTotal,
                            discountAmount: res.TotalAmount < SubTotal ? SubTotal - res.TotalAmount : 0,
                            taxAmount: TaxAmount,
                            shippingFee: ShippingFee,
                            totalAmount: res.TotalAmount,
                            receivedAmount: res.ReceivedAmount,
                            changeAmount: res.ChangeAmount,
                            customerName: CustomerName,
                            customerPhone: CustomerPhone,
                            discountVoucherCode: DiscountVoucherCode,
                            existingClientOrderId: CurrentOrder?.Id,
                            existingLocalCode: CurrentOrder?.OrderCode
                        );

                        if (!saved || offlineOrder == null)
                        {
                            // STOP THE TRANSACTION! Do not confirm success! Do not wipe order!
                            AvoraMessageDialog.Error(
                                $"LỖI LƯU TRỮ CỤC BỘ: {error}\n\nGiao dịch thanh toán chưa được lưu. Hệ thống KHÔNG in hóa đơn và KHÔNG ghi nhận hoàn tất để tránh thất thoát dữ liệu!",
                                "Lỗi Nghiêm Trọng");
                            return;
                        }

                        AvoraMessageDialog.Warning(
                            $"Mất kết nối máy chủ. Giao dịch tiền mặt đã được lưu an toàn trên thiết bị (Mã: {offlineOrder.LocalOrderCode}).\nĐang chờ đồng bộ lên hệ thống khi máy chủ hoạt động trở lại.",
                            "Lưu Ngoại Tuyến");

                        OrderCompleted?.Invoke();
                    }
                }
                catch (Exception ex)
                {
                    AvoraMessageDialog.Error($"Lỗi thanh toán: {ex.Message}", "Lỗi");
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }

        private void LookupCustomerAsync()
        {
            var dlg = new Dialogs.CustomerSelectDialog();
            if (dlg.ShowDialog() == true)
            {
                if (dlg.IsCleared)
                {
                    CustomerPhone = null;
                    CustomerName = "Khách lẻ";
                    CustomerPoints = 0;
                    CustomerTier = "BRONZE";
                    if (CurrentOrder != null)
                    {
                        CurrentOrder.UserId = null;
                        CurrentOrder.CustomerName = "Khách lẻ";
                        CurrentOrder.CustomerPhone = null;
                    }
                    HasUnsavedChanges = true;
                    AvoraMessageDialog.Info("Đã chuyển về khách lẻ cho đơn hàng này.", "Thông báo");
                    return;
                }

                if (dlg.SelectedCustomer != null)
                {
                    var member = dlg.SelectedCustomer;
                    CustomerPhone = member.Phone;
                    CustomerName = member.FullName;
                    CustomerPoints = member.LoyaltyPoints;
                    CustomerTier = member.MemberTier;
                    if (CurrentOrder != null)
                    {
                        CurrentOrder.UserId = member.Id;
                        CurrentOrder.CustomerName = member.FullName;
                        CurrentOrder.CustomerPhone = member.Phone;
                    }
                    HasUnsavedChanges = true;
                    AvoraMessageDialog.Success($"Đã gắn khách hàng: {member.FullName} ({member.Phone})\nĐiểm tích lũy: {member.LoyaltyPoints:N0} điểm", "Khách hàng");
                }
            }
        }

        private void OpenGuestCount()
        {
            int currentGuests = CurrentOrder?.GuestCount > 0 ? CurrentOrder.GuestCount : (CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 2);
            var dlg = new GuestCountDialog(currentGuests);
            dlg.Owner = Application.Current.MainWindow;
            if (dlg.ShowDialog() == true)
            {
                if (CurrentOrder != null) CurrentOrder.GuestCount = dlg.GuestCount;
                if (CurrentTable != null) CurrentTable.Capacity = dlg.GuestCount;
                OnPropertyChanged(nameof(GuestCountText));
                HasUnsavedChanges = true;
            }
        }

        private async Task OpenMoveTableAsync()
        {
            IsMoreMenuOpen = false;
            if (CurrentTable == null)
            {
                AvoraMessageDialog.Warning("Chưa chọn bàn để chuyển!", "Thông báo");
                return;
            }

            var allTables = GetTablesCallback?.Invoke() ?? new List<PosTable>();
            var dlg = new MoveTableDialog(CurrentTable, allTables);
            dlg.Owner = Application.Current.MainWindow;
            if (dlg.ShowDialog() == true && dlg.DestinationTable != null)
            {
                var dest = dlg.DestinationTable;
                IsBusy = true;
                try
                {
                    var (success, error) = await _apiService.MoveTableAsync(CurrentTable.Id, dest.Id, CurrentOrder?.Id);
                    if (success)
                    {
                        AvoraMessageDialog.Success($"Đã chuyển đơn từ bàn {CurrentTable.Name} sang bàn {dest.Name} thành công!", "Chuyển bàn");
                        TableOperationCompleted?.Invoke();
                        BackToTableRequested?.Invoke();
                    }
                    else
                    {
                        AvoraMessageDialog.Error($"Không thể chuyển bàn: {error}", "Lỗi");
                    }
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }

        private async Task OpenMergeTableAsync()
        {
            IsMoreMenuOpen = false;
            if (CurrentTable == null || CurrentOrder == null || string.IsNullOrEmpty(CurrentOrder.Id))
            {
                AvoraMessageDialog.Warning("Đơn hàng chưa được lưu trên hệ thống để thực hiện gộp bàn!", "Thông báo");
                return;
            }

            var allTables = GetTablesCallback?.Invoke() ?? new List<PosTable>();
            var dlg = new MergeTableDialog(CurrentTable, allTables);
            dlg.Owner = Application.Current.MainWindow;
            if (dlg.ShowDialog() == true && dlg.TargetTable != null)
            {
                var target = dlg.TargetTable;
                string? targetOrderId = target.CurrentOrder?.Id;
                if (string.IsNullOrEmpty(targetOrderId))
                {
                    AvoraMessageDialog.Warning($"Bàn {target.Name} không có đơn hàng hợp lệ để gộp!", "Thông báo");
                    return;
                }

                if (!AvoraMessageDialog.Confirm($"Bạn có chắc chắn muốn gộp đơn từ bàn {CurrentTable.Name} vào bàn {target.Name}?", "Xác nhận gộp bàn"))
                {
                    return;
                }

                IsBusy = true;
                try
                {
                    var (success, error) = await _apiService.MergeOrdersAsync(CurrentOrder.Id, targetOrderId);
                    if (success)
                    {
                        AvoraMessageDialog.Success($"Đã gộp đơn từ bàn {CurrentTable.Name} vào bàn {target.Name} thành công!", "Gộp bàn");
                        TableOperationCompleted?.Invoke();
                        BackToTableRequested?.Invoke();
                    }
                    else
                    {
                        AvoraMessageDialog.Error($"Không thể gộp bàn: {error}", "Lỗi");
                    }
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }

        private async Task OpenSplitTableAsync()
        {
            IsMoreMenuOpen = false;
            if (CurrentOrder == null || string.IsNullOrEmpty(CurrentOrder.Id))
            {
                AvoraMessageDialog.Warning("Đơn hàng chưa được lưu trên hệ thống để thực hiện tách bàn!", "Thông báo");
                return;
            }

            var allTables = GetTablesCallback?.Invoke() ?? new List<PosTable>();
            var dlg = new SplitTableDialog(CurrentOrder, allTables);
            dlg.Owner = Application.Current.MainWindow;
            if (dlg.ShowDialog() == true && dlg.SelectedItemsToMove.Count > 0)
            {
                var destTable = dlg.SelectedDestinationTable;
                var itemsToMove = dlg.SelectedItemsToMove.Select(s => (object)new
                {
                    orderItemId = s.Item.Id,
                    quantity = s.SplitQuantity
                }).ToList();

                IsBusy = true;
                try
                {
                    var (success, error) = await _apiService.SplitOrderAsync(CurrentOrder.Id, itemsToMove, destTable?.Id);
                    if (success)
                    {
                        AvoraMessageDialog.Success($"Đã tách món sang {(destTable != null ? "bàn " + destTable.Name : "hóa đơn mới")} thành công!", "Tách bàn");
                        TableOperationCompleted?.Invoke();
                        BackToTableRequested?.Invoke();
                    }
                    else
                    {
                        AvoraMessageDialog.Error($"Không thể tách bàn: {error}", "Lỗi");
                    }
                }
                finally
                {
                    IsBusy = false;
                }
            }
        }

        private void OpenTableQr()
        {
            IsMoreMenuOpen = false;
            if (CurrentTable == null)
            {
                AvoraMessageDialog.Warning("Chưa chọn bàn ăn!", "Thông báo");
                return;
            }

            string branchId = BranchIdCallback?.Invoke() ?? SecureSessionManager.LoadSession()?.BranchId ?? "DEFAULT";
            var dlg = new TableQrDialog(CurrentTable, branchId, _apiService, CurrentOrder?.Id);
            dlg.Owner = Application.Current.MainWindow;
            dlg.ShowDialog();
        }
    }
}
