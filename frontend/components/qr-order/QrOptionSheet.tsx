'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Plus, Minus, Check, UtensilsCrossed, ZoomIn, AlertTriangle } from 'lucide-react';
import { QrBottomSheet } from './QrBottomSheet';
import { QrImageViewer } from './QrImageViewer';
import { sanitizeProductHtml } from './qr-html-util';
import {
  QrCartItem,
  QrCartOption,
  QrProduct,
  QrProductOptionGroup,
} from './qr-types';
import toast from 'react-hot-toast';

interface QrOptionSheetProps {
  product: QrProduct | null;
  pricingMode: 'REGULAR' | 'BUFFET_INCLUDED';
  editingItem?: QrCartItem | null;
  cartItems?: QrCartItem[];
  hasActiveBuffet?: boolean;
  maxItemsPerSubmission?: number | null;
  onClose: () => void;
  onAddToCart: (item: QrCartItem) => void;
  onSaveEdit?: (localId: string, updatedItem: QrCartItem) => void;
}

const getGroupItems = (group: QrProductOptionGroup) =>
  (group.items || group.optionItems || []).filter((it) => it.available !== false);

const isGroupMultiple = (group: QrProductOptionGroup): boolean => {
  if (typeof group.multipleChoice === 'boolean') {
    return group.multipleChoice;
  }
  const max = group.maxSelect ?? group.maxSelections;
  if (typeof max === 'number' && max > 1) {
    return true;
  }
  return false;
};

const isGroupRequired = (group: QrProductOptionGroup): boolean => {
  if (group.isRequired) return true;
  const min = group.minSelect ?? group.minSelections;
  return typeof min === 'number' && min > 0;
};

const getGroupMin = (group: QrProductOptionGroup): number => {
  const min = group.minSelect ?? group.minSelections;
  if (typeof min === 'number' && min >= 0) return min;
  return isGroupRequired(group) ? 1 : 0;
};

const getGroupMax = (group: QrProductOptionGroup): number => {
  const max = group.maxSelect ?? group.maxSelections;
  if (typeof max === 'number' && max > 0) return max;
  if (!isGroupMultiple(group)) return 1;
  return 0; // 0 means unconstrained
};

