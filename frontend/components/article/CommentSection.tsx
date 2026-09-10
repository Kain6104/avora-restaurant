'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  CornerDownRight,
  Send,
  MoreVertical,
  Trash2,
  Edit2,
  Clock,
  ShieldCheck,
  Crown,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface CommentItem {
  id: string;
  articleId: string;
  userId: string;
  parentId?: string | null;
  content: string;
  status: 'PENDING' | 'APPROVED' | 'SPAM' | 'DELETED' | 'ACTIVE';
  isEdited?: boolean;
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    fullName?: string;
    avatar?: string;
    avatarUrl?: string;
    role?: string;
    membershipTier?: {
      name: string;
      color?: string;
    } | null;
  };
  replies?: CommentItem[];
}

interface CommentSectionProps {
  articleId: string;
  initialCommentCount?: number;
  currentUserId?: string | null;
  currentUserRole?: string | null;
}

export default function CommentSection({
  articleId,
  initialCommentCount = 0,
  currentUserId,
  currentUserRole,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(initialCommentCount);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);
  const [replyContent, setReplyContent] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    fullName?: string;
    avatarUrl?: string;
    avatar?: string;
    role?: string;
  } | null>(null);

  // Fetch logged in user to accurately check comment ownership and permissions
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data);
        }
      } catch {
        // user not authenticated
      }
    };
    fetchMe();
  }, []);

  // Close open action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.comment-action-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchComments = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${articleId}/comments`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.data?.comments)
          ? json.data.comments
          : Array.isArray(json.comments)
          ? json.comments
          : Array.isArray(json)
          ? json
          : [];
        setComments(list);
        setTotalCount(json.meta?.total ?? json.data?.totalCount ?? list.length);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: newComment.trim(),
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Vui lòng đăng nhập để bình luận');
          return;
        }
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error?.message || errData?.message || 'Không thể gửi bình luận');
        return;
      }

      setNewComment('');
      toast.success('Bình luận đã được đăng!');
      fetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
      toast.error('Có lỗi xảy ra khi gửi bình luận');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: replyContent.trim(),
          parentId,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Vui lòng đăng nhập để phản hồi');
          return;
        }
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error?.message || errData?.message || 'Không thể gửi phản hồi');
        return;
      }

      setReplyContent('');
      setReplyingTo(null);
      toast.success('Phản hồi thành công!');
      fetchComments();
    } catch (err) {
      console.error('Failed to reply:', err);
      toast.error('Lỗi khi gửi phản hồi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/comments/${commentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error?.message || errData?.message || 'Không thể cập nhật bình luận');
        return;
      }

      setEditingCommentId(null);
      setEditContent('');
      toast.success('Đã cập nhật bình luận');
      fetchComments();
    } catch (err) {
      console.error('Update comment error:', err);
      toast.error('Lỗi khi cập nhật bình luận');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error?.message || errData?.message || 'Không thể xóa bình luận');
        return;
      }

      toast.success('Đã xóa bình luận');
      fetchComments();
    } catch (err) {
      console.error('Delete comment error:', err);
      toast.error('Lỗi khi xóa bình luận');
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const renderCommentCard = (comment: CommentItem, isReply = false) => {
    const isDeleted = comment.status === 'DELETED';
    const activeUserId = currentUserId || currentUser?.id;
    const activeUserRole = currentUserRole || currentUser?.role;

    const isOwner = !!(
      activeUserId &&
      (comment.userId === activeUserId || (comment.user && comment.user.id === activeUserId))
    );
    const canModerate = activeUserRole === 'ADMIN' || activeUserRole === 'MANAGER';
    const isEditing = editingCommentId === comment.id;

    return (
      <div
        key={comment.id}
        className={`group relative flex gap-3 ${
          isReply ? 'ml-6 sm:ml-10 mt-3 pt-3 border-t border-slate-100/80' : 'pt-4 border-t border-slate-100 first:border-t-0 first:pt-0'
        }`}
      >
        {/* Avatar */}
        <div className="shrink-0">
          {isDeleted ? (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <AlertCircle size={16} />
            </div>
          ) : (comment.user?.avatarUrl || comment.user?.avatar || (comment.user as any)?.avatarUrl) ? (
            <img
              src={comment.user?.avatarUrl || comment.user?.avatar || (comment.user as any)?.avatarUrl}
              alt={comment.user?.fullName || 'User'}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-2 ring-slate-100"
            />
          ) : (
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center shadow-xs">
              {(comment.user?.fullName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content Box */}
        <div className="flex-1 min-w-0">
          <div className="bg-slate-50/90 rounded-2xl px-3.5 py-2.5 border border-slate-100 hover:border-slate-200 transition-colors">
            {/* Header: Name, badges, time */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm text-slate-900">
                  {isDeleted ? 'Người dùng' : comment.user?.fullName || 'Khách hàng'}
                </span>

                {/* Role badge */}
                {!isDeleted && (comment.user?.role === 'ADMIN' || comment.user?.role === 'MANAGER') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                    <ShieldCheck size={11} />
                    {comment.user.role === 'ADMIN' ? 'Quản trị' : 'Quản lý'}
                  </span>
                )}

                {/* Membership tier badge */}
                {!isDeleted && comment.user?.membershipTier && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                    <Crown size={11} />
                    {comment.user.membershipTier.name}
                  </span>
                )}
              </div>

              {/* Action Menu (Edit / Delete) */}
              {!isDeleted && (isOwner || canModerate) && (
                <div className="relative comment-action-menu">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === comment.id ? null : comment.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    title="Tùy chọn bình luận"
                  >
                    <MoreVertical size={14} />
                  </button>

                  {openMenuId === comment.id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 text-xs font-medium animate-in fade-in zoom-in-95 duration-150">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditContent(comment.content);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Edit2 size={12} className="text-slate-500" /> Sửa bình luận
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          handleDeleteComment(comment.id);
                        }}
                        className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <Trash2 size={12} className="text-red-500" /> Xóa bình luận
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Comment Body */}
            {isDeleted ? (
              <p className="text-xs sm:text-sm text-slate-400 italic">Bình luận này đã bị xóa.</p>
            ) : isEditing ? (
              <div className="mt-1 space-y-2">
                <textarea
                  rows={2}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCommentId(null)}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/60 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateComment(comment.id)}
                    className="px-3 py-1 text-xs bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed break-words">
                {comment.content}
              </p>
            )}
          </div>

          {/* Footer Actions: Timestamp, Edited Tag & Reply */}
          {!isDeleted && (
            <div className="flex items-center gap-2.5 mt-1 ml-2 text-[11px] text-slate-400 font-medium flex-wrap">
              <span className="flex items-center gap-1">
                <Clock size={11} /> {formatTime(comment.createdAt)}
              </span>

              {/* Tag Đã chỉnh sửa kèm thời gian */}
              {(comment.isEdited || comment.editedAt) && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-slate-500 italic bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs transition-colors"
                  title={`Đã chỉnh sửa lúc ${formatTime(comment.editedAt || comment.updatedAt)}`}
                >
                  <Edit2 size={10} className="text-slate-400" />
                  <span>Đã chỉnh sửa lúc {formatTime(comment.editedAt || comment.updatedAt)}</span>
                </span>
              )}

              {/* Reply Button (Only on top-level comments to enforce 2-tier limit) */}
              {!isReply && (
                <button
                  type="button"
                  onClick={() => {
                    if (replyingTo?.id === comment.id) {
                      setReplyingTo(null);
                    } else {
                      setReplyingTo({
                        id: comment.id,
                        authorName: comment.user?.fullName || 'Khách hàng',
                      });
                      setReplyContent('');
                    }
                  }}
                  className="hover:text-red-600 font-semibold transition-colors flex items-center gap-1 cursor-pointer ml-1"
                >
                  <CornerDownRight size={11} /> Phản hồi
                </button>
              )}
            </div>
          )}

          {/* Inline Reply Input */}
          {!isReply && replyingTo?.id === comment.id && (
            <div className="mt-3 ml-2 flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder={`Phản hồi @${replyingTo.authorName}...`}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlePostReply(comment.id);
                    }
                  }}
                  className="w-full pl-3 pr-20 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => handlePostReply(comment.id)}
                  disabled={isSubmitting || !replyContent.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Send size={11} /> Gửi
                </button>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="px-2.5 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
            </div>
          )}

          {/* Render 2nd-Tier Nested Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="space-y-1">
              {comment.replies.map((reply) => renderCommentCard(reply, true))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-6" id="comments">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} className="text-red-600" />
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            Bình luận ({totalCount})
          </h3>
        </div>
      </div>

      {/* Top Comment Input Box */}
      <form onSubmit={handlePostComment} className="relative">
        <div className="flex gap-3 items-start">
          {/* Avatar of current logged-in user */}
          <div className="shrink-0 hidden sm:block">
            {(currentUser?.avatarUrl || currentUser?.avatar) ? (
              <img
                src={currentUser.avatarUrl || currentUser.avatar}
                alt={currentUser.fullName || 'User'}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                {(currentUser?.fullName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1">
            <textarea
              rows={3}
              placeholder={
                currentUser
                  ? `Bình luận dưới tên ${currentUser.fullName || 'bạn'}...`
                  : 'Chia sẻ suy nghĩ của bạn về bài viết này...'
              }
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 shadow-2xs transition-all resize-none placeholder-slate-400"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-slate-400">
                Hãy bình luận văn minh và tôn trọng cộng đồng
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !newComment.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-md hover:shadow-red-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Send size={14} />
                <span>{isSubmitting ? 'Đang gửi...' : 'Gửi bình luận'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      {isLoading ? (
        <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
          Đang tải bình luận...
        </div>
      ) : comments.length === 0 ? (
        <div className="py-10 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
          <MessageSquare size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">Chưa có bình luận nào</p>
          <p className="text-xs text-slate-400 mt-0.5">Hãy là người đầu tiên để lại ý kiến!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => renderCommentCard(c, false))}
        </div>
      )}
    </div>
  );
}
