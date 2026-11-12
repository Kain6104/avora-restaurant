"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import AddToCartForm from './AddToCartForm';

export default function AddToCartButton({ item, className }: { item: any, className?: string }) {
  const { addToCart, currentBranchId, cartItems, updateQuantity, removeFromCart, setBranchModalProduct } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const productCartItems = cartItems?.filter((i: any) => i.productId === item.id) || [];
  const cartQuantity = productCartItems.reduce((acc: number, curr: any) => acc + curr.quantity, 0);
  const cartItemToDecrease = productCartItems[productCartItems.length - 1];

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation(); // Prevent bubbling up to the parent <Link>
    
    let branch = currentBranchId;
    if (!branch && typeof window !== 'undefined') {
      branch = localStorage.getItem('selectedBranchId') || 'AVO-Q1';
    }
    
    if (item.branches && item.branches.length > 0) {
      const isAvailable = item.branches.some((b: any) => b.id === branch);
      if (!isAvailable) {
        setBranchModalProduct(item);
        return;
      }
    }

    const priceAtSale = item.flashSalePrice || item.discountedPrice || item.price;
    const originalPriceAtSale = item.price;
    const cartItem = {
      id: item.id,
      productId: item.id,
      name: item.name,
      originalPriceAtSale,
      priceAtSale,
      quantity: 1,
      imageUrl: item.imageUrl || item.image,
      isFlashSaleItem: !!item.flashSalePrice,
      flashSaleId: item.flashSaleId,
      flashSaleStock: item.flashSaleStock,
      flashSaleSold: item.flashSaleSold,
      maxQuantityPerUser: item.maxQuantityPerUser,
      rawProduct: item
    };
    
    addToCart(cartItem, branch || 'AVO-Q1');
  };

  const handleDecreaseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItemToDecrease) {
      if (cartItemToDecrease.quantity > 1) {
        updateQuantity(cartItemToDecrease.id, cartItemToDecrease.quantity - 1);
      } else {
        removeFromCart(cartItemToDecrease.id);
      }
    }
  };

  const renderContent = () => {
    if (mounted && cartQuantity > 0) {
      return (
        <div 
          className="flex items-center bg-red-50/90 rounded-full border border-red-200/80 p-0.5 shadow-xs shrink-0 max-w-fit" 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button 
            type="button"
            onClick={handleDecreaseClick}
            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 flex items-center justify-center text-red-600 hover:bg-white rounded-full transition-colors shrink-0 active:scale-90"
            title="Giảm số lượng"
          >
            <Minus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 stroke-[2.5]" />
          </button>
          <span className="min-w-[15px] sm:min-w-[18px] md:min-w-[20px] text-center text-[10.5px] sm:text-xs font-black text-red-600 shrink-0 px-0.5">
            {cartQuantity}
          </span>
          <button 
            type="button"
            onClick={handleAddClick}
            className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors shadow-xs shrink-0 active:scale-90"
            title="Tăng số lượng"
          >
            <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 stroke-[2.5]" />
          </button>
        </div>
      );
    }

    return (
      <button 
        type="button"
        onClick={handleAddClick}
        className={className || "w-6 h-6 sm:w-7 sm:h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md shrink-0 active:scale-95"}
        title="Thêm vào giỏ hàng"
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
      </button>
    );
  };

  return renderContent();
}
