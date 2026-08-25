"use client";

import React, { useState, useEffect } from 'react';
import { useCart, CartItem } from '../../../context/CartContext';
import Link from 'next/link';
import {
  ShoppingCart, Plus, Minus, Trash2, ArrowLeft,
  ShoppingBag, PencilLine, ShieldCheck, Truck, HeadphonesIcon, RefreshCcw, Heart, Ticket, X, ChevronRight
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
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
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
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 min-h-[calc(100vh-100px)] lg:pb-2 bg-slate-50/30 sm:bg-transparent">

      {/* Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-8 px-1 sm:px-0">
        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-red-50 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
          <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Giỏ hàng</h1>
          <p className="text-[11px] sm:text-sm text-slate-500 font-medium">{totalQuantity} món ăn</p>
        </div>
      </div>

      {cartItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-16 flex flex-col items-center justify-center text-center mx-1 sm:mx-0">
          <div className="w-20 h-20 sm:w-32 sm:h-32 bg-slate-50 rounded-full flex items-center justify-center mb-5 sm:mb-6">
            <ShoppingCart className="w-8 h-8 sm:w-12 sm:h-12 text-slate-300" />
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-1.5 sm:mb-2">Giỏ hàng trống</h2>
          <p className="text-slate-500 mb-6 sm:mb-8 text-sm sm:text-lg">Chưa có món ăn nào trong giỏ hàng.</p>
          <Link href="/" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 sm:px-8 sm:py-4 rounded-xl font-bold transition-all hover:-translate-y-1 shadow-md shadow-red-600/20 active:scale-95 text-sm sm:text-base">
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Chọn món ngay
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-8">

            {/* LEFT: Cart Table & Info */}
            <div className="flex-1 space-y-4 sm:space-y-6">

              {/* Cart List */}
              <div className="bg-white rounded-2xl sm:rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-6">Món ăn</div>
                  <div className="col-span-2 text-center">Đơn giá</div>
                  <div className="col-span-2 text-center">Số lượng</div>
                  <div className="col-span-2 text-right">Thành tiền</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {cartItems.map((item) => (
                    <div key={item.id} className="p-3 sm:p-5 flex gap-3 sm:gap-4 relative hover:bg-slate-50/50 transition-colors group items-center sm:items-start">

                      {/* Image */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative">
                        <img
                          src={item.imageUrl || 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=200'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        {item.isFlashSaleItem && (
                          <div className="absolute top-0 left-0 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg z-10">
                            SALE
                          </div>
                        )}
                      </div>

                      {/* Details Container */}
                      <div className="flex-1 min-w-0 flex flex-col sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center h-full sm:h-auto">

                        {/* Name & Options */}
                        <div className="sm:col-span-6 flex flex-col justify-center sm:justify-start">
                          <div className="flex justify-between items-start pr-6 sm:pr-0">
                            <h3 className="font-bold text-slate-900 text-sm sm:text-[15px] line-clamp-2 leading-tight">
                              <Link 
                                href={item.rawProduct?.category?.slug && item.rawProduct?.slug ? `/${item.rawProduct.category.slug}/${item.rawProduct.slug}` : `/menu`} 
                                className="hover:text-red-600 transition-colors"
                              >
                                {item.name}
                              </Link>
                            </h3>

                            {/* Desktop Delete */}
                            <button onClick={() => removeFromCart(item.id)} className="hidden sm:flex p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute top-4 right-4 opacity-0 group-hover:opacity-100">
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {item.optionsTextSnapshot && (
                            <div className="text-[11px] text-slate-500 mt-0.5 sm:mt-1 line-clamp-1">{item.optionsTextSnapshot}</div>
                          )}

                          {item.note && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5 sm:mt-1 line-clamp-1">Ghi chú: {item.note}</div>
                          )}

                          <button onClick={() => setEditingItem(item)} className="text-[10px] text-blue-500 flex items-center gap-1 mt-1 sm:mt-1.5 font-medium hover:underline w-fit shrink-0">
                            <PencilLine size={12} /> Tùy chọn / Ghi chú
                          </button>
                        </div>

                        {/* Price (Desktop only - Mobile merged below) */}
                        <div className="hidden sm:flex sm:col-span-2 flex-col items-center justify-center">
                          <span className="font-bold text-slate-900">{item.priceAtSale.toLocaleString('vi-VN')}đ</span>
                          {item.originalPriceAtSale > item.priceAtSale && (
                            <span className="text-[10px] text-slate-400 line-through">{item.originalPriceAtSale.toLocaleString('vi-VN')}đ</span>
                          )}
                        </div>

                        {/* Mobile Bottom Row (Price + Quantity) & Desktop Quantity */}
                        <div className="flex items-center justify-between sm:justify-center mt-2 sm:mt-0 sm:col-span-2">
                          {/* Mobile Price */}
                          <div className="flex sm:hidden flex-col">
                            <span className="font-black text-red-600 text-sm">{item.priceAtSale.toLocaleString('vi-VN')}đ</span>
                            {item.originalPriceAtSale > item.priceAtSale && (
                              <span className="text-[9px] text-slate-400 line-through">{item.originalPriceAtSale.toLocaleString('vi-VN')}đ</span>
                            )}
                          </div>

                          {/* Quantity Control */}
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm h-7 sm:h-8">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 sm:w-8 h-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-l-lg"><Minus size={14} /></button>
                            <span className="w-6 sm:w-8 text-center text-xs sm:text-sm font-bold text-slate-800">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 sm:w-8 h-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-r-lg"><Plus size={14} /></button>
                          </div>
                        </div>

                        {/* Total (Desktop only) */}
                        <div className="hidden sm:flex sm:col-span-2 justify-end pr-8">
                          <span className="font-black text-red-600 text-[15px]">
                            {getCartItemTotal(item).toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                      </div>

                      {/* Mobile Delete */}
                      <button onClick={() => removeFromCart(item.id)} className="sm:hidden absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                        <X size={16} />
                      </button>

                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT: Order Summary */}
            <div className="w-full lg:w-[340px] shrink-0">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 lg:sticky lg:top-24">

                <div className="hidden sm:flex items-center gap-2 mb-4">
                  <h2 className="font-bold text-lg text-slate-900">Tóm tắt đơn hàng</h2>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-slate-600 text-sm">
                    <span className="font-medium">Tạm tính ({totalQuantity} món)</span>
                    <span className="font-bold text-slate-800">{totalAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {appliedVoucher && (
                    <div className="flex justify-between text-green-600 text-sm">
                      <span className="font-medium">Giảm giá ({appliedVoucher.code})</span>
                      <span className="font-bold">-{discountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>

                {/* VOUCHER SECTION */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Ticket size={16} className="text-red-500" /> Ưu đãi</span>
                    <button onClick={() => setIsVoucherModalOpen(true)} className="text-xs font-bold text-red-600 hover:underline">Chọn mã</button>
                  </div>

                  {appliedVoucher ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2.5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center"><Ticket className="w-3.5 h-3.5 text-green-600" /></div>
                        <div>
                          <p className="font-bold text-green-800 text-xs">{appliedVoucher.code}</p>
                          <p className="text-[10px] text-green-600">Đã áp dụng mã</p>
                        </div>
                      </div>
                      <button onClick={removeVoucher} className="p-1 hover:bg-green-100 rounded-full text-green-700 transition-colors">
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
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all uppercase placeholder:normal-case"
                        />
                        <button
                          disabled={applying || !voucherCode}
                          onClick={() => applyVoucherCode(voucherCode)}
                          className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold px-3.5 rounded-xl text-sm transition-colors"
                        >
                          {applying ? '...' : 'Áp dụng'}
                        </button>
                      </div>
                      {voucherError && <p className="text-red-500 text-[11px] mt-1.5 font-medium px-1">{voucherError}</p>}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 border-dashed my-4"></div>

                <div className="flex justify-between items-end mb-4">
                  <span className="font-bold text-slate-900 text-base sm:text-lg">Tổng cộng</span>
                  <span className="font-black text-red-600 text-xl sm:text-2xl leading-none">{finalAmount.toLocaleString('vi-VN')}đ</span>
                </div>

                <div className="bg-slate-50 text-slate-500 text-[11px] p-2.5 rounded-xl border border-slate-100 mb-5 flex gap-2 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-slate-400" />
                  <p>Bạn chỉ cần xác nhận đơn hàng, phí giao hàng sẽ được tính ở bước <strong>thanh toán</strong>.</p>
                </div>

                {/* Desktop Checkout Button */}
                <Link
                  href="/checkout"
                  className="hidden lg:flex w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 items-center justify-center gap-2 hover:-translate-y-0.5"
                >
                  Tiến hành thanh toán
                </Link>

                {/* Continue Shopping Button */}
                <Link
                  href="/"
                  className="flex lg:hidden lg:text-center mt-2 py-3 rounded-xl bg-slate-50 border-0 border-slate-100 text-slate-600 hover:bg-slate-100 font-bold text-sm transition-colors items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Thêm món khác
                </Link>
                <Link
                  href="/"
                  className="hidden lg:flex justify-center mt-3 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Tiếp tục chọn món
                </Link>
              </div>
            </div>

          </div>

          {/* BELOW EVERYTHING: Info Badges & Thank you note */}
          <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-8">
            {/* Info Badges - Horizontal Scroll on Mobile */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3 sm:p-5">
              <div className="flex overflow-x-auto gap-2 sm:grid sm:grid-cols-4 sm:gap-4 pb-1 sm:pb-0 hide-scrollbar snap-x">
                <div className="snap-start shrink-0 w-[140px] sm:w-auto flex items-center gap-2.5 bg-slate-50/50 sm:bg-transparent border border-slate-100 sm:border-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                    <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-[11px] sm:text-sm leading-tight">Giao nhanh</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">30-45 phút</p>
                  </div>
                </div>
                <div className="snap-start shrink-0 w-[140px] sm:w-auto flex items-center gap-2.5 bg-slate-50/50 sm:bg-transparent border border-slate-100 sm:border-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-[11px] sm:text-sm leading-tight">An toàn</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Bảo mật 100%</p>
                  </div>
                </div>
                <div className="snap-start shrink-0 w-[140px] sm:w-auto flex items-center gap-2.5 bg-slate-50/50 sm:bg-transparent border border-slate-100 sm:border-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                    <HeadphonesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-[11px] sm:text-sm leading-tight">Hỗ trợ 24/7</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Luôn sẵn sàng</p>
                  </div>
                </div>
                <div className="snap-start shrink-0 w-[140px] sm:w-auto flex items-center gap-2.5 bg-slate-50/50 sm:bg-transparent border border-slate-100 sm:border-transparent p-2.5 sm:p-0 rounded-xl sm:rounded-none">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                    <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-[11px] sm:text-sm leading-tight">Đổi trả</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Dễ dàng</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Thank you note */}
            <div className="bg-red-50/50 rounded-2xl border border-red-100 p-3 sm:p-5 flex items-center justify-between overflow-hidden relative">
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-red-500 shrink-0">
                  <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-red-500" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Cảm ơn bạn đã chọn Avora!</h4>
                  <p className="text-[11px] sm:text-xs text-slate-600">Chúc bạn có trải nghiệm tuyệt vời.</p>
                </div>
              </div>
              <img src="/avora_logo.png" className="absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] object-contain rotate-12" alt="bg" />
            </div>
          </div>
        </>
      )}

      {/* Mobile Fixed Bottom Checkout Bar */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 pb-safe shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-1000 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-medium">Tổng thanh toán</span>
            <span className="text-[17px] font-black text-red-600 leading-tight">{finalAmount.toLocaleString('vi-VN')}đ</span>
          </div>
          <Link href="/checkout" className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-red-600/20 active:scale-95 transition-all text-sm">
            Thanh toán <ChevronRight size={16} className="-mr-1 opacity-80" />
          </Link>
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

      {/* CSS for hide-scrollbar and pb-safe */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .pb-safe {
          padding-bottom: env(safe-area-inset-bottom, 12px);
        }
      `}} />
    </div>
  );
}
