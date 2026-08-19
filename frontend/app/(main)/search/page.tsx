'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Filter, SortDesc, Search as SearchIcon, Star, Heart, Minus, ListFilter, ArrowDownUp, X, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import AddToCartButton from '@/components/AddToCartButton';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentBranchId, cartItems, updateQuantity, removeFromCart } = useCart();
  const query = searchParams.get('s') || '';
  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sort') || '';
  const tabParam = searchParams.get('tab') || 'products';

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Price filter state
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';

  useEffect(() => {
    // Reset page to 1 when search query, filters, or branch change
    setPage(1);
    fetchSearchResults(1);
  }, [query, categoryParam, sortParam, minPriceParam, maxPriceParam, currentBranchId]);

  const fetchSearchResults = async (currentPage: number) => {
    if (currentPage === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `http://localhost:3001/api/products/search?q=${encodeURIComponent(query)}&page=${currentPage}&limit=20`;
      if (categoryParam) url += `&category=${categoryParam}`;
      if (sortParam) url += `&sort=${sortParam}`;
      if (minPriceParam) url += `&minPrice=${minPriceParam}`;
      if (maxPriceParam) url += `&maxPrice=${maxPriceParam}`;
      if (currentBranchId) url += `&branchId=${currentBranchId}`;

      const res = await fetch(url);
      const data = await res.json();

      if (currentPage === 1) {
        setProducts(data.products || []);
      } else {
        setProducts(prev => [...prev, ...(data.products || [])]);
      }

      setCategories(data.categories || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Error fetching search results:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSearchResults(nextPage);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/search?${params.toString()}`);
  };

  const handleSortChange = (sortType: string) => {
    handleFilterChange('sort', sortType);
  };

  const handlePriceFilter = (min: string, max: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (min) params.set('minPrice', min);
    else params.delete('minPrice');

    if (max) params.set('maxPrice', max);
    else params.delete('maxPrice');

    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
          <div className="flex items-center text-sm text-slate-500">
            <Link href="/" className="hover:text-red-600 transition-colors">Trang chủ</Link>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-slate-800 font-medium">Tìm kiếm</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-6">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Kết quả tìm kiếm cho "{query}"
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tìm thấy {total} kết quả phù hợp</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar (Desktop) */}
          <div className="hidden md:block w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-24">
              <div className="flex items-center gap-2 font-bold text-slate-800 mb-4 pb-4 border-b border-slate-100">
                <Filter className="w-5 h-5" />
                Bộ lọc nâng cao
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-slate-800 mb-3">Loại sản phẩm</h3>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      checked={categoryParam === ''}
                      onChange={() => handleFilterChange('category', '')}
                    />
                    <span className={`text-sm group-hover:text-red-600 transition-colors ${categoryParam === '' ? 'font-bold text-red-600' : 'text-slate-600'}`}>Tất cả</span>
                  </label>
                  {categories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        checked={categoryParam === cat.slug}
                        onChange={() => handleFilterChange('category', cat.slug)}
                      />
                      <span className={`text-sm group-hover:text-red-600 transition-colors ${categoryParam === cat.slug ? 'font-bold text-red-600' : 'text-slate-600'}`}>
                        {cat.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-3">Mức giá</h3>
                <div className="space-y-2.5">
                  {[
                    { label: 'Tất cả', min: '', max: '' },
                    { label: 'Dưới 100.000đ', min: '', max: '100000' },
                    { label: '100.000đ - 300.000đ', min: '100000', max: '300000' },
                    { label: 'Trên 300.000đ', min: '300000', max: '' },
                  ].map((range, idx) => {
                    const isSelected = minPriceParam === range.min && maxPriceParam === range.max;
                    return (
                      <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="price_filter"
                          className="w-4 h-4 text-red-600 focus:ring-red-500"
                          checked={isSelected}
                          onChange={() => handlePriceFilter(range.min, range.max)}
                        />
                        <span className={`text-sm group-hover:text-red-600 transition-colors ${isSelected ? 'font-bold text-red-600' : 'text-slate-600'}`}>
                          {range.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => handleFilterChange('tab', 'products')}
                  className={`flex-1 py-4 text-center font-bold text-sm transition-colors relative ${tabParam === 'products' ? 'text-red-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Sản phẩm
                  {tabParam === 'products' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600 rounded-t-full"></span>}
                </button>
                <button
                  onClick={() => handleFilterChange('tab', 'articles')}
                  className={`flex-1 py-4 text-center font-bold text-sm transition-colors relative ${tabParam === 'articles' ? 'text-red-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Bài viết
                  {tabParam === 'articles' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600 rounded-t-full"></span>}
                </button>
              </div>

              {/* Sort Bar (Desktop) */}
              {tabParam === 'products' && (
                <div className="hidden md:flex items-center justify-between p-4 bg-slate-50 border-t border-slate-100">
                  <div className="text-sm font-medium text-slate-700">
                    Danh sách sản phẩm
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 mr-2">Sắp xếp theo:</span>
                    <button
                      onClick={() => handleSortChange('sold_desc')}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${sortParam === 'sold_desc' ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                    >
                      Bán chạy
                    </button>
                    <button
                      onClick={() => handleSortChange('price_asc')}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${sortParam === 'price_asc' ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                    >
                      Giá thấp
                    </button>
                    <button
                      onClick={() => handleSortChange('price_desc')}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${sortParam === 'price_desc' ? 'border-red-600 text-red-600 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                    >
                      Giá cao
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Results Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              </div>
            ) : tabParam === 'products' ? (
              products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {products.map(product => {
                      const productCartItems = cartItems.filter(i => i.productId === product.id);
                      const cartQuantity = productCartItems.reduce((acc, curr) => acc + curr.quantity, 0);
                      const cartItemToDecrease = productCartItems[productCartItems.length - 1];
                      return (
                      <div key={product.id} className="bg-white rounded-2xl border border-slate-100/80 overflow-hidden hover:shadow-xl hover:border-red-100 hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full">
                        <div className="block relative aspect-[4/3] bg-slate-50">
                          <Link href={`/${product.category?.slug}/${product.slug}`} className="absolute inset-0 z-0">
                            <img
                              src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </Link>
                          
                          <button className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Heart className="w-4 h-4" />
                          </button>
                          
                          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                            {product.oldPrice && (
                              <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                              </span>
                            )}
                          </div>
                          
                          <Link href={`/${product.category?.slug}/${product.slug}`} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-0">
                            <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">Xem nhanh</span>
                          </Link>
                        </div>
                        
                        <div className="p-3 md:p-4 flex flex-col flex-1">
                          <Link href={`/${product.category?.slug}/${product.slug}`}>
                            <h3 className="font-bold text-slate-900 text-[12px] md:text-[14px] leading-tight mb-1.5 line-clamp-2 group-hover:text-red-600 transition-colors">
                              {product.name}
                            </h3>
                          </Link>
                          
                          <div className="flex items-center gap-1 mb-2 text-[10px] text-slate-500">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-slate-700 font-semibold">{product.avgRating || 4.9}</span>
                            <span className="text-slate-300">•</span>
                            <span>Đã bán {product.soldQuantity || (product.name.length * 7) % 100 + 20}</span>
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-2">
                            <div>
                              <p className="text-red-600 font-black text-sm md:text-base leading-none">
                                {product.price.toLocaleString('vi-VN')}đ
                              </p>
                              {product.oldPrice && (
                                <p className="text-slate-400 text-[10px] line-through mt-0.5">
                                  {product.oldPrice.toLocaleString('vi-VN')}đ
                                </p>
                              )}
                            </div>
                            <AddToCartButton item={product} className="w-8 h-8 md:w-9 md:h-9 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-sm shrink-0 hover:shadow-md hover:shadow-red-600/30" />
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>

                  {hasMore && (
                    <div className="mt-8 flex justify-center">
                      <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="bg-white border border-red-600 text-red-600 hover:bg-red-50 hover:shadow-md px-8 py-2.5 rounded-full font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loadingMore ? (
                          <>
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            Đang tải...
                          </>
                        ) : (
                          `Xem thêm ${total - products.length} kết quả`
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <SearchIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Không tìm thấy sản phẩm nào</h3>
                  <p className="text-slate-500">Rất tiếc, chúng tôi không tìm thấy kết quả phù hợp với từ khóa "{query}". Vui lòng thử lại với từ khóa khác hoặc bỏ các bộ lọc.</p>
                </div>
              )
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <h3 className="text-lg font-bold text-slate-800 mb-2">Tính năng đang phát triển</h3>
                <p className="text-slate-500">Mục bài viết sức khỏe/tin tức đang được hoàn thiện và sẽ sớm ra mắt.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Sticky Bottom Toolbar */}
      <div className="md:hidden fixed bottom-[100px] left-1/2 -translate-x-1/2 z-40 bg-slate-800 text-white flex items-center h-12 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.3)] divide-x divide-slate-700/50 whitespace-nowrap">
        <button onClick={() => setIsSortModalOpen(true)} className="flex items-center gap-2 px-6 py-2 font-medium text-sm hover:text-red-400 transition-colors">
          <ArrowDownUp className="w-4 h-4" /> Sắp xếp
        </button>
        <button onClick={() => setIsFilterModalOpen(true)} className="flex items-center gap-2 px-6 py-2 font-medium text-sm hover:text-red-400 transition-colors">
          <ListFilter className="w-4 h-4" /> Bộ lọc
        </button>
      </div>

      {/* Sort Modal */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsSortModalOpen(false)} />
          <div className="relative bg-white w-full rounded-t-3xl min-h-[300px] flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <button onClick={() => setIsSortModalOpen(false)} className="p-2 -ml-2 text-slate-400">
                <X className="w-6 h-6" />
              </button>
              <h3 className="font-bold text-lg">Sắp xếp theo</h3>
              <div className="w-10"></div>
            </div>
            <div className="p-4 flex flex-col">
              {[
                { value: '', label: 'Mặc định' },
                { value: 'sold_desc', label: 'Bán chạy nhất' },
                { value: 'price_asc', label: 'Giá tăng dần' },
                { value: 'price_desc', label: 'Giá giảm dần' }
              ].map(option => (
                <button 
                  key={option.value}
                  onClick={() => {
                    handleSortChange(option.value);
                    setIsSortModalOpen(false);
                  }}
                  className={`flex items-center justify-between py-4 border-b border-slate-50 last:border-0 ${sortParam === option.value ? 'text-red-600 font-bold' : 'text-slate-700'}`}
                >
                  {option.label}
                  {sortParam === option.value && <Check className="w-5 h-5 text-red-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterModalOpen(false)} />
          <div className="relative bg-white w-full rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <button onClick={() => setIsFilterModalOpen(false)} className="p-2 -ml-2 text-slate-400">
                <X className="w-6 h-6" />
              </button>
              <h3 className="font-bold text-lg">Bộ lọc</h3>
              <button onClick={() => {
                 router.push('/search?s=' + query);
                 setIsFilterModalOpen(false);
              }} className="text-red-600 font-bold text-sm">Thiết lập lại</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-6">
                <h4 className="font-bold mb-4">Khoảng giá (VNĐ)</h4>
                <div className="grid grid-cols-2 gap-3">
                   {[
                    { label: 'Tất cả', min: '', max: '' },
                    { label: 'Dưới 100K', min: '', max: '100000' },
                    { label: '100K - 300K', min: '100000', max: '300000' },
                    { label: 'Trên 300K', min: '300000', max: '' },
                   ].map((range, idx) => {
                     const isSelected = minPriceParam === range.min && maxPriceParam === range.max;
                     return (
                       <button
                         key={idx}
                         onClick={() => handlePriceFilter(range.min, range.max)}
                         className={`py-2 rounded-xl text-sm font-medium border ${isSelected ? 'border-red-600 text-red-600 bg-red-50' : 'border-slate-200 text-slate-700 bg-white'}`}
                       >
                         {range.label}
                       </button>
                     )
                   })}
                </div>
              </div>
              <div>
                <h4 className="font-bold mb-4">Danh mục</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                     onClick={() => handleFilterChange('category', '')}
                     className={`py-2 rounded-xl text-sm font-medium border ${categoryParam === '' ? 'border-red-600 text-red-600 bg-red-50' : 'border-slate-200 text-slate-700 bg-white'}`}
                  >
                    TẤT CẢ
                  </button>
                  {categories.map(c => (
                     <button 
                       key={c.slug}
                       onClick={() => handleFilterChange('category', c.slug)}
                       className={`py-2 rounded-xl text-sm font-medium border uppercase ${categoryParam === c.slug ? 'border-red-600 text-red-600 bg-red-50' : 'border-slate-200 text-slate-700 bg-white'}`}
                     >
                       {c.name}
                     </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
               <button onClick={() => setIsFilterModalOpen(false)} className="w-full bg-red-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-600/30">Áp dụng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
