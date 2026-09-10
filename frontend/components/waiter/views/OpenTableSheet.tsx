'use client';

import React, { useState } from 'react';
import { X, Users, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface OpenTableSheetProps {
  table: any;
  onClose: () => void;
  onConfirm: (guestCount: number) => Promise<void>;
}

export default function OpenTableSheet({ table, onClose, onConfirm }: OpenTableSheetProps) {
  const [guestCount, setGuestCount] = useState<number>(2);
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />
      
      {/* Sheet Content */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">Mở bàn {table?.name}</h3>
              <p className="text-xs text-slate-500 font-medium">Sức chứa: {table?.capacity} khách</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center active:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <label className="block text-sm font-bold text-slate-700 mb-4 text-center">
            Vui lòng chọn số lượng khách
          </label>
          
          <div className="flex items-center justify-center gap-6 mb-8">
            <button 
              onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
              className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-black text-slate-600 active:scale-90 active:bg-slate-200 transition-all"
            >
              -
            </button>
            <div className="w-20 text-center font-black text-5xl text-slate-800">
              {guestCount}
            </div>
            <button 
              onClick={() => setGuestCount(guestCount + 1)}
              className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-black text-slate-600 active:scale-90 active:bg-slate-200 transition-all"
            >
              +
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full h-14 rounded-xl bg-[#DA251D] text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_4px_14px_rgba(218,37,29,0.3)] disabled:opacity-70 disabled:active:scale-100"
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check size={24} />
                Xác nhận mở bàn
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
