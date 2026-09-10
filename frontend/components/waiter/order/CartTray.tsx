'use client';

import React, { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';
import toast from 'react-hot-toast';
import PaymentView from '../financial/PaymentView';
import useSWR from 'swr';

interface CartTrayProps {
  totalSent: number;
  totalUnsent: number;
  unsentCount: number;
  onAddItems: () => void;
  onSentSuccess?: () => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CartTray({ totalSent, totalUnsent, unsentCount, onAddItems, onSentSuccess }: CartTrayProps) {
  const { isOffline, selectedTableId, activeBranchId, unsentItems, clearUnsentItems, setSelectedTableId, setSelectedOrderId } = useWaiterStore();
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const { data: response, mutate } = useSWR(
    isOffline || !selectedTableId || !activeBranchId ? null : `/api/pos/tables/${selectedTableId}/session?branchId=${activeBranchId}`,
    fetcher
  );

  const handleSendKitchen = async () => {
    if (!selectedTableId || !activeBranchId) return;
    const tableUnsent = unsentItems[selectedTableId] || [];
    if (tableUnsent.length === 0) return;

    if (isOffline) {
      toast.success('Đã lưu ngoại tuyến. Sẽ gửi bếp khi có mạng.');
      return;
    }

    setIsSending(true);
    const toastId = toast.loading('Đang gửi món sang bếp...');

    try {
      const itemsPayload = tableUnsent.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        note: it.note || '',
        selectedOptionIds: it.selectedOptions?.map(so => so.optionItemId) || [],
        pricingMode: it.pricingMode || 'REGULAR',
        buffetSessionId: it.buffetSessionId || undefined,
        source: 'WAITER' as const,
      }));

      const res = await fetch(`/api/pos/tables/${selectedTableId}/send-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranchId,
          items: itemsPayload,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Lỗi gửi món sang bếp');
      }

      const printStatus = resData.printStatus || resData.data?.printStatus;

      clearUnsentItems(selectedTableId);
      mutate();
      onSentSuccess?.();

      if (printStatus && !printStatus.isPosOnline && printStatus.warningMessage) {
        toast.error(printStatus.warningMessage, {
          id: toastId,
          duration: 9000,
          icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        });
        if (typeof window !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 100, 100, 100]);
        }
      } else {
        toast.success('Đã gửi bếp thành công!', { id: toastId });
        if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi bếp. Vui lòng thử lại.', { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const handlePayment = () => {
    if (isOffline) {
      toast.error('Không thể thanh toán khi đang ngoại tuyến.');
      return;
    }
    setPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    setPaymentOpen(false);
    mutate();
    onSentSuccess?.();
    setSelectedTableId(null);
    setSelectedOrderId(null);
  };

  return (
    <>
      <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)] z-20 transition-transform">
        <div className="p-4 flex flex-col gap-3">
          
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-slate-500">Tạm tính</span>
            <span className="text-xl font-bold text-[#DA251D]">
              {(totalSent + totalUnsent).toLocaleString('vi-VN')}₫
            </span>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onAddItems}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-bold transition-colors active:scale-95"
            >
              <Plus size={20} strokeWidth={2.5} />
              Thêm món
            </button>
            
            {unsentCount > 0 ? (
              <button 
                onClick={handleSendKitchen}
                className="flex-1 bg-[#DA251D] hover:bg-red-700 text-white py-3.5 rounded-xl font-bold shadow-sm shadow-red-200 transition-colors active:scale-95 flex flex-col items-center justify-center leading-tight"
              >
                <span>Gửi bếp</span>
                <span className="text-[10px] font-medium opacity-90">{unsentCount} món mới</span>
              </button>
            ) : (
              <button 
                onClick={handlePayment}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold shadow-sm transition-colors active:scale-95 flex items-center justify-center"
              >
                Thanh toán
              </button>
            )}
          </div>
        </div>
      </div>

      <PaymentView 
        isOpen={isPaymentOpen} 
        onClose={() => setPaymentOpen(false)} 
        onSuccess={handlePaymentSuccess}
        order={response?.data?.order} 
      />
    </>
  );
}
