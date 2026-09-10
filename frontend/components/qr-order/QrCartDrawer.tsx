'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  Send,
  Sparkles,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { QrCartItem, QrGuest } from './qr-types';
import toast from 'react-hot-toast';

interface QrCartDrawerProps {
  isOpen: boolean;
  token: string;
  guest: QrGuest;
  cartItems: QrCartItem[];
  availableProductIds?: Set<string>;
  onClose: () => void;
  onUpdateQuantity: (localId: string, quantity: number) => void;
  onRemoveItem: (localId: string) => void;
  onClearCart: () => void;
  onSubmitSuccess: () => void;
}

export const QrCartDrawer: React.FC<QrCartDrawerProps> = ({
  isOpen,
  token,
  guest,
  cartItems,
  availableProductIds,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSubmitSuccess,
}) => {
  if (!isOpen) return null;

  const [roundNote, setRoundNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for items not available at current branch or without QR channel
  const invalidItems = availableProductIds
    ? cartItems.filter((it) => !availableProductIds.has(it.productId))
    : [];

  // Group items by pricingMode
  const buffetItems = cartItems.filter((it) => it.pricingMode === 'BUFFET_INCLUDED');
  const retailItems = cartItems.filter((it) => it.pricingMode !== 'BUFFET_INCLUDED');

  const totalCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);
  const totalAmount = cartItems.reduce((sum, it) => sum + it.priceAtSale * it.quantity, 0);

  // Submit round with UUID idempotency
  const handleSubmitRound = async () => {
    if (cartItems.length === 0) return;

    if (invalidItems.length > 0) {
      toast.error('Vui lòng xóa các món không khả dụng tại chi nhánh trước khi gửi');
      return;
    }

    setIsSubmitting(true);
    // Generate secure UUID idempotency key
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `round-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const itemsPayload = cartItems.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        note: it.note || '',
        pricingMode: it.pricingMode,
        requestedPricingMode: it.pricingMode,
        selectedOptions: it.selectedOptions.map((o) => ({
          optionItemId: o.optionItemId,
          nameAtSale: o.nameAtSale,
          priceAdjustmentAtSale: o.priceAdjustmentAtSale,
        })),
      }));

      const res = await fetch(`/api/qr-order/${token}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrGuestId: guest.id,
          idempotencyKey,
          note: roundNote.trim() || undefined,
          items: itemsPayload,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Lỗi gửi món sang bếp');
      }

      toast.success('Đã gửi món thành công! Bếp đang chuẩn bị.');
      onClearCart();
      onClose();
      onSubmitSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi món lúc này');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer */}
      <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-250 pb-[env(safe-area-inset-bottom)] max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-slate-900">Giỏ hàng của bạn</h3>
            <span className="text-xs font-bold text-slate-400">({totalCount} món)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alert banner for invalid items */}
        {invalidItems.length > 0 && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-xs text-red-700 font-medium min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="truncate">
                Có <strong className="text-red-900">{invalidItems.length}</strong> món không khả dụng tại chi nhánh
              </span>
            </div>
            <button
              type="button"
              onClick={() => invalidItems.forEach((it) => onRemoveItem(it.localId))}
              className="text-[11px] bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer shrink-0"
            >
              Xóa món lỗi
            </button>
          </div>
        )}

        {/* Scrollable Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {cartItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <UtensilsCrossed className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold">Giỏ hàng đang trống</p>
            </div>
          ) : (
            <>
              {/* GROUP 1: TRONG GÓI BUFFET */}
              {buffetItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                      Trong gói Buffet (0đ)
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {buffetItems.map((item) => {
                      const isUnavailable = Boolean(
                        availableProductIds && !availableProductIds.has(item.productId)
                      );
                      return (
                        <CartItemRow
                          key={item.localId}
                          item={item}
                          isUnavailable={isUnavailable}
                          onUpdateQuantity={onUpdateQuantity}
                          onRemoveItem={onRemoveItem}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GROUP 2: MÓN GỌI THÊM / MANG VỀ */}
              {retailItems.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="w-2 h-2 rounded-full bg-[#da251d]" />
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Món gọi thêm / Mang về
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {retailItems.map((item) => {
                      const isUnavailable = Boolean(
                        availableProductIds && !availableProductIds.has(item.productId)
                      );
                      return (
                        <CartItemRow
                          key={item.localId}
                          item={item}
                          isUnavailable={isUnavailable}
                          onUpdateQuantity={onUpdateQuantity}
                          onRemoveItem={onRemoveItem}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Round Note */}
              <div className="pt-2">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wide block mb-1.5">
                  Ghi chú cho lượt gọi này
                </label>
                <input
                  type="text"
                  value={roundNote}
                  onChange={(e) => setRoundNote(e.target.value)}
                  placeholder="Ví dụ: Cho lên cùng lúc, mang đá lạnh trước..."
                  className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none transition-all"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer & Submit Action */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-white space-y-3 shrink-0">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Tổng cộng lượt gọi này:
              </span>
              <span className="text-base font-black text-[#da251d] font-mono">
                {totalAmount.toLocaleString('vi-VN')}đ
              </span>
            </div>

            <button
              type="button"
              onClick={handleSubmitRound}
              disabled={isSubmitting || invalidItems.length > 0}
              className="w-full h-13 rounded-2xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'ĐANG GỬI MÓN...'
                  : invalidItems.length > 0
                  ? 'VUI LÒNG XÓA MÓN LỖI ĐỂ GỬI BẾP'
                  : 'GỬI MÓN SANG BẾP'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface CartItemRowProps {
  item: QrCartItem;
  isUnavailable?: boolean;
  onUpdateQuantity: (localId: string, quantity: number) => void;
  onRemoveItem: (localId: string) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  isUnavailable,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  const lineTotal = item.priceAtSale * item.quantity;
  const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';

  return (
    <div
      className={`p-3 rounded-2xl flex items-center justify-between gap-3 transition-all ${
        isUnavailable
          ? 'bg-red-50/60 border-2 border-red-300'
          : 'bg-slate-50 border border-slate-200/80'
      }`}
    >
      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h5
            className={`text-xs font-black truncate ${
              isUnavailable ? 'text-red-900 line-through' : 'text-slate-900'
            }`}
          >
            {item.productName}
          </h5>
          {isUnavailable && (
            <span className="text-[9px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.5 rounded border border-red-300">
              Không có tại chi nhánh
            </span>
          )}
          {isBuffet && (
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded border border-emerald-300">
              Buffet
            </span>
          )}
        </div>

        {/* Selected options snapshot */}
        {item.selectedOptions && item.selectedOptions.length > 0 && (
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {item.selectedOptions.map((o) => o.nameAtSale).join(', ')}
          </p>
        )}

        {/* Item Note */}
        {item.note && <p className="text-[10px] text-amber-800 italic mt-0.5">"{item.note}"</p>}

        <div className="mt-1 font-mono text-xs">
          {isBuffet ? (
            <span className="font-black text-emerald-600">
              {item.priceAtSale > 0 ? `${item.priceAtSale.toLocaleString('vi-VN')}đ (Phụ thu)` : '0đ'}
            </span>
          ) : (
            <span className="font-black text-slate-900">
              {lineTotal.toLocaleString('vi-VN')}đ
            </span>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center border border-slate-200 rounded-xl bg-white p-0.5 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            if (item.quantity <= 1) {
              onRemoveItem(item.localId);
            } else {
              onUpdateQuantity(item.localId, item.quantity - 1);
            }
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer"
        >
          {item.quantity <= 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-500" /> : <Minus className="w-3 h-3" />}
        </button>

        <span className="w-7 text-center font-black text-xs text-slate-900 font-mono">
          {item.quantity}
        </span>

        <button
          type="button"
          onClick={() => onUpdateQuantity(item.localId, item.quantity + 1)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
