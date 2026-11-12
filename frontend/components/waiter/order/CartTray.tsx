'use client';

import React, { useState } from 'react';
import { Plus, AlertTriangle, CloudOff } from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';
import { syncEngine } from '@/lib/offline/syncEngine';
import { db } from '@/lib/offline/db';
import { useIsIPhone } from '@/lib/utils/device';
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
  const isIPhone = useIsIPhone();
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

    const itemsPayload = tableUnsent.map(it => ({
      productId: it.productId,
      quantity: it.quantity,
      note: it.note || '',
      selectedOptionIds: it.selectedOptions?.map(so => so.optionItemId) || [],
      pricingMode: it.pricingMode || 'REGULAR',
      buffetSessionId: it.buffetSessionId || undefined,
      source: 'WAITER' as const,
    }));

    // BƯỚC 1: OPTIMISTIC UPDATE TỨC THÌ (0ms)
    const optimisticNewItems = tableUnsent.map((it, idx) => ({
      id: it.localId || `opt_${Date.now()}_${idx}`,
      productId: it.productId,
      productName: it.productName || 'Món ăn',
      imageUrl: it.imageUrl,
      unit: (it as any).unit || 'phần',
      quantity: it.quantity,
      priceAtSale: it.priceAtSale || 0,
      note: it.note || '',
      optionsTextSnapshot: it.selectedOptions?.map(o => o.nameAtSale).join(', ') || '',
      kitchenStatus: 'PENDING',
      sentQuantity: it.quantity,
      pricingMode: it.pricingMode || 'REGULAR',
      buffetSessionId: it.buffetSessionId,
      buffetPackageId: it.buffetPackageId,
      source: 'WAITER' as const,
      selectedOptions: (it.selectedOptions || []).map((o, sidx) => ({
        id: `opt_so_${idx}_${sidx}`,
        optionItemId: o.optionItemId,
        nameAtSale: o.nameAtSale,
        priceAdjustmentAtSale: o.priceAdjustment,
      })),
      taxPercentageAtSale: 0,
      taxableAmountAtSale: 0,
      taxAmountAtSale: 0,
      taxRate: 0,
    }));

    const addedTotal = tableUnsent.reduce((sum, it) => sum + (it.priceAtSale * it.quantity), 0);

    mutate((currentData: any) => {
      if (!currentData) return currentData;
      const currentOrder = currentData.data?.order || currentData.order;
      if (!currentOrder) {
        const newOrder = {
          id: `offline_ord_${Date.now()}`,
          orderCode: 'Đang lưu...',
          status: 'UNPAID',
          kitchenStatus: 'PENDING',
          orderItems: optimisticNewItems,
          totalAmount: addedTotal,
          subTotal: addedTotal,
          taxAmount: 0,
          discountAmount: 0,
          serviceChargeTotal: 0,
          createdAt: new Date().toISOString(),
        };
        return currentData.data
          ? { ...currentData, data: { ...currentData.data, order: newOrder } }
          : { ...currentData, order: newOrder };
      }
      const mergedItems = [...(currentOrder.orderItems || []), ...optimisticNewItems];
      const updatedOrder = {
        ...currentOrder,
        orderItems: mergedItems,
        subTotal: Number(currentOrder.subTotal || 0) + addedTotal,
        totalAmount: Number(currentOrder.totalAmount || 0) + addedTotal,
      };
      return currentData.data
        ? { ...currentData, data: { ...currentData.data, order: updatedOrder } }
        : { ...currentData, order: updatedOrder };
    }, false);

    // CẬP NHẬT INDEXEDDB
    try {
      const cachedOrder = await db.activeOrders.where('tableId').equals(selectedTableId).first();
      if (cachedOrder) {
        const merged = [...(cachedOrder.orderItems || []), ...optimisticNewItems];
        await db.activeOrders.update(cachedOrder.id, {
          orderItems: merged,
          totalAmount: Number(cachedOrder.totalAmount || 0) + addedTotal,
          subTotal: Number(cachedOrder.subTotal || 0) + addedTotal,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.activeOrders.put({
          id: `offline_ord_${Date.now()}`,
          branchId: activeBranchId,
          tableId: selectedTableId,
          orderCode: 'Lưu offline',
          temporaryOrderCode: null,
          guestCount: 1,
          status: 'UNPAID',
          kitchenStatus: 'PENDING',
          orderItems: optimisticNewItems,
          totalAmount: addedTotal,
          subTotal: addedTotal,
          taxAmount: 0,
          discountAmount: 0,
          serviceChargeTotal: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      const cachedTable = await db.posTables.get(selectedTableId);
      if (cachedTable && cachedTable.status !== 'OCCUPIED') {
        await db.posTables.update(selectedTableId, { status: 'OCCUPIED' });
      }
    } catch (dbErr) {
      console.warn('Lỗi ghi IndexedDB từ CartTray:', dbErr);
    }

    clearUnsentItems(selectedTableId);
    onSentSuccess?.();

    // If device is offline or server unavailable, queue command into persistent IndexedDB
    if (isOffline) {
      try {
        await syncEngine.enqueueCommand(
          'SEND_ITEMS',
          activeBranchId,
          { branchId: activeBranchId, items: itemsPayload },
          { tableId: selectedTableId }
        );
        toast.success('Đã lưu vào hàng đợi ngoại tuyến. Món đã được lưu cục bộ.', {
          icon: <CloudOff className="w-4 h-4 text-amber-500" />,
          duration: 4000,
        });
      } catch (err: any) {
        toast.error('Lỗi lưu đơn ngoại tuyến: ' + err.message);
      }
      return;
    }

    setIsSending(true);
    const toastId = toast.loading('Đang gửi món sang bếp...');
    const idempotencyKey = `cmd_send_${crypto.randomUUID()}`;

    try {
      const res = await fetch(`/api/pos/tables/${selectedTableId}/send-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: activeBranchId,
          items: itemsPayload,
          idempotencyKey,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || 'Lỗi gửi món sang bếp');
      }

      const printStatus = resData.printStatus || resData.data?.printStatus;

      // Reconcile response từ server vào IndexedDB và SWR cache (0ms delay, không gọi mutate() rỗng)
      const serverResult = resData.data || resData;
      if (serverResult?.order && activeBranchId) {
        const sOrder = serverResult.order;
        try {
          await db.activeOrders.put({
            id: sOrder.id,
            branchId: activeBranchId,
            tableId: selectedTableId,
            orderCode: sOrder.orderCode,
            temporaryOrderCode: sOrder.temporaryOrderCode || null,
            guestCount: sOrder.guestCount || 1,
            totalAmount: sOrder.totalAmount || 0,
            subTotal: sOrder.subTotal || 0,
            taxAmount: sOrder.taxAmount || 0,
            discountAmount: sOrder.discountAmount || 0,
            serviceChargeTotal: sOrder.serviceChargeTotal || 0,
            status: sOrder.status,
            kitchenStatus: sOrder.kitchenStatus || 'PENDING',
            cashierId: sOrder.cashierId || null,
            orderItems: sOrder.orderItems || [],
            user: sOrder.user || null,
            updatedAt: sOrder.updatedAt || new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn('Lỗi ghi server order vào IndexedDB từ CartTray:', dbErr);
        }
      }

      mutate(resData, false);
      clearUnsentItems(selectedTableId);
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
      // Network drop during send: safely enqueue into persistent offline queue with same idempotency key
      if (!navigator.onLine || err.message?.includes('fetch') || err.message?.includes('NetworkError')) {
        await syncEngine.enqueueCommand(
          'SEND_ITEMS',
          activeBranchId,
          { branchId: activeBranchId, items: itemsPayload },
          { tableId: selectedTableId }
        );
        clearUnsentItems(selectedTableId);
        onSentSuccess?.();
        toast.success('Mất kết nối. Đơn đã được chuyển vào hàng đợi ngoại tuyến an toàn!', {
          id: toastId,
          icon: <CloudOff className="w-4 h-4 text-amber-500" />,
          duration: 5000,
        });
      } else {
        toast.error(err.message || 'Không thể gửi bếp. Vui lòng thử lại.', { id: toastId });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePayment = () => {
    if (isOffline) {
      toast.error('Giao dịch thanh toán bắt buộc phải có kết nối máy chủ để tránh sai lệch tài chính.', {
        icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
        duration: 4500,
      });
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
      <div className={`absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 transition-transform touch-none overscroll-none ${
        isIPhone ? 'pb-[max(18px,calc(env(safe-area-inset-bottom)+10px))]' : 'pb-2'
      }`}>
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
