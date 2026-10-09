using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using AvoraPosNative.Dialogs;
using AvoraPosNative.Models;
using AvoraPosNative.Services;

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

        public ObservableCollection<PosOrderItem> Items { get; } = new();

        public event Action? OrderCompleted;
        public event Action? BackToTableRequested;

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
                decimal total = SubTotal - DiscountAmount + TaxAmount + ShippingFee;
                return total > 0 ? total : 0;
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
            SearchCustomerCommand = new RelayCommand(async _ => await LookupCustomerAsync());
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
            decimal unitPrice = product.Price;
            string optionsDesc = string.Empty;

            if (selectedOptions != null && selectedOptions.Count > 0)
            {
                unitPrice += selectedOptions.Sum(o => o.Price);
                optionsDesc = string.Join(", ", selectedOptions.Select(o => o.Name));
            }

            // Kiểm tra xem món trùng tên, options, note có tồn tại chưa
            var existing = Items.FirstOrDefault(i =>
                i.ProductId == product.Id &&
                (i.OptionsText ?? string.Empty) == optionsDesc &&
                (i.Note ?? string.Empty) == (note ?? string.Empty) &&
                i.Status == "NEW");

            if (existing != null)
            {
                existing.Quantity += quantity;
                existing.LineTotal = existing.Quantity * existing.Price;
            }
            else
            {
                Items.Add(new PosOrderItem
                {
                    Id = Guid.NewGuid().ToString(),
                    ProductId = product.Id,
                    ProductName = product.Name,
                    Quantity = quantity,
                    Price = unitPrice,
                    LineTotal = unitPrice * quantity,
                    OptionsText = optionsDesc,
                    Note = note,
                    Status = "NEW"
                });
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
            // VAT 8% hoặc 10% theo quy định
            TaxAmount = Math.Round(SubTotal * 0.08m, 0);
            OnPropertyChanged(nameof(SubTotal));
            OnPropertyChanged(nameof(TotalAmount));
        }

        private async Task SendToKitchenAsync()
        {
            if (Items.Count == 0)
            {
                MessageBox.Show("Chưa có món nào trong đơn!", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            var newItems = Items.Where(i => i.Status == "NEW").ToList();
            if (newItems.Count == 0)
            {
                MessageBox.Show("Tất cả các món đã được gửi bếp trước đó!", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            IsBusy = true;
            try
            {
                var session = Security.SecureSessionManager.LoadSession();
                string branchId = session?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51";

                if (CurrentOrder == null || string.IsNullOrEmpty(CurrentOrder.Id))
                {
                    // Gọi API tạo đơn hàng thật trên Backend
                    var createDto = new
                    {
                        branchId = branchId,
                        tableId = CurrentTable?.Id,
                        orderType = "DINE_IN",
                        guestCount = CurrentTable?.Capacity > 0 ? CurrentTable.Capacity : 2,
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
                    }
                    else
                    {
                        System.Diagnostics.Debug.WriteLine($"[API] Create order notice: {err}");
                    }
                }
                else
                {
                    // Đơn hàng đã có: gửi các món mới xuống bếp
                    var sendKitchenDto = new
                    {
                        orderId = CurrentOrder.Id,
                        items = newItems.Select(i => new { productId = i.ProductId, quantity = i.Quantity, note = i.Note }).ToList()
                    };
                    await _apiService.SendToKitchenAsync(CurrentOrder.Id, sendKitchenDto);
                }

                // In phiếu bếp ngay lập tức qua RAW ESC/POS hoặc Raster
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
                    orderCode: CurrentOrder?.OrderCode ?? "ORD-NEW",
                    items: printItems,
                    cashier: "Thu ngân"
                );

                // Cập nhật trạng thái item thành SENT_KITCHEN
                foreach (var it in newItems)
                {
                    it.Status = "SENT_KITCHEN";
                }

                HasUnsavedChanges = false;
                MessageBox.Show("Đã gửi bếp thành công!", "Thành công", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi gửi bếp: {ex.Message}", "Lỗi", MessageBoxButton.OK, MessageBoxImage.Error);
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
                MessageBox.Show("Đơn hàng chưa có món!", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
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
                MessageBox.Show("Đã in phiếu tạm tính!", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Lỗi in tạm tính: {ex.Message}", "Lỗi", MessageBoxButton.OK, MessageBoxImage.Error);
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
                MessageBox.Show("Đơn hàng chưa có món để thanh toán!", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Warning);
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
                IsBusy = true;
                try
                {
                    // Gọi API thanh toán thật nếu đơn hàng có trên hệ thống backend
                    if (CurrentOrder != null && !string.IsNullOrEmpty(CurrentOrder.Id))
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

                        var (paySuccess, payErr) = await _apiService.ProcessPaymentAsync(CurrentOrder.Id, payDto);
                        if (!paySuccess)
                        {
                            System.Diagnostics.Debug.WriteLine($"[PAYMENT API] Warning: {payErr}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[PAYMENT API] Exception: {ex.Message}");
                }
                finally
                {
                    IsBusy = false;
                }

                // In hóa đơn chính thức và mở két tiền
                _ = Task.Run(async () =>
                {
                    var payload = new PrintJobPayload
                    {
                        Title = "HÓA ĐƠN THANH TOÁN",
                        OrderCode = CurrentOrder?.OrderCode ?? "ORD-PAID",
                        TableName = CurrentTable?.Name ?? "Bàn ăn",
                        CashierName = "Thu ngân",
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
                });

                MessageBox.Show("Thanh toán thành công!", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Information);
                OrderCompleted?.Invoke();
            }
        }

        private async Task LookupCustomerAsync()
        {
            var keypad = new NumericKeypadDialog("Nhập số điện thoại khách hàng:", 0);
            if (keypad.ShowDialog() == true && !string.IsNullOrWhiteSpace(keypad.DisplayText))
            {
                string phone = keypad.DisplayText.Trim();
                try
                {
                    var member = await _apiService.SearchMembershipAsync(phone);
                    if (member != null)
                    {
                        CustomerPhone = member.Phone;
                        CustomerName = member.FullName;
                        CustomerPoints = member.LoyaltyPoints;
                        CustomerTier = member.MemberTier;
                        MessageBox.Show($"Tìm thấy khách hàng:\n{member.FullName} ({member.MemberTier})\nĐiểm tích lũy: {member.LoyaltyPoints:N0}", "Thành viên", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                    else
                    {
                        CustomerPhone = phone;
                        CustomerName = "Khách mới";
                        MessageBox.Show("Chưa tìm thấy thông tin thành viên với SĐT này.", "Thông báo", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Lỗi tra cứu: {ex.Message}", "Lỗi", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }
    }
}
