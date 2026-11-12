'use client';

import React, { useState } from 'react';
import { Users, Check, Utensils, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface OpenTableSheetProps {
  table: any;
  onClose: () => void;
  onConfirm: (guestCount: number) => Promise<void>;
}

export default function OpenTableSheet({ table, onClose, onConfirm }: OpenTableSheetProps) {
  const reservation = table?.reservation || null;
  const initialGuests = reservation?.partySize || table?.capacity || 2;
  const [guestCount, setGuestCount] = useState<number>(initialGuests);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(guestCount);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Không thể mở bàn');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveModal
      isOpen={Boolean(table)}
      onClose={onClose}
      title={`Mở bàn ${table?.name || table?.tableCode}`}
      subtitle={`Sức chứa tiêu chuẩn: ${table?.capacity || 2} khách`}
      icon={<Users size={18} className="text-[#DA251D]" />}
      maxWidth="sm"
      footer={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-2xl bg-[#DA251D] hover:bg-[#b81d16] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-red-500/25 disabled:opacity-70 cursor-pointer"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check size={18} strokeWidth={2.5} />
              <span>Xác nhận mở bàn ({guestCount} khách)</span>
            </>
          )}
        </button>
      }
    >
      <div className="py-2 space-y-4">
        {/* Reservation Banner if this table is reserved */}
        {reservation && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                {reservation.customerName}
              </span>
              <span className="font-mono text-red-600">{reservation.reservationCode}</span>
            </div>
            <div className="text-[11px] text-amber-700 mt-1">
              Lịch hẹn: <strong>{reservation.partySize} khách</strong>
              {reservation.startAt ? ` lúc ${new Date(reservation.startAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </div>

            {Array.isArray(reservation.preOrderedItems) && reservation.preOrderedItems.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200">
                <div className="flex items-center justify-between font-bold text-red-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Utensils className="w-3.5 h-3.5" />
                    Món đặt trước ({reservation.preOrderedItems.length} món):
                  </span>
                  <span className="font-mono font-extrabold">
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(reservation.preOrderTotal || 0)}
                  </span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto text-[10.5px] bg-white/80 p-2 rounded-xl border border-amber-100">
                  {reservation.preOrderedItems.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span className="truncate max-w-[170px]">{item.name} x{item.quantity}</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.lineTotal || (item.price * item.quantity))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-center">
          <p className="text-xs font-bold text-slate-500 mb-2">Số lượng khách vào bàn</p>
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
              className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-90 text-2xl font-black text-slate-700 flex items-center justify-center transition-all cursor-pointer"
            >
              -
            </button>
            <div className="w-16 text-center font-black text-4xl text-slate-900 font-mono">
              {guestCount}
            </div>
            <button
              type="button"
              onClick={() => setGuestCount(guestCount + 1)}
              className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-90 text-2xl font-black text-slate-700 flex items-center justify-center transition-all cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