export const QrOptionSheet: React.FC<QrOptionSheetProps> = ({
  product,
  pricingMode,
  editingItem,
  cartItems = [],
  hasActiveBuffet = false,
  maxItemsPerSubmission = null,
  onClose,
  onAddToCart,
  onSaveEdit,
}) => {
  const optionGroups = useMemo(() => product?.optionGroups || [], [product?.optionGroups]);

  const [selectedOptionMap, setSelectedOptionMap] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    if (editingItem) {
      const selectedIdSet = new Set(editingItem.selectedOptions.map((o) => o.optionItemId));
      optionGroups.forEach((group) => {
        const items = getGroupItems(group);
        const matched = items.filter((it) => selectedIdSet.has(it.id)).map((it) => it.id);
        if (matched.length > 0) {
          initial[group.id] = matched;
        } else if (isGroupRequired(group) && !isGroupMultiple(group) && items.length > 0) {
          initial[group.id] = [items[0].id];
        }
      });
      return initial;
    }

    optionGroups.forEach((group) => {
      const items = getGroupItems(group);
      const isMultiple = isGroupMultiple(group);
      const isRequired = isGroupRequired(group);
      const maxSel = getGroupMax(group);

      const defaults = items.filter((it) => it.isDefault).map((it) => it.id);
      if (defaults.length > 0) {
        if (!isMultiple) {
          initial[group.id] = [defaults[0]];
        } else {
          initial[group.id] = maxSel > 0 ? defaults.slice(0, maxSel) : defaults;
        }
      } else if (isRequired && !isMultiple && items.length > 0) {
        // Tự động chọn option đầu tiên cho nhóm Bắt buộc Chọn 1 nếu không có default
        initial[group.id] = [items[0].id];
      }
    });
    return initial;
  });

  const [quantity, setQuantity] = useState(editingItem?.quantity ?? 1);
  const [note, setNote] = useState(editingItem?.note ?? '');
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const handleToggleOption = (group: QrProductOptionGroup, itemId: string) => {
    const isMultiple = isGroupMultiple(group);
    const isRequired = isGroupRequired(group);
    const maxSel = getGroupMax(group);

    setSelectedOptionMap((prev) => {
      const current = prev[group.id] || [];
      const isAlreadySelected = current.includes(itemId);

      // 1. Nhóm CHỈ CHỌN 1 (Single choice / Radio)
      if (!isMultiple) {
        if (isAlreadySelected) {
          // Nhóm bắt buộc: Không cho bỏ chọn thành rỗng
          if (isRequired) {
            return prev;
          }
          // Nhóm không bắt buộc: Cho phép hủy chọn
          return { ...prev, [group.id]: [] };
        }
        // Chọn option này (thay thế lựa chọn cũ)
        return { ...prev, [group.id]: [itemId] };
      }

      // 2. Nhóm CHỌN NHIỀU (Multiple choice / Checkbox)
      if (isAlreadySelected) {
        return {
          ...prev,
          [group.id]: current.filter((id) => id !== itemId),
        };
      }

      if (maxSel > 0 && current.length >= maxSel) {
        toast.error(`Nhóm "${group.name}" chỉ được chọn tối đa ${maxSel} tùy chọn`);
        return prev;
      }

      return {
        ...prev,
        [group.id]: [...current, itemId],
      };
    });
  };

  const selectedOptions = useMemo((): QrCartOption[] => {
    const list: QrCartOption[] = [];
    optionGroups.forEach((group) => {
      const items = getGroupItems(group);
      const selectedIds = selectedOptionMap[group.id] || [];
      selectedIds.forEach((id) => {
        const found = items.find((i) => i.id === id);
        if (found) {
          list.push({
            optionItemId: found.id,
            nameAtSale: found.name,
            priceAdjustmentAtSale: found.priceAdjustment || 0,
          });
        }
      });
    });
    return list;
  }, [optionGroups, selectedOptionMap]);

  const sanitizedDescription = useMemo(
    () => sanitizeProductHtml(product?.description),
    [product?.description]
  );

  const isBuffetIncluded = pricingMode === 'BUFFET_INCLUDED';
  const alreadyInCartQty = useMemo(() => {
    if (!isBuffetIncluded || !product) return 0;
    return cartItems
      .filter(
        (it) =>
          it.pricingMode === 'BUFFET_INCLUDED' &&
          it.productId === product.id &&
          it.localId !== editingItem?.localId
      )
      .reduce((sum, it) => sum + it.quantity, 0);
  }, [cartItems, editingItem?.localId, isBuffetIncluded, product]);

  const totalOtherItemsInCart = useMemo(
    () =>
      cartItems
        .filter((it) => it.localId !== editingItem?.localId)
        .reduce((sum, it) => sum + it.quantity, 0),
    [cartItems, editingItem?.localId]
  );

  if (!product) return null;

  const basePrice = pricingMode === 'BUFFET_INCLUDED' ? 0 : product.effectivePrice;
  const optionsSum = selectedOptions.reduce((sum, opt) => sum + opt.priceAdjustmentAtSale, 0);
  const unitTotal = basePrice + optionsSum;
  const lineTotal = unitTotal * quantity;
  const oldPrice = product.oldPrice ?? product.originalPrice ?? 0;

  const maxPerRoundLimit =
    isBuffetIncluded &&
    typeof product.maxQuantityPerRound === 'number' &&
    product.maxQuantityPerRound > 0
      ? product.maxQuantityPerRound
      : null;
  const maxTotalLimit =
    isBuffetIncluded &&
    typeof product.maxTotalQuantity === 'number' &&
    product.maxTotalQuantity > 0
      ? product.maxTotalQuantity
      : null;
  const usedTotal = isBuffetIncluded ? product.usedTotalQuantity || 0 : 0;

  const perRoundRemaining =
    maxPerRoundLimit !== null ? Math.max(0, maxPerRoundLimit - alreadyInCartQty) : null;
  const totalRemaining =
    maxTotalLimit !== null ? Math.max(0, maxTotalLimit - usedTotal - alreadyInCartQty) : null;
  const submissionRemaining =
    hasActiveBuffet &&
    typeof maxItemsPerSubmission === 'number' &&
    maxItemsPerSubmission > 0
      ? Math.max(0, maxItemsPerSubmission - totalOtherItemsInCart)
      : null;

  const limitCandidates = [perRoundRemaining, totalRemaining, submissionRemaining].filter(
    (v): v is number => v !== null
  );
  const maxSelectableQty =
    limitCandidates.length > 0 ? Math.min(...limitCandidates) : null;
  const isAtDishQuotaLimit = maxSelectableQty !== null && maxSelectableQty <= 0;

  const handleSubmit = () => {
    if (isAtDishQuotaLimit) {
      toast.error(
        submissionRemaining !== null && submissionRemaining <= 0
          ? `Giỏ hàng đã đạt giới hạn ${maxItemsPerSubmission} món cho mỗi lần gọi. Vui lòng gửi bếp hoặc điều chỉnh giỏ hàng.`
          : totalRemaining !== null && totalRemaining <= 0
          ? `Món "${product.name}" đã hết lượt gọi trong bữa Buffet này`
          : `Món "${product.name}" đã đạt giới hạn mỗi lần gọi trong giỏ hàng`
      );
      return;
    }

    if (maxSelectableQty !== null && quantity > maxSelectableQty) {
      toast.error(
        submissionRemaining !== null &&
          quantity > submissionRemaining &&
          submissionRemaining === maxSelectableQty
          ? `Bạn chỉ có thể thêm tối đa ${maxSelectableQty} món nữa (giới hạn ${maxItemsPerSubmission} món / lần gọi).`
          : `Món "${product.name}" chỉ còn được chọn tối đa ${maxSelectableQty} phần cho lượt này`
      );
      setQuantity(Math.max(1, maxSelectableQty));
      return;
    }

    for (const group of optionGroups) {
      const items = getGroupItems(group);
      if (items.length === 0) continue;

      const selectedCount = (selectedOptionMap[group.id] || []).length;
      const isMultiple = isGroupMultiple(group);
      const isRequired = isGroupRequired(group);
      const minSel = getGroupMin(group);
      const maxSel = getGroupMax(group);

      if (isRequired) {
        const requiredMin = minSel > 0 ? minSel : 1;
        if (selectedCount < requiredMin) {
          if (!isMultiple || requiredMin === 1) {
            toast.error(`Vui lòng chọn "${group.name}"`);
          } else {
            toast.error(`Vui lòng chọn ít nhất ${requiredMin} tùy chọn cho "${group.name}"`);
          }
          return;
        }
      }

      if (!isMultiple && selectedCount > 1) {
        toast.error(`Nhóm "${group.name}" chỉ được chọn 1 tùy chọn`);
        return;
      }

      if (maxSel > 0 && selectedCount > maxSel) {
        toast.error(`Nhóm "${group.name}" chỉ được chọn tối đa ${maxSel} tùy chọn`);
        return;
      }
    }

    const itemPayload: QrCartItem = {
      localId: editingItem
        ? editingItem.localId
        : `${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      unit: product.unit,
      quantity,
      pricingMode,
      basePrice,
      priceAtSale: unitTotal,
      originalPrice: product.price,
      selectedOptions,
      note: note.trim() || undefined,
    };

    if (editingItem && onSaveEdit) {
      onSaveEdit(editingItem.localId, itemPayload);
    } else {
      onAddToCart(itemPayload);
    }
    onClose();
  };

  const footerNode = (
    <div className="flex items-center justify-between gap-2.5">
      <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50 shrink-0">
        <button
          type="button"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          aria-label="Giảm số lượng"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center font-bold text-sm text-slate-900 font-mono">
          {quantity}
        </span>
        <button
          type="button"
          onClick={() => {
            if (maxSelectableQty !== null && quantity >= maxSelectableQty) {
              toast.error(
                maxSelectableQty === 0
                  ? `Món "${product.name}" đã đạt giới hạn cho phép`
                  : `Chỉ có thể chọn tối đa ${maxSelectableQty} phần lúc này`
              );
              return;
            }
            setQuantity((q) => q + 1);
          }}
          disabled={maxSelectableQty !== null && quantity >= maxSelectableQty}
          aria-label="Tăng số lượng"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#DA251D] hover:bg-white disabled:opacity-35 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isAtDishQuotaLimit}
        className="flex-1 h-10 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-between px-4 transition-all cursor-pointer"
      >
        <span>
          {isAtDishQuotaLimit
            ? 'Đã đạt giới hạn món'
            : editingItem
            ? 'Cập nhật món'
            : 'Thêm vào giỏ'}
        </span>
        <span className="font-mono text-sm whitespace-nowrap">{lineTotal.toLocaleString('vi-VN')}đ</span>
      </button>
    </div>
  );

  return (
    <>
      <QrBottomSheet
        isOpen={Boolean(product)}
        onClose={onClose}
        title={editingItem ? 'Chỉnh sửa món trong giỏ' : 'Chi tiết món ăn'}
        headerBadge={
          pricingMode === 'BUFFET_INCLUDED' ? (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
              Trong gói Buffet
            </span>
          ) : undefined
        }
        footer={footerNode}
      >
        <div className="space-y-4">
          {/* Product Detail Header */}
          <div className="flex items-start gap-3 pb-3.5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (product.imageUrl) {
                  setViewerSrc(product.imageUrl);
                }
              }}
              disabled={!product.imageUrl}
              aria-label={product.imageUrl ? `Phóng to hình ${product.name}` : undefined}
              className={`w-22 h-22 rounded-xl overflow-hidden relative bg-[#FAFBFD] shrink-0 border border-slate-200 group flex items-center justify-center ${
                product.imageUrl ? 'cursor-zoom-in' : 'cursor-default'
              }`}
            >
              {product.imageUrl ? (
                <>
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="88px"
                    className="object-contain object-center p-1 transition-transform duration-200 group-hover:scale-105"
                  />
                  <span className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-slate-900/65 text-white flex items-center justify-center backdrop-blur-xs">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </span>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <UtensilsCrossed className="w-7 h-7" />
                </div>
              )}
            </button>

            <div className="flex-1 min-w-0">
              {product.itemCode && (
                <span className="inline-block mb-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                  {product.itemCode}
                </span>
              )}
              <h4 className="text-sm font-bold text-slate-900 leading-snug">{product.name}</h4>
              <div className="flex items-baseline gap-2 mt-1.5">
                {pricingMode === 'BUFFET_INCLUDED' ? (
                  <>
                    <span className="text-sm font-bold text-emerald-600 font-mono">0đ</span>
                    {product.effectivePrice > 0 && (
                      <span className="text-xs text-slate-400 line-through font-mono">
                        {product.effectivePrice.toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-[#DA251D] font-mono">
                      {product.effectivePrice.toLocaleString('vi-VN')}đ
                    </span>
                    {oldPrice > product.effectivePrice && (
                      <span className="text-xs text-slate-400 line-through font-mono">
                        {oldPrice.toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </>
                )}
              </div>
              {product.imageUrl && (
                <p className="text-[10px] text-slate-400 mt-1">Chạm vào ảnh để phóng to</p>
              )}
            </div>
          </div>

          {sanitizedDescription && (
            <div
              className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 border border-slate-100 rounded-xl p-3 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1 [&_strong]:font-semibold [&_b]:font-semibold [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-semibold [&_a]:text-[#DA251D] [&_a]:underline break-words"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
          )}

          {/* Buffet Per-Dish Limit Indicator */}
          {isBuffetIncluded && (maxPerRoundLimit !== null || maxTotalLimit !== null) && (
            <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex flex-wrap items-center gap-2 text-[11px] font-bold text-indigo-900">
              {maxPerRoundLimit !== null && (
                <span className="px-2 py-0.5 rounded-lg bg-white border border-indigo-200">
                  Tối đa {maxPerRoundLimit} phần / lần gọi
                </span>
              )}
              {maxTotalLimit !== null && (
                <span className="px-2 py-0.5 rounded-lg bg-white border border-indigo-200">
                  Cả bữa: đã gọi {usedTotal}/{maxTotalLimit} · còn{' '}
                  {Math.max(0, maxTotalLimit - usedTotal)} phần
                </span>
              )}
            </div>
          )}

          {/* Buffet Leftover Surcharge Notice — ONLY for Buffet items */}
          {isBuffetIncluded && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed text-amber-950 space-y-0.5">
                <p className="font-bold text-amber-900">Chính sách thức ăn thừa</p>
                <p>
                  Để đảm bảo chất lượng phục vụ và hạn chế lãng phí thực phẩm, nhà hàng xin phép phụ thu{' '}
                  <span className="font-black text-[#DA251D]">30.000đ/100g</span> đối với thức ăn thừa.
                </p>
              </div>
            </div>
          )}

          {/* Option Groups */}
          {optionGroups.map((group) => {
            const items = getGroupItems(group);
            if (items.length === 0) return null;
            const selectedIds = selectedOptionMap[group.id] || [];
            const isMultiple = isGroupMultiple(group);
            const isRequired = isGroupRequired(group);
            const minSel = getGroupMin(group);
            const maxSel = getGroupMax(group);

            const ruleBadge = isRequired ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-[#DA251D] border border-red-200/80 leading-none whitespace-nowrap">
                {!isMultiple
                  ? 'Bắt buộc · Chọn 1'
                  : maxSel > 0
                  ? `Bắt buộc ${minSel > 1 ? `(tối thiểu ${minSel})` : ''} · Tối đa ${maxSel}`
                  : `Bắt buộc ${minSel > 1 ? `(tối thiểu ${minSel})` : 'chọn'}`}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                {!isMultiple
                  ? 'Tùy chọn · Chọn 1'
                  : maxSel > 0
                  ? `Tối đa ${maxSel}`
                  : 'Chọn nhiều'}
              </span>
            );

            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide truncate">
                      {group.name}
                    </h5>
                    {isRequired && <span className="text-[#DA251D] font-bold text-xs shrink-0">*</span>}
                  </div>
                  <div className="shrink-0">{ruleBadge}</div>
                </div>

                <div className="space-y-1.5">
                  {items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleOption(group, item.id)}
                        className={`w-full px-3 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-red-50/70 border-[#DA251D] text-slate-900 shadow-2xs'
                            : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Radio button (Chọn 1) vs Checkbox (Chọn nhiều) */}
                          {!isMultiple ? (
                            <div
                              className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'border-[#DA251D] bg-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full bg-[#DA251D]" />
                              )}
                            </div>
                          ) : (
                            <div
                              className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? 'bg-[#DA251D] border-[#DA251D] text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          )}
                          <span
                            className={`text-xs truncate ${
                              isSelected ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>

                        {item.priceAdjustment > 0 && (
                          <span className="text-xs font-bold text-[#DA251D] font-mono shrink-0 whitespace-nowrap ml-2">
                            +{item.priceAdjustment.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Kitchen Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
              Ghi chú cho bếp
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Không hành lá, ít cay..."
              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white text-xs outline-none transition-all"
            />
          </div>
        </div>
      </QrBottomSheet>

      <QrImageViewer
        src={viewerSrc}
        alt={product.name}
        onClose={() => setViewerSrc(null)}
      />
    </>
  );
};
