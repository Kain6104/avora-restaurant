'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';
import { QrProduct, QrCartOption } from './qr-types';

interface QrOptionSheetProps {
  product: QrProduct | null;
  pricingMode: 'REGULAR' | 'BUFFET_INCLUDED';
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    product: QrProduct,
    quantity: number,
    selectedOptions: QrCartOption[],
    note?: string,
    pricingMode?: 'REGULAR' | 'BUFFET_INCLUDED'
  ) => void;
}

export const QrOptionSheet: React.FC<QrOptionSheetProps> = ({
  product,
  pricingMode,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !product) return null;

  const [quantity, setQuantity] = useState(1);
  const [selectedOptionMap, setSelectedOptionMap] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');

  const optionGroups = (product.optionGroups || []).filter(
    (g) => g && Array.isArray(g.items) && g.items.length > 0
  );

  // Toggle single or multi option item
  const handleToggleOption = (
    groupId: string,
    itemId: string,
    maxSelections: number
  ) => {
    setSelectedOptionMap((prev) => {
      const current = prev[groupId] || [];
      if (maxSelections === 1) {
        // Single selection (radio style)
        return { ...prev, [groupId]: [itemId] };
      }

      // Multi-selection (checkbox style)
      const exists = current.includes(itemId);
      if (exists) {
        return { ...prev, [groupId]: current.filter((id) => id !== itemId) };
      }
      if (current.length >= maxSelections) {
        return prev; // limit reached
      }
      return { ...prev, [groupId]: [...current, itemId] };
    });
  };

  // Compute extra charges from options
  const collectedOptions: QrCartOption[] = [];
  let optionSurcharge = 0;

  optionGroups.forEach((group) => {
    const selectedItemIds = selectedOptionMap[group.id] || [];
    (group.items || []).forEach((item) => {
      if (selectedItemIds.includes(item.id)) {
        collectedOptions.push({
          optionItemId: item.id,
          nameAtSale: `${group.name}: ${item.name}`,
          priceAdjustmentAtSale: item.priceAdjustment || 0,
        });
        optionSurcharge += item.priceAdjustment || 0;
      }
    });
  });

  const effectivePrice = product.effectivePrice ?? product.price ?? 0;
  const basePrice = pricingMode === 'BUFFET_INCLUDED' ? 0 : effectivePrice;
  const unitPrice = basePrice + optionSurcharge;
  const lineTotal = unitPrice * quantity;

  const handleAddToCart = () => {
    onConfirm(product, quantity, collectedOptions, note.trim() || undefined, pricingMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop tap to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Bottom Sheet Modal */}
      <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-250 pb-[env(safe-area-inset-bottom)]">
        {/* Header Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
              Tùy chọn món ăn
            </span>
            {pricingMode === 'BUFFET_INCLUDED' && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                Trong gói Buffet
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Product Summary */}
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            {product.imageUrl && (
              <div className="w-16 h-16 rounded-2xl overflow-hidden relative bg-slate-100 shrink-0 border border-slate-200">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <h3 className="text-base font-black text-slate-900 leading-snug">{product.name}</h3>
              <div className="flex items-baseline gap-2 mt-1">
                {pricingMode === 'BUFFET_INCLUDED' ? (
                  <>
                    <span className="text-base font-black text-emerald-600 font-mono">0đ</span>
                    {effectivePrice > 0 && (
                      <span className="text-xs text-slate-400 line-through font-mono">
                        {effectivePrice.toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-base font-black text-[#da251d] font-mono">
                    {effectivePrice.toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Option Groups */}
          {optionGroups.map((group) => {
            const selectedIds = selectedOptionMap[group.id] || [];
            const isSingle = group.maxSelections === 1;

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    {group.name}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {isSingle ? 'Chọn 1' : `Tối đa ${group.maxSelections}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {group.items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleOption(group.id, item.id, group.maxSelections)}
                        className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-red-50/70 border-[#da251d] text-slate-900 ring-1 ring-red-400/30'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-[#da251d] border-[#da251d] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-xs font-bold">{item.name}</span>
                        </div>

                        {item.priceAdjustment > 0 && (
                          <span className="text-xs font-black text-[#da251d] font-mono">
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

          {/* Ghi chú */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wide block">
              Ghi chú cho bếp (Tùy chọn)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Không hành lá, ít cay, ăn liền..."
              className="w-full h-11 px-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none transition-all"
            />
          </div>
        </div>

        {/* Footer Action Strip */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          {/* Quantity Stepper */}
          <div className="flex items-center border border-slate-200 rounded-2xl p-1 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-30 active:scale-95 cursor-pointer font-black"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center font-black text-sm text-slate-900 font-mono">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 cursor-pointer font-black"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 h-12 rounded-2xl bg-[#da251d] hover:bg-[#b81d16] active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-between px-4 shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <span>THÊM VÀO GIỎ</span>
            <span className="font-mono">{lineTotal.toLocaleString('vi-VN')}đ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
