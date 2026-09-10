'use client';

import React, { useState } from 'react';
import { X, Bell, GlassWater, Utensils, HelpCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface QrCallStaffModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
}

const QUICK_REASONS = [
  { id: 'water', label: 'Thêm nước lọc / đá lạnh', icon: GlassWater },
  { id: 'utensils', label: 'Thêm chén dĩa / khăn ướt', icon: Utensils },
  { id: 'assistance', label: 'Cần nhân viên tư vấn món', icon: HelpCircle },
  { id: 'other', label: 'Yêu cầu khác', icon: Bell },
];

export const QrCallStaffModal: React.FC<QrCallStaffModalProps> = ({
  isOpen,
  token,
  onClose,
}) => {
  if (!isOpen) return null;

  const [selectedReason, setSelectedReason] = useState(QUICK_REASONS[0].label);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const finalNote = customNote.trim()
      ? `${selectedReason}: ${customNote.trim()}`
      : selectedReason;

    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) || 'guest-device';

      const res = await fetch(`/api/qr-order/${token}/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'CALL_STAFF',
          deviceSessionId,
          note: finalNote,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gửi yêu cầu');
      }

      toast.success('Đã gửi yêu cầu tới nhân viên phục vụ!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi yêu cầu phục vụ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl my-auto space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Gọi nhân viên</h3>
              <p className="text-[11px] text-slate-400">Nhân viên sẽ đến bàn ngay</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Reasons */}
        <div className="space-y-2">
          {QUICK_REASONS.map((item) => {
            const isSelected = selectedReason === item.label;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedReason(item.label)}
                className={`w-full p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-50/70 border-amber-400 text-slate-900 ring-1 ring-amber-400/30'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom note */}
        <div>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Thêm ghi chú chi tiết nếu cần..."
            className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:bg-white text-xs outline-none transition-all"
          />
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'ĐANG GỬI...' : 'GỬI YÊU CẦU ĐẾN PHỤC VỤ'}</span>
        </button>
      </div>
    </div>
  );
};
