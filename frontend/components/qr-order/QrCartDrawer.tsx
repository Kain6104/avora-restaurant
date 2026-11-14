'use client';

import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  UtensilsCrossed,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { QrBottomSheet } from './QrBottomSheet';
import { QrCartItem, QrGuest, QrProduct } from './qr-types';
import toast from 'react-hot-toast';

interface QrCartDrawerProps {
  token: string;
  tableName?: string;
  guest: QrGuest;
  cartItems: QrCartItem[];
  availableProductIds?: Set<string> | null;
  productCatalog?: Record<string, QrProduct>;
  hasActiveBuffet?: boolean;
  maxItemsPerSubmission?: number | null;
  onClose: () => void;
  onUpdateQuantity: (localId: string, quantity: number) => void;
  onRemoveItem: (localId: string) => void;
  onEditItem?: (item: QrCartItem) => void;
  onClearCart: () => void;
  onSubmitSuccess: () => void;
}

export const QrCartDrawer: React.FC<QrCartDrawerProps> = ({
  token,
  tableName,
  guest,
  cartItems,
  availableProductIds,
  productCatalog,
  hasActiveBuffet = false,
  maxItemsPerSubmission = null,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
  onClearCart,
  onSubmitSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidItems = useMemo(() => {
    if (!availableProductIds || availableProductIds.size === 0) return [];
    return cartItems.filter((item) => !availableProductIds.has(item.productId));
  }, [cartItems, availableProductIds]);

  const buffetItems = cartItems.filter((i) => i.pricingMode === 'BUFFET_INCLUDED');
  const retailItems = cartItems.filter((i) => i.pricingMode === 'REGULAR');

  const totalCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = cartItems.reduce((sum, i) => sum + i.priceAtSale * i.quantity, 0);

  const hasPerSubmissionLimit =
    hasActiveBuffet &&
    typeof maxItemsPerSubmission === 'number' &&
    maxItemsPerSubmission > 0;
  const isOverBuffetLimit =
    hasPerSubmissionLimit && totalCount > (maxItemsPerSubmission as number);

  // Per-dish limit validation (round cap + cumulative total cap)
  const dishLimitViolations = useMemo(() => {
    if (!hasActiveBuffet || !productCatalog) return [];
    const byProd = new Map<string, { name: string; qty: number }>();
    for (const item of buffetItems) {
      const cur = byProd.get(item.productId) || { name: item.productName, qty: 0 };
      cur.qty += item.quantity;
      byProd.set(item.productId, cur);
    }

    const errors: string[] = [];
    byProd.forEach(({ name, qty }, productId) => {
      const prod = productCatalog[productId];
      if (!prod) return;
      if (
        typeof prod.maxQuantityPerRound === 'number' &&
        prod.maxQuantityPerRound > 0 &&
        qty > prod.maxQuantityPerRound
      ) {
        errors.push(
          `Món "${name}" chỉ được gọi tối đa ${prod.maxQuantityPerRound} phần/lần (đang chọn ${qty}).`
        );
      }
      if (typeof prod.maxTotalQuantity === 'number' && prod.maxTotalQuantity > 0) {
        const used = prod.usedTotalQuantity || 0;
        const remaining = Math.max(0, prod.maxTotalQuantity - used);
        if (qty > remaining) {
          errors.push(
            remaining === 0
              ? `Món "${name}" đã hết lượt gọi trong bữa (${used}/${prod.maxTotalQuantity}).`
              : `Món "${name}" chỉ còn gọi được ${remaining}/${prod.maxTotalQuantity} phần trong bữa (đang chọn ${qty}).`
          );
        }
      }
    });
    return errors;
  }, [hasActiveBuffet, productCatalog, buffetItems]);

  const hasDishLimitViolation = dishLimitViolations.length > 0;

  const handleSubmitRound = async () => {
    if (cartItems.length === 0) return;

    if (invalidItems.length > 0) {
      toast.error(
        `Có ${invalidItems.length} món không thuộc thực đơn chi nhánh. Vui lòng xóa trước khi gửi.`
      );
      return;
    }

    if (isOverBuffetLimit) {
      toast.error(
        `Bạn đang chọn ${totalCount} món, vượt quá giới hạn ${maxItemsPerSubmission} món cho mỗi lần gọi. Vui lòng điều chỉnh số lượng trước khi gửi.`
      );
      return;
    }

    if (hasDishLimitViolation) {
      toast.error(dishLimitViolations[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `round_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const payload = {
        qrGuestId: guest.id,
        idempotencyKey,
        items: cartItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          pricingMode: i.pricingMode,
          note: i.note,
          selectedOptions:
            i.selectedOptions.length > 0
              ? i.selectedOptions.map((opt) => ({ optionItemId: opt.optionItemId }))
              : undefined,
        })),
      };

      const res = await fetch(`/api/qr-order/${token}/rounds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Lỗi gửi món sang bếp');
      }

      toast.success('Đã gửi món thành công. Bếp đang chuẩn bị.');
      onClearCart();
      onSubmitSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Không thể gửi món lúc này');
    } finally {
      setIsSubmitting(false);
    }
  };

  const footerNode =
    cartItems.length > 0 ? (
      <div className="space-y-2.5">
        {hasPerSubmissionLimit && (
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Giới hạn mỗi lần gửi</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-md border ${
                isOverBuffetLimit
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              Đang chọn: {totalCount} / {maxItemsPerSubmission} món
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Tổng lượt gọi ({totalCount} món)
          </span>
          <span className="text-base font-bold text-[#DA251D] font-mono whitespace-nowrap">
            {totalAmount.toLocaleString('vi-VN')}đ
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmitRound}
          disabled={isSubmitting || invalidItems.length > 0 || isOverBuffetLimit || hasDishLimitViolation}
          className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {invalidItems.length > 0
              ? 'Vui lòng xóa món không khả dụng'
              : isOverBuffetLimit
                ? `Vượt quá ${maxItemsPerSubmission} món / lần gọi`
                : hasDishLimitViolation
                  ? 'Điều chỉnh số lượng món vượt giới hạn'
                  : isSubmitting
                    ? 'Đang gửi bếp...'
                    : 'Xác nhận gửi bếp'}
          </span>
        </button>
      </div>
    ) : null;

  return (
    <QrBottomSheet
      isOpen={true}
      onClose={onClose}
      title="Giỏ hàng của bạn"
      subtitle={tableName ? `${tableName} • ${totalCount} món` : `${totalCount} món đã chọn`}
      headerIcon={<ShoppingBag className="w-4 h-4" />}
      footer={footerNode}
    >
      {invalidItems.length > 0 && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-rose-700 font-medium min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="truncate">
              Có <strong>{invalidItems.length}</strong> món không khả dụng tại chi nhánh
            </span>
          </div>
          <button
            type="button"
            onClick={() => invalidItems.forEach((it) => onRemoveItem(it.localId))}
            className="text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer shrink-0"
          >
            Xóa món lỗi
          </button>
        </div>
      )}

      {cartItems.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <UtensilsCrossed className="w-9 h-9 mx-auto text-slate-300" />
          <p className="text-xs font-bold text-slate-600">Giỏ hàng đang trống</p>
          <p className="text-[11px] text-slate-400">Hãy chọn món từ thực đơn để thêm vào giỏ.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {isOverBuffetLimit && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="font-semibold leading-relaxed">
                Bạn đang chọn {totalCount} món, vượt quá giới hạn {maxItemsPerSubmission} món cho mỗi lần gọi. Vui lòng điều chỉnh số lượng trước khi gửi.
              </p>
            </div>
          )}

          {hasDishLimitViolation && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 font-semibold leading-relaxed">
                {dishLimitViolations.map((msg, idx) => (
                  <p key={idx}>{msg}</p>
                ))}
              </div>
            </div>
          )}

          {buffetItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h4 className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Trong gói Buffet (0đ)
                </h4>
              </div>
              <div className="space-y-2">
                {buffetItems.map((item) => (
                  <CartItemRow
                    key={item.localId}
                    item={item}
                    isUnavailable={Boolean(
                      availableProductIds && !availableProductIds.has(item.productId)
                    )}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                    onEditItem={onEditItem}
                  />
                ))}
              </div>
            </div>
          )}

          {retailItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#DA251D]" />
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Món gọi thêm / Đồ uống
                </h4>
              </div>
              <div className="space-y-2">
                {retailItems.map((item) => (
                  <CartItemRow
                    key={item.localId}
                    item={item}
                    isUnavailable={Boolean(
                      availableProductIds && !availableProductIds.has(item.productId)
                    )}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                    onEditItem={onEditItem}
                  />
                ))}
              </div>
            </div>
          )}

          {hasActiveBuffet && buffetItems.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Để đảm bảo chất lượng phục vụ và hạn chế lãng phí thực phẩm, nhà hàng xin phép phụ thu{' '}
                <strong className="font-bold text-[#DA251D]">30.000đ/100g</strong> đối với thức ăn thừa.
              </span>
            </div>
          )}
        </div>
      )}
    </QrBottomSheet>
  );
};

