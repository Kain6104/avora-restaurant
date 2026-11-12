"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, Check, Utensils } from 'lucide-react';
import { PosProduct, PosCartItemOption } from './pos-types';
import { isWeightUnit } from './pos-utils';

interface ProductOptionModalProps {
  product: PosProduct | null;
  onClose: () => void;
  onConfirm: (
    product: PosProduct,
    quantity: number,
    selectedOptions: PosCartItemOption[],
    note?: string,
    customUnitPrice?: number,
  ) => void;
  isDarkMode?: boolean;
}

export const ProductOptionModal: React.FC<ProductOptionModalProps> = ({
  product,
  onClose,
  onConfirm,
  isDarkMode = false,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [quantityStr, setQuantityStr] = useState('1');
  const [customPriceStr, setCustomPriceStr] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, PosCartItemOption>>({});
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const allowDecimal = isWeightUnit(product?.unit);
  const allowOpenPrice = Boolean(product?.allowOpenPriceOnPos);

  useEffect(() => {
    if (!product) return;
    const initQty = isWeightUnit(product.unit) ? 0.5 : 1;
    setQuantity(initQty);
    setQuantityStr(String(initQty));
    setCustomPriceStr(String(Math.round(Number(product.effectivePrice ?? product.price ?? 0))));
    setNote('');
    setValidationError(null);

    // Auto-select defaults
    const initialOptions: Record<string, PosCartItemOption> = {};
    for (const group of product.optionGroups) {
      const defaultItem = group.optionItems.find((oi) => oi.isDefault);
      if (defaultItem) {
        initialOptions[defaultItem.id] = {
          optionItemId: defaultItem.id,
          nameAtSale: defaultItem.name,
          priceAdjustmentAtSale: defaultItem.priceAdjustment,
        };
      } else if (group.isRequired && group.optionItems.length > 0 && !group.multipleChoice) {
        const first = group.optionItems[0];
        initialOptions[first.id] = {
          optionItemId: first.id,
          nameAtSale: first.name,
          priceAdjustmentAtSale: first.priceAdjustment,
        };
      }
    }
    setSelectedOptions(initialOptions);
  }, [product]);

  if (!product) return null;

  const handleSelectOption = (group: any, item: any) => {
    if (group.multipleChoice) {
      const copy = { ...selectedOptions };
      if (copy[item.id]) {
        delete copy[item.id];
      } else {
        // Check max select
        const currentInGroup = Object.values(copy).filter((opt) =>
          group.optionItems.some((oi: any) => oi.id === opt.optionItemId),
        ).length;
        if (group.maxSelect && currentInGroup >= group.maxSelect) {
          return;
        }
        copy[item.id] = {
          optionItemId: item.id,
          nameAtSale: item.name,
          priceAdjustmentAtSale: item.priceAdjustment,
        };
      }
      setSelectedOptions(copy);
    } else {
      // Single choice in this group: remove others from this group first
      const copy = { ...selectedOptions };
      for (const oi of group.optionItems) {
        delete copy[oi.id];
      }
      copy[item.id] = {
        optionItemId: item.id,
        nameAtSale: item.name,
        priceAdjustmentAtSale: item.priceAdjustment,
      };
      setSelectedOptions(copy);
    }
  };

  const optionsTotalAdjustment = Object.values(selectedOptions).reduce(
    (sum, opt) => sum + opt.priceAdjustmentAtSale,
    0,
  );
  const parsedCustomPrice = allowOpenPrice ? Math.max(0, Number(customPriceStr || 0)) : product.effectivePrice;
  const baseUnitPrice = allowOpenPrice && Number.isFinite(parsedCustomPrice) ? Math.round(parsedCustomPrice) : product.effectivePrice;
  const singleUnitPrice = baseUnitPrice + optionsTotalAdjustment;
  const grandTotal = Math.round(singleUnitPrice * quantity);

  const handleConfirm = () => {
    // Validate required groups
    for (const group of product.optionGroups) {
      if (group.isRequired) {
        const hasSelected = Object.values(selectedOptions).some((opt) =>
          group.optionItems.some((oi: any) => oi.id === opt.optionItemId),
        );
        if (!hasSelected) {
          setValidationError(`Vui lòng chọn tùy chọn cho nhóm "${group.name}"`);
          return;
        }
      }
    }

    const safeQty = Math.round(quantity * 1000) / 1000;
    if (!Number.isFinite(safeQty) || safeQty <= 0) {
      setValidationError('Số lượng / trọng lượng phải lớn hơn 0');
      return;
    }

    onConfirm(
      product,
      safeQty,
      Object.values(selectedOptions),
      note.trim() || undefined,
      allowOpenPrice ? baseUnitPrice : undefined,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl border max-w-lg w-full overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className={`p-4 border-b flex items-start justify-between shrink-0 ${
          isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-gray-100 border-gray-200'
            }`}>
              {product.imageUrl ? (
                <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'text-slate-600' : 'text-gray-400'}`}>
                  <Utensils className="w-6 h-6" />
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                {product.itemCode} • {product.categoryName}
              </span>
              <h3 className={`text-sm font-extrabold leading-snug ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{product.name}</h3>
              <div className="text-xs font-bold text-[#da251d] mt-0.5">
                {(product.effectivePrice ?? product.price ?? 0).toLocaleString('vi-VN')}đ
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Option Groups */}
        <div className={`p-4 overflow-y-auto space-y-4 flex-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
          {validationError && (
            <div className={`p-2.5 rounded-xl text-xs font-semibold border ${
              isDarkMode ? 'bg-red-950/40 border-red-900 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {validationError}
            </div>
          )}

          {product.optionGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                  {group.name}
                  {group.isRequired && (
                    <span className="text-red-500 ml-1 text-[11px] font-normal">(Bắt buộc)</span>
                  )}
                </span>
                <span className="text-[10px] text-gray-400">
                  {group.multipleChoice
                    ? `Tối đa ${group.maxSelect} lựa chọn`
                    : 'Chọn 1'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.optionItems.map((item) => {
                  const isChecked = !!selectedOptions[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.available}
                      onClick={() => handleSelectOption(group, item)}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all select-none text-left ${
                        !item.available
                          ? isDarkMode
                            ? 'bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed line-through'
                            : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed line-through'
                          : isChecked
                          ? isDarkMode
                            ? 'bg-red-950/40 border-[#da251d] text-red-400 font-bold shadow-xs'
                            : 'bg-red-50 border-[#da251d] text-[#da251d] font-bold shadow-xs'
                          : isDarkMode
                          ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-750'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-[#da251d] border-[#da251d] text-white'
                              : isDarkMode
                              ? 'border-slate-600 bg-slate-800'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span>{item.name}</span>
                      </div>
                      {item.priceAdjustment > 0 && (
                        <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          +{item.priceAdjustment.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {allowOpenPrice && (
            <div className={`space-y-1.5 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-gray-100'}`}>
              <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                Đơn giá bán tại POS (VNĐ / {product.unit || 'phần'}):
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={customPriceStr}
                onChange={(e) => setCustomPriceStr(e.target.value)}
                className={`w-full text-sm font-black font-mono rounded-xl px-3 py-2 outline-none border ${
                  isDarkMode
                    ? 'bg-slate-800 border-amber-600/60 text-amber-300 focus:border-amber-400'
                    : 'bg-amber-50/40 border-amber-300 text-slate-900 focus:border-amber-500'
                }`}
              />
            </div>
          )}

          {/* Kitchen Note */}
          <div className={`space-y-1.5 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-gray-100'}`}>
            <label className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>Ghi chú cho bếp / quầy:</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Ít đá, không hành, sốt để riêng..."
              className={`w-full text-xs rounded-xl px-3 py-2 outline-none transition-all border ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:bg-slate-750 focus:border-[#da251d]'
                  : 'bg-gray-50 border-gray-200 focus:border-[#da251d] focus:bg-white text-gray-800 placeholder-gray-400'
              }`}
            />
          </div>
        </div>

        {/* Modal Footer: Quantity & Confirm */}
        <div className={`p-4 border-t flex items-center justify-between gap-4 shrink-0 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/90' : 'border-gray-100 bg-gray-50'
        }`}>
          {/* Quantity Counter */}
          <div className={`flex items-center border rounded-xl p-1 ${
            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
          }`}>
            <button
              type="button"
              onClick={() => {
                const step = allowDecimal ? 0.1 : 1;
                const minVal = allowDecimal ? 0.1 : 1;
                const next = Math.max(minVal, Math.round((quantity - step) * 1000) / 1000);
                setQuantity(next);
                setQuantityStr(String(next));
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all ${
                isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>
            {allowDecimal ? (
              <input
                type="text"
                inputMode="decimal"
                value={quantityStr}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
                  const parts = raw.split('.');
                  const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                  setQuantityStr(cleaned);
                  const num = parseFloat(cleaned);
                  if (Number.isFinite(num) && num >= 0) {
                    setQuantity(Math.round(num * 1000) / 1000);
                  }
                }}
                className={`w-14 text-center text-sm font-extrabold font-mono bg-transparent outline-none ${isDarkMode ? 'text-white' : 'text-gray-800'}`}
              />
            ) : (
              <span className={`w-10 text-center text-sm font-extrabold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{quantity}</span>
            )}
            <button
              type="button"
              onClick={() => {
                const step = allowDecimal ? 0.1 : 1;
                const next = Math.round((quantity + step) * 1000) / 1000;
                setQuantity(next);
                setQuantityStr(String(next));
              }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all ${
                isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 bg-[#da251d] hover:bg-[#b81d16] text-white py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-between shadow-sm active:scale-98 transition-all"
          >
            <span>Thêm vào đơn</span>
            <span className="text-xs font-extrabold">{grandTotal.toLocaleString('vi-VN')}đ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
