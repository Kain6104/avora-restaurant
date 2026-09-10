"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Plus, Minus, Check, Utensils } from 'lucide-react';
import { PosProduct, PosCartItemOption } from './pos-types';

interface ProductOptionModalProps {
  product: PosProduct | null;
  onClose: () => void;
  onConfirm: (
    product: PosProduct,
    quantity: number,
    selectedOptions: PosCartItemOption[],
    note?: string,
  ) => void;
}

export const ProductOptionModal: React.FC<ProductOptionModalProps> = ({
  product,
  onClose,
  onConfirm,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, PosCartItemOption>>({});
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    setQuantity(1);
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
  const singleUnitPrice = product.effectivePrice + optionsTotalAdjustment;
  const grandTotal = singleUnitPrice * quantity;

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

    onConfirm(product, quantity, Object.values(selectedOptions), note.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
              {product.imageUrl ? (
                <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Utensils className="w-6 h-6" />
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                {product.itemCode} • {product.categoryName}
              </span>
              <h3 className="text-sm font-extrabold text-gray-900 leading-snug">{product.name}</h3>
              <div className="text-xs font-bold text-[#da251d] mt-0.5">
                {(product.effectivePrice ?? product.price ?? 0).toLocaleString('vi-VN')}đ
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Option Groups */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {validationError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold">
              {validationError}
            </div>
          )}

          {product.optionGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800">
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
                          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed line-through'
                          : isChecked
                          ? 'bg-red-50 border-[#da251d] text-[#da251d] font-bold shadow-xs'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all ${
                            isChecked
                              ? 'bg-[#da251d] border-[#da251d] text-white'
                              : 'border-gray-300'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span>{item.name}</span>
                      </div>
                      {item.priceAdjustment > 0 && (
                        <span className="text-[11px] font-semibold text-gray-500">
                          +{item.priceAdjustment.toLocaleString('vi-VN')}đ
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Kitchen Note */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-800">Ghi chú cho bếp / quầy:</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Ít đá, không hành, sốt để riêng..."
              className="w-full text-xs bg-gray-50 border border-gray-200 focus:border-[#da251d] focus:bg-white rounded-xl px-3 py-2 outline-none transition-all placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Modal Footer: Quantity & Confirm */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-4 shrink-0">
          {/* Quantity Counter */}
          <div className="flex items-center border border-gray-200 rounded-xl bg-white p-1">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-10 text-center text-sm font-extrabold text-gray-800">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition-all"
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
