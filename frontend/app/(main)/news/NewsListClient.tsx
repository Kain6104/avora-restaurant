'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Tag,
  Clock,
  Eye,
  MessageSquare,
  ThumbsUp,
  Bookmark,
  Calendar,
  Sparkles,
  Flame,
  ChevronRight,
  Filter,
  ShieldCheck,
  Lock,
  LayoutGrid,
  List,
  TrendingUp,
  Utensils,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  type?: 'NEWS' | 'PROMOTION' | 'EVENT' | 'BRAND_STORY' | 'GUIDE' | 'MENU_UPDATE';
  articleType?: 'NEWS' | 'PROMOTION' | 'EVENT' | 'BRAND_STORY' | 'GUIDE' | 'MENU_UPDATE';
  visibility: 'PUBLIC' | 'AUTHENTICATED' | 'MEMBERS_ONLY' | 'PRIVATE';
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
  promotionStartAt?: string | null;
  promotionEndAt?: string | null;
  promotionLabel?: string | null;
  promotionStatus?: 'UPCOMING' | 'ONGOING' | 'ENDED' | null;
  viewCount: number;
  reactionCount: number;
  commentCount: number;
  isFeatured?: boolean;
  author?: {
    id?: string;
    fullName?: string;
    avatar?: string;
    avatarUrl?: string;
  } | null;
  branches?: {
    id?: string;
    name?: string;
    branch?: {
      id: string;
      name: string;
    };
  }[];
  isFavorited?: boolean;
  isFavorite?: boolean;
}

const TYPE_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PROMOTION', label: 'Ưu đãi & Khuyến mãi', shortLabel: 'Ưu đãi' },
  { key: 'NEWS', label: 'Tin tức AVORA', shortLabel: 'Tin tức' },
  { key: 'MENU_UPDATE', label: 'Món mới & Thực đơn', shortLabel: 'Món mới' },
  { key: 'EVENT', label: 'Sự kiện', shortLabel: 'Sự kiện' },
  { key: 'BRAND_STORY', label: 'Câu chuyện thương hiệu', shortLabel: 'Câu chuyện' },
  { key: 'GUIDE', label: 'Cẩm nang ẩm thực', shortLabel: 'Cẩm nang' },
];

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; dotColor: string }> = {
  PROMOTION: { label: 'Khuyến mãi', bg: 'bg-rose-50 border-rose-200/80', text: 'text-rose-700', dotColor: 'bg-rose-500' },
  NEWS: { label: 'Tin tức', bg: 'bg-blue-50 border-blue-200/80', text: 'text-blue-700', dotColor: 'bg-blue-500' },
  EVENT: { label: 'Sự kiện', bg: 'bg-purple-50 border-purple-200/80', text: 'text-purple-700', dotColor: 'bg-purple-500' },
  BRAND_STORY: { label: 'Câu chuyện', bg: 'bg-amber-50 border-amber-200/80', text: 'text-amber-800', dotColor: 'bg-amber-500' },
  GUIDE: { label: 'Cẩm nang', bg: 'bg-emerald-50 border-emerald-200/80', text: 'text-emerald-700', dotColor: 'bg-emerald-500' },
  MENU_UPDATE: { label: 'Món mới', bg: 'bg-orange-50 border-orange-200/80', text: 'text-orange-700', dotColor: 'bg-orange-500' },
};

interface NewsListClientProps {
  initialArticles: ArticleListItem[];
}

