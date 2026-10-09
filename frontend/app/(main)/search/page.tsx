'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductRatingBadge from '@/components/reviews/ProductRatingBadge';
import {
  ChevronRight,
  Filter,
  Search as SearchIcon,
  Star,
  Heart,
  ListFilter,
  ArrowDownUp,
  X,
  Check,
  MapPin,
  Newspaper,
  Calendar,
  Clock,
  Eye,
  MessageSquare,
  Bookmark,
  Sparkles,
  Flame,
  ArrowRight,
  UtensilsCrossed,
  Tag,
  BookOpen,
  Award,
  RotateCcw,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import AddToCartButton from '@/components/AddToCartButton';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

// Article type definitions & aesthetics
const ARTICLE_TYPES = [
  { value: '', label: 'Tất cả loại bài viết', icon: BookOpen, color: 'text-slate-600' },
  { value: 'PROMOTION', label: 'Ưu đãi & Khuyến mãi', icon: Flame, color: 'text-rose-600' },
  { value: 'NEWS', label: 'Tin tức & Sự kiện', icon: Newspaper, color: 'text-blue-600' },
  { value: 'EVENT', label: 'Sự kiện đặc biệt', icon: Sparkles, color: 'text-purple-600' },
  { value: 'BRAND_STORY', label: 'Câu chuyện thương hiệu', icon: Award, color: 'text-amber-600' },
  { value: 'GUIDE', label: 'Cẩm nang ẩm thực', icon: UtensilsCrossed, color: 'text-emerald-600' },
  { value: 'MENU_UPDATE', label: 'Thực đơn & Món mới', icon: Tag, color: 'text-orange-600' },
];

const ARTICLE_TYPE_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  PROMOTION: { label: 'Khuyến mãi', bg: 'bg-gradient-to-r from-rose-500 to-red-600', text: 'text-white', border: 'border-rose-300' },
  NEWS: { label: 'Tin tức', bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-300' },
  EVENT: { label: 'Sự kiện', bg: 'bg-purple-600', text: 'text-white', border: 'border-purple-300' },
  BRAND_STORY: { label: 'Câu chuyện', bg: 'bg-amber-700', text: 'text-white', border: 'border-amber-300' },
  GUIDE: { label: 'Cẩm nang', bg: 'bg-emerald-600', text: 'text-white', border: 'border-emerald-300' },
  MENU_UPDATE: { label: 'Món mới', bg: 'bg-orange-600', text: 'text-white', border: 'border-orange-300' },
};

const PROMOTION_STATUSES = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ONGOING', label: 'Đang diễn ra' },
  { value: 'UPCOMING', label: 'Sắp diễn ra' },
  { value: 'ENDED', label: 'Đã kết thúc' },
];

