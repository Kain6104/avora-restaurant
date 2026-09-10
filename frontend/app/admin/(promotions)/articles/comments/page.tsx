'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Crown,
  Clock,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface CommentAdminItem {
  id: string;
  articleId: string;
  userId: string;
  parentId?: string | null;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'SPAM' | 'DELETED';
  createdAt: string;
  user?: {
    id: string;
    fullName?: string;
    avatar?: string;
    membershipTier?: {
      name: string;
    } | null;
  };
  article?: {
    id: string;
    title: string;
    slug: string;
  };
}

export default function AdminCommentsPage() {
  const { t, locale } = useLanguage();
  const isEn = locale === 'en';

  const [comments, setComments] = useState<CommentAdminItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`${baseUrl}/api/articles/admin/comments?${params.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setComments(data?.data?.comments || []);
        setTotalCount(data?.data?.total || 0);
        setTotalPages(data?.data?.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
      toast.error(isEn ? 'Error loading comments list' : 'Lỗi khi tải danh sách bình luận');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, searchQuery, isEn]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleModerate = async (commentId: string, status: string) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/comments/${commentId}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        toast.success(isEn ? 'Comment status updated successfully' : 'Đã cập nhật trạng thái bình luận');
        fetchComments();
      } else {
        toast.error(isEn ? 'Cannot update status' : 'Không thể cập nhật trạng thái');
      }
    } catch {
      toast.error(isEn ? 'Error performing moderation' : 'Lỗi khi thực hiện kiểm duyệt');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={11} /> {isEn ? 'Approved' : 'Đã duyệt'}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Clock size={11} /> {isEn ? 'Pending' : 'Chờ duyệt'}
          </span>
        );
      case 'SPAM':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
            <AlertTriangle size={11} /> Spam
          </span>
        );
      case 'DELETED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {isEn ? 'Deleted' : 'Đã xóa'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/articles"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <MessageSquare size={22} className="text-red-600" />
              {isEn ? 'Article Comments Moderation Center' : 'Trung Tâm Duyệt Bình Luận Bài Viết'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'Moderate customer reviews, replies, and eliminate spam'
                : 'Kiểm duyệt, loại bỏ spam và đảm bảo văn hóa bình luận tích cực'}
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER STRIP ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto custom-scrollbar">
          {[
            { key: 'ALL', label: isEn ? 'All' : 'Tất cả' },
            { key: 'PENDING', label: isEn ? 'Pending' : 'Chờ duyệt' },
            { key: 'APPROVED', label: isEn ? 'Approved' : 'Đã duyệt' },
            { key: 'SPAM', label: 'Spam' },
            { key: 'DELETED', label: isEn ? 'Deleted' : 'Đã xóa' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full sm:w-72 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={isEn ? 'Search comment content...' : 'Tìm theo nội dung bình luận...'}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white"
          />
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">{isEn ? 'Commenter' : 'Người bình luận'}</th>
                <th className="py-3 px-3">{isEn ? 'Content' : 'Nội dung'}</th>
                <th className="py-3 px-3">{isEn ? 'Article' : 'Bài viết'}</th>
                <th className="py-3 px-3">{isEn ? 'Status' : 'Trạng thái'}</th>
                <th className="py-3 px-3">{isEn ? 'Time' : 'Thời gian'}</th>
                <th className="py-3 px-4 text-right">{isEn ? 'Moderation Action' : 'Hành động duyệt'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    {isEn ? 'Loading comments list...' : 'Đang tải danh sách bình luận...'}
                  </td>
                </tr>
              ) : comments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    {isEn ? 'No matching comments found' : 'Không có bình luận nào phù hợp'}
                  </td>
                </tr>
              ) : (
                comments.map((comment) => (
                  <tr key={comment.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* User */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {comment.user?.avatar ? (
                          <img
                            src={comment.user.avatar}
                            alt="avatar"
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-[10px]">
                            {(comment.user?.fullName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-slate-900 block truncate max-w-[120px]">
                            {comment.user?.fullName || (isEn ? 'Customer' : 'Khách hàng')}
                          </span>
                          {comment.user?.membershipTier && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              {comment.user.membershipTier.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Content */}
                    <td className="py-3 px-3">
                      <p className="text-slate-800 line-clamp-2 max-w-sm font-medium">
                        {comment.content}
                      </p>
                      {comment.parentId && (
                        <span className="text-[10px] text-slate-400 italic">
                          {isEn ? 'Reply to comment' : 'Phản hồi bình luận'}
                        </span>
                      )}
                    </td>

                    {/* Article */}
                    <td className="py-3 px-3">
                      {comment.article ? (
                        <Link
                          href={`/news/${comment.article.slug}`}
                          target="_blank"
                          className="font-semibold text-slate-700 hover:text-red-600 transition-colors line-clamp-1 max-w-[160px] inline-flex items-center gap-1"
                        >
                          {comment.article.title} <ExternalLink size={11} />
                        </Link>
                      ) : (
                        <span className="text-slate-400 italic">
                          {isEn ? 'Article does not exist' : 'Bài viết không tồn tại'}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">{renderStatusBadge(comment.status)}</td>

                    {/* Date */}
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {formatDate(comment.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {comment.status !== 'APPROVED' && (
                          <button
                            type="button"
                            onClick={() => handleModerate(comment.id, 'APPROVED')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 cursor-pointer"
                          >
                            {isEn ? 'Approve' : 'Duyệt'}
                          </button>
                        )}
                        {comment.status !== 'SPAM' && (
                          <button
                            type="button"
                            onClick={() => handleModerate(comment.id, 'SPAM')}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold text-[11px] hover:bg-amber-200 cursor-pointer"
                          >
                            Spam
                          </button>
                        )}
                        {comment.status !== 'DELETED' && (
                          <button
                            type="button"
                            onClick={() => handleModerate(comment.id, 'DELETED')}
                            className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 font-bold text-[11px] hover:bg-red-200 cursor-pointer"
                          >
                            {isEn ? 'Delete' : 'Xóa'}
                          </button>
                        )}
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
              {isEn
                ? `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, totalCount)} of ${totalCount} comments`
                : `Hiển thị ${(page - 1) * limit + 1} - ${Math.min(page * limit, totalCount)} trên ${totalCount} bình luận`}
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
