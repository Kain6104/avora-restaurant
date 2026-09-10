'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Newspaper,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Bell,
  BarChart3,
  Archive,
  Trash2,
  ExternalLink,
  Flame,
  Clock,
  CheckCircle2,
  FileText,
  Lock,
  Store,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  Bookmark,
  MousePointerClick,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface ArticleSummaryStats {
  totalArticles: number;
  publishedArticles: number;
  draftArticles: number;
  scheduledArticles: number;
  ongoingPromotions: number;
  totalViews: number;
  totalReactions: number;
  totalComments: number;
  totalFavorites: number;
  totalProductClicks: number;
}

interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  type?: string;
  articleType?: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  visibility: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  promotionStartAt?: string | null;
  promotionEndAt?: string | null;
  viewCount: number;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  author?: {
    fullName?: string;
  } | null;
  branches?: any[];
  _count?: {
    products?: number;
    vouchers?: number;
    comments?: number;
    reactions?: number;
    favorites?: number;
  };
}

export default function AdminArticlesPage() {
  const { t, locale } = useLanguage();
  const [stats, setStats] = useState<ArticleSummaryStats | null>(null);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedVisibility, setSelectedVisibility] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchStats = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/admin/articles/analytics/overview`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data?.data?.summary || null);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }
      if (selectedType !== 'ALL') {
        params.set('type', selectedType);
      }
      if (selectedVisibility !== 'ALL') {
        params.set('visibility', selectedVisibility);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`${baseUrl}/api/admin/articles?${params.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        const articleList = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.articles)
          ? json.data.articles
          : Array.isArray(json.articles)
          ? json.articles
          : [];
        const total = json.meta?.total ?? json.data?.total ?? json.total ?? articleList.length;
        const totalPg = json.meta?.totalPages ?? json.data?.totalPages ?? json.totalPages ?? 1;

        setArticles(articleList);
        setTotalCount(total);
        setTotalPages(totalPg);
      } else {
        toast.error(t('articles.loadError', 'Không thể tải danh sách bài viết'));
      }
    } catch (err) {
      console.error('Failed to load articles:', err);
      toast.error(t('articles.loadError', 'Lỗi khi tải danh sách bài viết'));
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, activeTab, selectedType, selectedVisibility, searchQuery, t]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleArchive = async (id: string, currentStatus: string) => {
    const isArchiving = currentStatus !== 'ARCHIVED';
    if (
      !window.confirm(
        isArchiving
          ? (locale === 'en' ? 'Move this article to ARCHIVED status?' : 'Bạn có chắc chắn muốn chuyển bài viết này sang trạng thái LƯU TRỮ?')
          : (locale === 'en' ? 'Restore this article to draft?' : 'Khôi phục bài viết này về bản nháp?')
      )
    )
      return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: isArchiving ? 'ARCHIVED' : 'DRAFT',
        }),
      });

      if (res.ok) {
        toast.success(isArchiving ? (locale === 'en' ? 'Article archived' : 'Đã lưu trữ bài viết') : (locale === 'en' ? 'Article restored' : 'Đã khôi phục bài viết'));
        fetchArticles();
        fetchStats();
      } else {
        toast.error(t('common.updateError', 'Không thể cập nhật trạng thái'));
      }
    } catch {
      toast.error(t('common.actionFailed', 'Lỗi khi thực hiện thao tác'));
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        locale === 'en'
          ? 'Are you sure you want to delete this article? If already published or with interactions, it will be safely archived.'
          : 'Bạn có chắc chắn muốn xóa bài viết này? Lưu ý: Nếu bài đã publish hoặc có tương tác, hệ thống sẽ tự động chuyển sang lưu trữ an toàn.'
      )
    )
      return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/admin/articles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(locale === 'en' ? 'Article deleted / archived' : 'Đã xử lý xóa/lưu trữ bài viết');
        fetchArticles();
        fetchStats();
      } else {
        toast.error(t('articles.deleteError', 'Lỗi khi xóa bài viết'));
      }
    } catch {
      toast.error(t('articles.deleteError', 'Lỗi khi xóa bài viết'));
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={12} /> {t('articles.tabPublished', 'Đã xuất bản')}
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
            <Clock size={12} /> {t('articles.tabScheduled', 'Đã lên lịch')}
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            <FileText size={12} /> {t('articles.tabDraft', 'Bản nháp')}
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Archive size={12} /> {t('articles.tabArchived', 'Lưu trữ')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 text-white flex items-center justify-center shadow-md shadow-red-600/20">
            <Newspaper size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              {t('articles.title', 'Quản Lý Tin Tức & Bài Viết')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {t('articles.subtitle', 'Soạn thảo, quản lý bài viết, nhắm đối tượng chi nhánh & gửi chiến dịch thông báo')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/articles/comments"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-colors"
          >
            <MessageSquare size={16} /> {t('articles.comments', 'Duyệt bình luận')}
          </Link>
          <Link
            href="/admin/articles/create"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 transition-all"
          >
            <Plus size={18} /> {t('articles.create', 'Tạo bài viết mới')}
          </Link>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('articles.totalArticles', 'Tổng bài viết')}</span>
            <Newspaper size={16} className="text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {stats?.totalArticles ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>{stats?.publishedArticles ?? 0} {locale === 'en' ? 'published' : 'đã xuất bản'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{locale === 'en' ? 'Active Promotions' : 'Khuyến mãi đang chạy'}</span>
            <Flame size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">
            {stats?.ongoingPromotions ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{stats?.scheduledArticles ?? 0} {locale === 'en' ? 'scheduled articles' : 'bài đã lên lịch'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('articles.viewsCount', 'Tổng lượt xem')}</span>
            <Eye size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {stats?.totalViews?.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{locale === 'en' ? 'Customer readership' : 'Lượt đọc từ khách hàng'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>{t('articles.interactionsCount', 'Tương tác (Reaction & Cmt)')}</span>
            <ThumbsUp size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {((stats?.totalReactions ?? 0) + (stats?.totalComments ?? 0)).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{stats?.totalFavorites ?? 0} {locale === 'en' ? 'bookmarks' : 'lượt lưu bài'}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Product Clicks (CTR)</span>
            <MousePointerClick size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {stats?.totalProductClicks?.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{locale === 'en' ? 'Dishes clicked from articles' : 'Click vào món ăn từ bài'}</span>
          </div>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100 custom-scrollbar">
          {[
            { key: 'ALL', label: t('articles.tabAll', 'Tất cả') },
            { key: 'PUBLISHED', label: t('articles.tabPublished', 'Đã xuất bản') },
            { key: 'SCHEDULED', label: t('articles.tabScheduled', 'Đã lên lịch') },
            { key: 'DRAFT', label: t('articles.tabDraft', 'Bản nháp') },
            { key: 'ARCHIVED', label: t('articles.tabArchived', 'Lưu trữ') },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t('articles.searchPlaceholder', 'Tìm theo tiêu đề bài viết...')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-medium"
            >
              <option value="ALL">{locale === 'en' ? 'All article types' : 'Tất cả loại bài'}</option>
              <option value="PROMOTION">{t('articles.typePromotion', 'Khuyến mãi')}</option>
              <option value="NEWS">{t('articles.typeNews', 'Tin tức')}</option>
              <option value="EVENT">{locale === 'en' ? 'Event' : 'Sự kiện'}</option>
              <option value="BRAND_STORY">{locale === 'en' ? 'Brand Story' : 'Câu chuyện'}</option>
              <option value="GUIDE">{t('articles.typeGuide', 'Cẩm nang')}</option>
              <option value="MENU_UPDATE">{locale === 'en' ? 'New Dishes' : 'Món mới'}</option>
            </select>

            <select
              value={selectedVisibility}
              onChange={(e) => {
                setSelectedVisibility(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-medium"
            >
              <option value="ALL">{locale === 'en' ? 'All audiences' : 'Tất cả đối tượng'}</option>
              <option value="PUBLIC">{t('articles.visPublic', 'Công khai (Public)')}</option>
              <option value="AUTHENTICATED">{locale === 'en' ? 'Logged-in users' : 'Đã đăng nhập'}</option>
              <option value="MEMBERS_ONLY">{t('articles.visMembersOnly', 'Hội viên VIP')}</option>
              <option value="PRIVATE">{locale === 'en' ? 'Internal / Admin' : 'Nội bộ / Admin'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── ARTICLES TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">{locale === 'en' ? 'Article' : 'Bài viết'}</th>
                <th className="py-3 px-3">{locale === 'en' ? 'Type / Status' : 'Loại / Trạng thái'}</th>
                <th className="py-3 px-3">{locale === 'en' ? 'Scope' : 'Phạm vi'}</th>
                <th className="py-3 px-3">{locale === 'en' ? 'Date' : 'Thời gian'}</th>
                <th className="py-3 px-3 text-center">{locale === 'en' ? 'Engagement' : 'Tương tác'}</th>
                <th className="py-3 px-4 text-right">{locale === 'en' ? 'Actions' : 'Thao tác'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    {t('common.loading', 'Đang tải danh sách bài viết...')}
                  </td>
                </tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    {locale === 'en' ? 'No articles match the current filter' : 'Không tìm thấy bài viết nào phù hợp bộ lọc'}
                  </td>
                </tr>
              ) : (
                articles.map((article) => (
                  <tr key={article.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Cover & Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60">
                          <img
                            src={
                              article.coverImageUrl ||
                              article.coverImage ||
                              article.thumbnailUrl ||
                              'https://images.unsplash.com/photo-1544025162-d76694265947?w=150'
                            }
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/articles/${article.id}`}
                            className="font-bold text-slate-900 hover:text-red-600 transition-colors line-clamp-1 text-xs sm:text-sm"
                          >
                            {article.title}
                          </Link>
                          <span className="text-[11px] text-slate-400 font-mono block truncate">
                            /{article.slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Type & Status */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {article.articleType || article.type || 'NEWS'}
                        </span>
                        <div>{renderStatusBadge(article.status)}</div>
                      </div>
                    </td>

                    {/* Visibility & Branch */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                          {article.visibility === 'MEMBERS_ONLY' ? (
                            <>
                              <Lock size={11} className="text-amber-600" /> {locale === 'en' ? 'Members' : 'Hội viên'}
                            </>
                          ) : article.visibility === 'PRIVATE' ? (
                            <>
                              <Lock size={11} className="text-red-600" /> {locale === 'en' ? 'Internal' : 'Nội bộ'}
                            </>
                          ) : (
                            locale === 'en' ? 'Public' : 'Công khai'
                          )}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {article.branches && article.branches.length > 0
                            ? `${article.branches.length} ${locale === 'en' ? 'branches' : 'chi nhánh'}`
                            : (locale === 'en' ? 'All Branches' : 'Tất cả CN')}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 text-[11px] text-slate-500">
                      {article.status === 'SCHEDULED' ? (
                        <div>
                          <span className="text-blue-600 font-semibold block">{locale === 'en' ? 'Scheduled:' : 'Hẹn publish:'}</span>
                          {formatDate(article.scheduledAt)}
                        </div>
                      ) : (
                        <div>
                          <span className="text-slate-400 block">{locale === 'en' ? 'Published:' : 'Xuất bản:'}</span>
                          {formatDate(article.publishedAt)}
                        </div>
                      )}
                    </td>

                    {/* Stats */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2.5 text-[11px] text-slate-500">
                        <span title={t('articles.viewsCount', 'Lượt xem')} className="flex items-center gap-0.5">
                          <Eye size={12} /> {article.viewCount}
                        </span>
                        <span title={locale === 'en' ? 'Reactions' : 'Cảm xúc'} className="flex items-center gap-0.5">
                          <ThumbsUp size={12} /> {article.reactionCount}
                        </span>
                        <span title={locale === 'en' ? 'Comments' : 'Bình luận'} className="flex items-center gap-0.5">
                          <MessageSquare size={12} /> {article.commentCount}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/news/${article.slug}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title={t('articles.viewOnWeb', 'Xem trên web')}
                        >
                          <ExternalLink size={15} />
                        </Link>

                        <Link
                          href={`/admin/articles/${article.id}/notify`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={t('articles.pushNotification', 'Gửi thông báo')}
                        >
                          <Bell size={15} />
                        </Link>

                        <Link
                          href={`/admin/articles/${article.id}/analytics`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title={t('articles.analytics', 'Xem phân tích')}
                        >
                          <BarChart3 size={15} />
                        </Link>

                        <Link
                          href={`/admin/articles/${article.id}/edit`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title={t('articles.edit', 'Chỉnh sửa')}
                        >
                          <Edit2 size={15} />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleArchive(article.id, article.status)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                          title={article.status === 'ARCHIVED' ? (locale === 'en' ? 'Restore' : 'Khôi phục') : (locale === 'en' ? 'Archive' : 'Lưu trữ')}
                        >
                          <Archive size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(article.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title={t('articles.delete', 'Xóa bài viết')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              {locale === 'en'
                ? `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, totalCount)} of ${totalCount} articles`
                : `Hiển thị ${(page - 1) * limit + 1} - ${Math.min(page * limit, totalCount)} trên ${totalCount} bài viết`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-bold text-slate-800">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
