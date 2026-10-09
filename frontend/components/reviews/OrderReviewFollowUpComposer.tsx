'use strict';
'use client';

import React, { useState } from 'react';
import { Send, Plus, Loader2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import ReviewMediaUploader, { UploadedMediaItem } from './ReviewMediaUploader';

interface OrderReviewFollowUpComposerProps {
  orderReviewId: string;
  daysRemaining: number;
  onSuccess: (newFollowUp: any) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const OrderReviewFollowUpComposer: React.FC<OrderReviewFollowUpComposerProps> = ({
  orderReviewId,
  daysRemaining,
  onSuccess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState('');
  const [mediaList, setMediaList] = useState<UploadedMediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (daysRemaining <= 0) {
    return (
      <div className="p-2.5 bg-slate-100 rounded-xl text-xs text-slate-500 text-center">
        Thời hạn 14 ngày để gửi phản hồi bổ sung cho đơn hàng này đã kết thúc.
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full py-2.5 px-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 text-amber-800 text-xs font-semibold hover:bg-amber-100/60 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
      >
        <Plus className="w-3.5 h-3.5 text-amber-600" />
        <span>Gửi thêm phản hồi bổ sung (Còn {daysRemaining} ngày)</span>
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (content.trim().length < 2) {
      toast.error('Nội dung phản hồi bổ sung tối thiểu 2 ký tự');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Vui lòng đăng nhập');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/order-reviews/${orderReviewId}/follow-ups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: content.trim(),
          mediaIds: mediaList.map((m) => m.id),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || 'Không thể gửi phản hồi');
      }

      toast.success('Gửi phản hồi bổ sung thành công!');
      setContent('');
      setMediaList([]);
      setIsOpen(false);
      onSuccess(data.data);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi gửi phản hồi bổ sung');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3.5 sm:p-4 rounded-xl bg-white border border-amber-200/80 shadow-xs space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-2">
          <span>Gửi phản hồi bổ sung</span>
          <span className="text-[11px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            Hạn còn {daysRemaining} ngày
          </span>
        </h4>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs text-neutral-400 hover:text-neutral-600"
        >
          Đóng
        </button>
      </div>

      <div className="flex items-start gap-2 p-2 bg-amber-50/50 border border-amber-100 rounded-lg text-[11px] sm:text-xs text-amber-800">
        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <span>
          Phản hồi bổ sung là dạng thêm mới theo dòng thời gian (không ghi đè đánh giá ban đầu và không nhận thêm điểm thưởng).
        </span>
      </div>

      <textarea
        rows={2}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Chia sẻ thêm thông tin hoặc cập nhật trải nghiệm sau khi dùng bữa..."
        maxLength={1000}
        className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-neutral-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y placeholder:text-neutral-400"
        required
      />

      <ReviewMediaUploader
        mediaList={mediaList}
        onMediaChange={setMediaList}
        maxFiles={5}
        disabled={isSubmitting}
      />

      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Gửi phản hồi</span>
        </button>
      </div>
    </form>
  );
};

export default OrderReviewFollowUpComposer;
