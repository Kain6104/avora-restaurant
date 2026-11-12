'use client';

import React, { useState } from 'react';
import { Utensils, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface KitchenNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  initialNote?: string;
  onSuccess?: (newNote: string) => void;
}

const QUICK_KITCHEN_NOTES = [
  'Làm ít cay / Không cay',
  'Không hành, không ngò',
  'Làm món nhanh giúp khách',
  'Mang lên cùng một lúc',
  'Ít đá / Không đường',
  'Khách ăn chay / Dị ứng hải sản',
];

export default function KitchenNoteModal({
  isOpen,
  onClose,
  orderId,
  initialNote = '',
  onSuccess,
}: KitchenNoteModalProps) {
  const [note, setNote] = useState(initialNote);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddQuickNote = (quickText: string) => {
    setNote((prev) => (prev ? `${prev}, ${quickText}` : quickText));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã cập nhật ghi chú bếp!');
        onSuccess?.(note.trim());
        onClose();
      } else {
        toast.error(data.message || 'Lỗi cập nhật ghi chú');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ghi chú Bếp / Pha chế"
      subtitle="Yêu cầu chế biến đặc biệt cho toàn bộ đơn hàng"
      icon={<Utensils size={18} className="text-[#DA251D]" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Check size={14} />
            <span>{isSubmitting ? 'Đang lưu...' : 'Lưu ghi chú'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 py-1">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Nội dung ghi chú
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập yêu cầu đặc biệt của khách cho bếp / quầy bar..."
            rows={3}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:border-[#DA251D] focus:ring-1 focus:ring-[#DA251D] outline-none transition-all resize-none shadow-2xs"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Gợi ý nhanh (chạm để thêm)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_KITCHEN_NOTES.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAddQuickNote(q)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] active:scale-95 text-slate-700 rounded-lg text-[11px] font-medium transition-all border border-slate-200/70 cursor-pointer"
              >
                + {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
