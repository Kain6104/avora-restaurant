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
    public class ProductMenuViewModel : ViewModelBase
    {
        private readonly PosApiService _apiService;
        private List<PosProduct> _allProducts = new();
        private string _searchKeyword = string.Empty;
        private string _selectedCategory = "ALL";
        private bool _isLoading = false;

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

        public ICommand SelectCategoryCommand { get; }
        public ICommand SelectProductCommand { get; }
        public ICommand ClearSearchCommand { get; }
        public ICommand RefreshCommand { get; }

        public ProductMenuViewModel(PosApiService apiService)
        {
            _apiService = apiService;

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

        private string? _branchId;

        public async Task LoadMenuAsync(string? branchId = null)
        {
            if (!string.IsNullOrEmpty(branchId)) _branchId = branchId;
            IsLoading = true;
            try
            {
                // Nạp danh mục
                var categories = await _apiService.GetCategoriesAsync(_branchId);

                // Nạp sản phẩm
                _allProducts = await _apiService.GetProductsAsync(_branchId);
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
