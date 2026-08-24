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
        <div className="flex items-center bg-red-50 rounded-full border border-red-100 p-0.5 shadow-sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <button 
            onClick={handleDecreaseClick}
            className="w-7 h-7 flex items-center justify-center text-red-600 hover:bg-white rounded-full transition-colors shrink-0"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-6 text-center text-xs font-bold text-red-600 shrink-0">{cartQuantity}</span>
          <button 
            onClick={handleAddClick}
            className="w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <button 
        onClick={handleAddClick}
        className={className || "w-7 h-7 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md shrink-0"}
      >
        <Plus className="w-4 h-4" />
      </button>
    );
  };

  return renderContent();
}
