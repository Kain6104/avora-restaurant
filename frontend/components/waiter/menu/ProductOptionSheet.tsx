'use client';

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import Image from 'next/image';
import { useWaiterStore } from '@/store/useWaiterStore';
import toast from 'react-hot-toast';

interface ProductOptionSheetProps {
  product: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedOptions: any[], note: string, quantity: number) => void;
}

export default function ProductOptionSheet({ product, isOpen, onClose, onConfirm }: ProductOptionSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  
  // Format: { [optionGroupId]: { [optionItemId]: quantity } }
  const [selections, setSelections] = useState<Record<string, Record<string, number>>>({});

  // Reset state when product changes
  useEffect(() => {
    if (isOpen && product) {
      setQuantity(1);
      setNote('');
      setSelections({});
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const currentPrice = product.flashSalePrice || product.discountedPrice || product.price;

  const handleOptionToggle = (group: any, item: any) => {
    setSelections(prev => {
      const groupSelections = prev[group.id] || {};
      const currentSelectedCount = Object.keys(groupSelections).length;
      const isSelected = !!groupSelections[item.id];

      const newGroupSelections = { ...groupSelections };

      if (isSelected) {
        delete newGroupSelections[item.id];
      } else {
        if (!group.multipleChoice && currentSelectedCount >= 1) {
          // If single choice, replace the existing selection
          Object.keys(newGroupSelections).forEach(k => delete newGroupSelections[k]);
          newGroupSelections[item.id] = 1;
        } else if (group.maxSelect && currentSelectedCount >= group.maxSelect) {
          toast(`Chỉ được chọn tối đa ${group.maxSelect} tùy chọn`);
          return prev;
        } else {
          newGroupSelections[item.id] = 1;
        }
      }

      return { ...prev, [group.id]: newGroupSelections };
    });
  };

  const handleConfirm = () => {
    // Validate requirements
    if (product.optionGroups) {
      for (const group of product.optionGroups) {
        const selectedCount = Object.keys(selections[group.id] || {}).length;
        if (group.isRequired && selectedCount < (group.minSelect || 1)) {
          toast.error(`Vui lòng chọn: ${group.name}`);
          return;
        }
      }
    }

    // Flatten selections
    const flatOptions: any[] = [];
    Object.entries(selections).forEach(([groupId, items]) => {
      Object.entries(items).forEach(([itemId, qty]) => {
        const group = product.optionGroups.find((g: any) => g.id === groupId);
        const item = group.optionItems.find((i: any) => i.id === itemId);
        if (item) {
          flatOptions.push({
            optionItemId: item.id,
            nameAtSale: item.name,
            priceAdjustment: item.priceAdjustment,
          });
        }
      });
    });

    onConfirm(flatOptions, note, quantity);
    onClose();
  };

  // Calculate Subtotal
  let optionsTotal = 0;
  Object.entries(selections).forEach(([groupId, items]) => {
    Object.keys(items).forEach(itemId => {
      const group = product.optionGroups.find((g: any) => g.id === groupId);
      const item = group?.optionItems.find((i: any) => i.id === itemId);
      if (item) {
        optionsTotal += item.priceAdjustment;
      }
    });
  });
  const finalPrice = (currentPrice + optionsTotal) * quantity;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-[60] transition-opacity"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-50 rounded-t-2xl z-[70] flex flex-col max-h-[90dvh] shadow-2xl transition-transform transform duration-300 ease-out">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white rounded-t-2xl border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-lg text-slate-800 line-clamp-1 pr-4">{product.name}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 active:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto touch-pan-y p-4 space-y-6">
          
          {/* Options */}
          {product.optionGroups?.map((group: any) => (
            <div key={group.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex justify-between items-baseline mb-3">
                <h3 className="font-bold text-slate-800">{group.name}</h3>
                {group.isRequired && (
                  <span className="text-[10px] font-bold uppercase text-[#DA251D] bg-red-50 px-2 py-0.5 rounded">Bắt buộc</span>
                )}
              </div>
              
              <div className="space-y-2">
                {group.optionItems?.map((item: any) => {
                  const isSelected = !!(selections[group.id]?.[item.id]);
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleOptionToggle(group, item)}
                      disabled={!item.available}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        !item.available ? 'opacity-50' : 
                        isSelected ? 'border-[#DA251D] bg-red-50 text-[#DA251D]' : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                          isSelected ? 'bg-[#DA251D] border-[#DA251D] text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      {item.priceAdjustment > 0 && (
                        <span className="text-sm font-semibold">+{item.priceAdjustment.toLocaleString('vi-VN')}₫</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Note & Quantity */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Ghi chú cho bếp</label>
              <input 
                type="text" 
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="VD: Không hành, ít cay..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#DA251D] focus:border-[#DA251D] outline-none text-[16px]"
              />
            </div>
            
            <div className="flex items-center justify-between pt-2">
              <span className="font-bold text-slate-800">Số lượng</span>
              <div className="flex items-center bg-slate-100 rounded-xl p-1">
                <button 
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 font-bold text-xl active:scale-95"
                >-</button>
                <span className="w-12 text-center font-bold text-lg text-slate-800">{quantity}</span>
                <button 
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#DA251D] font-bold text-xl active:scale-95"
                >+</button>
              </div>
            </div>
          </div>
          
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={handleConfirm}
            className="w-full flex items-center justify-between bg-[#DA251D] hover:bg-red-700 text-white p-4 rounded-xl font-bold shadow-md shadow-red-200 active:scale-95 transition-transform"
          >
            <span>Thêm món</span>
            <span>{finalPrice.toLocaleString('vi-VN')}₫</span>
          </button>
        </div>

      </div>
    </>
  );
}
