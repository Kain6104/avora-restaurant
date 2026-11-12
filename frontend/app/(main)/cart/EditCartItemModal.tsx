"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { CartItem } from '@/context/CartContext';

interface OptionItem {
  id: string;
  name: string;
  priceAdjustment: number;
}

interface OptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  multipleChoice: boolean;
  optionItems: OptionItem[];
}

interface EditCartItemModalProps {
  item: CartItem;
  onClose: () => void;
  onSave: (updatedItem: CartItem) => void;
}

export default function EditCartItemModal({ item, onClose, onSave }: EditCartItemModalProps) {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  
  // Convert selectedOptions array to record map
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState(item.note || '');

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/products/by-id/${item.productId}`);
        const data = await res.json();
        setProduct(data);

        // Pre-fill selected options
        const initialSelections: Record<string, string[]> = {};
        if (data.optionGroups && item.selectedOptions) {
          const selectedIds = item.selectedOptions.map(o => o.optionItemId);
          
          data.optionGroups.forEach((group: OptionGroup) => {
            const intersection = group.optionItems.filter(i => selectedIds.includes(i.id)).map(i => i.id);
            if (intersection.length > 0) {
              initialSelections[group.id] = intersection;
            }
          });
        }
        setSelectedOptions(initialSelections);
      } catch (err) {
        console.error('Error fetching product for edit', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [item]);

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

  const handleSave = () => {
    if (!product) return;

    let addonsTotal = 0;
    const newSelectedOptions: any[] = [];
    const optionsTextParts: string[] = [];

    product.optionGroups?.forEach((group: OptionGroup) => {
      const selectedItemIds = selectedOptions[group.id] || [];
      selectedItemIds.forEach(id => {
        const optItem = group.optionItems.find(i => i.id === id);
        if (optItem) {
          addonsTotal += optItem.priceAdjustment;
          newSelectedOptions.push({
            optionItemId: optItem.id,
            nameAtSale: optItem.name,
            priceAdjustmentAtSale: optItem.priceAdjustment
          });
          optionsTextParts.push(optItem.name);
        }
      });
    });

    const newOriginalPrice = product.oldPrice ? product.oldPrice + addonsTotal : product.price + addonsTotal;
    const newPriceAtSale = product.price + addonsTotal;

    const updatedItem: CartItem = {
      ...item,
      originalPriceAtSale: newOriginalPrice,
      priceAtSale: newPriceAtSale,
      selectedOptions: newSelectedOptions,
      optionsTextSnapshot: optionsTextParts.join(', '),
      note
    };

    onSave(updatedItem);
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div 
        className="relative bg-white w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[88vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header siêu nhỏ gọn */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">Tùy chọn & Ghi chú món</h2>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-full transition-colors border border-slate-200/60 shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2.5">
              <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">Đang tải tùy chọn món...</span>
            </div>
          ) : (
            <>
              {/* Product Info Bar */}
              <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
                <img 
                  src={item.imageUrl || (item as any).image || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200'} 
                  alt={item.name} 
                  className="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-200/60"
                  onError={(e: any) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-red-600 font-black text-xs sm:text-sm font-mono">
                      {((product?.flashSalePrice || product?.discountedPrice || product?.price || item.priceAtSale || 0)).toLocaleString('vi-VN')}đ
                    </span>
                    <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200/50">
                      Số lượng: x{item.quantity}
                    </span>
                  </div>
                </div>
              </div>

              {/* Option Groups (Dạng Pills siêu nhỏ gọn) */}
              {product?.optionGroups?.map((group: OptionGroup) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-slate-800 text-xs tracking-tight">{group.name}</h4>
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

                  {/* Pills Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {group.optionItems.map(optItem => {
                      const isSelected = (selectedOptions[group.id] || []).includes(optItem.id);
                      return (
                        <button
                          key={optItem.id}
                          type="button"
                          onClick={() => handleOptionToggle(group.id, optItem.id, group.multipleChoice)}
                          className={`relative px-2.5 py-2 rounded-xl text-left transition-all border flex items-center justify-between gap-1.5 cursor-pointer ${
                            isSelected 
                              ? 'border-red-500 bg-red-50/70 text-red-700 shadow-2xs font-semibold' 
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate leading-snug">{optItem.name}</p>
                            {optItem.priceAdjustment > 0 && (
                              <p className={`text-[10px] font-mono ${isSelected ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                                +{optItem.priceAdjustment.toLocaleString('vi-VN')}đ
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

              {/* Note Textarea */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Ghi chú cho quán <span className="text-slate-400 font-normal text-[11px]">(tùy chọn)</span>
                </label>
                <textarea 
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="VD: Không đá, ít cay, để nước chấm riêng..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 text-xs leading-relaxed resize-none"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Cố định */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-t border-slate-100 bg-white shrink-0 flex items-center gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors"
          >
            Đóng
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-red-600/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
}
