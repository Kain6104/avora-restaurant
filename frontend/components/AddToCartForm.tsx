"use client";

import React, { useState } from 'react';
import { Minus, Plus, ShoppingCart, Check } from 'lucide-react';

interface OptionItem {
  id: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
}

interface OptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  multipleChoice: boolean;
  optionItems: OptionItem[];
}

interface AddToCartFormProps {
  basePrice: number;
  optionGroups: OptionGroup[];
  initialNote?: string;
  onAddToCart?: (quantity: number, selectedOptions: Record<string, string[]>, addonsTotal: number, note: string) => void;
}

export default function AddToCartForm({ basePrice, optionGroups, initialNote, onAddToCart }: AddToCartFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(() => {
    // Initialize with default options
    const initial: Record<string, string[]> = {};
    optionGroups?.forEach(group => {
      const defaultItem = group.optionItems.find(item => item.isDefault);
      if (defaultItem) {
        initial[group.id] = [defaultItem.id];
      } else {
        initial[group.id] = [];
      }
    });
    return initial;
  });
  const [note, setNote] = useState(initialNote || '');

  const handleOptionToggle = (groupId: string, itemId: string, multipleChoice: boolean) => {
    setSelectedOptions(prev => {
      const currentSelected = prev[groupId] || [];
      if (multipleChoice) {
        if (currentSelected.includes(itemId)) {
          return { ...prev, [groupId]: currentSelected.filter(id => id !== itemId) };
        } else {
          return { ...prev, [groupId]: [...currentSelected, itemId] };
        }
      } else {
        return { ...prev, [groupId]: [itemId] };
      }
    });
  };

  // Calculate total price
  let addonsTotal = 0;
  optionGroups?.forEach(group => {
    const selectedItemIds = selectedOptions[group.id] || [];
    selectedItemIds.forEach(id => {
      const item = group.optionItems.find(i => i.id === id);
      if (item) addonsTotal += item.priceAdjustment;
    });
  });

  const totalPrice = (basePrice + addonsTotal) * quantity;

  return (
    <div className="flex flex-col flex-1">
      {/* Option Groups */}
      <div className="flex-1 overflow-y-auto mb-3 pr-1 custom-scrollbar space-y-3.5">
        {optionGroups?.map(group => (
          <div key={group.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-800 text-xs sm:text-[13px] tracking-tight">{group.name}</h3>
                {group.isRequired && (
                  <span className="bg-red-50 text-red-600 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border border-red-200/50">
                    Bắt buộc
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {group.multipleChoice ? 'Chọn nhiều' : 'Chọn 1'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {group.optionItems.map(item => {
                const isSelected = (selectedOptions[group.id] || []).includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOptionToggle(group.id, item.id, group.multipleChoice)}
                    className={`relative px-2.5 py-2 rounded-xl text-left transition-all border flex items-center justify-between gap-1.5 cursor-pointer ${
                      isSelected 
                        ? 'border-red-500 bg-red-50/70 text-red-700 shadow-2xs font-semibold' 
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs truncate leading-snug">{item.name}</p>
                      {item.priceAdjustment > 0 && (
                        <p className={`text-[10px] font-mono ${isSelected ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                          +{item.priceAdjustment.toLocaleString('vi-VN')}đ
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer cố định siêu gọn */}
      <div className="mt-auto border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-slate-500 font-medium text-xs">Tạm tính:</span>
          <span className="text-lg sm:text-xl font-black text-red-600 font-mono">{totalPrice.toLocaleString('vi-VN')}đ</span>
        </div>

        {/* Quantity & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 h-9 sm:h-10 shrink-0">
            <button 
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white rounded-lg text-slate-600 shadow-2xs hover:text-red-600 transition-colors"
            >
              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <span className="w-7 sm:w-8 text-center font-black text-slate-900 text-xs sm:text-sm font-mono">{quantity}</span>
            <button 
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-white rounded-lg text-slate-600 shadow-2xs hover:text-red-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <button 
            type="button"
            onClick={() => onAddToCart && onAddToCart(quantity, selectedOptions, addonsTotal, note)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-9 sm:h-10 flex items-center justify-center gap-1.5 shadow-md shadow-red-600/20 transition-all active:scale-[0.99] text-xs sm:text-sm cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" /> Thêm vào giỏ
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
}