interface CartItemRowProps {
  item: QrCartItem;
  isUnavailable?: boolean;
  onUpdateQuantity: (localId: string, quantity: number) => void;
  onRemoveItem: (localId: string) => void;
  onEditItem?: (item: QrCartItem) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  isUnavailable,
  onUpdateQuantity,
  onRemoveItem,
  onEditItem,
}) => {
  const lineTotal = item.priceAtSale * item.quantity;
  const isBuffet = item.pricingMode === 'BUFFET_INCLUDED';

  return (
    <div
      className={`p-2.5 rounded-xl flex items-center justify-between gap-2.5 border ${
        isUnavailable
          ? 'bg-rose-50/70 border-rose-300'
          : 'bg-slate-50 border-slate-200/80'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <h5
            className={`text-xs font-bold truncate ${
              isUnavailable ? 'text-rose-900 line-through' : 'text-slate-900'
            }`}
          >
            {item.productName}
          </h5>
          {isUnavailable && (
            <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200">
              Không khả dụng
            </span>
          )}
          {isBuffet && (
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
              Buffet
            </span>
          )}
        </div>

        {item.selectedOptions.length > 0 && (
          <p className="text-[10px] text-slate-500 truncate mt-0.5">
            {item.selectedOptions.map((o) => o.nameAtSale).join(', ')}
          </p>
        )}

        {item.note && (
          <p className="text-[10px] text-amber-800 italic mt-0.5">&ldquo;{item.note}&rdquo;</p>
        )}

        <div className="mt-1 font-mono text-xs">
          {isBuffet ? (
            <span className="font-bold text-emerald-600">
              {item.priceAtSale > 0
                ? `${item.priceAtSale.toLocaleString('vi-VN')}đ (Phụ thu)`
                : '0đ'}
            </span>
          ) : (
            <span className="font-bold text-slate-900 whitespace-nowrap">
              {lineTotal.toLocaleString('vi-VN')}đ
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {onEditItem && !isUnavailable && (
          <button
            type="button"
            onClick={() => onEditItem(item)}
            aria-label={`Chỉnh sửa ${item.productName}`}
            title="Chỉnh sửa tùy chọn & ghi chú"
            className="h-8 px-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-[#DA251D] flex items-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
            <span>Sửa</span>
          </button>
        )}

        <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (item.quantity <= 1) {
                onRemoveItem(item.localId);
              } else {
                onUpdateQuantity(item.localId, item.quantity - 1);
              }
            }}
            aria-label="Giảm số lượng"
            className="w-7 h-7 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            {item.quantity <= 1 ? (
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
          </button>

          <span className="w-7 text-center font-bold text-xs text-slate-900 font-mono">
            {item.quantity}
          </span>

          <button
            type="button"
            onClick={() => onUpdateQuantity(item.localId, item.quantity + 1)}
            aria-label="Tăng số lượng"
            className="w-7 h-7 rounded flex items-center justify-center text-[#DA251D] hover:bg-slate-100 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
