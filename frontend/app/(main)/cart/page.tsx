"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useCart, CartItem, consolidateCartList } from '../../../context/CartContext';
import Link from 'next/link';
import {
  ShoppingCart, Plus, Minus, Trash2, ArrowLeft,
  ShoppingBag, PencilLine, ShieldCheck, Truck, HeadphonesIcon, RefreshCcw, Heart, X, Store, AlertCircle, Utensils, Check
} from 'lucide-react';
import EditCartItemModal from './EditCartItemModal';
import BranchAvailabilityModal from '../../../components/cart/BranchAvailabilityModal';
import DishReplacementModal from '../../../components/cart/DishReplacementModal';

export default function CartPage() {
  const {
    cartItems,
    updateQuantity,
    updateCartItem,
    removeFromCart,
    appliedVoucher,
    discountAmount,
    getCartItemTotal,
    refreshQuotas,
    isLoaded,
    currentBranchId,
    setIsBranchModalOpen,
    changeBranch,
    selectedItemIds,
    toggleSelectItem,
    selectAllItems,
    syncCartWithServer,
  } = useCart();

  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [activeBranch, setActiveBranch] = useState<any>(null);

  // Modals state
  const [availabilityModalProduct, setAvailabilityModalProduct] = useState<{ id: string; name: string } | null>(null);
  const [replacementModalItem, setReplacementModalItem] = useState<CartItem | null>(null);

  const displayItems = cartItems;
  const availableItems = useMemo(() => displayItems.filter((i) => i.isAvailableAtBranch !== false), [displayItems]);
  const unavailableItems = useMemo(() => displayItems.filter((i) => i.isAvailableAtBranch === false), [displayItems]);

  const selectedItems = useMemo(
    () => displayItems.filter((i) => selectedItemIds.includes(i.id) && i.isAvailableAtBranch !== false),
    [displayItems, selectedItemIds]
  );

  const isAllAvailableSelected = availableItems.length > 0 && availableItems.every((i) => selectedItemIds.includes(i.id));

  const selectedSubtotal = useMemo(
    () => selectedItems.reduce((acc, item) => acc + getCartItemTotal(item), 0),
    [selectedItems, getCartItemTotal]
  );
  const finalAmount = Math.max(0, selectedSubtotal - discountAmount);
  const totalQuantity = displayItems.reduce((acc, item) => acc + item.quantity, 0);

  // Mặc định luôn chọn tất cả món ăn khả dụng trong giỏ hàng
  useEffect(() => {
    if (availableItems.length > 0) {
      const availIds = availableItems.map((i) => i.id);
      const hasAnyValidSelection = selectedItemIds.some((id) => availIds.includes(id));
      if (selectedItemIds.length === 0 || !hasAnyValidSelection) {
        selectAllItems(true);
      }
    }
  }, [availableItems, selectedItemIds, selectAllItems]);

  useEffect(() => {
    if (isLoaded) {
      refreshQuotas();
      syncCartWithServer();
    }
  }, [isLoaded]);

  useEffect(() => {
    fetch('/api/home/branches', { headers: { 'ngrok-skip-browser-warning': 'true' } })
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const bId =
            currentBranchId ||
            (typeof window !== 'undefined'
              ? localStorage.getItem('currentBranchId') || localStorage.getItem('selectedBranchId')
              : null);
          const found = list.find((b: any) => b.id === bId) || list[0];
          setActiveBranch(found);
        }
      })
      .catch(() => {});
  }, [currentBranchId]);

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 min-h-[calc(100vh-100px)] lg:pb-2 bg-slate-50/30 sm:bg-transparent">
      {/* Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-8 px-1 sm:px-0">
        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-red-50 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
          <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Giỏ hàng của bạn</h1>
          <p className="text-[11px] sm:text-sm text-slate-500 font-medium">
            {totalQuantity} món ăn • {availableItems.length} món sẵn sàng phục vụ
          </p>
        </div>
      </div>

      {displayItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-16 flex flex-col items-center justify-center text-center mx-1 sm:mx-0">
          <div className="w-20 h-20 sm:w-32 sm:h-32 bg-slate-50 rounded-full flex items-center justify-center mb-5 sm:mb-6">
            <ShoppingCart className="w-8 h-8 sm:w-12 sm:h-12 text-slate-300" />
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-slate-800 mb-1.5 sm:mb-2">Giỏ hàng trống</h2>
          <p className="text-slate-500 mb-6 sm:mb-8 text-sm sm:text-lg">Chưa có món ăn nào trong giỏ hàng.</p>
          <Link
            href="/"
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 sm:px-8 sm:py-4 rounded-xl font-bold transition-all hover:-translate-y-1 shadow-md shadow-red-600/20 active:scale-95 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Chọn món ngay
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-8">
            {/* LEFT: Cart Table & Info */}
            <div className="flex-1 space-y-3.5 sm:space-y-4">
              {/* Serving Branch Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                    <Store className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Chi nhánh đang chọn
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {activeBranch?.name || 'Chi nhánh AVORA'}
                    </div>
                    {activeBranch?.street && (
                      <div className="text-xs text-slate-500 truncate">
                        {activeBranch.street}, {activeBranch.district || ''}, {activeBranch.province || ''}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                >
                  Đổi chi nhánh
                </button>
              </div>

              {/* Select All Bar */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-bold text-slate-800 select-none">
                  <input
                    type="checkbox"
                    checked={isAllAvailableSelected}
                    onChange={(e) => selectAllItems(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer accent-red-600"
                  />
                  <span>
                    Chọn tất cả ({selectedItems.length}/{availableItems.length} món)
                  </span>
                </label>

                {unavailableItems.length > 0 && (
                  <span className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                    {unavailableItems.length} món không khả dụng tại chi nhánh này
                  </span>
                )}
              </div>

              {/* Cart Items List */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Desktop Table Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider items-center">
                  <div className="col-span-1 text-center">Chọn</div>
                  <div className="col-span-5">Món ăn</div>
                  <div className="col-span-2 text-center">Đơn giá</div>
                  <div className="col-span-2 text-center">Số lượng</div>
                  <div className="col-span-2 text-right pr-2">Thành tiền</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {displayItems.map((item) => {
                    const isUnavailable = item.isAvailableAtBranch === false;
                    const isSelected = selectedItemIds.includes(item.id) && !isUnavailable;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:px-6 sm:py-4 flex flex-col gap-2 relative transition-colors ${
                          isUnavailable
                            ? 'bg-slate-50/70 border-l-4 border-l-amber-400'
                            : 'hover:bg-slate-50/40'
                        }`}
                      >
                        {/* Desktop Row: Chuẩn Grid 12 cột khớp 100% với Header, không bao giờ bị đè giá */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 items-center">
                          {/* Checkbox */}
                          <div className="col-span-1 flex items-center justify-center">
                            <input
                              type="checkbox"
                              disabled={isUnavailable}
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer accent-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Hình ảnh + Tên món & Options */}
                          <div className="col-span-5 flex items-center gap-3.5 min-w-0">
                            <div
                              className={`w-16 h-16 sm:w-18 sm:h-18 shrink-0 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 relative ${
                                isUnavailable ? 'grayscale opacity-70' : ''
                              }`}
                            >
                              <img
                                src={
                                  item.imageUrl ||
                                  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200'
                                }
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                              {item.isFlashSaleItem && (
                                <div className="absolute top-0 left-0 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg z-10">
                                  SALE
                                </div>
                              )}
                              {item.isCombo && (
                                <div className="absolute top-0 left-0 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-br-lg z-10">
                                  COMBO
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3
                                className={`font-bold text-sm leading-snug line-clamp-2 ${
                                  isUnavailable ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {item.name}
                              </h3>

                              {item.optionsTextSnapshot && (
                                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                  {item.optionsTextSnapshot}
                                </div>
                              )}

                              {item.note && (
                                <div className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">
                                  Ghi chú: {item.note}
                                </div>
                              )}

                              {!isUnavailable && (
                                <button
                                  type="button"
                                  onClick={() => setEditingItem(item)}
                                  className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-1 font-semibold hover:underline w-fit cursor-pointer"
                                >
                                  <PencilLine size={11} /> Tùy chọn / Ghi chú
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Đơn giá */}
                          <div className="col-span-2 text-center">
                            <span
                              className={`font-semibold text-sm ${
                                isUnavailable ? 'line-through text-slate-400' : 'text-slate-800'
                              }`}
                            >
                              {(Number(item.priceAtSale) || 0).toLocaleString('vi-VN')}đ
                            </span>
                          </div>

                          {/* Bộ chọn số lượng */}
                          <div className="col-span-2 flex items-center justify-center">
                            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs h-8 shrink-0">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-full flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-l-lg transition-colors cursor-pointer"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-slate-800 select-none">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-full flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-r-lg transition-colors cursor-pointer"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Thành tiền & Nút xóa */}
                          <div className="col-span-2 flex items-center justify-end gap-3 pr-2">
                            <span
                              className={`font-black text-sm text-right whitespace-nowrap ${
                                isUnavailable ? 'line-through text-slate-400' : 'text-red-600 font-mono'
                              }`}
                            >
                              {(getCartItemTotal(item) || 0).toLocaleString('vi-VN')}đ
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Xóa món"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Giao diện Mobile (< sm) */}
                        <div className="flex sm:hidden gap-3 items-start">
                          {/* Checkbox */}
                          <div className="shrink-0 flex items-center justify-center pt-1.5">
                            <input
                              type="checkbox"
                              disabled={isUnavailable}
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer accent-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Image */}
                          <div
                            className={`w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative ${
                              isUnavailable ? 'grayscale opacity-70' : ''
                            }`}
                          >
                            <img
                              src={
                                item.imageUrl ||
                                'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200'
                              }
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            {item.isFlashSaleItem && (
                              <div className="absolute top-0 left-0 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-br-lg z-10">
                                SALE
                              </div>
                            )}
                            {item.isCombo && (
                              <div className="absolute top-0 left-0 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-br-lg z-10">
                                COMBO
                              </div>
                            )}
                          </div>

                          {/* Info & Quantity */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h3
                                className={`font-bold text-xs leading-snug line-clamp-2 ${
                                  isUnavailable ? 'line-through text-slate-400' : 'text-slate-900'
                                }`}
                              >
                                {item.name}
                              </h3>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                              >
                                <X size={15} />
                              </button>
                            </div>

                            {item.optionsTextSnapshot && (
                              <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                {item.optionsTextSnapshot}
                              </div>
                            )}

                            {item.note && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-1">
                                Ghi chú: {item.note}
                              </div>
                            )}

                            {!isUnavailable && (
                              <button
                                type="button"
                                onClick={() => setEditingItem(item)}
                                className="text-[10px] text-blue-500 flex items-center gap-0.5 mt-1 font-medium hover:underline w-fit"
                              >
                                <PencilLine size={11} /> Tùy chọn / Ghi chú
                              </button>
                            )}

                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50">
                              <span
                                className={`font-bold text-xs ${
                                  isUnavailable ? 'line-through text-slate-400' : 'text-red-600 font-mono'
                                }`}
                              >
                                {(getCartItemTotal(item) || 0).toLocaleString('vi-VN')}đ
                              </span>

                              <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs h-7 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-7 h-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-l-lg"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-slate-800">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-r-lg"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Unavailable Notice & Resolution Actions */}
                        {isUnavailable && (
                          <div className="mt-1 sm:ml-9 p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 text-amber-800 text-xs">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="font-semibold">
                                {item.unavailabilityMessage || 'Món không phục vụ tại chi nhánh này!'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setAvailabilityModalProduct({ id: item.productId, name: item.name })
                                }
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-amber-300 text-amber-900 rounded-lg font-bold text-[11px] transition-colors shadow-2xs"
                              >
                                Xem chi nhánh có hàng
                              </button>
                              <button
                                type="button"
                                onClick={() => setReplacementModalItem(item)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] transition-colors shadow-2xs"
                              >
                                Chọn món thay thế
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                    <span className="font-medium">Đã chọn ({selectedItems.length} món)</span>
                    <span className="font-bold text-slate-800">{selectedSubtotal.toLocaleString('vi-VN')}đ</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 text-sm">
                      <span className="font-medium">Giảm giá ưu đãi</span>
                      <span className="font-bold">-{discountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 border-dashed my-4"></div>

                <div className="flex justify-between items-end mb-4">
                  <span className="font-bold text-slate-900 text-base sm:text-lg">Tổng cộng</span>
                  <span className="font-black text-red-600 text-xl sm:text-2xl leading-none">
                    {finalAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>

                <div className="bg-slate-50 text-slate-500 text-[11px] p-2.5 rounded-xl border border-slate-100 mb-5 flex gap-2 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-slate-400" />
                  <p>
                    Bạn chỉ cần xác nhận các món cần đặt, phí giao hàng sẽ được tính ở bước <strong>thanh toán</strong>.
                  </p>
                </div>

                {/* Checkout Button */}
                {selectedItems.length > 0 ? (
                  <Link
                    href="/checkout"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(
                          'checkoutSelectedItems',
                          JSON.stringify(selectedItems.map((i) => i.id))
                        );
                      }
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 hover:-translate-y-0.5"
                  >
                    Tiến hành thanh toán ({selectedItems.length} món)
                  </Link>
                ) : (
                  <button
                    disabled
                    className="w-full bg-slate-200 text-slate-400 font-bold py-3.5 rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Chọn ít nhất 1 món để thanh toán
                  </button>
                )}

                <Link
                  href="/"
                  className="flex justify-center mt-3 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm transition-colors items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Tiếp tục chọn món
                </Link>
              </div>
            </div>
          </div>

          {/* Info Badges */}
          <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-8">
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
          </div>
        </>
      )}

      {/* Edit Options Modal */}
      {editingItem && (
        <EditCartItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updated) => {
            updateCartItem(editingItem.id, updated);
            setEditingItem(null);
          }}
        />
      )}

      {/* Branch Availability Modal */}
      {availabilityModalProduct && (
        <BranchAvailabilityModal
          isOpen={!!availabilityModalProduct}
          onClose={() => setAvailabilityModalProduct(null)}
          productId={availabilityModalProduct.id}
          productName={availabilityModalProduct.name}
          currentBranchId={currentBranchId}
          onSwitchBranch={(newBranchId) => {
            changeBranch(newBranchId);
          }}
        />
      )}

      {/* Dish Replacement Modal */}
      {replacementModalItem && (
        <DishReplacementModal
          isOpen={!!replacementModalItem}
          onClose={() => setReplacementModalItem(null)}
          cartItem={replacementModalItem}
          branchId={currentBranchId}
          onReplacementSuccess={() => {
            syncCartWithServer();
          }}
        />
      )}
    </div>
  );
}
