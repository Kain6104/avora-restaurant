'use client';

import React, { useState } from 'react';
import { Bell, GlassWater, Utensils, HelpCircle, Send } from 'lucide-react';
import { QrBottomSheet } from './QrBottomSheet';
import toast from 'react-hot-toast';

interface QrCallStaffModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const QUICK_REASONS = [
  { id: 'water', label: 'Thêm nước lọc / đá lạnh', icon: GlassWater },
  { id: 'utensils', label: 'Thêm chén dĩa / khăn ướt', icon: Utensils },
  { id: 'assistance', label: 'Cần nhân viên tư vấn món', icon: HelpCircle },
  { id: 'other', label: 'Yêu cầu hỗ trợ khác', icon: Bell },
];

export const QrCallStaffModal: React.FC<QrCallStaffModalProps> = ({
  isOpen,
  token,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState(QUICK_REASONS[0].label);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    // 1. Kiểm tra mạng
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Không thể gửi yêu cầu, vui lòng thử lại hoặc gọi trực tiếp phục vụ');
      return;
    }

    // 2. Chống spam Cooldown 15 giây
    const COOLDOWN_MS = 15000;
    const lastSentTime = Number(
      (typeof window !== 'undefined' && localStorage.getItem('avora_qr_last_call_staff_time')) || 0
    );
    const elapsed = Date.now() - lastSentTime;
    if (elapsed < COOLDOWN_MS) {
      toast('Bạn vừa gửi yêu cầu, vui lòng đợi 15 giây', { icon: '⏳' });
      return;
    }

    setIsSubmitting(true);
    const finalNote = customNote.trim()
      ? `${selectedReason}: ${customNote.trim()}`
      : selectedReason;

    try {
      const deviceSessionId =
        (typeof window !== 'undefined' && localStorage.getItem('avora_qr_device_id')) ||
        'guest-device';

      const res = await fetch(`/api/qr-order/${token}/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'CALL_STAFF',
          deviceSessionId,
          note: finalNote,
        }),
      });

      if (res.status === 401 || res.status === 404) {
        toast.error('Phiên gọi món đã kết thúc');
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gửi yêu cầu');
      }

      if (data.isDuplicate) {
        toast('Đang có yêu cầu chờ phục vụ tiếp nhận, vui lòng đợi trong giây lát', { icon: '⏳' });
        onClose();
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('avora_qr_last_call_staff_time', Date.now().toString());
      }

      toast.success('Yêu cầu đã được gửi tới phục vụ');
      setCustomNote('');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      toast.error('Không thể gửi yêu cầu, vui lòng thử lại hoặc gọi trực tiếp phục vụ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <QrBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Gọi nhân viên hỗ trợ"
      subtitle="Nhân viên sẽ đến bàn trong giây lát"
      headerIcon={<Bell className="w-4 h-4" />}
      footer={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu ngay'}</span>
        </button>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          {QUICK_REASONS.map((item) => {
            const isSelected = selectedReason === item.label;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedReason(item.label)}
                className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-red-50/70 border-[#DA251D] text-slate-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isSelected ? 'text-[#DA251D]' : 'text-slate-400'
                  }`}
                />
                <span className="text-xs font-semibold flex-1">{item.label}</span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-[#DA251D] border-[#DA251D]' : 'border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            Ghi chú thêm (Tùy chọn)
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Ví dụ: Mang giúp 2 ly đá..."
            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none transition-all"
          />
        </div>
      </div>
    </QrBottomSheet>
  );
};