export default function NewsListClient({ initialArticles = [] }: NewsListClientProps) {
  const [articles, setArticles] = useState<ArticleListItem[]>(initialArticles);
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'compact' | 'grid'>('compact'); // mobile view mode switcher
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedArticlesMap, setSavedArticlesMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialArticles && initialArticles.length > 0) {
      setArticles(initialArticles);
      const map: Record<string, boolean> = {};
      initialArticles.forEach((a) => {
        if (a.isFavorited || a.isFavorite) map[a.id] = true;
      });
      setSavedArticlesMap(map);
    } else {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/articles?limit=50`, { credentials: 'include' })
        .then((r) => r.json())
        .then((json) => {
          const list = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.data?.articles)
            ? json.data.articles
            : Array.isArray(json.articles)
            ? json.articles
            : Array.isArray(json)
            ? json
            : [];
          setArticles(list);
          const map: Record<string, boolean> = {};
          list.forEach((a: any) => {
            if (a.isFavorited || a.isFavorite) map[a.id] = true;
          });
          setSavedArticlesMap(map);
        })
        .catch((err) => console.error('Failed to fetch client articles:', err))
        .finally(() => setIsLoading(false));
    }
  }, [initialArticles]);

  const handleToggleFavorite = async (e: React.MouseEvent, articleId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const previousState = !!savedArticlesMap[articleId];
    const nextState = !previousState;

    setSavedArticlesMap((prev) => ({ ...prev, [articleId]: nextState }));

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${articleId}/favorite`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Vui lòng đăng nhập để lưu bài viết');
        }
        setSavedArticlesMap((prev) => ({ ...prev, [articleId]: previousState }));
        return;
      }

      const data = await res.json();
      const isSaved = data?.data?.isFavorited ?? data?.isFavorited ?? nextState;
      setSavedArticlesMap((prev) => ({ ...prev, [articleId]: isSaved }));
      toast.success(isSaved ? 'Đã lưu bài viết vào mục yêu thích!' : 'Đã bỏ lưu bài viết');
    } catch {
      setSavedArticlesMap((prev) => ({ ...prev, [articleId]: previousState }));
      toast.error('Lỗi khi lưu bài viết');
    }
  };

  // Counts by type for badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: articles.length };
    articles.forEach((a) => {
      const t = a.articleType || a.type || 'NEWS';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const artType = article.articleType || article.type || 'NEWS';
      if (selectedType !== 'ALL' && artType !== selectedType) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = article.title?.toLowerCase().includes(query);
        const matchesExcerpt = article.excerpt?.toLowerCase().includes(query);
        return matchesTitle || matchesExcerpt;
      }
      return true;
    });
  }, [articles, selectedType, searchQuery]);

  const featuredArticle = useMemo(() => {
    return articles.find((a) => a.isFeatured) || articles[0];
  }, [articles]);

  const regularArticles = useMemo(() => {
    if (!featuredArticle) return filteredArticles;
    // In ALL tab with no search, avoid duplicate of featured article
    if (selectedType === 'ALL' && !searchQuery.trim()) {
      return filteredArticles.filter((a) => a.id !== featuredArticle.id);
    }
    return filteredArticles;
  }, [filteredArticles, featuredArticle, selectedType, searchQuery]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const renderPromotionBadge = (status?: string | null, isCompact = false) => {
    if (!status) return null;
    if (status === 'ONGOING') {
      return (
        <span className={`inline-flex items-center gap-1 font-black rounded-full bg-red-600 text-white shadow-xs animate-pulse ${
          isCompact ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-2.5 py-0.5'
        }`}>
          <Flame size={isCompact ? 10 : 12} /> Đang diễn ra
        </span>
      );
    }
    if (status === 'UPCOMING') {
      return (
        <span className={`inline-flex items-center gap-1 font-bold rounded-full bg-amber-500 text-white shadow-xs ${
          isCompact ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-2.5 py-0.5'
        }`}>
          <Clock size={isCompact ? 10 : 12} /> Sắp diễn ra
        </span>
      );
    }
    if (status === 'ENDED') {
      return (
        <span className={`inline-flex items-center gap-1 font-semibold rounded-full bg-slate-400 text-white ${
          isCompact ? 'text-[9px] px-1.5 py-0.2' : 'text-[11px] px-2 py-0.5'
        }`}>
          Đã kết thúc
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50/80 pb-24 md:pb-20 font-sans selection:bg-red-100 selection:text-red-900">
      {/* ── HEADER BANNER: COMPACT ON MOBILE, RICH ON DESKTOP ── */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-900 text-white pt-6 pb-12 sm:pt-10 sm:pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-0 w-80 sm:w-96 h-80 sm:h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 sm:w-80 h-72 sm:h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-red-400 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-2 sm:mb-3">
                <Sparkles size={12} />
                <span>AVORA Culinary Journal</span>
              </div>
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                Tin Tức & Ưu Đãi Ẩm Thực
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 sm:mt-2 max-w-xl line-clamp-2 sm:line-clamp-none">
                Cập nhật chương trình khuyến mãi độc quyền, thực đơn mới và những câu chuyện ẩm thực tinh hoa từ AVORA.
              </p>
            </div>

            {/* Quick Search */}
            <div className="w-full md:w-80">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Tìm tin tức, voucher, món mới..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 sm:py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white/20 transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-20">
        {/* ── STICKY CATEGORY PILLS BAR ── */}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-1.5 sm:p-2 shadow-lg shadow-slate-900/5 border border-slate-200/80 mb-6 sm:mb-8 flex items-center justify-between gap-2 sticky top-2 sm:static z-30">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar flex-1 py-0.5">
            {TYPE_TABS.map((tab) => {
              const isActive = selectedType === tab.key;
              const count = typeCounts[tab.key] || 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedType(tab.key)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-slate-50 sm:bg-transparent'
                  }`}
                >
                  <span className="sm:hidden">{tab.shortLabel || tab.label}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile View Mode Switcher (Compact List vs Magazine Grid) */}
          <div className="flex sm:hidden items-center bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'compact' ? 'bg-white text-red-600 shadow-2xs font-bold' : 'text-slate-400'
              }`}
              title="Xem danh sách nhỏ gọn"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-red-600 shadow-2xs font-bold' : 'text-slate-400'
              }`}
              title="Xem thẻ lớn"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* ── FEATURED SPOTLIGHT ARTICLE (Only on ALL tab with no search) ── */}
        {selectedType === 'ALL' && !searchQuery.trim() && featuredArticle && (
          <div className="mb-6 sm:mb-10">
            <Link
              href={`/news/${featuredArticle.slug}`}
              className="group block bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-red-200 transition-all duration-300"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                {/* Cover image */}
                <div className="lg:col-span-7 relative aspect-[16/9] sm:aspect-[16/10] lg:aspect-auto min-h-[200px] sm:min-h-[280px] overflow-hidden bg-slate-100">
                  <img
                    src={
                      featuredArticle.coverImageUrl ||
                      featuredArticle.coverImage ||
                      featuredArticle.thumbnailUrl ||
                      'https://images.unsplash.com/photo-1544025162-d76694265947?w=1000'
                    }
                    alt={featuredArticle.title}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden" />
                  
                  {/* Floating tags */}
                  <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider shadow-sm">
                      <Sparkles size={11} /> Nổi bật
                    </span>
                    {featuredArticle.promotionStatus &&
                      renderPromotionBadge(featuredArticle.promotionStatus)}
                  </div>

                  {/* Mobile Quick Overlay Title for cinematic feel */}
                  <div className="absolute bottom-3 left-3 right-3 lg:hidden">
                    <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider block">
                      {TYPE_CONFIG[featuredArticle.articleType || featuredArticle.type || 'NEWS']?.label}
                    </span>
                    <h2 className="text-sm sm:text-base font-black text-white line-clamp-2 drop-shadow-md leading-snug">
                      {featuredArticle.title}
                    </h2>
                  </div>
                </div>

                {/* Desktop Content */}
                <div className="lg:col-span-5 p-4 sm:p-7 sm:flex flex-col justify-between hidden">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
                          TYPE_CONFIG[featuredArticle.articleType || featuredArticle.type || 'NEWS']?.bg || 'bg-slate-100'
                        } ${TYPE_CONFIG[featuredArticle.articleType || featuredArticle.type || 'NEWS']?.text || 'text-slate-700'}`}
                      >
                        {TYPE_CONFIG[featuredArticle.articleType || featuredArticle.type || 'NEWS']?.label || featuredArticle.type}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatDate(featuredArticle.publishedAt)}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                      {featuredArticle.title}
                    </h2>

                    {featuredArticle.excerpt && (
                      <p className="text-slate-600 text-sm mt-3 line-clamp-3 leading-relaxed [text-align:justify]">
                        {featuredArticle.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3.5 text-xs font-semibold text-slate-400">
                      <span className="flex items-center gap-1">
                        <Eye size={13} /> {featuredArticle.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp size={13} /> {featuredArticle.reactionCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={13} /> {featuredArticle.commentCount}
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-black text-red-600 group-hover:translate-x-1 transition-transform">
                      Khám phá ngay <ArrowRight size={15} />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* ── ARTICLES LISTING: COMPACT LIST VIEW ON MOBILE VS GRID ON DESKTOP ── */}
        {regularArticles.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs">
            <Filter size={32} className="mx-auto text-slate-300 mb-2.5" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Không tìm thấy bài viết nào</h3>
            <p className="text-xs text-slate-500 mt-1">
              Thử tìm kiếm với từ khóa khác hoặc bấm xem tất cả danh mục.
            </p>
          </div>
        ) : (
          <div>
            {/* ════ MOBILE COMPACT LIST VIEW (Only on mobile when viewMode === 'compact') ════ */}
            <div className={`sm:hidden space-y-2.5 ${viewMode === 'compact' ? 'block' : 'hidden'}`}>
              {regularArticles.map((article) => {
                const isSaved = !!savedArticlesMap[article.id];
                const artType = article.articleType || article.type || 'NEWS';
                const typeMeta = TYPE_CONFIG[artType] || {
                  label: artType,
                  bg: 'bg-slate-100 border-slate-200',
                  text: 'text-slate-700',
                  dotColor: 'bg-slate-400',
                };
                const cardImg =
                  article.thumbnailUrl ||
                  article.coverImageUrl ||
                  article.coverImage ||
                  'https://images.unsplash.com/photo-1544025162-d76694265947?w=300';

                return (
                  <Link
                    key={article.id}
                    href={`/news/${article.slug}`}
                    className="group bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-red-200 transition-all flex gap-3 items-center"
                  >
                    {/* Compact left thumbnail */}
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={cardImg}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {article.promotionStatus === 'ONGOING' && (
                        <div className="absolute top-1 left-1 bg-red-600 text-white rounded-md p-0.5">
                          <Flame size={10} className="animate-pulse" />
                        </div>
                      )}
                    </div>

                    {/* Compact right details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        {/* Badges row */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full border ${typeMeta.bg} ${typeMeta.text}`}>
                            {typeMeta.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(article.publishedAt)}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                          {article.title}
                        </h3>
                      </div>

                      {/* Bottom meta stats */}
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center gap-0.5">
                            <Eye size={11} /> {article.viewCount}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <ThumbsUp size={11} /> {article.reactionCount}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, article.id)}
                          className={`p-1 rounded-md transition-colors ${
                            isSaved ? 'text-red-600' : 'text-slate-300 hover:text-red-600'
                          }`}
                          title={isSaved ? 'Đã lưu' : 'Lưu'}
                        >
                          <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ════ GRID VIEW (DESKTOP OR MOBILE WHEN IN GRID MODE) ════ */}
            <div
              className={`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ${
                viewMode === 'grid' ? 'grid sm:grid' : 'hidden sm:grid'
              }`}
            >
              {regularArticles.map((article) => {
                const isSaved = !!savedArticlesMap[article.id];
                const artType = article.articleType || article.type || 'NEWS';
                const typeMeta = TYPE_CONFIG[artType] || {
                  label: artType,
                  bg: 'bg-slate-100 border-slate-200',
                  text: 'text-slate-700',
                  dotColor: 'bg-slate-400',
                };

                const cardImg =
                  article.coverImageUrl ||
                  article.coverImage ||
                  article.thumbnailUrl ||
                  'https://images.unsplash.com/photo-1544025162-d76694265947?w=600';

                return (
                  <div
                    key={article.id}
                    className="group bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-2xs hover:shadow-xl hover:border-red-200 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
                  >
                    <Link href={`/news/${article.slug}`} className="block">
                      {/* Cover image & badges */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                        <img
                          src={cardImg}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider shadow-xs border ${typeMeta.bg} ${typeMeta.text}`}
                          >
                            {typeMeta.label}
                          </span>
                          {article.promotionStatus &&
                            renderPromotionBadge(article.promotionStatus)}
                          {article.visibility === 'MEMBERS_ONLY' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px]">
                              <Lock size={10} /> VIP
                            </span>
                          )}
                        </div>

                        {/* Bookmark Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, article.id)}
                          className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition-all cursor-pointer ${
                            isSaved
                              ? 'bg-red-600 text-white shadow-md'
                              : 'bg-white/85 text-slate-700 hover:bg-white hover:text-red-600 shadow-2xs'
                          }`}
                          title={isSaved ? 'Đã lưu' : 'Lưu bài viết'}
                        >
                          <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      {/* Body */}
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mb-2">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {formatDate(article.publishedAt)}
                          </span>
                          {article.branches && article.branches.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-red-600 font-semibold truncate max-w-[120px]">
                                {(article.branches[0] as any).name || (article.branches[0] as any).branch?.name || 'Chi nhánh'}
                              </span>
                            </>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                          {article.title}
                        </h3>

                        {article.excerpt && (
                          <p className="text-slate-500 text-xs mt-2 line-clamp-2 leading-relaxed [text-align:justify]">
                            {article.excerpt}
                          </p>
                        )}
                      </div>
                    </Link>

                    {/* Footer stats */}
                    <div className="px-4 sm:px-5 pb-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1" title="Lượt xem">
                          <Eye size={13} /> {article.viewCount}
                        </span>
                        <span className="flex items-center gap-1" title="Cảm xúc">
                          <ThumbsUp size={13} /> {article.reactionCount}
                        </span>
                        <span className="flex items-center gap-1" title="Bình luận">
                          <MessageSquare size={13} /> {article.commentCount}
                        </span>
                      </div>

                      <Link
                        href={`/news/${article.slug}`}
                        className="text-red-600 font-bold hover:underline inline-flex items-center gap-0.5 text-xs"
                      >
                        Đọc tiếp <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

