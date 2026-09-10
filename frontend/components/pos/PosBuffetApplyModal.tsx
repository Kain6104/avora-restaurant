"use client";

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Utensils, Users, Plus, Minus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { PosProduct } from './pos-types';

export interface BuffetTicketOption {
  productId: string;
  product: PosProduct;
  quantity: number;
}

export interface BuffetPackageItemData {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  tickets: Array<{
    id: string;
    productId: string;
    product: PosProduct;
  }>;
  items: Array<{
    id: string;
    productId: string;
    product: PosProduct;
  }>;
}

export interface PosBuffetApplyModalProps {
  isOpen: boolean;
  branchId: string;
  tableName?: string;
  currentGuestCount?: number;
  onClose: () => void;
  onConfirmApply: (selectedTickets: Array<{ product: PosProduct; quantity: number }>, packageName: string) => void;
}

export const PosBuffetApplyModal: React.FC<PosBuffetApplyModalProps> = ({
  isOpen,
  branchId,
  tableName = 'Bàn',
  currentGuestCount = 1,
  onClose,
  onConfirmApply,
}) => {
  const [packages, setPackages] = useState<BuffetPackageItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen || !branchId) return;

    let isMounted = true;
    const fetchPackages = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/buffet/packages?branchId=${encodeURIComponent(branchId)}&onlyActive=true`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && isMounted) {
          setPackages(json.data);
          if (json.data.length > 0) {
            const first = json.data[0];
            setSelectedPackageId(first.id);
            // Default ticket counts: set first ticket to current guest count
            const initialCounts: Record<string, number> = {};
            if (first.tickets && first.tickets.length > 0) {
              initialCounts[first.tickets[0].productId] = Math.max(1, currentGuestCount);
            }
            setTicketCounts(initialCounts);
          }
        }
      } catch (e) {
        console.error('Error fetching buffet packages for POS modal:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchPackages();
    return () => {
      isMounted = false;
    };
  }, [isOpen, branchId, currentGuestCount]);

  if (!isOpen) return null;

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const handleSelectPackage = (pkg: BuffetPackageItemData) => {
    setSelectedPackageId(pkg.id);
    const newCounts: Record<string, number> = {};
    if (pkg.tickets && pkg.tickets.length > 0) {
      newCounts[pkg.tickets[0].productId] = Math.max(1, currentGuestCount);
    }
    setTicketCounts(newCounts);
  };

  const handleUpdateTicketCount = (productId: string, delta: number) => {
    setTicketCounts((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const totalTickets = Object.values(ticketCounts).reduce((sum, q) => sum + q, 0);

  const totalEstimate = selectedPackage?.tickets.reduce((sum, t) => {
    const qty = ticketCounts[t.productId] || 0;
    const price = t.product?.price || 0;
    return sum + price * qty;
  }, 0) || 0;

  const handleConfirm = () => {
    if (!selectedPackage) return;
    const itemsToAdd: Array<{ product: PosProduct; quantity: number }> = [];

    for (const t of selectedPackage.tickets) {
      const qty = ticketCounts[t.productId] || 0;
      if (qty > 0 && t.product) {
        itemsToAdd.push({
          product: {
            ...t.product,
            isBuffetTicket: true,
            buffetTicketPackageId: selectedPackage.id,
            buffetTicketPackageName: selectedPackage.name,
          },
          quantity: qty,
        });
      }
    }

    if (itemsToAdd.length === 0) {
      alert('Vui lòng chọn ít nhất 1 vé Buffet!');
      return;
    }

    onConfirmApply(itemsToAdd, selectedPackage.name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Áp Dụng Gói Buffet Cho Bàn</h2>
              <p className="text-xs text-red-100 font-medium">
                {tableName} • Đang phục vụ {currentGuestCount} khách
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#da251d]" />
              <span className="text-xs font-semibold">Đang tải danh sách gói Buffet...</span>
            </div>
          ) : packages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-2xl">
              <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
              <h3 className="text-sm font-extrabold text-slate-800">Chưa có gói Buffet tại chi nhánh này</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Vui lòng vào menu Quản lý Buffet trong trang Admin để cấu hình gói Buffet và vé tính tiền cho chi nhánh.
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Chọn gói Buffet */}
              <div>
                <label className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-2.5">
                  1. Chọn Gói Buffet Áp Dụng
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {packages.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id;
                    const ticketSample = pkg.tickets?.[0]?.product?.price;

                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handleSelectPackage(pkg)}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'border-[#da251d] bg-red-50/40 shadow-xs ring-2 ring-red-100'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={`text-sm font-extrabold ${isSelected ? 'text-[#da251d]' : 'text-slate-800'}`}>
                            {pkg.name}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#da251d] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 font-medium">{pkg.description}</p>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                          <span className="text-slate-400 font-medium">Gồm {pkg.items?.length || 0} món gọi 0đ</span>
                          {ticketSample !== undefined && (
                            <span className="font-extrabold text-[#da251d] font-mono">
                              Từ {ticketSample.toLocaleString('vi-VN')}đ
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Chọn số lượng vé Buffet */}
              {selectedPackage && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      2. Số Lượng Vé Tính Tiền
                    </label>
                    <span className="text-xs text-slate-400 font-semibold">
                      (Bàn có {currentGuestCount} khách)
                    </span>
                  </div>

                  {selectedPackage.tickets && selectedPackage.tickets.length > 0 ? (
                    <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      {selectedPackage.tickets.map((t) => {
                        const prod = t.product;
                        const qty = ticketCounts[prod.id] || 0;
                        const price = prod.price || 0;

                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-slate-900">{prod.name}</span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-200">
                                  Vé Buffet
                                </span>
                              </div>
                              <span className="text-xs font-bold text-slate-600 font-mono">
                                {price.toLocaleString('vi-VN')}đ / người
                              </span>
                            </div>

                            {/* Counter */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateTicketCount(prod.id, -1)}
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-black text-slate-900 font-mono">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateTicketCount(prod.id, 1)}
                                className="w-8 h-8 rounded-lg bg-[#da251d] hover:bg-red-700 text-white flex items-center justify-center font-bold transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                      Gói này chưa được gắn sản phẩm vé Buffet tính tiền. Vui lòng thiết lập trong trang quản trị.
                    </div>
                  )}
                </div>
              )}

              {/* Thông tin hỗ trợ */}
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-extrabold block">Cơ chế hoạt động sau khi áp dụng:</span>
                  <p className="text-[11px] text-sky-700">
                    • Các vé Buffet trên sẽ được thêm vào giỏ hàng và lưu vào đơn hàng.<br />
                    • Phiên Buffet sẽ tự động kích hoạt cho bàn này.<br />
                    • Nhân viên POS, Phục vụ Waiter và Khách quét QR đều sẽ được gọi các món trong gói với giá <strong>0đ</strong>.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[11px] text-slate-500 font-bold block">Tổng tiền vé dự tính:</span>
            <span className="text-base font-black text-[#da251d] font-mono">
              {totalEstimate.toLocaleString('vi-VN')}đ ({totalTickets} vé)
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={totalTickets === 0 || !selectedPackage}
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-[#da251d] hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Kích Hoạt Buffet Cho Bàn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