// Highlighting component for search matches
function HighlightText({ text, highlight }: { text?: string | null; highlight: string }) {
  if (!text) return null;
  if (!highlight.trim()) return <span>{text}</span>;

  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentBranchId, cartItems, flashSaleQuotas, setBranchModalProduct } = useCart();

  const query = searchParams.get('s') || '';
  const tabParam = searchParams.get('tab') || 'products';
  const categoryParam = searchParams.get('category') || '';
  const sortParam = searchParams.get('sort') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const articleTypeParam = searchParams.get('articleType') || '';
  const promotionStatusParam = searchParams.get('promotionStatus') || '';

  // Products state
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);

  // Articles state
  const [articles, setArticles] = useState<any[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articlePage, setArticlePage] = useState(1);
  const [hasMoreArticles, setHasMoreArticles] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [loadingMoreArticles, setLoadingMoreArticles] = useState(false);
  const [savedArticles, setSavedArticles] = useState<Record<string, boolean>>({});

  // Mobile Modals
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Fetch product search results
  const fetchProducts = async (currentPage: number) => {
    if (currentPage === 1) setLoadingProducts(true);
    else setLoadingMoreProducts(true);

    try {
      let url = `${API_URL}/api/products/search?q=${encodeURIComponent(query)}&page=${currentPage}&limit=20`;
      if (categoryParam) url += `&category=${categoryParam}`;
      if (sortParam && tabParam === 'products') url += `&sort=${sortParam}`;
      if (minPriceParam) url += `&minPrice=${minPriceParam}`;
      if (maxPriceParam) url += `&maxPrice=${maxPriceParam}`;

      const res = await fetch(url);
      const data = await res.json();

      if (currentPage === 1) {
        setProducts(data.products || []);
      } else {
        setProducts((prev) => [...prev, ...(data.products || [])]);
      }

      setCategories(data.categories || []);
      setProductTotal(data.total || 0);
      setHasMoreProducts(data.hasMore || false);
    } catch (err) {
      console.error('Error fetching product search results:', err);
    } finally {
      setLoadingProducts(false);
      setLoadingMoreProducts(false);
    }
  };

  // Fetch article search results
  const fetchArticles = async (currentPage: number) => {
    if (currentPage === 1) setLoadingArticles(true);
    else setLoadingMoreArticles(true);

    try {
      let url = `${API_URL}/api/articles?search=${encodeURIComponent(query)}&page=${currentPage}&limit=12`;
      if (articleTypeParam) url += `&type=${articleTypeParam}`;
      if (promotionStatusParam) url += `&promotionStatus=${promotionStatusParam}`;
      if (sortParam && tabParam === 'articles') url += `&sort=${sortParam}`;

      const res = await fetch(url);
      const json = await res.json();
      const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.data?.articles)
        ? json.data.articles
        : Array.isArray(json.articles)
        ? json.articles
        : [];
      const total = json.meta?.total || list.length;
      const totalPages = json.meta?.totalPages || 1;

      if (currentPage === 1) {
        setArticles(list);
      } else {
        setArticles((prev) => [...prev, ...list]);
      }

      setArticleTotal(total);
      setHasMoreArticles(currentPage < totalPages);
    } catch (err) {
      console.error('Error fetching article search results:', err);
    } finally {
      setLoadingArticles(false);
      setLoadingMoreArticles(false);
    }
  };

  // Trigger fetches when parameters change
  useEffect(() => {
    setProductPage(1);
    fetchProducts(1);
  }, [query, categoryParam, sortParam, minPriceParam, maxPriceParam]);

  useEffect(() => {
    setArticlePage(1);
    fetchArticles(1);
  }, [query, articleTypeParam, promotionStatusParam, sortParam]);

  // Handle Load More
  const handleLoadMoreProducts = () => {
    if (!loadingMoreProducts && hasMoreProducts) {
      const next = productPage + 1;
      setProductPage(next);
      fetchProducts(next);
    }
  };

  const handleLoadMoreArticles = () => {
    if (!loadingMoreArticles && hasMoreArticles) {
      const next = articlePage + 1;
      setArticlePage(next);
      fetchArticles(next);
    }
  };

  // URL State change helper
  const handleParamChange = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`/search?${params.toString()}`);
  };

  const handleTabChange = (newTab: 'products' | 'articles') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    params.delete('sort');
    router.push(`/search?${params.toString()}`);
  };

  const handleResetFilters = () => {
    const params = new URLSearchParams();
    if (query) params.set('s', query);
    params.set('tab', tabParam);
    router.push(`/search?${params.toString()}`);
  };

  // Bookmark toggle with optimistic UI
  const handleToggleBookmark = async (e: React.MouseEvent, articleId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const isCurrentlySaved = !!savedArticles[articleId];
    setSavedArticles((prev) => ({ ...prev, [articleId]: !isCurrentlySaved }));

    try {
      const res = await fetch(`${API_URL}/api/articles/${articleId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast('Vui lòng đăng nhập để lưu bài viết vào hồ sơ yêu thích!', {
            icon: '🔒',
            style: { borderRadius: '12px', background: '#333', color: '#fff' },
          });
        }
        setSavedArticles((prev) => ({ ...prev, [articleId]: isCurrentlySaved }));
        return;
      }

      toast.success(isCurrentlySaved ? 'Đã bỏ lưu bài viết' : 'Đã lưu bài viết vào mục yêu thích!');
    } catch (err) {
      setSavedArticles((prev) => ({ ...prev, [articleId]: isCurrentlySaved }));
    }
  };

  const displayProducts = useMemo(() => {
    return products.map((p) => {
      const dp = { ...p };
      if (dp.isFlashSaleItem || dp.flashSalePrice) {
        const quota = flashSaleQuotas[dp.id];
        if (quota !== undefined) {
          const cartQty =
            cartItems
              ?.filter((c: any) => c.productId === dp.id && c.isFlashSaleItem)
              .reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
          const remaining = quota - cartQty;
          if (remaining <= 0) {
            dp.flashSalePrice = null;
            dp.isFlashSaleItem = false;
            dp.flashSaleId = null;
            dp.maxQuantityPerUser = null;
          }
        }
      }
      return dp;
    });
  }, [products, flashSaleQuotas, cartItems]);

  const hasActiveProductFilters = !!categoryParam || !!minPriceParam || !!maxPriceParam;
  const hasActiveArticleFilters = !!articleTypeParam || !!promotionStatusParam;

  return (
    <div className="bg-slate-50 min-h-screen pb-28 md:pb-16 font-sans">
      {/* Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
          <div className="flex items-center text-xs md:text-sm text-slate-500">
            <Link href="/" className="hover:text-red-600 transition-colors font-medium">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-slate-400" />
            <span className="text-slate-900 font-semibold">Tìm kiếm</span>
            {query && (
              <>
                <ChevronRight className="w-3.5 h-3.5 mx-1.5 text-slate-400" />
                <span className="text-red-600 font-bold truncate max-w-[160px] md:max-w-sm">
                  "{query}"
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-4 md:mt-6">
        {/* Clean Standard Header */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {query ? (
              <>
                Kết quả tìm kiếm cho <span className="text-red-600">"{query}"</span>
              </>
            ) : (
              'Tất cả sản phẩm & bài viết'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tìm thấy{' '}
            <strong className="text-slate-900 font-bold">
              {tabParam === 'products' ? productTotal : articleTotal}
            </strong>{' '}
            kết quả phù hợp
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Sidebar (Desktop) */}
          <div className="hidden md:block w-64 lg:w-72 shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sticky top-20 space-y-6">
              {/* Header with Clear Filter */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <Filter className="w-4 h-4 text-red-600" />
                  <span>Bộ lọc nâng cao</span>
                </div>
                {(hasActiveProductFilters || hasActiveArticleFilters) && (
                  <button
                    onClick={handleResetFilters}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Đặt lại
                  </button>
                )}
              </div>

              {/* Dynamic Sidebar content based on Active Tab */}
              {tabParam === 'products' ? (
                <>
                  {/* Category Filter */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 text-slate-400">
                      Loại sản phẩm
                    </h3>
                    <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                      <button
                        onClick={() => handleParamChange({ category: null })}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          categoryParam === ''
                            ? 'bg-red-50 text-red-600 font-bold border border-red-200'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>Tất cả</span>
                        {categoryParam === '' && <Check className="w-3.5 h-3.5 text-red-600" />}
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleParamChange({ category: cat.slug })}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            categoryParam === cat.slug
                              ? 'bg-red-50 text-red-600 font-bold border border-red-200'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{cat.name}</span>
                          {categoryParam === cat.slug && <Check className="w-3.5 h-3.5 text-red-600" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Range Filter */}
                  <div className="pt-3 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 text-slate-400">
                      Mức giá
                    </h3>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Tất cả', min: '', max: '' },
                        { label: 'Dưới 100.000đ', min: '', max: '100000' },
                        { label: '100.000đ - 300.000đ', min: '100000', max: '300000' },
                        { label: '300.000đ - 600.000đ', min: '300000', max: '600000' },
                        { label: 'Trên 600.000đ', min: '600000', max: '' },
                      ].map((range, idx) => {
                        const isSelected = minPriceParam === range.min && maxPriceParam === range.max;
                        return (
                          <button
                            key={idx}
                            onClick={() =>
                              handleParamChange({
                                minPrice: range.min || null,
                                maxPrice: range.max || null,
                              })
                            }
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-red-50 text-red-600 font-bold border border-red-200'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>{range.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-red-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Article Type Filter */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 text-slate-400">
                      Chuyên mục bài viết
                    </h3>
                    <div className="space-y-1.5">
                      {ARTICLE_TYPES.map((type) => {
                        const IconComponent = type.icon;
                        const isSelected = articleTypeParam === type.value;
                        return (
                          <button
                            key={type.value}
                            onClick={() => handleParamChange({ articleType: type.value || null })}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                              isSelected
                                ? 'bg-red-50 text-red-600 font-bold border border-red-200 shadow-xs'
                                : 'text-slate-600 hover:bg-slate-100 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <IconComponent className={`w-4 h-4 ${isSelected ? 'text-red-600' : type.color}`} />
                              <span>{type.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-red-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Promotion Status Filter */}
                  <div className="pt-3 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 text-slate-400">
                      Trạng thái ưu đãi
                    </h3>
                    <div className="space-y-1.5">
                      {PROMOTION_STATUSES.map((status) => {
                        const isSelected = promotionStatusParam === status.value;
                        return (
                          <button
                            key={status.value}
                            onClick={() => handleParamChange({ promotionStatus: status.value || null })}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                              isSelected
                                ? 'bg-red-50 text-red-600 font-bold border border-red-200'
                                : 'text-slate-600 hover:bg-slate-100 font-medium'
                            }`}
                          >
                            <span>{status.label}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-red-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Main Search Results Area */}
          <div className="flex-1 min-w-0">
            {/* Super Compact Dual-Tabs Bar on Mobile, Refined on Desktop */}
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xs border border-slate-200 mb-4 overflow-hidden">
              <div className="flex border-b border-slate-100 p-1 bg-slate-100/70 rounded-t-xl md:rounded-t-2xl">
                {/* Product Tab */}
                <button
                  onClick={() => handleTabChange('products')}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 rounded-lg md:rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                    tabParam === 'products'
                      ? 'bg-white text-red-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="hidden sm:inline">Sản phẩm & Thực đơn</span>
                  <span className="sm:hidden">Sản phẩm</span>
                  <span
                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-extrabold ${
                      tabParam === 'products'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {productTotal}
                  </span>
                </button>

                {/* Article Tab */}
                <button
                  onClick={() => handleTabChange('articles')}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2 sm:px-4 rounded-lg md:rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 ${
                    tabParam === 'articles'
                      ? 'bg-white text-red-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="hidden sm:inline">Bài viết & Tin tức</span>
                  <span className="sm:hidden">Bài viết</span>
                  <span
                    className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-extrabold ${
                      tabParam === 'articles'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {articleTotal}
                  </span>
                </button>
              </div>

              {/* Sorting Bar (Desktop) */}
              <div className="hidden md:flex items-center justify-between px-5 py-3 bg-slate-50/50 border-t border-slate-100 text-xs">
                <div className="font-medium text-slate-600">
                  {tabParam === 'products' ? 'Danh sách món ăn' : 'Danh sách bài viết & tin tức'}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-medium mr-1">Sắp xếp theo:</span>
                  {tabParam === 'products' ? (
                    <>
                      <button
                        onClick={() => handleParamChange({ sort: null })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === ''
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Liên quan
                      </button>
                      <button
                        onClick={() => handleParamChange({ sort: 'sold_desc' })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === 'sold_desc'
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Bán chạy
                      </button>
                      <button
                        onClick={() => handleParamChange({ sort: 'price_asc' })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === 'price_asc'
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Giá thấp
                      </button>
                      <button
                        onClick={() => handleParamChange({ sort: 'price_desc' })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === 'price_desc'
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Giá cao
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleParamChange({ sort: null })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === '' || sortParam === 'newest'
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Mới nhất
                      </button>
                      <button
                        onClick={() => handleParamChange({ sort: 'views' })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === 'views'
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Xem nhiều nhất
                      </button>
                      <button
                        onClick={() => handleParamChange({ sort: 'oldest' })}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                          sortParam === 'oldest'
                            ? 'bg-white text-red-600 border border-red-200 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        Cũ nhất
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* TAB 1: PRODUCTS RESULTS */}
            {tabParam === 'products' && (
              <>
                {loadingProducts ? (
                  <div className="flex flex-col justify-center items-center py-20 bg-white rounded-2xl border border-slate-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
                    <p className="text-slate-500 text-xs font-medium">Đang tìm kiếm món ăn...</p>
                  </div>
                ) : displayProducts.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {displayProducts.map((product) => {
                        const isAvailableHere =
                          !currentBranchId ||
                          product.branches?.length === 0 ||
                          product.branches?.some((b: any) => b.id === currentBranchId);
                        const onlyAvailableBranch =
                          !isAvailableHere && product.branches?.length > 0 ? product.branches[0] : null;

                        return (
                          <div
                            key={product.id}
                            className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-xl hover:border-red-100 hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full"
                          >
                            <div className="block relative aspect-[4/3] bg-slate-50">
                              <Link
                                href={`/${product.category?.slug}/${product.slug}`}
                                className="absolute inset-0 z-0"
                              >
                                <img
                                  src={
                                    product.imageUrl ||
                                    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'
                                  }
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </Link>

                              <button
                                type="button"
                                className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/90 backdrop-blur-xs rounded-full flex items-center justify-center shadow-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Heart className="w-3.5 h-3.5" />
                              </button>

                              <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                                {product.flashSalePrice ? (
                                  <span className="bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded-full shadow-xs">
                                    -{Math.round((1 - product.flashSalePrice / product.price) * 100)}%
                                  </span>
                                ) : (
                                  product.oldPrice && (
                                    <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                                      -{Math.round((1 - product.price / product.oldPrice) * 100)}%
                                    </span>
                                  )
                                )}
                              </div>

                              {isAvailableHere ? (
                                <Link
                                  href={`/${product.category?.slug}/${product.slug}`}
                                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-0"
                                >
                                  <span className="bg-white/95 backdrop-blur-xs text-slate-800 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                    Xem nhanh
                                  </span>
                                </Link>
                              ) : (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 z-0">
                                  <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xs text-center">
                                    Không bán tại
                                    <br />
                                    chi nhánh hiện tại
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="p-3 md:p-4 flex flex-col flex-1">
                              <Link href={`/${product.category?.slug}/${product.slug}`}>
                                <h3 className="font-bold text-slate-900 text-xs md:text-sm leading-tight mb-1.5 line-clamp-2 group-hover:text-red-600 transition-colors">
                                  <HighlightText text={product.name} highlight={query} />
                                </h3>
                              </Link>

                              <div className="flex items-center gap-1.5 mb-2 text-[10px] text-slate-500 flex-wrap">
                                <ProductRatingBadge avgRating={product.avgRating} ratingCount={product.ratingCount} size="sm" />
                                <span className="text-slate-300">•</span>
                                <span>Đã bán {product.soldQuantity || 48}</span>
                              </div>

                              <div className="mt-auto flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-red-600 font-black text-sm md:text-base leading-none">
                                    {(product.flashSalePrice || product.price).toLocaleString('vi-VN')}đ
                                  </p>
                                  {(product.flashSalePrice ? true : !!product.oldPrice) && (
                                    <p className="text-slate-400 text-[10px] line-through mt-0.5">
                                      {product.price.toLocaleString('vi-VN')}đ
                                    </p>
                                  )}
                                </div>

                                {isAvailableHere ? (
                                  <AddToCartButton
                                    item={product}
                                    className="w-8 h-8 md:w-9 md:h-9 bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center transition-all duration-300 shadow-xs shrink-0 hover:shadow-md hover:shadow-red-600/30"
                                  />
                                ) : (
                                  onlyAvailableBranch && (
                                    <button
                                      onClick={() => {
                                        setBranchModalProduct(product);
                                      }}
                                      className="text-[10px] font-bold text-orange-600 bg-orange-100 hover:bg-orange-200 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                      <MapPin className="w-3 h-3 shrink-0" /> Xem chi nhánh
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {hasMoreProducts && (
                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={handleLoadMoreProducts}
                          disabled={loadingMoreProducts}
                          className="bg-white border border-red-600 text-red-600 hover:bg-red-50 hover:shadow-sm px-8 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {loadingMoreProducts ? (
                            <>
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                              <span>Đang tải thêm...</span>
                            </>
                          ) : (
                            <span>Xem thêm {productTotal - products.length} kết quả</span>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center max-w-lg mx-auto shadow-xs">
                    <SearchIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      Không tìm thấy sản phẩm nào
                    </h3>
                    <p className="text-slate-500 text-xs mb-5">
                      Rất tiếc, chúng tôi không tìm thấy kết quả phù hợp với từ khóa "{query}". Vui lòng thử lại với từ khóa khác hoặc bỏ các bộ lọc.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleTabChange('articles')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all"
                      >
                        Xem Bài viết ({articleTotal})
                      </button>
                      <button
                        onClick={handleResetFilters}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                      >
                        Bỏ bộ lọc
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: ARTICLES RESULTS */}
            {tabParam === 'articles' && (
              <>
                {loadingArticles ? (
                  <div className="flex flex-col justify-center items-center py-20 bg-white rounded-2xl border border-slate-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
                    <p className="text-slate-500 text-xs font-medium">Đang tìm kiếm bài viết...</p>
                  </div>
                ) : articles.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {articles.map((art) => {
                        const typeInfo = ARTICLE_TYPE_BADGES[art.articleType || art.type] || {
                          label: 'Tin tức',
                          bg: 'bg-slate-800',
                          text: 'text-white',
                          border: 'border-slate-300',
                        };
                        const coverImg =
                          art.coverImageUrl ||
                          art.thumbnailUrl ||
                          'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800';
                        const isSaved = !!savedArticles[art.id];
                        const dateFormatted = art.publishedAt
                          ? new Date(art.publishedAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : 'Mới cập nhật';

                        return (
                          <article
                            key={art.id}
                            className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-xl hover:border-red-200 hover:-translate-y-1 transition-all duration-300 flex flex-col group relative"
                          >
                            {/* Card Image Banner */}
                            <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                              <Link href={`/news/${art.slug}`} className="block w-full h-full">
                                <img
                                  src={coverImg}
                                  alt={art.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                              </Link>

                              {/* Top Badges */}
                              <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10 pointer-events-none">
                                <span
                                  className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs ${typeInfo.bg} ${typeInfo.text}`}
                                >
                                  {typeInfo.label}
                                </span>

                                {art.promotionStatus === 'ONGOING' && (
                                  <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                    Đang diễn ra
                                  </span>
                                )}

                                {art.promotionStatus === 'UPCOMING' && (
                                  <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                    <Clock className="w-2.5 h-2.5" />
                                    Sắp diễn ra
                                  </span>
                                )}

                                {art.visibility === 'MEMBERS_ONLY' && (
                                  <span className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                    <Sparkles className="w-2.5 h-2.5" /> VIP
                                  </span>
                                )}
                              </div>

                              {/* Bookmark Button */}
                              <button
                                onClick={(e) => handleToggleBookmark(e, art.id)}
                                title={isSaved ? 'Bỏ lưu' : 'Lưu bài viết'}
                                className={`absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-xs ${
                                  isSaved
                                    ? 'bg-red-600 text-white shadow-red-600/40'
                                    : 'bg-white/90 backdrop-blur-xs text-slate-700 hover:text-red-600 hover:bg-white'
                                }`}
                              >
                                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
                              </button>

                              {/* Published date pill over image bottom */}
                              <div className="absolute bottom-2.5 left-2.5 text-[10px] font-semibold text-white/90 flex items-center gap-1 z-10 pointer-events-none drop-shadow">
                                <Calendar className="w-3 h-3" />
                                <span>{dateFormatted}</span>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-3.5 sm:p-4 flex flex-col flex-1">
                              <Link href={`/news/${art.slug}`}>
                                <h3 className="font-extrabold text-slate-900 text-sm md:text-base leading-snug group-hover:text-red-600 transition-colors line-clamp-2 mb-1.5">
                                  <HighlightText text={art.title} highlight={query} />
                                </h3>
                              </Link>

                              <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed mb-3">
                                <HighlightText
                                  text={art.excerpt || 'Khám phá bài viết ẩm thực hấp dẫn tại AVORA Restaurant...'}
                                  highlight={query}
                                />
                              </p>

                              {/* Author & Footer Engagement Stats */}
                              <div className="mt-auto pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[9px] overflow-hidden">
                                    {art.author?.avatarUrl ? (
                                      <img
                                        src={art.author.avatarUrl}
                                        alt={art.author?.fullName || 'AVORA'}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      (art.author?.fullName || 'AVORA')[0]
                                    )}
                                  </div>
                                  <span className="font-semibold text-slate-700 truncate max-w-[80px] sm:max-w-[100px] text-[11px]">
                                    {art.author?.fullName || 'AVORA Team'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5 text-[11px]">
                                  <span className="flex items-center gap-0.5 hover:text-slate-800 transition-colors">
                                    <Eye className="w-3 h-3 text-slate-400" />
                                    <span>{(art.viewCount || 0).toLocaleString()}</span>
                                  </span>
                                  <span className="flex items-center gap-0.5 hover:text-red-600 transition-colors">
                                    <Heart className="w-3 h-3 text-slate-400" />
                                    <span>{art.reactionCount || art._count?.reactions || 0}</span>
                                  </span>
                                  <span className="flex items-center gap-0.5 hover:text-blue-600 transition-colors">
                                    <MessageSquare className="w-3 h-3 text-slate-400" />
                                    <span>{art.commentCount || art._count?.comments || 0}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Load more button */}
                    {hasMoreArticles && (
                      <div className="mt-8 flex justify-center">
                        <button
                          onClick={handleLoadMoreArticles}
                          disabled={loadingMoreArticles}
                          className="bg-white border border-red-600 text-red-600 hover:bg-red-50 px-8 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {loadingMoreArticles ? (
                            <>
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                              <span>Đang tải thêm...</span>
                            </>
                          ) : (
                            <span>Xem thêm {articleTotal - articles.length} bài viết</span>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 p-10 text-center max-w-lg mx-auto shadow-xs">
                    <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      Không tìm thấy bài viết nào phù hợp
                    </h3>
                    <p className="text-slate-500 text-xs mb-5 leading-relaxed">
                      Không có bài viết hoặc tin tức nào khớp với từ khóa "{query}". Hãy thử chọn chuyên mục khác hoặc duyệt qua tất cả tin tức của chúng tôi.
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link
                        href="/news"
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all"
                      >
                        Xem tất cả tin tức
                      </Link>
                      <button
                        onClick={handleResetFilters}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                      >
                        Bỏ bộ lọc
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Toolbar (Positioned at bottom-[74px] comfortably above BottomNav) */}
      <div className="md:hidden fixed bottom-[74px] left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white flex items-center h-11 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md divide-x divide-slate-700/60 whitespace-nowrap px-1 border border-white/10">
        <button
          onClick={() => setIsSortModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 font-bold text-xs hover:text-red-400 transition-colors"
        >
          <ArrowDownUp className="w-3.5 h-3.5 text-slate-300" /> Sắp xếp
        </button>
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 font-bold text-xs hover:text-red-400 transition-colors"
        >
          <ListFilter className="w-3.5 h-3.5 text-slate-300" /> Bộ lọc
          {(hasActiveProductFilters || hasActiveArticleFilters) && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          )}
        </button>
      </div>

      {/* Mobile Sort Modal */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsSortModalOpen(false)} />
          <div className="relative bg-white w-full rounded-t-3xl min-h-[260px] flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <button onClick={() => setIsSortModalOpen(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-base text-slate-900">Sắp xếp theo</h3>
              <div className="w-9"></div>
            </div>
            <div className="p-4 flex flex-col divide-y divide-slate-50">
              {tabParam === 'products'
                ? [
                    { value: '', label: 'Liên quan nhất' },
                    { value: 'sold_desc', label: 'Bán chạy nhất' },
                    { value: 'price_asc', label: 'Giá tăng dần' },
                    { value: 'price_desc', label: 'Giá giảm dần' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleParamChange({ sort: option.value || null });
                        setIsSortModalOpen(false);
                      }}
                      className={`flex items-center justify-between py-3.5 text-sm ${
                        sortParam === option.value ? 'text-red-600 font-black' : 'text-slate-700 font-medium'
                      }`}
                    >
                      <span>{option.label}</span>
                      {sortParam === option.value && <Check className="w-4 h-4 text-red-600" />}
                    </button>
                  ))
                : [
                    { value: '', label: 'Mới nhất' },
                    { value: 'views', label: 'Xem nhiều nhất' },
                    { value: 'oldest', label: 'Cũ nhất' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        handleParamChange({ sort: option.value || null });
                        setIsSortModalOpen(false);
                      }}
                      className={`flex items-center justify-between py-3.5 text-sm ${
                        (sortParam === '' && option.value === '') || sortParam === option.value
                          ? 'text-red-600 font-black'
                          : 'text-slate-700 font-medium'
                      }`}
                    >
                      <span>{option.label}</span>
                      {((sortParam === '' && option.value === '') || sortParam === option.value) && (
                        <Check className="w-4 h-4 text-red-600" />
                      )}
                    </button>
                  ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsFilterModalOpen(false)} />
          <div className="relative bg-white w-full rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <button onClick={() => setIsFilterModalOpen(false)} className="p-2 text-slate-400">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-base text-slate-900">
                Bộ lọc {tabParam === 'products' ? 'Sản phẩm' : 'Bài viết'}
              </h3>
              <button onClick={handleResetFilters} className="text-red-600 font-bold text-xs">
                Đặt lại
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-5">
              {tabParam === 'products' ? (
                <>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2.5">
                      Khoảng giá
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Tất cả', min: '', max: '' },
                        { label: 'Dưới 100K', min: '', max: '100000' },
                        { label: '100K - 300K', min: '100000', max: '300000' },
                        { label: '300K - 600K', min: '300000', max: '600000' },
                        { label: 'Trên 600K', min: '600000', max: '' },
                      ].map((range, idx) => {
                        const isSelected = minPriceParam === range.min && maxPriceParam === range.max;
                        return (
                          <button
                            key={idx}
                            onClick={() =>
                              handleParamChange({
                                minPrice: range.min || null,
                                maxPrice: range.max || null,
                              })
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              isSelected
                                ? 'border-red-600 text-red-600 bg-red-50'
                                : 'border-slate-200 text-slate-700 bg-white'
                            }`}
                          >
                            {range.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2.5">
                      Danh mục món ăn
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleParamChange({ category: null })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                          categoryParam === ''
                            ? 'border-red-600 text-red-600 bg-red-50'
                            : 'border-slate-200 text-slate-700 bg-white'
                        }`}
                      >
                        Tất cả
                      </button>
                      {categories.map((c) => (
                        <button
                          key={c.slug}
                          onClick={() => handleParamChange({ category: c.slug })}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border truncate transition-all ${
                            categoryParam === c.slug
                              ? 'border-red-600 text-red-600 bg-red-50'
                              : 'border-slate-200 text-slate-700 bg-white'
                          }`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2.5">
                      Chuyên mục bài viết
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {ARTICLE_TYPES.map((type) => {
                        const isSelected = articleTypeParam === type.value;
                        const IconComponent = type.icon;
                        return (
                          <button
                            key={type.value}
                            onClick={() => handleParamChange({ articleType: type.value || null })}
                            className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl text-xs font-bold border transition-all ${
                              isSelected
                                ? 'border-red-600 text-red-600 bg-red-50'
                                : 'border-slate-200 text-slate-700 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <IconComponent className={`w-4 h-4 ${isSelected ? 'text-red-600' : type.color}`} />
                              <span>{type.label}</span>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-red-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2.5">
                      Trạng thái ưu đãi
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {PROMOTION_STATUSES.map((status) => {
                        const isSelected = promotionStatusParam === status.value;
                        return (
                          <button
                            key={status.value}
                            onClick={() => handleParamChange({ promotionStatus: status.value || null })}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                              isSelected
                                ? 'border-red-600 text-red-600 bg-red-50'
                                : 'border-slate-200 text-slate-700 bg-white'
                            }`}
                          >
                            {status.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.04)]">
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl shadow-md text-sm transition-all"
              >
                Áp dụng kết quả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
