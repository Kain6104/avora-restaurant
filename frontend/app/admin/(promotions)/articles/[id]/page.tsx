'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit2,
  Bell,
  BarChart3,
  ExternalLink,
  Eye,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  MousePointerClick,
  Calendar,
  Clock,
  Lock,
  Store,
  Crown,
  Utensils,
  Ticket,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Send,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useLanguage();
  const articleId = params?.id as string;

  const [article, setArticle] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'CONTENT' | 'PRODUCTS_VOUCHERS' | 'COMMENTS' | 'CAMPAIGNS'
  >('OVERVIEW');
  const [isLoading, setIsLoading] = useState(true);

  const fetchArticle = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/admin/articles/${articleId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setArticle(data?.data || data || null);
      } else {
        toast.error(t('articles.notFound', 'Không tìm thấy bài viết'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('articles.loadError', 'Lỗi khi tải bài viết'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (articleId) fetchArticle();
  }, [articleId]);

  const handleModerateComment = async (commentId: string, status: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/comments/${commentId}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success(locale === 'en' ? 'Comment status updated' : 'Đã cập nhật trạng thái bình luận');
        fetchArticle();
      } else {
        toast.error(t('common.updateError', 'Không thể cập nhật'));
      }
    } catch {
      toast.error(t('common.actionFailed', 'Lỗi khi kiểm duyệt'));
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm font-medium animate-pulse">
        {t('articles.loadingInfo', 'Đang tải thông tin chi tiết bài viết...')}
      </div>
    );
  }

  if (!article) {
    return (
      <div className="py-20 text-center text-slate-500 font-bold">
        {t('articles.notFound', 'Không tìm thấy bài viết')}
      </div>
    );
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── TOP HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/articles"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                {article.type}
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {article.status}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">
              {article.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/news/${article.slug}`}
            target="_blank"
            className="p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink size={15} /> {t('articles.viewOnWeb', 'Xem trên web')}
          </Link>
          <Link
            href={`/admin/articles/${article.id}/notify`}
            className="p-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Bell size={15} /> {t('articles.pushNotification', 'Gửi thông báo')}
          </Link>
          <Link
            href={`/admin/articles/${article.id}/analytics`}
            className="p-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <BarChart3 size={15} /> {t('articles.analytics', 'Thống kê')}
          </Link>
          <Link
            href={`/admin/articles/${article.id}/edit`}
            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-red-600/20 transition-all"
          >
            <Edit2 size={15} /> {t('articles.edit', 'Chỉnh sửa')}
          </Link>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">{t('articles.viewsCount', 'Lượt xem')}</span>
          <span className="text-xl font-black text-blue-600 mt-1 block">
            {article.viewCount?.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') || 0}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">{locale === 'en' ? 'Reactions' : 'Cảm xúc (Reactions)'}</span>
          <span className="text-xl font-black text-amber-600 mt-1 block">
            {article.reactionCount || 0}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">{locale === 'en' ? 'Comments' : 'Bình luận'}</span>
          <span className="text-xl font-black text-emerald-600 mt-1 block">
            {article.commentCount || 0}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-400 block">{locale === 'en' ? 'Favorites' : 'Lượt lưu bài'}</span>
          <span className="text-xl font-black text-rose-600 mt-1 block">
            {article._count?.favorites || 0}
          </span>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-slate-400 block">{locale === 'en' ? 'Shares' : 'Lượt chia sẻ'}</span>
          <span className="text-xl font-black text-purple-600 mt-1 block">
            {article.shareCount || 0}
          </span>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="bg-white rounded-2xl p-1.5 border border-slate-100 shadow-2xs flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {[
          { key: 'OVERVIEW', label: locale === 'en' ? 'Overview' : 'Tổng quan' },
          { key: 'CONTENT', label: locale === 'en' ? 'Content Preview' : 'Xem trước nội dung' },
          { key: 'PRODUCTS_VOUCHERS', label: locale === 'en' ? `Dishes & Vouchers (${(article.products?.length || 0) + (article.vouchers?.length || 0)})` : `Món ăn & Voucher (${(article.products?.length || 0) + (article.vouchers?.length || 0)})` },
          { key: 'COMMENTS', label: locale === 'en' ? `Comments (${article.comments?.length || 0})` : `Bình luận (${article.comments?.length || 0})` },
          { key: 'CAMPAIGNS', label: locale === 'en' ? `Campaigns (${article.notificationCampaigns?.length || 0})` : `Chiến dịch thông báo (${article.notificationCampaigns?.length || 0})` },
        ].map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setActiveTab(tabItem.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tabItem.key
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Metadata Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              {locale === 'en' ? 'Configuration & Schedule' : 'Thông tin cấu hình & Thời gian'}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">{locale === 'en' ? 'Slug path:' : 'Đường dẫn slug:'}</span>
                <span className="font-mono text-slate-800 font-semibold">{article.slug}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{locale === 'en' ? 'Author:' : 'Người tạo:'}</span>
                <span className="text-slate-800 font-semibold">
                  {article.author?.fullName || (locale === 'en' ? 'System' : 'Hệ thống')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{locale === 'en' ? 'Created at:' : 'Thời gian tạo:'}</span>
                <span className="text-slate-700">{formatDate(article.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{locale === 'en' ? 'Published at:' : 'Thời gian xuất bản:'}</span>
                <span className="text-slate-700">{formatDate(article.publishedAt)}</span>
              </div>
              {article.scheduledAt && (
                <div className="col-span-2 bg-blue-50 p-2.5 rounded-xl text-blue-800">
                  <span className="font-semibold block">{locale === 'en' ? 'Auto publish scheduled at:' : 'Hẹn giờ xuất bản tự động:'}</span>
                  <span className="font-mono">{formatDate(article.scheduledAt)}</span>
                </div>
              )}
              {article.type === 'PROMOTION' && (
                <div className="col-span-2 bg-red-50 p-2.5 rounded-xl text-red-800 space-y-1">
                  <span className="font-bold block">{locale === 'en' ? 'Promotion period:' : 'Thời gian khuyến mãi:'}</span>
                  <div>{locale === 'en' ? 'Start: ' : 'Bắt đầu: '}{formatDate(article.promotionStartAt)}</div>
                  <div>{locale === 'en' ? 'End: ' : 'Kết thúc: '}{formatDate(article.promotionEndAt)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Targeting Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              {locale === 'en' ? 'Audience Scope & Branches' : 'Phạm vi đối tượng & Chi nhánh'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">{locale === 'en' ? 'Access level:' : 'Quyền truy cập:'}</span>
                <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-800">
                  {article.visibility}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">{locale === 'en' ? 'Applied branches:' : 'Chi nhánh áp dụng:'}</span>
                {article.branches && article.branches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {article.branches.map((b: any) => (
                      <span
                        key={b.branchId}
                        className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-semibold"
                      >
                        {b.branch?.name || b.branchId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-700 font-medium italic">
                    {locale === 'en' ? 'All AVORA branches' : 'Tất cả các chi nhánh AVORA'}
                  </span>
                )}
              </div>

              {article.visibility === 'MEMBERS_ONLY' && (
                <div>
                  <span className="text-slate-400 block mb-1">{locale === 'en' ? 'Applied membership tiers:' : 'Hạng thành viên áp dụng:'}</span>
                  {article.membershipTiers && article.membershipTiers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {article.membershipTiers.map((tierItem: any) => (
                        <span
                          key={tierItem.membershipTierId}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold"
                        >
                          {tierItem.tier?.name || tierItem.membershipTierId}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-700 font-medium italic">
                      {locale === 'en' ? 'All membership card tiers' : 'Tất cả các hạng thẻ thành viên'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT (PREVIEW) ── */}
      {activeTab === 'CONTENT' && (
        <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-100 shadow-2xs space-y-6 max-w-4xl mx-auto">
          {article.coverImage && (
            <div className="aspect-16/9 rounded-2xl overflow-hidden bg-slate-100">
              <img
                src={article.coverImage}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{article.title}</h2>

          {article.excerpt && (
            <p className="text-slate-600 text-sm italic border-l-4 border-red-500 pl-3">
              {article.excerpt}
            </p>
          )}

          <div
            className="prose prose-slate prose-red max-w-none pt-4 border-t border-slate-100"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />
        </div>
      )}

      {/* ── TAB PRODUCTS & VOUCHERS ── */}
      {activeTab === 'PRODUCTS_VOUCHERS' && (
        <div className="space-y-6">
          {/* Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Utensils size={18} className="text-red-600" /> {locale === 'en' ? 'Linked Dishes' : 'Món ăn liên kết'} ({article.products?.length || 0})
            </h3>

            {article.products?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{locale === 'en' ? 'No linked dishes.' : 'Không có món ăn nào liên kết.'}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {article.products.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                      <img
                        src={p.product?.image || p.product?.imageUrl || '/food-placeholder.png'}
                        alt={p.product?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{p.product?.name}</h4>
                      <span className="text-xs text-red-600 font-semibold">
                        {p.product?.price?.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} đ
                      </span>
                      {p.highlightNote && (
                        <span className="block text-[10px] text-slate-400 italic truncate">
                          {p.highlightNote}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vouchers */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Ticket size={18} className="text-amber-600" /> {locale === 'en' ? 'Linked Vouchers' : 'Voucher liên kết'} ({article.vouchers?.length || 0})
            </h3>

            {article.vouchers?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{locale === 'en' ? 'No linked vouchers.' : 'Không có voucher nào liên kết.'}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {article.vouchers.map((v: any) => (
                  <div
                    key={v.id}
                    className="p-3.5 bg-amber-50/50 rounded-xl border border-dashed border-amber-300 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-red-600 bg-white px-2 py-0.5 rounded border border-red-200">
                          {v.voucher?.code}
                        </span>
                        <span className="text-[11px] font-bold text-amber-800">
                          {v.voucher?.discountType === 'PERCENTAGE'
                            ? (locale === 'en' ? `Discount ${v.voucher?.discountValue}%` : `Giảm ${v.voucher?.discountValue}%`)
                            : (locale === 'en' ? `Discount ${v.voucher?.discountValue?.toLocaleString('en-US')} VND` : `Giảm ${v.voucher?.discountValue?.toLocaleString('vi-VN')} đ`)}
                        </span>
                      </div>
                      {v.customNote && (
                        <p className="text-xs text-slate-600 mt-1 italic">{v.customNote}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB COMMENTS ── */}
      {activeTab === 'COMMENTS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">
            {locale === 'en' ? `Comments List (${article.comments?.length || 0})` : `Danh sách bình luận (${article.comments?.length || 0})`}
          </h3>

          {article.comments?.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{locale === 'en' ? 'No comments yet.' : 'Chưa có bình luận nào.'}</p>
          ) : (
            <div className="space-y-3">
              {article.comments.map((c: any) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {c.user?.fullName || (locale === 'en' ? 'User' : 'Người dùng')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : c.status === 'SPAM'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {c.status}
                      </span>
                      <span className="text-slate-400 text-[11px]">{formatDate(c.createdAt)}</span>
                    </div>
                    <p className="text-slate-700">{c.content}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.status !== 'APPROVED' && (
                      <button
                        type="button"
                        onClick={() => handleModerateComment(c.id, 'APPROVED')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                      >
                        {locale === 'en' ? 'Approve' : 'Duyệt'}
                      </button>
                    )}
                    {c.status !== 'SPAM' && (
                      <button
                        type="button"
                        onClick={() => handleModerateComment(c.id, 'SPAM')}
                        className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200"
                      >
                        Spam
                      </button>
                    )}
                    {c.status !== 'DELETED' && (
                      <button
                        type="button"
                        onClick={() => handleModerateComment(c.id, 'DELETED')}
                        className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-semibold hover:bg-red-200"
                      >
                        {locale === 'en' ? 'Delete' : 'Xóa'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CAMPAIGNS ── */}
      {activeTab === 'CAMPAIGNS' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900">
              {locale === 'en' ? `Notification Campaigns (${article.notificationCampaigns?.length || 0})` : `Chiến dịch thông báo (${article.notificationCampaigns?.length || 0})`}
            </h3>
            <Link
              href={`/admin/articles/${article.id}/notify`}
              className="px-3.5 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 inline-flex items-center gap-1"
            >
              <Bell size={14} /> {locale === 'en' ? 'Send New Campaign' : 'Gửi chiến dịch mới'}
            </Link>
          </div>

          {article.notificationCampaigns?.length === 0 ? (
            <p className="text-xs text-slate-400 italic">{locale === 'en' ? 'No notification campaigns sent yet.' : 'Chưa có chiến dịch thông báo nào được gửi.'}</p>
          ) : (
            <div className="space-y-3">
              {article.notificationCampaigns.map((camp: any) => (
                <div
                  key={camp.id}
                  className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{camp.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {camp.status}
                      </span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{camp.body}</p>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {locale === 'en' ? 'Sent at: ' : 'Gửi lúc: '}{formatDate(camp.createdAt)} • {locale === 'en' ? 'Recipients: ' : 'Người nhận: '}{' '}
                      {camp.recipientCount?.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
