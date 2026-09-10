'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Eye,
  MousePointerClick,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  Share2,
  TrendingUp,
  BarChart3,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';
import { REACTION_CONFIG, ReactionType } from '@/components/article/ReactionIcons';
import { useLanguage } from '@/contexts/LanguageContext';

const PIE_COLORS = ['#1877F2', '#E0245E', '#F5A623', '#FF647C', '#3EA6FF', '#D8232A'];

export default function ArticleAnalyticsPage() {
  const params = useParams();
  const articleId = params?.id as string;
  const { locale } = useLanguage();
  const isEn = locale === 'en';

  const [analytics, setAnalytics] = useState<any>(null);
  const [days, setDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!articleId) return;

    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/admin/articles/${articleId}/analytics?days=${days}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data?.data || data);
        } else {
          toast.error(isEn ? 'Analytics data not found' : 'Không tìm thấy dữ liệu thống kê');
        }
      } catch (err) {
        console.error(err);
        toast.error(isEn ? 'Error loading analytics' : 'Lỗi khi tải thống kê');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [articleId, days, isEn]);

  if (isLoading && !analytics) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm font-medium animate-pulse">
        {isEn ? 'Loading analytics and performance metrics...' : 'Đang tải dữ liệu phân tích thống kê...'}
      </div>
    );
  }

  const rawReactions = analytics?.reactionsBreakdown || analytics?.reactionBreakdown;
  const reactionData = Array.isArray(rawReactions)
    ? rawReactions.map((item: any) => ({
        name: REACTION_CONFIG[item.type as ReactionType]?.label || item.type,
        value: item.count,
      }))
    : rawReactions && typeof rawReactions === 'object'
    ? Object.entries(rawReactions).map(([type, count]) => ({
        name: REACTION_CONFIG[type as ReactionType]?.label || type,
        value: count as number,
      }))
    : [];

  const rawProductClicks = analytics?.productClicks || analytics?.productPerformance || [];
  const productCTRData = Array.isArray(rawProductClicks)
    ? rawProductClicks.map((p: any) => ({
        name: p.productName || p.name || p.productId,
        clicks: p.clickCount ?? p.clicks ?? 0,
      }))
    : [];

  return (
    <div className="space-y-6 pb-20">
      {/* ── HEADER & RANGE PICKER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/articles/${articleId}`}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <BarChart3 size={22} className="text-blue-600" />
              {isEn ? 'Article Performance & Analytics' : 'Thống Kê & Phân Tích Hiệu Suất Bài Viết'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-lg">
              {analytics?.article?.title ||
                (isEn
                  ? 'Real customer engagement & performance metrics report'
                  : 'Báo cáo số liệu tương tác thực tế từ khách hàng')}
            </p>
          </div>
        </div>

        {/* Date range filter */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          {[
            { label: isEn ? 'Last 7 days' : '7 ngày qua', value: 7 },
            { label: isEn ? 'Last 30 days' : '30 ngày qua', value: 30 },
            { label: isEn ? 'Last 90 days' : '90 ngày qua', value: 90 },
          ].map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setDays(r.value)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                days === r.value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── METRIC STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="text-slate-400 text-xs font-semibold flex items-center justify-between">
            <span>{isEn ? 'Total Views' : 'Tổng lượt xem'}</span>
            <Eye size={15} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">
            {(analytics?.article?.viewCount ?? analytics?.totalViews ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="text-slate-400 text-xs font-semibold flex items-center justify-between">
            <span>{isEn ? 'Dish Clicks (CTR)' : 'Lượt click món (CTR)'}</span>
            <MousePointerClick size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {(analytics?.totalProductClicks ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="text-slate-400 text-xs font-semibold flex items-center justify-between">
            <span>{isEn ? 'Dish CTR Rate' : 'Tỷ lệ CTR món ăn'}</span>
            <TrendingUp size={15} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">
            {analytics?.ctrPercentage !== undefined
              ? `${analytics.ctrPercentage}%`
              : analytics?.productCTR !== undefined
              ? `${analytics.productCTR}%`
              : '0%'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="text-slate-400 text-xs font-semibold flex items-center justify-between">
            <span>{isEn ? 'Reactions' : 'Cảm xúc'}</span>
            <ThumbsUp size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">
            {(analytics?.article?.reactionCount ?? analytics?.totalReactions ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="text-slate-400 text-xs font-semibold flex items-center justify-between">
            <span>{isEn ? 'Comments' : 'Bình luận'}</span>
            <MessageSquare size={15} className="text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 mt-2">
            {(analytics?.article?.commentCount ?? analytics?.totalComments ?? 0).toLocaleString('vi-VN')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
          <div className="text-slate-400 text-xs font-semibold flex items-center justify-between">
            <span>{isEn ? 'Saves & Shares' : 'Lưu & Chia sẻ'}</span>
            <Share2 size={15} className="text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2">
            {(
              (analytics?.article?._count?.favorites ?? analytics?.totalFavorites ?? 0) +
              (analytics?.article?.shareCount ?? analytics?.totalShares ?? 0)
            ).toLocaleString('vi-VN')}
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product Clicks Bar Chart */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isEn ? 'Dish Clicks Distribution (Product Clicks)' : 'Phân bổ lượt Click món ăn (Product Clicks)'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn
                  ? 'Dishes that received the most interest from this article'
                  : 'Món ăn nào nhận được nhiều sự quan tâm nhất từ bài viết này'}
              </p>
            </div>
          </div>

          {productCTRData.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 italic">
              {isEn
                ? 'No dish clicks recorded during this time range'
                : 'Chưa ghi nhận lượt click món ăn nào trong khoảng thời gian này'}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productCTRData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="clicks"
                    fill="#da251d"
                    radius={[6, 6, 0, 0]}
                    name={isEn ? 'Clicks' : 'Lượt click'}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Reactions Breakdown Pie Chart */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {isEn ? 'Reactions Breakdown' : 'Phân bố cảm xúc (Reactions)'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEn ? 'Distribution of reader reaction emotions' : 'Tỷ lệ các loại cảm xúc người đọc phản hồi'}
            </p>
          </div>

          {reactionData.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 italic">
              {isEn ? 'No reactions yet for this article' : 'Chưa có cảm xúc nào được thả cho bài viết này'}
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reactionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {reactionData.map((_: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
