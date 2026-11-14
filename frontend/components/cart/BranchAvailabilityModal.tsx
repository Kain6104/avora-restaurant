'use client';

import React, { useState, useEffect } from 'react';
import { Store, MapPin, Phone, Clock, X, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BranchAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string | null;
  productName: string | null;
  currentBranchId: string;
  onSwitchBranch: (branchId: string) => void;
}

export default function BranchAvailabilityModal({
  isOpen,
  onClose,
  productId,
  productName,
  currentBranchId,
  onSwitchBranch,
}: BranchAvailabilityModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [productInfo, setProductInfo] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !productId) return;

    setLoading(true);
    fetch(`/api/cart/product-branches/${productId}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setBranches(data.data.branches || []);
          setProductInfo(data.data.product || null);
        } else {
          toast.error(data.message || 'Không thể tra cứu danh sách chi nhánh');
        }
      })
      .catch((err) => {
        console.error('Fetch branches selling product error:', err);
        toast.error('Lỗi kết nối khi tải danh sách chi nhánh');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, productId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Chi nhánh có phục vụ món này
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs font-medium">
                {productName || productInfo?.name || 'Món ăn'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-red-600 mb-2" />
              <p className="text-xs font-medium text-slate-600">Đang tìm các chi nhánh có món...</p>
            </div>
          ) : branches.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-semibold">Hiện tại món ăn này đang tạm hết ở tất cả các chi nhánh.</p>
              <p className="text-xs text-slate-400 mt-1">Quý khách vui lòng chọn món thay thế hoặc quay lại sau nhé.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-500 mb-2">
                Món ăn này hiện đang sẵn sàng phục vụ tại các cơ sở sau:
              </p>
              {branches.map((b) => {
                const isCurrent = b.id === currentBranchId;
                const address = [b.street, b.ward, b.district, b.province].filter(Boolean).join(', ');

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{b.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100/70 px-2 py-0.5 rounded-full shrink-0">
                            Hiện tại
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{address}</span>
                      </div>
                      {b.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Hotline: {b.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isCurrent ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 px-3 py-1.5 bg-emerald-50 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đang chọn
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSwitchBranch(b.id);
                            onClose();
                          }}
                          className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <span>Chọn chi nhánh này</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

