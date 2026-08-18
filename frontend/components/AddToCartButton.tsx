"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import AddToCartForm from './AddToCartForm';

export default function AddToCartButton({ item, className }: { item: any, className?: string }) {
  const { addToCart, currentBranchId } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); // Prevent bubbling up to the parent <Link>
    setIsModalOpen(true);
  };

  const handleConfirmAdd = (quantity: number, selectedOptions: Record<string, string[]>, addonsTotal: number) => {
    // Format options as string for cart item name/description
    let optionNames: string[] = [];
    if (item.optionGroups && selectedOptions) {
      item.optionGroups.forEach((group: any) => {
        const selectedIds = selectedOptions[group.id] || [];
        selectedIds.forEach((id: string) => {
          const opt = group.optionItems.find((o: any) => o.id === id);
          if (opt) optionNames.push(opt.name);
        });
      });
    }

    const cartItem = {
      id: item.id + (optionNames.length > 0 ? '-' + Math.random().toString(36).substr(2, 9) : ''),
      name: item.name + (optionNames.length > 0 ? ` (${optionNames.join(', ')})` : ''),
      price: (item.discountedPrice || item.price) + addonsTotal,
      quantity: quantity,
      imageUrl: item.imageUrl || item.image
    };
    
    let branch = currentBranchId;
    if (!branch && typeof window !== 'undefined') {
      branch = localStorage.getItem('selectedBranchId') || 'AVO-Q1';
    }
    
    addToCart(cartItem, branch || 'AVO-Q1');
    setIsModalOpen(false);
  };

  return (
    <>
      <button 
        onClick={handleAddClick}
        className={className || "w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md shrink-0"}
      >
        <Plus className="w-4 h-4" />
      </button>

      {isModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full sm:w-[500px] h-[80vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 duration-300">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-start justify-between shrink-0">
              <div className="flex gap-4">
                <img src={item.imageUrl || item.image || 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400'} className="w-20 h-20 rounded-xl object-cover shadow-sm" />
                <div>
                  <h2 className="font-bold text-lg text-slate-900 leading-tight mb-1">{item.name}</h2>
                  <div className="text-red-600 font-bold">{(item.discountedPrice || item.price).toLocaleString('vi-VN')}đ</div>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1">
              <AddToCartForm 
                basePrice={item.discountedPrice || item.price} 
                optionGroups={item.optionGroups || []} 
                onAddToCart={handleConfirmAdd} 
              />
            </div>
            
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
