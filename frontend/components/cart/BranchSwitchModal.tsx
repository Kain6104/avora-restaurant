'use client';

import React from 'react';
import { AlertTriangle, Store, X, ArrowRight, Trash2, CheckCircle2 } from 'lucide-react';

interface BranchSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBranch: {
    id: string;
    name: string;
    street?: string;
    district?: string;
    province?: string;
  } | null;
  unavailableItems: Array<{
    id: string;
    name: string;
    image?: string;
    priceAtSale?: number;
    reason?: string;
  }>;
  onConfirmKeep: () => void;
  onConfirmRemove: () => void;
}

export default function BranchSwitchModal({
  isOpen,
  onClose,
  targetBranch,
  unavailableItems,
  onConfirmKeep,
  onConfirmRemove,
}: BranchSwitchModalProps) {
  if (!isOpen || !targetBranch) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
                Xác nhận chuyển đổi chi nhánh
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chuyển sang: <span className="font-semibold text-slate-800">{targetBranch.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Giỏ hàng của bạn đang có <strong className="text-rose-600">{unavailableItems.length} món</strong> không phục vụ hoặc tạm hết hàng tại chi nhánh <strong>{targetBranch.name}</strong>:
          </p>

          {/* List of unavailable items */}
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 max-h-56 overflow-y-auto">
            {unavailableItems.map((item) => (
              <div key={item.id} className="p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Món</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-slate-800 truncate">{item.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-rose-600 font-semibold">
                      {(item.priceAtSale || 0).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-medium">
                      {item.reason || 'Không phục vụ tại chi nhánh này'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 italic">
            Quý khách muốn giữ lại các món này trong giỏ (sẽ bị vô hiệu hóa khi đặt hàng tại chi nhánh mới) hay loại bỏ chúng khỏi giỏ hàng?
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="sm:order-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Hủy bỏ, giữ chi nhánh cũ
          </button>
          <button
            type="button"
            onClick={onConfirmKeep}
            className="sm:order-2 flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Giữ lại món (tạm vô hiệu hóa)</span>
          </button>
          <button
            type="button"
            onClick={onConfirmRemove}
            className="sm:order-3 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Xóa món hết & Đổi</span>
          </button>
        </div>
      </div>
    </div>
  );
}

