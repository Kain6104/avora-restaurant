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
  isDarkMode?: boolean;
}

export const BuffetSelectionModal: React.FC<BuffetSelectionModalProps> = ({
  isOpen = true,
  product,
  packageName = 'Gói Buffet',
  onSelectBuffet,
  onSelectRetail,
  onSelectMode,
  onClose,
  isDarkMode = false,
}) => {
  if (isOpen === false || !product) return null;
  const retailPrice = product.effectivePrice || product.price || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className={`rounded-t-3xl sm:rounded-3xl shadow-2xl border w-full max-w-md overflow-hidden animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-gradient-to-r from-red-50 to-orange-50/50 border-red-100'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#da251d] text-white flex items-center justify-center shadow-xs">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Hình thức gọi món</h3>
              <p className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Bàn đang sử dụng gói: <span className="text-[#da251d] font-bold">{packageName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-white/80'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Info */}
        <div className={`p-6 text-center border-b ${
          isDarkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50/50 border-slate-100'
        }`}>
          <div className={`inline-block px-3 py-1 rounded-full text-[11px] font-bold mb-2 ${
            isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}>
            Món ăn nằm trong gói Buffet
          </div>
          <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            {product.name}
          </h2>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
            className={`w-full text-left p-4.5 rounded-2xl border-2 transition-all cursor-pointer group flex items-start justify-between gap-3 shadow-xs hover:shadow-md ${
              isDarkMode
                ? 'border-red-900/60 bg-red-950/30 hover:bg-red-950/50 hover:border-red-600'
                : 'border-red-200 hover:border-[#da251d] bg-red-50/30 hover:bg-red-50/60'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                isDarkMode ? 'bg-red-900/50 text-red-300' : 'bg-red-100 text-[#da251d]'
              }`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black transition-colors ${
                    isDarkMode ? 'text-white group-hover:text-red-400' : 'text-slate-900 group-hover:text-[#da251d]'
                  }`}>
                    TRONG GÓI BUFFET
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    isDarkMode ? 'bg-red-900/60 text-red-300' : 'bg-red-100 text-[#da251d]'
                  }`}>
                    Ưu đãi 0đ
                  </span>
                </div>
                <div className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
            className={`w-full text-left p-4.5 rounded-2xl border-2 transition-all cursor-pointer group flex items-start justify-between gap-3 shadow-xs hover:shadow-md ${
              isDarkMode
                ? 'border-slate-800 bg-slate-800/60 hover:bg-slate-800 hover:border-slate-700'
                : 'border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-black transition-colors ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}>
                    MÓN LẺ (TÍNH TIỀN)
                  </span>
                </div>
                <div className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Tính tiền theo giá bán hiện tại (mua thêm / mang về)
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-base font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                {retailPrice.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className={`px-6 py-3.5 border-t flex justify-end ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
};
