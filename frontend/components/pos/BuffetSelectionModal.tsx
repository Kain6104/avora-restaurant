"use client";

import React from 'react';
import { X, Sparkles, ShoppingBag, Utensils } from 'lucide-react';
import { PosProduct } from './pos-types';

export interface BuffetSelectionModalProps {
  isOpen?: boolean;
  product: PosProduct | any;
  packageName?: string;
  onSelectBuffet?: () => void;
  onSelectRetail?: () => void;
  onSelectMode?: (mode: 'BUFFET_INCLUDED' | 'REGULAR') => void;
  onClose: () => void;
}

export const BuffetSelectionModal: React.FC<BuffetSelectionModalProps> = ({
  isOpen = true,
  product,
  packageName = 'Gói Buffet',
  onSelectBuffet,
  onSelectRetail,
  onSelectMode,
  onClose,
}) => {
  if (isOpen === false || !product) return null;
  const retailPrice = product.effectivePrice || product.price || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50/50 border-b border-red-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#da251d] text-white flex items-center justify-center shadow-xs">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Hình thức gọi món</h3>
              <p className="text-[11px] text-slate-500 font-medium">Bàn đang sử dụng gói: <span className="text-[#da251d] font-bold">{packageName}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-white/80 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Info */}
        <div className="p-6 text-center border-b border-slate-100 bg-slate-50/50">
          <div className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold mb-2">
            Món ăn nằm trong gói Buffet
          </div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            {product.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Vui lòng xác nhận hình thức thêm món cho khách hàng:
          </p>
        </div>

        {/* 2 Choice Cards */}
        <div className="p-6 space-y-3.5">
          {/* Choice 1: Trong gói Buffet */}
          <button
            type="button"
            onClick={() => {
              onSelectBuffet?.();
              onSelectMode?.('BUFFET_INCLUDED');
            }}
            className="w-full text-left p-4.5 rounded-2xl border-2 border-red-200 hover:border-[#da251d] bg-red-50/30 hover:bg-red-50/60 transition-all cursor-pointer group flex items-start justify-between gap-3 shadow-xs hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-[#da251d] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 group-hover:text-[#da251d] transition-colors">
                    TRONG GÓI BUFFET
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-red-100 text-[#da251d] text-[10px] font-extrabold uppercase">
                    Ưu đãi 0đ
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  Dùng tại chỗ theo gói {packageName}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black text-[#da251d]">0đ</span>
            </div>
          </button>

          {/* Choice 2: Món lẻ */}
          <button
            type="button"
            onClick={() => {
              onSelectRetail?.();
              onSelectMode?.('REGULAR');
            }}
            className="w-full text-left p-4.5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50 transition-all cursor-pointer group flex items-start justify-between gap-3 shadow-xs hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 group-hover:text-slate-900 transition-colors">
                    MÓN LẺ (TÍNH TIỀN)
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  Tính tiền theo giá bán hiện tại (mua thêm / mang về)
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base font-black text-slate-800">
                {retailPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
};
