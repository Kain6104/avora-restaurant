'use client';

import React from 'react';
import { X, ShieldCheck, Calendar, Store, FileText, Sparkles, AlertCircle } from 'lucide-react';

export interface VoucherDetail {
  code: string;
  title: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscount?: number | null;
  minOrderValue?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  applicableScope?: string;
  costFarmCoin?: number;
  costLoyaltyPoints?: number;
}

interface VoucherTermsModalProps {
  voucher: VoucherDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VoucherTermsModal({ voucher, isOpen, onClose }: VoucherTermsModalProps) {
  if (!isOpen || !voucher) return null;

  const formatDate = (dateVal?: string | Date) => {
    if (!dateVal) return 'Không thời hạn';
    try {
      return new Date(dateVal).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return String(dateVal);
    }
  };

  const discountDisplay =
    voucher.discountType === 'PERCENTAGE'
      ? `Giảm ${voucher.discountValue}% (Tối đa ${(voucher.maxDiscount || 0).toLocaleString('vi-VN')}đ)`
      : voucher.discountType === 'FREE_SHIP'
      ? `Miễn phí vận chuyển (Tối đa ${(voucher.discountValue || 30000).toLocaleString('vi-VN')}đ)`
      : `Giảm ${(voucher.discountValue || 20000).toLocaleString('vi-VN')}đ`;

  const scopeDisplay =
    voucher.applicableScope === 'POS'
      ? 'Chỉ áp dụng dùng bữa tại nhà hàng (Quầy POS)'
      : voucher.applicableScope === 'ONLINE'
      ? 'Chỉ áp dụng đặt món giao hàng trực tuyến (Online Delivery)'
      : 'Áp dụng toàn hệ thống (Dùng tại quầy POS & Đặt món online)';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#fffdfa] rounded-2xl sm:rounded-3xl border-2 border-[#d4af37] shadow-[0_20px_50px_rgba(40,25,10,0.5)] overflow-hidden flex flex-col max-h-[92vh] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3e210b] via-[#653a12] to-[#3e210b] px-4 py-3 text-white flex items-center justify-between border-b border-[#d4af37]/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-black text-sm sm:text-base text-amber-200 tracking-wide">
                ĐIỀU KIỆN ÁP DỤNG VOUCHER
              </h3>
              <p className="text-[10px] text-amber-300/70 font-mono">MÃ: {voucher.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1 space-y-3.5 text-[#3e2723] text-xs">
          {/* Voucher highlight box */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#fff8e7] to-[#faebd2] border border-[#e0c598] shadow-inner">
            <h4 className="font-serif font-black text-sm text-[#4a2e18] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{voucher.title}</span>
            </h4>
            {voucher.description && (
              <p className="text-[11px] text-[#795548] mt-1 leading-relaxed">
                {voucher.description}
              </p>
            )}
          </div>

          {/* Key Conditions Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#ebd8be] flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Mức giảm</p>
                <p className="font-black text-rose-700 text-xs mt-0.5">{discountDisplay}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#ebd8be] flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Đơn tối thiểu</p>
                <p className="font-black text-emerald-800 text-xs mt-0.5">
                  {(voucher.minOrderValue || 0).toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#ebd8be] flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <Store className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Phạm vi sử dụng</p>
                <p className="font-bold text-[#4a2e18] text-[11px] mt-0.5">{scopeDisplay}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#fdfbf7] border border-[#ebd8be] flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Thời hạn hiệu lực</p>
                <p className="font-bold text-[#4a2e18] text-[11px] mt-0.5">
                  Đến {formatDate(voucher.endDate)}
                </p>
              </div>
            </div>
          </div>

          {/* Rules & Policy */}
          <div className="p-3 rounded-xl bg-[#f7f2ea] border border-[#e5d8c6] space-y-1.5 text-[11px] text-[#5d4037]">
            <p className="font-bold flex items-center gap-1 text-[#3e2723]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Quy định sử dụng:</span>
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[10.5px] leading-relaxed">
              <li>Mỗi hóa đơn thanh toán chỉ được áp dụng tối đa 01 voucher.</li>
              <li>Voucher được lưu trực tiếp vào ví tài khoản và có thể dùng quét mã tại quầy thu ngân AVORA hoặc chọn tại bước thanh toán online.</li>
              <li>Voucher không có giá trị quy đổi thành tiền mặt hoặc hoàn lại tiền thừa.</li>
              <li>Không áp dụng đồng thời với một số chương trình đại tiệc buffet khuyến mãi đặc biệt khác (nếu có thông báo riêng).</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f5ede0] border-t border-[#e5d8c6] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
