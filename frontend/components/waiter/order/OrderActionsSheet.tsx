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
  Users,
  AlertTriangle,
  ShieldAlert,
  Coins,
  Printer,
  ChefHat,
  Bell,
  BellRing,
  Loader2,
} from 'lucide-react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useAdmin } from '@/contexts/AdminContext';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/syncEngine';
import KitchenNoteModal from './KitchenNoteModal';
import TableQrModal from './TableQrModal';
import { MoveTableModal } from '@/components/pos/MoveTableModal';
import { SplitOrderModal } from '@/components/pos/SplitOrderModal';
import { MergeOrderModal } from '@/components/pos/MergeOrderModal';
import { CancelOrderModal } from '@/components/pos/CancelOrderModal';
import ResponsiveModal from '@/components/ui/ResponsiveModal';

interface OrderActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  table: any;
  onRefresh?: () => void;
  onOpenRedeemPoints?: () => void;
  onPrintTempBill?: () => void;
  isPrintingTempBill?: boolean;
  onSendKitchen?: () => void;
  isSendingKitchen?: boolean;
  onTogglePaymentRequest?: () => void;
  isPaymentRequested?: boolean;
  isRequestingPayment?: boolean;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function OrderActionsSheet({
  isOpen,
  onClose,
  order,
  table,
  onRefresh,
  onOpenRedeemPoints,
  onPrintTempBill,
  isPrintingTempBill,
  onSendKitchen,
  isSendingKitchen,
  onTogglePaymentRequest,
  isPaymentRequested,
  isRequestingPayment,
}: OrderActionsSheetProps) {
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const isOffline = useWaiterStore(s => s.isOffline);
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

  // Edit guest count state
  const [isEditGuestsOpen, setIsEditGuestsOpen] = useState(false);
  const [tempGuestCount, setTempGuestCount] = useState<number>(order?.guestCount || table?.activeSession?.guestCount || 1);
  const [isSavingGuests, setIsSavingGuests] = useState(false);

  React.useEffect(() => {
    if (order?.guestCount || table?.activeSession?.guestCount) {
      setTempGuestCount(order?.guestCount || table?.activeSession?.guestCount || 1);
    }
  }, [order?.guestCount, table?.activeSession?.guestCount]);

  const handleSaveGuestCount = async () => {
    if (!order?.id) {
      toast.error('Chưa có đơn hàng để cập nhật số khách');
      return;
    }
    setIsSavingGuests(true);

    // Cập nhật offline cục bộ tức thì
    try {
      if (order.id) {
        await db.activeOrders.update(order.id, { guestCount: tempGuestCount });
      }
    } catch {
      // ignore
    }

    if (isOffline) {
      if (activeBranchId) {
        await syncEngine.enqueueCommand(
          'UPDATE_ORDER',
          activeBranchId,
          { branchId: activeBranchId, guestCount: tempGuestCount },
          { orderId: order.id, tableId: table?.id }
        );
      }
      toast.success(`Đã lưu ${tempGuestCount} khách (Ngoại tuyến)!`);
      setIsEditGuestsOpen(false);
      onRefresh?.();
      setIsSavingGuests(false);
      return;
    }

    try {
      // Hỗ trợ cả PUT và POST
      let res = await fetch(`/api/pos/orders/${order.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestCount: tempGuestCount }),
      });
      if (res.status === 404 || res.status === 405) {
        res = await fetch(`/api/pos/orders/${order.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestCount: tempGuestCount }),
        });
      }
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã cập nhật ${tempGuestCount} khách!`);
        setIsEditGuestsOpen(false);
        onRefresh?.();
      } else {
        toast.error(data.message || 'Lỗi cập nhật số lượng khách');
      }
    } catch (err: any) {
      if (!navigator.onLine && activeBranchId) {
        await syncEngine.enqueueCommand(
          'UPDATE_ORDER',
          activeBranchId,
          { branchId: activeBranchId, guestCount: tempGuestCount },
          { orderId: order.id, tableId: table?.id }
        );
        toast.success(`Mất kết nối. Đã lưu ${tempGuestCount} khách vào hàng đợi!`);
        setIsEditGuestsOpen(false);
        onRefresh?.();
      } else {
        toast.error(err.message || 'Lỗi kết nối máy chủ');
      }
    } finally {
      setIsSavingGuests(false);
    }
  };

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
      {/* Responsive Bottom Sheet: Action Sheet */}
      <ResponsiveModal
        isOpen={isOpen}
        onClose={onClose}
        title={table?.name ? `Thao tác bàn – ${table.name}` : 'Thao tác đơn hàng'}
        subtitle={`Mã đơn: ${orderCodeDisplay}`}
        maxWidth="md"
      >
        <div className="space-y-3 py-1">
          {/* Menu Actions List */}
          <div className="divide-y divide-slate-100 bg-slate-50/70 rounded-2xl border border-slate-200/80 overflow-hidden">
            {/* Sửa số lượng khách */}
            <button
              type="button"
              onClick={() => {
                setTempGuestCount(order?.guestCount || table?.activeSession?.guestCount || 1);
                setIsEditGuestsOpen(true);
              }}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-slate-800 hover:bg-slate-100/70 active:bg-slate-200 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Users size={18} className="text-slate-600 shrink-0" />
                <span>Sửa số lượng khách</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#DA251D] bg-red-50 px-2.5 py-1 rounded-full border border-red-200 shadow-2xs">
                {order?.guestCount || table?.activeSession?.guestCount || 1} khách
              </span>
            </button>

            {/* In hóa đơn tạm tính */}
            {onPrintTempBill && (
              <button
                type="button"
                disabled={isPrintingTempBill}
                onClick={() => {
                  onClose();
                  onPrintTempBill();
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-slate-800 hover:bg-slate-100/70 active:bg-slate-200 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Printer size={18} className="text-slate-600 shrink-0" />
                  <span>In phiếu tạm tính</span>
                </div>
                {isPrintingTempBill && <Loader2 size={15} className="animate-spin text-slate-400 shrink-0" />}
              </button>
            )}

            {/* Báo bếp / Gửi lại lệnh in bếp */}
            {onSendKitchen && (
              <button
                type="button"
                disabled={isSendingKitchen}
                onClick={() => {
                  onClose();
                  onSendKitchen();
                }}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-orange-600 hover:bg-orange-50/70 active:bg-orange-100 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChefHat size={18} className="text-orange-500 shrink-0" />
                  <span>Báo bếp (Gửi lệnh in bếp)</span>
                </div>
                {isSendingKitchen && <Loader2 size={15} className="animate-spin text-orange-500 shrink-0" />}
              </button>
            )}

            {/* Thông báo thanh toán tới POS */}
            {onTogglePaymentRequest && (
              <button
                type="button"
                disabled={isRequestingPayment}
                onClick={() => {
                  onClose();
                  onTogglePaymentRequest();
                }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 transition-colors font-bold text-xs sm:text-sm cursor-pointer ${
                  isPaymentRequested
                    ? 'text-amber-800 bg-amber-50/70 hover:bg-amber-100'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isPaymentRequested ? (
                    <BellRing size={18} className="text-amber-600 shrink-0 animate-pulse" />
                  ) : (
                    <Bell size={18} className="text-amber-600 shrink-0" />
                  )}
                  <span>{isPaymentRequested ? 'Hủy yêu cầu thanh toán' : 'Gửi yêu cầu TT tới thu ngân POS'}</span>
                </div>
                {isRequestingPayment && <Loader2 size={15} className="animate-spin text-amber-500 shrink-0" />}
              </button>
            )}

            {/* Ghi chú Bếp */}
            <button
              type="button"
              onClick={() => { onClose(); setIsKitchenNoteOpen(true); }}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-[#DA251D] hover:bg-red-50/70 active:bg-red-100 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <Edit3 size={18} className="text-[#DA251D] shrink-0" />
              <span>Ghi chú Bếp</span>
            </button>

            {/* QR Order */}
            <button
              type="button"
              onClick={() => { onClose(); setIsQrOrderOpen(true); }}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-slate-800 hover:bg-slate-100/70 active:bg-slate-200 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <QrCode size={18} className="text-slate-600 shrink-0" />
              <span>Mã QR gọi món</span>
            </button>

            {/* Đổi điểm & Khuyến mãi */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRedeemPoints?.();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-3 text-amber-700 hover:bg-amber-50 active:bg-amber-100 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <Coins size={18} className="text-amber-600 shrink-0" />
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
              className="w-full flex items-center gap-3 px-3.5 py-3 text-slate-800 hover:bg-slate-100/70 active:bg-slate-200 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <ArrowLeftRight size={18} className="text-slate-600 shrink-0" />
              <span>Chuyển bàn</span>
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
              className="w-full flex items-center gap-3 px-3.5 py-3 text-slate-800 hover:bg-slate-100/70 active:bg-slate-200 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <Scissors size={18} className="text-slate-600 shrink-0" />
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
              className="w-full flex items-center gap-3 px-3.5 py-3 text-slate-800 hover:bg-slate-100/70 active:bg-slate-200 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <FileText size={18} className="text-slate-600 shrink-0" />
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
              className="w-full flex items-center gap-3 px-3.5 py-3 text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition-colors font-bold text-xs sm:text-sm cursor-pointer"
            >
              <XCircle size={18} className="text-rose-600 shrink-0" />
              <span>Hủy đơn</span>
            </button>
          </div>

          {/* Order Metadata Details */}
          <div className="bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mã đơn hàng</span>
              <span className="font-mono font-bold text-slate-900">{orderCodeDisplay}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Người phục vụ</span>
              <span className="font-semibold text-slate-900">{creatorName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Thời gian tạo đơn</span>
              <span className="font-semibold text-slate-900">{formatCreationTime()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Thời gian phục vụ</span>
              <span className="font-bold text-[#DA251D]">{calculateDuration()}</span>
            </div>
          </div>
        </div>
      </ResponsiveModal>

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

      {/* Sửa số lượng khách Modal */}
      {isEditGuestsOpen && (
        <ResponsiveModal
          isOpen={isEditGuestsOpen}
          onClose={() => setIsEditGuestsOpen(false)}
          title="Cập nhật số lượng khách"
          subtitle={table?.name ? `Bàn: ${table.name}` : `Đơn: ${orderCodeDisplay}`}
          maxWidth="sm"
        >
          <div className="space-y-4 py-2">
            {/* Stepper */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setTempGuestCount(Math.max(1, tempGuestCount - 1))}
                className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs"
              >
                -
              </button>
              <div className="w-24 text-center">
                <div className="text-3xl font-black font-mono text-[#DA251D] tracking-tight">
                  {tempGuestCount}
                </div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                  Khách
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTempGuestCount(tempGuestCount + 1)}
                className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-black text-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs"
              >
                +
              </button>
            </div>

            {/* Quick Select Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[1, 2, 4, 6, 8, 10, 12, 16].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTempGuestCount(num)}
                  className={`py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                    tempGuestCount === num
                      ? 'bg-[#DA251D] text-white shadow-xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {num} khách
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditGuestsOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSavingGuests}
                onClick={handleSaveGuestCount}
                className="flex-1 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSavingGuests ? <Loader2 size={16} className="animate-spin" /> : 'Lưu số khách'}
              </button>
            </div>
          </div>
        </ResponsiveModal>
      )}
    </>
  );
}
