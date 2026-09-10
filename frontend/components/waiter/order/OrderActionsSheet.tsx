'use client';

import React, { useState } from 'react';
import { 
  Edit3, 
  QrCode, 
  ArrowLeftRight, 
  Scissors, 
  FileText, 
  XCircle,
  X,
  Clock,
  User,
  AlertTriangle,
  ShieldAlert,
  Coins,
} from 'lucide-react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useAdmin } from '@/contexts/AdminContext';
import KitchenNoteModal from './KitchenNoteModal';
import TableQrModal from './TableQrModal';
import { MoveTableModal } from '@/components/pos/MoveTableModal';
import { SplitOrderModal } from '@/components/pos/SplitOrderModal';
import { MergeOrderModal } from '@/components/pos/MergeOrderModal';
import { CancelOrderModal } from '@/components/pos/CancelOrderModal';

interface OrderActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  table: any;
  onRefresh?: () => void;
  onOpenRedeemPoints?: () => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function OrderActionsSheet({
  isOpen,
  onClose,
  order,
  table,
  onRefresh,
  onOpenRedeemPoints,
}: OrderActionsSheetProps) {
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const currentUser = useWaiterStore(s => s.currentUser);
  const setSelectedTableId = useWaiterStore(s => s.setSelectedTableId);
  const setSelectedOrderId = useWaiterStore(s => s.setSelectedOrderId);
  const { can } = useAdmin();

  // Sub-modals
  const [isKitchenNoteOpen, setIsKitchenNoteOpen] = useState(false);
  const [isQrOrderOpen, setIsQrOrderOpen] = useState(false);
  const [isMoveTableOpen, setIsMoveTableOpen] = useState(false);
  const [isSplitOrderOpen, setIsSplitOrderOpen] = useState(false);
  const [isMergeOrderOpen, setIsMergeOrderOpen] = useState(false);
  const [isCancelOrderOpen, setIsCancelOrderOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch all tables in branch for move, split, merge actions
  const { data: tablesResponse, mutate: mutateTables } = useSWR(
    isOpen && activeBranchId ? `/api/pos/tables?branchId=${activeBranchId}` : null,
    fetcher
  );

  const rawTables = tablesResponse?.data?.tables || tablesResponse?.data || [];
  const posTables = Array.isArray(rawTables) ? rawTables.map((t: any) => ({
    ...t,
    visualStatus: t.status === 'OCCUPIED' ? 'OCCUPIED' : t.status === 'RESERVED' ? 'RESERVED' : 'VACANT',
    currentOrder: t.currentOrder || (t.activeOrders && t.activeOrders[0]) || null,
  })) : [];

  if (!isOpen && !isKitchenNoteOpen && !isQrOrderOpen && !isMoveTableOpen && !isSplitOrderOpen && !isMergeOrderOpen && !isCancelOrderOpen) {
    return null;
  }

  // Calculate duration of service
  const calculateDuration = () => {
    if (!order?.createdAt) return 'Vừa tạo';
    const created = new Date(order.createdAt).getTime();
    const now = Date.now();
    const diffMin = Math.max(0, Math.floor((now - created) / (1000 * 60)));
    if (diffMin < 60) return `${diffMin} phút`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours} giờ ${mins} phút`;
  };

  const formatCreationTime = () => {
    if (!order?.createdAt) return 'Chưa xác định';
    const date = new Date(order.createdAt);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${hh}:${mm} ${dd}/${MM}/${yyyy}`;
  };

  const creatorName = order?.creator?.fullName || order?.creator?.name || currentUser?.fullName || 'Hân Dâu';
  const orderCodeDisplay = order?.temporaryOrderCode || order?.orderNumber || (order?.id ? `TMP-${order.id.slice(0, 8).toUpperCase()}` : 'TMP-CE8EC78F');

  // Move table handler
  const handleConfirmMoveTable = async (targetTableId: string) => {
    if (!order?.id) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/pos/orders/move-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, targetTableId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Chuyển bàn thành công!');
        setSelectedTableId(targetTableId);
        setIsMoveTableOpen(false);
        onClose();
        onRefresh?.();
      } else {
        toast.error(data.message || 'Lỗi chuyển bàn');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Split order handler
  const handleConfirmSplit = async (items: any[], targetTableId?: string, reason?: string) => {
    if (!order?.id) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/pos/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceOrderId: order.id,
          targetTableId,
          items,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Tách đơn thành công!');
        setIsSplitOrderOpen(false);
        onClose();
        onRefresh?.();
      } else {
        toast.error(data.message || 'Lỗi tách đơn');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Merge order handler
  const handleConfirmMerge = async (sourceOrderId: string, targetOrderId: string, reason?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/pos/orders/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceOrderId, targetOrderId, reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Gộp đơn thành công!');
        setIsMergeOrderOpen(false);
        onClose();
        onRefresh?.();
      } else {
        toast.error(data.message || 'Lỗi gộp đơn');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel order handler
  const handleConfirmCancel = async (orderId: string, reason: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/pos/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Hủy đơn hàng thành công');
        setIsCancelOrderOpen(false);
        onClose();
        setSelectedTableId(null);
        setSelectedOrderId(null);
      } else {
        toast.error(data.message || 'Lỗi hủy đơn');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Action Sheet Backdrop & Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="fixed inset-0"
            onClick={onClose}
          />
          <div 
            className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col z-[90] pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-2" />

            {/* Menu Actions List (Matching Image 2 exactly) */}
            <div className="divide-y divide-slate-100 px-2 py-1">
              {/* Ghi chú Bếp */}
              <button
                type="button"
                onClick={() => { onClose(); setIsKitchenNoteOpen(true); }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-[#DA251D] hover:bg-red-50/50 active:bg-red-100 rounded-xl transition-colors font-medium text-[15px]"
              >
                <Edit3 size={20} className="text-[#DA251D] shrink-0" />
                <span>Ghi chú Bếp</span>
              </button>

              {/* QR Order */}
              <button
                type="button"
                onClick={() => { onClose(); setIsQrOrderOpen(true); }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors font-medium text-[15px]"
              >
                <QrCode size={20} className="text-slate-600 shrink-0" />
                <span>QR Order</span>
              </button>

              {/* Đổi điểm & Khuyến mãi */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRedeemPoints?.();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-amber-700 hover:bg-amber-50 active:bg-amber-100 rounded-xl transition-colors font-medium text-[15px] cursor-pointer"
              >
                <Coins size={20} className="text-amber-600 shrink-0" />
                <span>Đổi điểm & Khuyến mãi</span>
              </button>

              {/* Thay đổi bàn */}
              <button
                type="button"
                onClick={() => {
                  if (!can('pos.table.change', activeBranchId || undefined)) {
                    toast.error('Bạn không có quyền chuyển bàn (pos.table.change)', {
                      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
                    });
                    return;
                  }
                  onClose();
                  setIsMoveTableOpen(true);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors font-medium text-[15px] cursor-pointer"
              >
                <ArrowLeftRight size={20} className="text-slate-600 shrink-0" />
                <span>Thay đổi bàn</span>
              </button>

              {/* Tách đơn */}
              <button
                type="button"
                onClick={() => {
                  if (!can('pos.table.split', activeBranchId || undefined)) {
                    toast.error('Bạn không có quyền tách bàn/đơn (pos.table.split)', {
                      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
                    });
                    return;
                  }
                  onClose();
                  setIsSplitOrderOpen(true);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors font-medium text-[15px] cursor-pointer"
              >
                <Scissors size={20} className="text-slate-600 shrink-0" />
                <span>Tách đơn</span>
              </button>

              {/* Gộp đơn */}
              <button
                type="button"
                onClick={() => {
                  if (!can('pos.table.merge', activeBranchId || undefined)) {
                    toast.error('Bạn không có quyền gộp bàn/đơn (pos.table.merge)', {
                      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
                    });
                    return;
                  }
                  onClose();
                  setIsMergeOrderOpen(true);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-slate-800 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors font-medium text-[15px] cursor-pointer"
              >
                <FileText size={20} className="text-slate-600 shrink-0" />
                <span>Gộp đơn</span>
              </button>

              {/* Hủy đơn */}
              <button
                type="button"
                onClick={() => {
                  if (!can('pos.order.cancel', activeBranchId || undefined)) {
                    toast.error('Bạn không có quyền hủy đơn hàng (pos.order.cancel)', {
                      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
                    });
                    return;
                  }
                  onClose();
                  setIsCancelOrderOpen(true);
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-rose-600 hover:bg-rose-50 active:bg-rose-100 rounded-xl transition-colors font-medium text-[15px] cursor-pointer"
              >
                <XCircle size={20} className="text-rose-600 shrink-0" />
                <span>Hủy đơn</span>
              </button>
            </div>

            {/* Subtle Divider */}
            <div className="h-px bg-slate-100 my-2 mx-4" />

            {/* Order Metadata Details (Matching Image 2 exactly) */}
            <div className="px-6 py-2 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tên đơn</span>
                <span className="font-semibold text-slate-900">{orderCodeDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Phục vụ / Tạo đơn</span>
                <span className="font-semibold text-slate-900">{creatorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Thời gian tạo đơn</span>
                <span className="font-semibold text-slate-900">{formatCreationTime()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Thời gian phục vụ</span>
                <span className="font-semibold text-[#DA251D]">{calculateDuration()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modals */}
      <KitchenNoteModal
        isOpen={isKitchenNoteOpen}
        onClose={() => setIsKitchenNoteOpen(false)}
        orderId={order?.id}
        initialNote={order?.note || ''}
        onSuccess={() => onRefresh?.()}
      />

      <TableQrModal
        isOpen={isQrOrderOpen}
        onClose={() => setIsQrOrderOpen(false)}
        tableName={`Bàn ${table?.name || table?.tableCode || ''}`}
        tableCode={table?.tableCode}
        tableId={table?.id || ''}
        branchId={activeBranchId || undefined}
        orderId={order?.id}
      />

      {isMoveTableOpen && (
        <MoveTableModal
          currentTable={table}
          tables={posTables}
          onClose={() => setIsMoveTableOpen(false)}
          onConfirmMove={handleConfirmMoveTable}
          isProcessing={isProcessing}
        />
      )}

      {isSplitOrderOpen && (
        <SplitOrderModal
          cartItems={order?.orderItems || []}
          availableTables={posTables}
          onClose={() => setIsSplitOrderOpen(false)}
          onConfirmSplit={handleConfirmSplit}
          isProcessing={isProcessing}
        />
      )}

      {isMergeOrderOpen && (
        <MergeOrderModal
          currentOrder={order}
          occupiedTables={posTables}
          onClose={() => setIsMergeOrderOpen(false)}
          onConfirmMerge={handleConfirmMerge}
          isProcessing={isProcessing}
        />
      )}

      {isCancelOrderOpen && (
        <CancelOrderModal
          order={order}
          onClose={() => setIsCancelOrderOpen(false)}
          onConfirmCancel={handleConfirmCancel}
          isProcessing={isProcessing}
        />
      )}
    </>
  );
}
