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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-[90%] max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Tùy chọn / Ghi chú</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
              <span className="text-sm text-slate-500">Đang tải tùy chọn...</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-4 mb-6 bg-slate-50 p-4 rounded-xl">
                <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                <div>
                  <h3 className="font-bold text-slate-900">{item.name}</h3>
                  <div className="text-red-600 font-bold text-sm">{(product.price || 0).toLocaleString('vi-VN')}đ</div>
                </div>
              </div>

              {product.optionGroups?.map((group: OptionGroup) => (
                <div key={group.id} className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-bold text-slate-800">{group.name}</h4>
                    {group.isRequired && <span className="bg-red-50 text-red-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Bắt buộc</span>}
                    {group.multipleChoice && <span className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Chọn nhiều</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.optionItems.map(optItem => {
                      const isSelected = (selectedOptions[group.id] || []).includes(optItem.id);
                      return (
                        <button
                          key={optItem.id}
                          onClick={() => handleOptionToggle(group.id, optItem.id, group.multipleChoice)}
                          className={`relative p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between h-full ${
                            isSelected ? 'border-red-600 bg-red-50' : 'border-slate-200 hover:border-red-300 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full mb-1">
                            <span className={`font-medium text-sm pr-2 ${isSelected ? 'text-red-700' : 'text-slate-700'}`}>{optItem.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                          </div>
                          {optItem.priceAdjustment > 0 && (
                            <span className="text-xs font-bold text-slate-500 mt-1">+{optItem.priceAdjustment.toLocaleString('vi-VN')}đ</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-bold text-slate-800">Ghi chú thêm</h4>
                </div>
                <textarea 
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="VD: Không hành, thêm tương ớt..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-red-500/10 focus:border-red-500 focus:bg-white outline-none transition-all placeholder:text-slate-400 text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 shrink-0 bg-white rounded-b-3xl">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-600/20 transition-all"
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
