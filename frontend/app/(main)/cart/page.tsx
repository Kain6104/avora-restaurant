"use client";

import React, { useState, useEffect } from 'react';
import { useCart, CartItem } from '../../../context/CartContext';
import Link from 'next/link';
import { 
  ShoppingCart, Plus, Minus, Trash2, ArrowLeft, 
  ShoppingBag, PencilLine, ShieldCheck, Truck, HeadphonesIcon, RefreshCcw, Heart, Ticket, X
} from 'lucide-react';
import EditCartItemModal from './EditCartItemModal';
import VoucherModal from '../../../components/VoucherModal';

export default function CartPage() {
  const { cartItems, updateQuantity, removeFromCart, updateCartItem, appliedVoucher, discountAmount, setVoucher, removeVoucher, getCartItemTotal, refreshQuotas, isLoaded } = useCart();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  
  const totalAmount = cartItems.reduce((acc, item) => acc + getCartItemTotal(item), 0);
  const finalAmount = Math.max(0, totalAmount - discountAmount);
  const totalQuantity = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    if (isLoaded) {
      refreshQuotas();
    }
  }, [isLoaded]);

  const applyVoucherCode = async (code: string) => {
    if (!code) return;
    setApplying(true);
    setVoucherError("");
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const res = await fetch('/api/promotions/vouchers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, orderValue: totalAmount, userId: user?.id })
      });
      const data = await res.json();
      if (res.ok) {
        setVoucher(data.voucher, data.discountAmount);
        setVoucherCode("");
        setIsVoucherModalOpen(false);
      } else {
        setVoucherError(data.message || 'Mã không hợp lệ');
      }
    } catch (err) {
      setVoucherError('Lỗi kết nối');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 min-h-[calc(100vh-100px)]">
      
      {/* Title */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
          <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Giỏ hàng của bạn</h1>
          <p className="text-slate-500 font-medium">{totalQuantity} món ăn</p>
        </div>
      </div>
      
      {cartItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 md:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="w-10 h-10 md:w-12 md:h-12 text-slate-300" />
          </div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 mb-2">Giỏ hàng trống</h2>
          <p className="text-slate-500 mb-6 md:mb-8 text-base md:text-lg">Chưa có món ăn nào trong giỏ hàng của bạn.</p>
          <Link href="/" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 md:px-8 md:py-4 rounded-lg font-bold transition-all hover:-translate-y-1 shadow-md shadow-red-600/20">
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> Tiếp tục chọn món
          </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          
          {/* LEFT: Cart Table & Info */}
          <div className="flex-1 space-y-4 md:space-y-6">
            
            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <div className="col-span-5">Món ăn</div>
                <div className="col-span-2 text-center">Đơn giá</div>
                <div className="col-span-2 text-center">Số lượng</div>
                <div className="col-span-2 text-right">Thành tiền</div>
                <div className="col-span-1"></div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-100">
                {cartItems.map((item) => (
                  <div key={item.id} className="p-3 md:px-6 md:py-5 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center group transition-colors hover:bg-slate-50/50">
                    
                    {/* Item Info (Image + Name + Options) */}
                    <div className="col-span-1 md:col-span-5 flex gap-3 md:gap-4">
                      <div className="relative shrink-0">
                        <img 
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=200'} 
                          alt={item.name} 
                          className="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover border border-slate-200 shadow-sm" 
                        />
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h3 className="font-bold text-slate-900 text-[14px] md:text-[15px] line-clamp-2">{item.name}</h3>
                        
                        {/* Badges could be dynamic, hardcoding a dummy one for UI parity if needed, or omit if no data */}
                        <div className="flex items-center gap-1.5 mt-1.5 mb-2">
                          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded text-[10px] font-bold">
                            <ShieldCheck className="w-3 h-3" /> Ngon nhất
                          </span>
                        </div>

                        {/* Options Text & Edit Button */}
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          {item.optionsTextSnapshot && (
                            <span className="line-clamp-1">{item.optionsTextSnapshot}</span>
                          )}
                          <button 
                            onClick={() => setEditingItem(item)}
                            className="flex items-center gap-1 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                          >
                            Ghi chú <PencilLine className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="col-span-1 md:col-span-2 flex md:flex-col items-center justify-between md:justify-center">
                      <span className="md:hidden text-slate-500 text-sm font-medium">Đơn giá:</span>
                      <div className="flex flex-row md:flex-col items-center md:items-center gap-2 md:gap-0.5">
                        <span className="font-bold text-red-600">{item.priceAtSale.toLocaleString('vi-VN')}đ</span>
                        {item.originalPriceAtSale && item.originalPriceAtSale > item.priceAtSale && (
                          <span className="text-xs text-slate-400 line-through font-medium">
                            {item.originalPriceAtSale.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center mt-1 md:mt-0">
                      <span className="md:hidden text-slate-500 text-sm font-medium">Số lượng:</span>
                      <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-0.5 md:p-1">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-slate-800 text-sm">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="col-span-1 md:col-span-2 flex flex-col items-end justify-center pr-0 md:pr-4">
                      <div className="flex items-center justify-between w-full md:w-auto md:justify-end">
                        <span className="md:hidden text-slate-500 text-sm font-medium">Thành tiền:</span>
                        <span className="font-black text-slate-900 text-base">
                          {getCartItemTotal(item).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end md:justify-center mt-2 md:mt-0 absolute md:relative top-2 right-2 md:top-auto md:right-auto">
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 md:p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100 bg-white md:bg-transparent shadow-sm md:shadow-none border border-slate-100 md:border-transparent"
                        title="Xóa món ăn"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    
                  </div>
                ))}
              </div>
            </div>

            {/* Info Badges */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Giao hàng nhanh</p>
                    <p className="text-xs text-slate-500">30-45 phút</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Thanh toán an toàn</p>
                    <p className="text-xs text-slate-500">Bảo mật tuyệt đối</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                    <HeadphonesIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Hỗ trợ 24/7</p>
                    <p className="text-xs text-slate-500">Luôn sẵn sàng hỗ trợ</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                    <RefreshCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Đổi trả dễ dàng</p>
                    <p className="text-xs text-slate-500">Trong 7 ngày</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Thank you note */}
            <div className="bg-red-50/50 rounded-xl border border-red-200 p-4 md:p-6 flex items-center justify-between overflow-hidden relative">
              <div className="flex items-center gap-3 md:gap-4 relative z-10">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-red-500">
                  <Heart className="w-6 h-6 fill-red-500" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Cảm ơn bạn đã chọn Avora!</h4>
                  <p className="text-sm text-slate-600">Chúc bạn có những trải nghiệm ẩm thực tuyệt vời.</p>
                </div>
              </div>
              <img src="/avora_logo.png" className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 object-contain rotate-12" alt="bg" />
            </div>

          </div>
          
          {/* RIGHT: Order Summary */}
          <div className="w-full lg:w-[360px] shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 md:p-6 sticky top-24">
              
              <div className="flex items-center gap-2 mb-4 md:mb-6">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-slate-600" />
                </div>
                <h2 className="font-bold text-lg text-slate-900">Tóm tắt đơn hàng</h2>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Tạm tính ({totalQuantity} món)</span>
                  <span className="font-bold text-slate-800">{totalAmount.toLocaleString('vi-VN')}đ</span>
                </div>
                {appliedVoucher && (
                  <div className="flex justify-between text-green-600">
                    <span className="font-medium">Giảm giá ({appliedVoucher.code})</span>
                    <span className="font-bold">-{discountAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
              </div>

              {/* VOUCHER SECTION */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-800">Khuyến mãi</span>
                  <button onClick={() => setIsVoucherModalOpen(true)} className="text-xs font-bold text-red-600 hover:underline">Chọn mã</button>
                </div>
                
                {appliedVoucher ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-bold text-green-800 text-sm">{appliedVoucher.code}</p>
                        <p className="text-xs text-green-600">Đã áp dụng mã giảm giá</p>
                      </div>
                    </div>
                    <button onClick={removeVoucher} className="p-1.5 hover:bg-green-100 rounded-full text-green-700 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        placeholder="Nhập mã giảm giá"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all uppercase"
                      />
                      <button 
                        disabled={applying || !voucherCode}
                        onClick={() => applyVoucherCode(voucherCode)}
                        className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold px-4 rounded-xl text-sm transition-colors"
                      >
                        {applying ? '...' : 'Áp dụng'}
                      </button>
                    </div>
                    {voucherError && <p className="text-red-500 text-xs mt-2 font-medium">{voucherError}</p>}
                  </div>
                )}
              </div>
              
              <div className="border-t border-slate-100 border-dashed my-6"></div>
              
              <div className="flex justify-between items-end mb-4">
                <span className="font-bold text-slate-900 text-lg">Tổng cộng</span>
                <span className="font-black text-red-600 text-2xl">{finalAmount.toLocaleString('vi-VN')}đ</span>
              </div>
              
              <div className="bg-slate-50 text-slate-600 text-[12px] md:text-[13px] p-3 md:p-4 rounded-lg border border-slate-200 mb-5 md:mb-6 flex gap-2 md:gap-3 leading-relaxed font-medium">
                <ShoppingBag className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-slate-500 mt-0.5" />
                <p>Bạn chỉ cần xác nhận đơn hàng, phí giao hàng sẽ được tính ở bước <strong>thanh toán</strong>.</p>
              </div>

              <Link 
                href="/checkout"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-4 rounded-lg transition-all shadow-md shadow-red-600/20 flex items-center justify-center gap-2 hover:-translate-y-0.5"
              >
                Tiến hành thanh toán
              </Link>
              
              <Link 
                href="/" 
                className="block text-center mt-3 md:mt-4 py-3 md:py-4 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Tiếp tục chọn món
              </Link>
            </div>
          </div>

        </div>
      )}

      {/* Edit Option Modal */}
      {editingItem && (
        <EditCartItemModal 
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updatedItem) => {
            updateCartItem(editingItem.id, updatedItem);
            setEditingItem(null);
          }}
        />
      )}

      <VoucherModal 
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        orderValue={totalAmount}
        onApply={(v) => applyVoucherCode(v.code)}
      />
    </div>
  );
}
