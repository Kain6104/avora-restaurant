"use client";

import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  Edit3,
  Check,
  ChefHat,
  Clock,
  Send,
  CheckCircle2,
  UtensilsCrossed,
  XCircle,
  Tag,
  Calculator,
  Info,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import { PosCartItem } from './pos-types';
import { getProductQuickNotes } from './pos-utils';
import { OrderItemPriceBreakdown } from './OrderItemPriceBreakdown';

export interface OrderCartItemProps {
  item: PosCartItem;
  index: number;
  isCompact?: boolean;
  isUnsaved?: boolean;
  isSelected?: boolean;
  readOnly?: boolean;
  onSelect?: () => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onOpenDiscount?: (item: PosCartItem) => void;
  onOpenKeypad?: (item: PosCartItem) => void;
  onOpenItemDetail?: (item: PosCartItem) => void;
}

export const OrderCartItem: React.FC<OrderCartItemProps> = ({
  item,
  index,
  isCompact = false,
  isUnsaved = false,
  isSelected,
  readOnly = false,
  onSelect,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNote,
  onOpenDiscount,
  onOpenKeypad,
  onOpenItemDetail,
}) => {
  const [isExpandedLocal, setIsExpandedLocal] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note || '');

  const isExpanded = !readOnly && (isSelected !== undefined ? isSelected : isExpandedLocal);

  // Nhận diện món đổi điểm thưởng (chống lạm dụng: không xóa / không đổi số lượng, chỉ sửa ghi chú)
  const isRedeemedReward = Boolean(
    item.priceAtSale === 0 &&
      (item.discountReason?.includes('đổi điểm') ||
        item.discountReason?.includes('Đổi điểm') ||
        item.note?.includes('ĐỔI ĐIỂM') ||
        item.orderedByName?.includes('Đổi điểm') ||
        Boolean(item.orderedById && item.priceAtSale === 0)),
  );

  const toggleExpand = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (readOnly) return;
    if (onSelect) {
      onSelect();
    } else {
      setIsExpandedLocal(!isExpandedLocal);
    }
  };

  const netUnitPrice = Math.max(0, item.priceAtSale - (item.discountAmount || 0));
  const lineTotal = netUnitPrice * item.quantity;
  const originalLineTotal = (item.originalPriceAtSale || item.priceAtSale) * item.quantity;

  const quickNotes = getProductQuickNotes(
    item.product.categorySlug || item.product.categoryName,
    item.product.name,
  );

  const handleSaveNote = (textToSave?: string) => {
    const finalVal = (textToSave !== undefined ? textToSave : noteText).trim();
    onUpdateNote(item.id, finalVal);
    setIsEditingNote(false);
  };

  const handleQuickNoteClick = (preset: string) => {
    const newNote = noteText ? `${noteText}, ${preset}` : preset;
    setNoteText(newNote);
    handleSaveNote(newNote);
  };

  const renderKitchenStatus = () => {
    switch (item.kitchenStatus) {
      case 'SENT':
        return (
          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200 flex items-center gap-1">
            <Send className="w-2.5 h-2.5" />
            <span>Đã gửi bếp</span>
          </span>
        );
      case 'ACKNOWLEDGED':
      case 'PREPARING':
        return (
          <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 flex items-center gap-1">
            <ChefHat className="w-2.5 h-2.5 text-amber-600" />
            <span>Đang nấu</span>
          </span>
        );
      case 'READY':
        return (
          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
            <span>Bếp xong</span>
          </span>
        );
      case 'SERVED':
        return (
          <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold border border-purple-200 flex items-center gap-1">
            <UtensilsCrossed className="w-2.5 h-2.5 text-purple-600" />
            <span>Đã phục vụ</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold border border-rose-200 flex items-center gap-1">
            <XCircle className="w-2.5 h-2.5 text-rose-600" />
            <span>Đã hủy</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`bg-white border rounded-xl transition-all select-none overflow-hidden ${
        isExpanded
          ? 'border-red-400 shadow-md ring-1 ring-red-400/20'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
      }`}
    >
      {/* 1. Ultra Compact Row (Chế độ rút gọn: 1 dòng duy nhất) */}
      {isCompact && !isExpanded ? (
        <div
          onClick={toggleExpand}
          className="h-10 px-2.5 cursor-pointer flex items-center justify-between gap-1.5 hover:bg-slate-50 transition-colors text-xs"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 font-mono shrink-0">
              {String(index + 1).padStart(2, '0')}.
            </span>
            <span className="text-xs font-bold text-slate-900 truncate">
              {item.product.name}
            </span>
            {item.pricingMode === 'BUFFET_TICKET' && (
              <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1 py-0.2 rounded font-black tracking-wide shrink-0">
                Vé Buffet
              </span>
            )}
            {item.pricingMode === 'BUFFET_INCLUDED' && (
              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1 py-0.2 rounded font-black tracking-wide shrink-0">
                Buffet 0đ
              </span>
            )}
            {isUnsaved && (
              <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1 py-0.2 rounded border border-amber-300 shrink-0">
                Chờ lưu
              </span>
            )}
            {!isUnsaved && item.savedQuantity !== undefined && item.quantity > item.savedQuantity && (
              <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1 py-0.2 rounded border border-amber-300 shrink-0">
                +{item.quantity - item.savedQuantity} Chưa lưu
              </span>
            )}
            {item.note && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                title={`Ghi chú: ${item.note}`}
              />
            )}
            {item.optionsTextSnapshot && (
              <span className="text-[10px] text-slate-400 truncate max-w-[90px] hidden sm:inline">
                ({item.optionsTextSnapshot})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick +/- buttons in compact mode */}
            {isRedeemedReward ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
                <Lock className="w-2.5 h-2.5 text-amber-600" />
                <span>SL: {item.quantity}</span>
              </div>
            ) : (
              <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item.id, item.quantity - 1);
                  }}
                  className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer"
                  title="Giảm 1"
                >
                  <Minus className="w-3 h-3 stroke-[2.5]" />
                </button>
                <span className="w-6 text-center text-xs font-black text-slate-900 font-mono">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateQuantity(item.id, item.quantity + 1);
                  }}
                  className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:scale-95 cursor-pointer"
                  title="Tăng 1"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            )}

            <div className="text-right min-w-[70px]">
              <span className="text-xs font-black text-slate-900 font-mono">
                {isRedeemedReward ? '0đ' : `${lineTotal.toLocaleString('vi-VN')}đ`}
              </span>
            </div>

            <button
              type="button"
              onClick={toggleExpand}
              className="text-slate-400 hover:text-slate-700 p-0.5"
              title="Mở rộng chi tiết món"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Super Compact Collapsed Row (Default View: 1-2 lines) */
        <div
          onClick={readOnly ? undefined : toggleExpand}
          className={`p-2 sm:p-2.5 flex flex-col gap-1 transition-colors ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
        >
        {/* Line 1: Index + Name + Line Total + Expand Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-400 font-mono shrink-0">
              {String(index + 1).padStart(2, '0')}.
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {item.product.name}
            </span>
            {isRedeemedReward && (
              <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-300 px-1 py-0.2 rounded font-black tracking-wide shrink-0">
                Đổi điểm
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right flex items-baseline justify-end gap-1">
              {!isRedeemedReward && originalLineTotal > lineTotal && (
                <span className="text-[10px] text-slate-400 line-through font-mono">
                  {originalLineTotal.toLocaleString('vi-VN')}đ
                </span>
              )}
              <span className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                {isRedeemedReward ? '0đ' : `${lineTotal.toLocaleString('vi-VN')}đ`}
              </span>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={toggleExpand}
                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                title="Mở rộng thao tác món"
              >
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#da251d]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Added By (Exact Staff + Exact Added Time) & Options Price Breakdown (Strict Vertical Alignment) */}
        <OrderItemPriceBreakdown item={item} showAddedBy={true} isCompact={isCompact} className="pl-5" />

        {/* Line 2 (Sub-info): Unit price x Quantity, kitchen status / Chờ lưu, discount badge, note */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 pl-5">
          <span className="font-semibold text-slate-700 font-mono inline-flex items-baseline gap-1">
            {isRedeemedReward ? (
              <span className="text-amber-700 font-bold">0đ</span>
            ) : item.originalPriceAtSale && item.originalPriceAtSale > item.priceAtSale ? (
              <>
                <span className="text-[10px] text-slate-400 line-through">
                  {item.originalPriceAtSale.toLocaleString('vi-VN')}đ
                </span>
                <span className="text-[#da251d] font-bold">
                  {item.priceAtSale.toLocaleString('vi-VN')}đ
                </span>
              </>
            ) : (
              <span>{item.priceAtSale.toLocaleString('vi-VN')}đ</span>
            )}
            <span className="text-slate-900 font-black ml-0.5">x {item.quantity}</span>
            {!isUnsaved && item.savedQuantity !== undefined && item.quantity > item.savedQuantity && (
              <span className="ml-1 text-[9px] text-amber-800 bg-amber-100 border border-amber-300 rounded px-1 font-bold font-sans">
                +{item.quantity - item.savedQuantity} Chưa lưu
              </span>
            )}
          </span>

            {isUnsaved ? (
              <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-300 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-amber-600" />
                <span>Chờ lưu</span>
              </span>
            ) : (
              renderKitchenStatus()
            )}

            {!isRedeemedReward && Boolean(item.discountAmount && item.discountAmount > 0) && (
              <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                -{item.discountAmount!.toLocaleString('vi-VN')}đ
              </span>
            )}

            {item.note && (
              <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-medium italic truncate max-w-[180px]">
                "{item.note}"
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded Action Strip */}
      {isExpanded && (
        <div
          className="px-2.5 pb-2.5 pt-2 bg-slate-50/90 border-t border-slate-100 space-y-2 animate-in slide-in-from-top-1 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Row 1: Stepper + Source/Buffet Badges to the right of the quantity stepper */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Stepper with Large Touch Buttons */}
            {isRedeemedReward ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-xs shadow-2xs">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Số lượng: {item.quantity} (Món đổi điểm - Cố định)</span>
              </div>
            ) : (
              <div className="flex items-center border border-slate-200 rounded-xl bg-white shadow-xs p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-[#da251d] active:scale-95 transition-all font-bold cursor-pointer"
                  aria-label="Giảm 1"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenKeypad && onOpenKeypad(item)}
                  className="min-w-9 h-10 px-2 flex items-center justify-center text-sm font-black text-slate-900 font-mono hover:bg-red-50 hover:text-[#da251d] rounded-md transition-colors cursor-pointer"
                  title="Bấm để mở bàn phím số"
                >
                  {item.quantity}
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-[#da251d] active:scale-95 transition-all font-bold cursor-pointer"
                  aria-label="Tăng 1"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            )}

            {/* Badges placed right next to stepper (+ button) */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {isRedeemedReward && (
                <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-md font-bold shrink-0">
                  Đổi điểm 0đ
                </span>
              )}
              {item.pricingMode === 'BUFFET_TICKET' && (
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-md font-black tracking-wide shrink-0">
                  Vé Buffet
                </span>
              )}
              {item.pricingMode === 'BUFFET_INCLUDED' && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-2 py-1 rounded-md font-black tracking-wide shrink-0">
                  Buffet
                </span>
              )}

              {item.source === 'QR_ORDER' && (
                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-1 rounded-md font-bold shrink-0">
                  QR - {item.orderedByName || 'Khách'}
                </span>
              )}
              {item.source === 'WAITER' && (
                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-1 rounded-md font-bold shrink-0">
                  Phục vụ
                </span>
              )}
              {item.source === 'POS' && (
                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-md font-bold shrink-0">
                  POS
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Action Buttons Grid */}
          <div className="grid grid-cols-4 gap-1 pt-0.5">
            {/* Ghi chú */}
            <button
              type="button"
              onClick={() => setIsEditingNote(!isEditingNote)}
              className={`h-9 px-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer ${
                isEditingNote || item.note
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title="Thêm hoặc sửa ghi chú"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Ghi chú</span>
            </button>

            {/* Giảm giá */}
            {onOpenDiscount && !isRedeemedReward ? (
              <button
                type="button"
                onClick={() => onOpenDiscount(item)}
                className={`h-9 px-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer ${
                  item.discountAmount && item.discountAmount > 0
                    ? 'border-red-300 bg-red-50 text-[#da251d]'
                    : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                }`}
                title="Giảm giá mặt hàng"
              >
                <Tag className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="truncate">Giảm</span>
              </button>
            ) : isRedeemedReward ? (
              <div className="h-9 px-1.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-300 text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed select-none">
                <Tag className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span className="truncate">0đ</span>
              </div>
            ) : (
              <div />
            )}

            {/* Chi tiết */}
            {onOpenItemDetail ? (
              <button
                type="button"
                onClick={() => onOpenItemDetail(item)}
                className="h-9 px-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                title="Xem thông tin chi tiết nguồn gọi, bếp, lệnh in"
              >
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="truncate">Chi tiết</span>
              </button>
            ) : (
              <div />
            )}

            {/* Xóa món */}
            {isRedeemedReward ? (
              <button
                type="button"
                disabled
                className="h-9 px-1.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-400 text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                title="Món đổi điểm không được phép xóa khỏi đơn"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Đổi điểm</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                className="h-9 px-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 active:scale-95 text-[#da251d] text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
                title="Xóa món khỏi đơn"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Xóa</span>
              </button>
            )}
          </div>

          {/* Inline Note Editor with Quick Pills */}
          {isEditingNote && (
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2 animate-in fade-in duration-100">
              {/* Category-aware Quick Note Pills */}
              <div className="flex flex-wrap gap-1">
                {quickNotes.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickNoteClick(preset)}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-red-50 hover:text-[#da251d] hover:border-red-300 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Nhập ghi chú chế biến..."
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#da251d] focus:bg-white h-9"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                />
                <button
                  type="button"
                  onClick={() => handleSaveNote()}
                  className="h-9 px-3 bg-[#da251d] hover:bg-[#b81d16] text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Lưu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingNote(false)}
                  className="h-9 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold shrink-0"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
