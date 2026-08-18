'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Filter, SortDesc, Search as SearchIcon } from 'lucide-react';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  
  // Price filter state
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';

  useEffect(() => {
    // Reset page to 1 when search query or filters change
    setPage(1);
    fetchSearchResults(1);
  }, [query, categoryParam, sortParam, minPriceParam, maxPriceParam]);

  const fetchSearchResults = async (currentPage: number) => {
    if (currentPage === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `http://localhost:3001/api/products/search?q=${encodeURIComponent(query)}&page=${currentPage}&limit=20`;
      if (categoryParam) url += `&category=${categoryParam}`;
      if (sortParam) url += `&sort=${sortParam}`;
      if (minPriceParam) url += `&minPrice=${minPriceParam}`;
      if (maxPriceParam) url += `&maxPrice=${maxPriceParam}`;

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
      {/* Breadcrumb & Title */}
      <div className="sticky top-[52px] md:top-[68px] z-[45] bg-white border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4">
          <div className="flex items-center text-sm text-slate-500 mb-2">
            <Link href="/" className="hover:text-red-600 transition-colors">Trang chủ</Link>
            <ChevronRight className="w-4 h-4 mx-1" />
            <span className="text-slate-800 font-medium">Tìm kiếm</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Kết quả tìm kiếm cho "{query}"
          </h1>
          <p className="text-sm text-slate-500 mt-1">Tìm thấy {total} kết quả phù hợp</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-6">
        {/* Mobile Filters Scrollable */}
        <div className="md:hidden flex overflow-x-auto pb-4 mb-2 -mx-4 px-4 gap-2 no-scrollbar">
          <button className="flex items-center gap-1 shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-700">
            <Filter className="w-4 h-4" /> Lọc
          </button>
          <select 
            className="shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 focus:outline-none"
            value={categoryParam}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">Loại sản phẩm</option>
            {categories.map(c => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <select 
            className="shrink-0 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-sm font-medium text-slate-700 focus:outline-none"
            value={sortParam}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
          >
            <option value="">Sắp xếp</option>
            <option value="sold_desc">Bán chạy</option>
            <option value="price_asc">Giá thấp</option>
            <option value="price_desc">Giá cao</option>
          </select>
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 overflow-hidden sticky top-16 md:top-[76px] z-30">
              <div className="flex border-b border-slate-100">
                <button 
                  onClick={() => handleFilterChange('tab', 'products')}
                  className={`flex-1 py-4 text-center font-bold text-sm transition-colors relative ${tabParam === 'products' ? 'text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Sản phẩm
                  {tabParam === 'products' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-full"></span>}
                </button>
                <button 
                  onClick={() => handleFilterChange('tab', 'articles')}
                  className={`flex-1 py-4 text-center font-bold text-sm transition-colors relative ${tabParam === 'articles' ? 'text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  Bài viết
                  {tabParam === 'articles' && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600 rounded-t-full"></span>}
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
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${sortParam === 'sold_desc' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                    >
                      Bán chạy
                    </button>
                    <button 
                      onClick={() => handleSortChange('price_asc')}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${sortParam === 'price_asc' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
                    >
                      Giá thấp
                    </button>
                    <button 
                      onClick={() => handleSortChange('price_desc')}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${sortParam === 'price_desc' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : tabParam === 'products' ? (
              products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col h-full">
                      <Link href={`/${product.category?.slug}/${product.slug}`} className="block relative aspect-square">
                        <img 
                          src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {product.oldPrice && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-md">
                            -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1">
                           <span className="bg-white/90 text-[10px] font-bold text-slate-700 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 border border-slate-200">
                             🇻🇳 Việt Nam
                           </span>
                        </div>
                      </Link>
                      <div className="p-3 flex flex-col flex-1">
                        <Link href={`/${product.category?.slug}/${product.slug}`}>
                          <h3 className="font-bold text-slate-800 text-sm line-clamp-2 hover:text-blue-600 transition-colors mb-2">
                            {product.name}
                          </h3>
                        </Link>
                        
                        <div className="mt-auto">
                          <div className="flex items-end gap-2 mb-3">
                            <span className="text-blue-600 font-bold text-lg">
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                            </span>
                            {product.oldPrice && (
                              <span className="text-xs text-slate-400 line-through mb-1">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.oldPrice)}
                              </span>
                            )}
                          </div>
                          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm transition-colors">
                            Chọn mua
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button 
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 hover:shadow-md px-8 py-2.5 rounded-full font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
