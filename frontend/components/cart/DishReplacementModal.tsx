'use client';

import React, { useState, useEffect } from 'react';
import { Utensils, X, ArrowRight, RefreshCw, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DishReplacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItem: {
    id: string;
    productId: string;
    name: string;
    quantity: number;
    priceAtSale?: number;
    optionsTextSnapshot?: string;
  } | null;
  branchId: string;
  onReplacementSuccess: () => void;
}

export default function DishReplacementModal({
  isOpen,
  onClose,
  cartItem,
  branchId,
  onReplacementSuccess,
}: DishReplacementModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [replacements, setReplacements] = useState<any[]>([]);
  const [originalProduct, setOriginalProduct] = useState<any>(null);
  const [selectedReplacementId, setSelectedReplacementId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !cartItem?.productId) return;

    setLoading(true);
    setSelectedReplacementId(null);

    fetch(`/api/cart/replacements?productId=${cartItem.productId}&branchId=${branchId || ''}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setReplacements(data.data.replacements || []);
          setOriginalProduct(data.data.originalProduct || null);
          if (data.data.replacements?.length > 0) {
            setSelectedReplacementId(data.data.replacements[0].id);
          }
        } else {
          toast.error(data.message || 'Không tìm thấy món thay thế phù hợp');
        }
      })
      .catch((err) => {
        console.error('Fetch replacements error:', err);
        toast.error('Lỗi kết nối khi tải món thay thế');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, cartItem?.productId, branchId]);

  const handleConfirmReplace = async () => {
    if (!cartItem || !selectedReplacementId) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/cart/replace-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          oldItemId: cartItem.id,
          newProductId: selectedReplacementId,
          quantity: cartItem.quantity,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Đã thay thế món ăn thành công!');
        onReplacementSuccess();
        onClose();
      } else {
        toast.error(data.message || 'Thay thế món thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !cartItem) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                Chọn món ăn thay thế
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs font-medium">
                Thay thế cho: <span className="text-slate-800 font-semibold">{cartItem.name}</span>
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
              <p className="text-xs font-medium text-slate-600">Đang tìm các món cùng danh mục...</p>
            </div>
          ) : replacements.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs sm:text-sm font-semibold">Hiện chưa có món thay thế cùng loại tại chi nhánh này.</p>
              <p className="text-xs text-slate-400 mt-1">Quý khách vui lòng chọn món khác trong thực đơn nhé.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 mb-2">
                Các món tương tự đang sẵn sàng phục vụ tại chi nhánh:
              </p>
              {replacements.map((prod) => {
                const isSelected = selectedReplacementId === prod.id;
                const diff = Number(prod.priceDifference || 0);

                return (
                  <div
                    key={prod.id}
                    onClick={() => setSelectedReplacementId(prod.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                      isSelected
                        ? 'border-red-500 bg-red-50/40 ring-2 ring-red-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {prod.image ? (
                        <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Món</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{prod.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-extrabold text-xs sm:text-sm text-red-600">
                          {(prod.basePrice || 0).toLocaleString('vi-VN')}đ
                        </span>
                        {diff === 0 ? (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                            Cùng giá
                          </span>
                        ) : diff > 0 ? (
                          <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                            +{diff.toLocaleString('vi-VN')}đ
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                            {diff.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={submitting || !selectedReplacementId}
            onClick={handleConfirmReplace}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5"
          >
            {submitting ? 'Đang đổi món...' : 'Xác nhận thay thế'}
          </button>
        </div>
      </div>
    </div>
  );
}

