'use client';

import React, { useState } from 'react';
import { X, Utensils, Check } from 'lucide-react';
import toast from 'react-hot-toast';

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

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2 text-[#DA251D]">
            <Utensils size={20} />
            <h3 className="font-bold text-base text-slate-800">Ghi chú Bếp / Pha chế</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Ghi chú cho đơn hàng
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập yêu cầu đặc biệt của khách cho bếp / quầy bar..."
              rows={3}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-[#DA251D] focus:ring-2 focus:ring-[#DA251D]/20 outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Gợi ý nhanh
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_KITCHEN_NOTES.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddQuickNote(q)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-[#DA251D] active:bg-red-100 text-slate-700 rounded-lg text-xs font-medium transition-colors border border-slate-200/60"
                >
                  + {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 active:scale-95 transition-all"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-sm font-semibold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Check size={16} />
            {isSubmitting ? 'Đang lưu...' : 'Lưu ghi chú'}
          </button>
        </div>
      </div>
    </div>
  );
}
