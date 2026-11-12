using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Input;
using AvoraPosNative.Models;
using AvoraPosNative.Services;
using AvoraPosNative.Storage;

namespace AvoraPosNative.ViewModels
{
    public class ProductMenuViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private List<PosProduct> _allProducts = new();
        private string _searchKeyword = string.Empty;
        private string _selectedCategory = "ALL";
        private bool _isLoading = false;
        private bool _isOfflineMenu = false;
        private string? _lastCacheTimeText;
        private string? _branchId;
        private int _guestCount = 2;

        public ICommand? OpenGuestCountCommand { get; set; }
        public int GuestCount
        {
            get => _guestCount;
            set => SetProperty(ref _guestCount, value);
        }

        public ObservableCollection<PosCategory> Categories { get; } = new();
        public ObservableCollection<PosProduct> FilteredProducts { get; } = new();

        public event Action<PosProduct>? ProductSelected;

        public string SearchKeyword
        {
            get => _searchKeyword;
            set
            {
                if (SetProperty(ref _searchKeyword, value))
                {
                    ApplyFilter();
                }
            }
        }

        public string SelectedCategory
        {
            get => _selectedCategory;
            set
            {
                if (SetProperty(ref _selectedCategory, value))
                {
                    ApplyFilter();
                }
            }
        }

        public bool IsLoading
        {
            get => _isLoading;
            set => SetProperty(ref _isLoading, value);
        }

        public bool IsOfflineMenu
        {
            get => _isOfflineMenu;
            set => SetProperty(ref _isOfflineMenu, value);
        }

        public string? LastCacheTimeText
        {
            get => _lastCacheTimeText;
            set => SetProperty(ref _lastCacheTimeText, value);
        }

        private bool _isCompactMode = false;

        public bool IsCompactMode
        {
            get => _isCompactMode;
            set
            {
                if (SetProperty(ref _isCompactMode, value))
                {
                    OnPropertyChanged(nameof(ViewModeText));
                    OnPropertyChanged(nameof(ViewModeIcon));
                }
            }
        }

        public string ViewModeText => IsCompactMode ? "Xem ảnh" : "Rút gọn";
        public string ViewModeIcon => IsCompactMode ? "🖼" : "☷";

        public ICommand SelectCategoryCommand { get; }
        public ICommand SelectProductCommand { get; }
        public ICommand ClearSearchCommand { get; }
        public ICommand RefreshCommand { get; }
        public ICommand ToggleCompactModeCommand { get; }

        public ProductMenuViewModel(PosApiService apiService)
        {
            _apiService = apiService;

            ToggleCompactModeCommand = new RelayCommand(_ => IsCompactMode = !IsCompactMode);

            SelectCategoryCommand = new RelayCommand(param =>
            {
                if (param is string cat)
                {
                    SelectedCategory = cat;
                }
            });

            SelectProductCommand = new RelayCommand(param =>
            {
                if (param is PosProduct product)
                {
                    ProductSelected?.Invoke(product);
                }
            });

            ClearSearchCommand = new RelayCommand(_ =>
            {
                SearchKeyword = string.Empty;
            });

            RefreshCommand = new RelayCommand(async _ => await LoadMenuAsync());
        }

        public async Task LoadMenuAsync(string? branchId = null)
        {
            if (!string.IsNullOrEmpty(branchId)) _branchId = branchId;
            if (string.IsNullOrEmpty(_branchId))
            {
                _branchId = Security.SecureSessionManager.LoadSession()?.BranchId ?? "4d69e8f9-4abf-4499-b2b4-6769228bbb51";
            }

            IsLoading = true;
            try
            {
                List<PosCategory> categories = new();
                List<PosProduct> products = new();
                bool loadedFromApi = false;

                try
                {
                    var menuData = await _apiService.GetMenuDataAsync(_branchId);
                    categories = menuData.Categories;
                    products = menuData.Products;
                    if (products.Count > 0)
                    {
                        loadedFromApi = true;
                        string branchSnap = _branchId;
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await MenuCacheRepository.SaveMenuSnapshotAsync(branchSnap, products, categories);
                            }
                            catch { }
                        });
                        IsOfflineMenu = false;
                        LastCacheTimeText = $"Cập nhật: {DateTime.Now:HH:mm dd/MM}";
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MENU] API load error: {ex.Message}");
                    loadedFromApi = false;
                }

                // If API failed or returned 0 items, read from SQLite cache
                if (!loadedFromApi || products.Count == 0)
                {
                    products = await MenuCacheRepository.GetCachedProductsAsync(_branchId);
                    categories = await MenuCacheRepository.GetCachedCategoriesAsync(_branchId);

                    var snapshotMeta = await MenuCacheRepository.GetLastSnapshotInfoAsync(_branchId);
                    IsOfflineMenu = true;
                    if (snapshotMeta != null)
                    {
                        LastCacheTimeText = $"Offline Cache: {snapshotMeta.SyncedAt.ToLocalTime():HH:mm dd/MM}";
                    }
                    else
                    {
                        LastCacheTimeText = "Offline Mode - Chưa có bản lưu Menu";
                    }
                    System.Diagnostics.Debug.WriteLine($"[MENU] Loaded from SQLite cache: {products.Count} products, {categories.Count} categories");
                }

                _allProducts = products;

                void updateMenuUi()
                {
                    Categories.Clear();
                    Categories.Add(new PosCategory { Id = "ALL", Name = "Tất cả" });
                    foreach (var c in categories)
                    {
                        Categories.Add(c);
                    }
                    ApplyFilter();
                }

                if (App.Current?.Dispatcher != null && !App.Current.Dispatcher.CheckAccess())
                {
                    App.Current.Dispatcher.Invoke(updateMenuUi);
                }
                else
                {
                    updateMenuUi();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MENU] Lỗi tải thực đơn: {ex.Message}");
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void ApplyFilter()
        {
            void doFilter()
            {
                var query = _allProducts.AsEnumerable();

                if (!string.IsNullOrWhiteSpace(SelectedCategory) && SelectedCategory != "ALL")
                {
                    query = query.Where(p => p.CategoryId == SelectedCategory || p.CategoryName == SelectedCategory);
                }

                if (!string.IsNullOrWhiteSpace(SearchKeyword))
                {
                    string norm = RemoveDiacritics(SearchKeyword.Trim().ToLowerInvariant());
                    query = query.Where(p =>
                        RemoveDiacritics((p.Name ?? string.Empty).ToLowerInvariant()).Contains(norm) ||
                        RemoveDiacritics((p.Code ?? string.Empty).ToLowerInvariant()).Contains(norm));
                }

                FilteredProducts.Clear();
                foreach (var p in query)
                {
                    FilteredProducts.Add(p);
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

        public void UpdateProductAvailabilityRealtime(string productId, bool available)
        {
            if (string.IsNullOrEmpty(productId)) return;
            var prod = _allProducts.FirstOrDefault(p => p.Id == productId);
            if (prod != null)
            {
                prod.Available = available;
                ApplyFilter();
            }
        }

        private static string RemoveDiacritics(string text)
        {
            if (string.IsNullOrWhiteSpace(text)) return string.Empty;
            var normalizedString = text.Normalize(System.Text.NormalizationForm.FormD);
            var stringBuilder = new System.Text.StringBuilder();

            foreach (var c in normalizedString)
            {
                var unicodeCategory = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != System.Globalization.UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(System.Text.NormalizationForm.FormC)
                .Replace("đ", "d").Replace("Đ", "D");
        }
    }
}
