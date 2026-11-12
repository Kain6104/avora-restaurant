'use client';

import React, { useState, useEffect } from 'react';
import { Check, UtensilsCrossed } from 'lucide-react';
import toast from 'react-hot-toast';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

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

  const currentPrice = product.flashSalePrice || product.discountedPrice || product.price || 0;

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
        const item = group?.optionItems?.find((i: any) => i.id === itemId);
        if (item) {
          flatOptions.push({
            optionItemId: item.id,
            nameAtSale: item.name,
            priceAdjustment: item.priceAdjustment || 0,
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
      const group = product.optionGroups?.find((g: any) => g.id === groupId);
      const item = group?.optionItems?.find((i: any) => i.id === itemId);
      if (item && item.priceAdjustment) {
        optionsTotal += item.priceAdjustment;
      }
    });
  });
  const finalPrice = (currentPrice + optionsTotal) * quantity;

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      subtitle={`Đơn giá: ${Number(currentPrice).toLocaleString('vi-VN')} đ`}
      icon={<UtensilsCrossed size={18} className="text-[#DA251D]" />}
      maxWidth="md"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full flex items-center justify-between bg-[#DA251D] hover:bg-[#b81d16] text-white p-3 rounded-2xl font-bold shadow-md shadow-red-500/25 active:scale-95 transition-all cursor-pointer text-xs sm:text-sm"
        >
          <span>Thêm vào đơn ({quantity})</span>
          <span className="font-mono text-sm sm:text-base font-black">{finalPrice.toLocaleString('vi-VN')} đ</span>
        </button>
      }
    >
      <div className="space-y-4 py-1">
        {/* Options */}
        {product.optionGroups?.map((group: any) => (
          <div key={group.id} className="bg-slate-50/70 rounded-2xl p-3 border border-slate-200/80">
            <div className="flex justify-between items-baseline mb-2">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900">{group.name}</h3>
              {group.isRequired && (
                <span className="text-[9.5px] font-black uppercase text-[#DA251D] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  Bắt buộc
                </span>
              )}
            </div>
            
            <div className="space-y-1.5">
              {group.optionItems?.map((item: any) => {
                const isSelected = !!(selections[group.id]?.[item.id]);
                
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOptionToggle(group, item)}
                    disabled={!item.available}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs cursor-pointer ${
                      !item.available ? 'opacity-40 cursor-not-allowed' : 
                      isSelected ? 'border-[#DA251D] bg-red-50/70 text-[#DA251D] font-bold' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                        isSelected ? 'bg-[#DA251D] border-[#DA251D] text-white' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs">{item.name}</span>
                    </div>
                    {item.priceAdjustment > 0 && (
                      <span className="text-[11px] font-bold">+{item.priceAdjustment.toLocaleString('vi-VN')} đ</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Note & Quantity */}
        <div className="bg-slate-50/70 rounded-2xl p-3 border border-slate-200/80 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú cho bếp</label>
            <input 
              type="text" 
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Không hành, ít cay, ra trước..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-[#DA251D] focus:border-[#DA251D] outline-none text-xs shadow-2xs"
            />
          </div>
          
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold text-xs text-slate-800">Số lượng món</span>
            <div className="flex items-center bg-slate-200/80 rounded-xl p-0.5">
              <button 
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-2xs text-slate-700 font-black text-base active:scale-95 cursor-pointer"
              >
                -
              </button>
              <span className="w-10 text-center font-black text-sm text-slate-900 font-mono">{quantity}</span>
              <button 
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 flex items-center justify-center bg-[#DA251D] text-white rounded-lg shadow-2xs font-black text-base active:scale-95 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </ResponsiveModal>
  );
}
