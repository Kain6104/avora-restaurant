"use client";

import React from 'react';
import { useCart } from '../../../context/CartContext';
import Link from 'next/link';
import { ShoppingCart, Plus, Minus, Trash2, ArrowLeft } from 'lucide-react';

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart } = useCart();
  
  const totalAmount = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 min-h-screen">
      <h1 className="text-2xl font-black text-slate-900 mb-6 uppercase">Giỏ hàng của bạn</h1>
      
      {cartItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Giỏ hàng trống</h2>
          <p className="text-slate-500 mb-6">Chưa có món ăn nào trong giỏ hàng của bạn.</p>
          <Link href="/" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
          </Link>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex items-center gap-4">
                <img src={item.imageUrl || 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=200'} alt={item.name} className="w-20 h-20 rounded-lg object-cover" />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 line-clamp-1">{item.name}</h3>
                  <div className="text-red-600 font-bold mt-1">{item.price.toLocaleString('vi-VN')}đ</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-600 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold text-slate-800 text-sm">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="w-full md:w-[320px] shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 sticky top-24">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Tóm tắt đơn hàng</h2>
              <div className="flex justify-between mb-2 text-slate-600">
                <span>Tổng tiền món</span>
                <span className="font-medium">{totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="border-t border-slate-100 my-4"></div>
              <div className="flex justify-between mb-6">
                <span className="font-bold text-slate-900">Tổng cộng</span>
                <span className="font-black text-red-600 text-xl">{totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
              <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md">
                Tiến hành thanh toán
              </button>
              <Link href="/" className="block text-center mt-4 text-sm text-slate-500 hover:text-red-600 font-medium transition-colors">
                Tiếp tục chọn món
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
