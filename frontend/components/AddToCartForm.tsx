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
  onAddToCart?: (quantity: number, selectedOptions: Record<string, string[]>, addonsTotal: number) => void;
}

export default function AddToCartForm({ basePrice, optionGroups, onAddToCart }: AddToCartFormProps) {
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
    <div className="mt-6 flex flex-col flex-1">
      
      {/* Option Groups */}
      <div className="flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar">
        {optionGroups?.map(group => (
          <div key={group.id} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-bold text-slate-800 text-lg">{group.name}</h3>
              {group.isRequired && <span className="bg-red-50 text-red-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Bắt buộc</span>}
              {group.multipleChoice && <span className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Chọn nhiều</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.optionItems.map(item => {
                const isSelected = (selectedOptions[group.id] || []).includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleOptionToggle(group.id, item.id, group.multipleChoice)}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      isSelected ? 'border-red-600 bg-red-50' : 'border-slate-200 hover:border-red-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-medium ${isSelected ? 'text-red-700' : 'text-slate-700'}`}>{item.name}</span>
                      {isSelected && <Check className="w-4 h-4 text-red-600" />}
                    </div>
                    {item.priceAdjustment > 0 && (
                      <span className="text-sm font-bold text-slate-500">+{item.priceAdjustment.toLocaleString('vi-VN')}đ</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-slate-100 pt-6">
        <div className="flex items-end justify-between mb-6">
          <span className="text-slate-500 font-medium">Tạm tính:</span>
          <span className="text-4xl font-black text-red-600">{totalPrice.toLocaleString('vi-VN')}đ</span>
        </div>

        {/* Quantity & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded-2xl p-1 border border-slate-200 w-full sm:w-auto h-14 shrink-0">
            <button 
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-600 shadow-sm hover:text-red-600 transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="w-12 text-center font-bold text-slate-900 text-xl">{quantity}</span>
            <button 
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-12 flex items-center justify-center bg-white rounded-xl text-slate-600 shadow-sm hover:text-red-600 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <button 
            onClick={() => onAddToCart && onAddToCart(quantity, selectedOptions, addonsTotal)}
            className="flex-1 w-full bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold h-14 flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all hover:-translate-y-1"
          >
            <ShoppingCart className="w-6 h-6" /> Thêm vào giỏ
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
