'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useWaiterStore, UnsentItem } from '@/store/useWaiterStore';
import { 
  ArrowLeft, 
  MoreVertical, 
  Plus, 
  Minus, 
  Trash2, 
  Clock, 
  User, 
  Save, 
  Coins, 
  Receipt, 
  SlidersHorizontal,
  Users,
  Info,
  X,
  ShoppingBag,
  Bike,
  Flame,
  CheckCircle2,
  Tag,
  Bell,
  BellRing,
  CreditCard,
  Loader2,
  AlertTriangle,
  ChefHat,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isOnlineOrder } from '@/components/pos/pos-utils';
import OrderActionsSheet from './OrderActionsSheet';
import TableQrModal from './TableQrModal';
import OrderOptionsDrawer from './OrderOptionsDrawer';
import RedeemPointsModal from './RedeemPointsModal';
import TaxFeeSheet from '../financial/TaxFeeSheet';
import PaymentView from '../financial/PaymentView';
import WaiterEditItemModal from './WaiterEditItemModal';

const fetcher = (url: string) => fetch(url).then(r => r.json());
const EMPTY_ITEMS: UnsentItem[] = [];

export default function OrderDetailView() {
  const { 
    selectedTableId, 
    selectedOrderId, 
    setSelectedTableId, 
    setSelectedOrderId, 
    setActiveTab,
    activeBranchId,
    currentUser,
    isOffline,
    updateUnsentItem,
    removeUnsentItem,
    clearUnsentItems
  } = useWaiterStore();

  const cartKey = selectedTableId || selectedOrderId || '';

  // Stable selector avoiding getSnapshot re-render loop
  const unsentMap = useWaiterStore(s => s.unsentItems);
  const unsentItems = (cartKey && unsentMap[cartKey]) || EMPTY_ITEMS;

  // Modals state
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isOrderOptionsOpen, setIsOrderOptionsOpen] = useState(false);
  const [isPointsOpen, setIsPointsOpen] = useState(false);
  const [isTaxFeeOpen, setIsTaxFeeOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSavingKitchen, setIsSavingKitchen] = useState(false);
  const [isEditingGuestCount, setIsEditingGuestCount] = useState(false);
  const [tempGuests, setTempGuests] = useState<number>(2);
  const [showBreakdownPopover, setShowBreakdownPopover] = useState(false);
  const [editingItem, setEditingItem] = useState<{ item: any; isSent: boolean } | null>(null);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Fetch current order/table session from the dedicated backend endpoint
  const swrKey = isOffline
    ? null
    : selectedTableId
    ? `/api/pos/tables/${selectedTableId}/session?branchId=${activeBranchId}`
    : selectedOrderId
    ? `/api/pos/orders/${selectedOrderId}`
    : null;

  const { data: response, isLoading, mutate } = useSWR(
    swrKey,
    fetcher,
    { refreshInterval: 4000 }
  );

  const table = response?.data?.table || null;
  const order = selectedTableId ? response?.data?.order : response?.data;
  const isOnline = isOnlineOrder(order);

  // VAT Invoice Modal State
  const [isVatModalOpen, setIsVatModalOpen] = useState(false);
  const [vatTaxCode, setVatTaxCode] = useState('');
  const [vatCompanyName, setVatCompanyName] = useState('');
  const [vatAddress, setVatAddress] = useState('');
  const [vatEmail, setVatEmail] = useState('');
  const [isLookingUpTax, setIsLookingUpTax] = useState(false);
  const [isSavingVat, setIsSavingVat] = useState(false);

  React.useEffect(() => {
    if (order) {
      setVatTaxCode(order.invoiceTaxCode || order.user?.taxCode || '');
      setVatCompanyName(order.invoiceCompanyName || order.user?.companyName || '');
      setVatAddress(order.invoiceAddress || order.user?.taxAddress || '');
      setVatEmail(order.invoiceEmail || order.user?.invoiceEmail || '');
    }
  }, [order]);

  const handleLookupTax = async () => {
    const cleanMst = vatTaxCode.trim();
    if (!cleanMst || cleanMst.length < 4) {
      toast.error('Vui lòng nhập mã số thuế hợp lệ');
      return;
    }
    setIsLookingUpTax(true);
    try {
      const res = await fetch(`/api/pos/tax-lookup/${encodeURIComponent(cleanMst)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setVatCompanyName(json.data.companyName || '');
        setVatAddress(json.data.address || '');
        toast.success('Đã tìm thấy thông tin doanh nghiệp!');
      } else {
        toast.error('Không tìm thấy thông tin mã số thuế này');
      }
    } catch {
      toast.error('Lỗi kết nối tra cứu mã số thuế');
    } finally {
      setIsLookingUpTax(false);
    }
  };

  const handleSaveVat = async () => {
    if (!order?.id) return;
    try {
      setIsSavingVat(true);
      const res = await fetch(`/api/pos/orders/${order.id}/invoice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isInvoiceRequested: Boolean(vatTaxCode.trim() || vatCompanyName.trim()),
          invoiceTaxCode: vatTaxCode.trim() || null,
          invoiceCompanyName: vatCompanyName.trim() || null,
          invoiceAddress: vatAddress.trim() || null,
          invoiceEmail: vatEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể lưu thông tin hóa đơn');
      }
      toast.success('Đã lưu thông tin xuất hóa đơn VAT!');
      setIsVatModalOpen(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu thông tin hóa đơn');
    } finally {
      setIsSavingVat(false);
    }
  };

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleBack = () => {
    if (unsentItems.length > 0) {
      setShowExitConfirm(true);
      return;
    }
    executeExit();
  };

  const executeExit = () => {
    const wasTable = Boolean(selectedTableId);
    setSelectedTableId(null);
    setSelectedOrderId(null);
    setActiveTab(wasTable ? 'TABLES' : 'ORDERS');
  };

  const handleAddItems = () => {
    if (isOnline) {
      toast('Đơn hàng trực tuyến chỉ được xem, không được thêm món!', {
        icon: <Info size={16} className="text-sky-500" />,
      });
      return;
    }
    // Navigate to Menu tab while preserving table/order context
    setActiveTab('MENU');
  };

  const orderItems = order?.orderItems || [];
  const hasUnsentKitchenItems =
    unsentItems.length > 0 ||
    orderItems.some((it: any) => it.kitchenStatus === 'PENDING' || (it.sentQuantity || 0) < it.quantity);

  // Totals calculations
  const totalSent = orderItems.reduce((sum: number, item: any) => sum + (item.priceAtSale * item.quantity), 0);
  const totalUnsent = unsentItems.reduce((sum: number, item: UnsentItem) => sum + (item.priceAtSale * item.quantity), 0);
  const totalItemCount = orderItems.reduce((sum: number, item: any) => sum + item.quantity, 0) + 
                         unsentItems.reduce((sum: number, item: UnsentItem) => sum + item.quantity, 0);

  const subTotal = totalSent + totalUnsent;
  const discountAmount = Number(order?.discountAmount) || 0;
  const serviceChargeTotal = Number(order?.serviceChargeTotal) || 0;
  const taxAmount = Number(order?.taxAmount) || 0;
  const finalTotal = order?.totalAmount !== undefined && order?.totalAmount !== null
    ? Math.max(0, Number(order.totalAmount) + totalUnsent)
    : Math.max(0, subTotal - discountAmount) + serviceChargeTotal;

  // Send unsent items to kitchen (Lưu / Báo bếp)
  const handleSaveKitchen = async () => {
    if (!activeBranchId) {
      toast.error('Thiếu thông tin chi nhánh');
      return;
    }

    if (unsentItems.length === 0) {
      if (!order?.id) {
        toast.success('Đơn hàng đã được lưu!');
        return;
      }
      // Gửi lệnh in bếp cho các món đã lưu trong đơn
      setIsSavingKitchen(true);
      const toastId = toast.loading('Đang phát lệnh in tới bếp...');
      try {
        const sendKitchenRes = await fetch(`/api/pos/orders/${order.id}/send-kitchen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });
        const sendKitchenData = await sendKitchenRes.json();
        if (!sendKitchenRes.ok || !sendKitchenData.success) {
          throw new Error(sendKitchenData?.message || 'Không thể gửi lệnh in bếp');
        }
        await mutate();
        const printStatus = sendKitchenData?.printStatus || sendKitchenData?.data?.printStatus;
        if (printStatus && !printStatus.isPosOnline && printStatus.warningMessage) {
          toast.error(printStatus.warningMessage, { id: toastId, duration: 8000 });
        } else {
          toast.success('Đã gửi lệnh in bếp thành công!', { id: toastId });
        }
      } catch (err: any) {
        toast.error(err.message || 'Lỗi gửi lệnh in bếp', { id: toastId });
      } finally {
        setIsSavingKitchen(false);
      }
      return;
    }

    setIsSavingKitchen(true);
    const toastId = toast.loading('Đang gửi món sang bếp...');

    try {
      const itemsPayload = unsentItems.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        note: it.note || '',
        discountAmount: it.discountAmount || 0,
        discountReason: it.discountReason || undefined,
        selectedOptionIds: it.selectedOptions?.map(so => so.optionItemId) || [],
        pricingMode: it.pricingMode || 'REGULAR',
        buffetSessionId: it.buffetSessionId || undefined,
        source: 'WAITER' as const,
      }));

      let printStatus: any = null;

      if (selectedTableId) {
        // Table order
        const res = await fetch(`/api/pos/tables/${selectedTableId}/send-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId: activeBranchId,
            items: itemsPayload
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Lỗi khi gửi bếp');
        }
        printStatus = data.printStatus || data.data?.printStatus;
      } else if (order?.id) {
        // Takeaway / Delivery order without table
        const existingItemsPayload = orderItems.map((oi: any) => ({
          id: oi.id,
          productId: oi.productId,
          quantity: oi.quantity,
          note: oi.note,
          selectedOptionIds: oi.selectedOptions?.map((so: any) => so.optionItemId) || [],
        }));
        const allItemsPayload = [...existingItemsPayload, ...itemsPayload];

        const res = await fetch(`/api/pos/orders/${order.id}/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: allItemsPayload,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Lỗi khi lưu món');
        }

        try {
          const sendKitchenRes = await fetch(`/api/pos/orders/${order.id}/send-kitchen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          const sendKitchenData = await sendKitchenRes.json();
          printStatus = sendKitchenData?.printStatus || sendKitchenData?.data?.printStatus;
        } catch (e) {
          console.warn('Lỗi gọi send-kitchen cho đơn mang đi:', e);
        }
      }

      // Clear local unsent cart
      clearUnsentItems(cartKey);

      // Re-fetch backend state
      await mutate();

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
        toast.success('Đã gửi món sang bếp thành công!', { id: toastId });
      }
    } catch (error: any) {
      toast.error(error.message || 'Lỗi gửi món sang bếp', { id: toastId });
    } finally {
      setIsSavingKitchen(false);
    }
  };

  const handleTogglePaymentRequest = async () => {
    if (!order?.id) return;
    const isCurrentlyRequested = order.paymentStatus === 'PAYMENT_REQUESTED' || order.status === 'HELD';
    setIsRequestingPayment(true);
    try {
      if (isCurrentlyRequested) {
        // Hủy yêu cầu thanh toán
        const res = await fetch(`/api/pos/orders/${order.id}/cancel-payment-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || json.error?.message || 'Không thể hủy yêu cầu thanh toán');
        }
        toast.success('Đã hủy yêu cầu thanh toán!', {
          icon: <Bell size={16} className="text-slate-500" />,
        });
      } else {
        // Gửi yêu cầu thanh toán
        const res = await fetch(`/api/pos/orders/${order.id}/request-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || json.error?.message || 'Không thể gửi yêu cầu thanh toán');
        }
        toast.success('Đã gửi yêu cầu thanh toán tới thu ngân POS!', {
          icon: <BellRing size={16} className="text-amber-500" />,
        });
      }
      await mutate();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi thao tác yêu cầu thanh toán');
    } finally {
      setIsRequestingPayment(false);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const staffNameDisplay = currentUser?.fullName || order?.cashierName || 'Phục vụ bàn';
  const orderCodeDisplay = order?.orderCode || order?.temporaryOrderCode || (order?.id ? order.id.slice(0, 8) : 'MỚI');

  const orderTitle = table?.name 
    ? `Bàn ${table.name}` 
    : table?.tableCode 
    ? `Bàn ${table.tableCode}` 
    : isOnline
    ? 'Đơn trực tuyến (Online)'
    : order?.orderType === 'TAKEAWAY' 
    ? 'Đơn mang đi' 
    : order?.orderType === 'DELIVERY' 
    ? 'Đơn giao hàng' 
    : 'Chi tiết đơn hàng';

  return (
    <div className="flex flex-col h-full bg-slate-50 select-none">
      {/* HEADER */}
      <header className="w-full bg-white border-b border-slate-200 shrink-0 px-4 py-3 flex items-center justify-between shadow-2xs z-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button 
          onClick={handleBack} 
          className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5">
            {isOnline && <Globe size={16} className="text-sky-600" />}
            {!isOnline && order?.orderType === 'TAKEAWAY' && <ShoppingBag size={16} className="text-[#DA251D]" />}
            {!isOnline && order?.orderType === 'DELIVERY' && <Bike size={16} className="text-[#DA251D]" />}
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {orderTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
            <span>Mã ĐH: #{orderCodeDisplay}</span>
            <span>•</span>
            {isOnline ? (
              <span className="inline-flex items-center gap-1 text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-md text-[11px]">
                Chỉ xem • HĐ VAT
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempGuests(order?.guestCount || table?.activeSession?.guestCount || 2);
                  setIsEditingGuestCount(true);
                }}
                className="inline-flex items-center gap-1 text-[#DA251D] hover:text-[#b81d16] font-semibold active:scale-95 transition-all bg-red-50 px-2 py-0.5 rounded-md cursor-pointer"
              >
                <Users size={12} />
                <span>{order?.guestCount || table?.activeSession?.guestCount || 1} khách</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 -mr-2">
          {isOnline && (
            <button 
              type="button"
              onClick={() => setIsVatModalOpen(true)}
              className="p-2 text-sky-600 active:bg-sky-50 rounded-full transition-colors cursor-pointer"
              title="Xuất hóa đơn VAT"
            >
              <Receipt size={22} />
            </button>
          )}
          <button 
            type="button"
            onClick={() => setIsActionsOpen(true)}
            className="p-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors cursor-pointer"
            title="Tùy chọn khác"
          >
            <MoreVertical size={24} />
          </button>
        </div>
      </header>

      {/* ITEMS LIST */}
      <div className="flex-1 overflow-y-auto touch-pan-y px-4 py-4 space-y-4">
        {/* Banner Đơn Online */}
        {isOnline && (
          <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between text-xs text-sky-900 shadow-xs">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-sky-600 shrink-0" />
              <div>
                <span className="font-bold">Đơn hàng trực tuyến:</span>
                <span className="text-sky-700 block text-[11px]">Chỉ được xem, không thể sửa/xóa món trong đơn.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVatModalOpen(true)}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs"
            >
              Hóa đơn VAT
            </button>
          </div>
        )}

        {isLoading && !isOffline && orderItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DA251D] mb-3" />
            <span className="text-xs text-slate-400">Đang tải chi tiết đơn...</span>
          </div>
        ) : (
          <>
            {/* 1. SENT ITEMS (Món đã gửi bếp) */}
            {orderItems.length > 0 && (
              <div className="space-y-3">
                {orderItems.map((item: any, idx: number) => {
                  const isRedeemedItem = item.priceAtSale === 0 && (item.discountReason?.includes('đổi điểm') || item.discountReason?.includes('Đổi điểm') || item.note?.includes('ĐỔI ĐIỂM') || item.orderedByName?.includes('Đổi điểm') || Boolean(item.orderedById && item.priceAtSale === 0));
                  const itemTotal = isRedeemedItem ? 0 : item.priceAtSale * item.quantity;
                  const itemTime = formatTime(item.createdAt || order?.createdAt);

                  return (
                    <div 
                      key={item.id || idx} 
                      onClick={() => {
                        if (isOnline) {
                          toast('Đơn hàng Online chỉ được xem, không được chỉnh sửa món', {
                            icon: <Info size={16} className="text-sky-500" />
                          });
                          return;
                        }
                        setEditingItem({ item, isSent: true });
                      }}
                      className="py-2.5 px-3 -mx-3 rounded-2xl hover:bg-slate-100/80 active:bg-slate-200/50 border-b border-slate-100/80 last:border-b-0 cursor-pointer transition-colors group"
                      title={isOnline ? 'Đơn hàng Online (chỉ xem)' : isRedeemedItem ? 'Chạm để sửa ghi chú món đổi điểm' : 'Chạm để chỉnh sửa món'}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <h3 className="font-bold text-[15px] text-slate-900 leading-snug group-hover:text-[#DA251D] transition-colors truncate">
                            {item.product?.name || item.productName || 'Món'}
                          </h3>
                          {isRedeemedItem && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-black shrink-0">
                              Đổi điểm 0đ
                            </span>
                          )}
                          {item.pricingMode === 'BUFFET_TICKET' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-black shrink-0">
                              Vé Buffet
                            </span>
                          )}
                          {item.pricingMode === 'BUFFET_INCLUDED' && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1.5 py-0.2 rounded font-black shrink-0">
                              Buffet
                            </span>
                          )}
                          {item.source === 'QR_ORDER' && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-bold shrink-0">
                              QR - {item.orderedByName || 'Khách'}
                            </span>
                          )}
                          {item.source === 'WAITER' && (
                            <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-bold shrink-0">
                              Phục vụ
                            </span>
                          )}
                          {item.source === 'POS' && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded font-bold shrink-0">
                              POS
                            </span>
                          )}
                        </div>
                        <span className={`font-bold text-[15px] shrink-0 font-mono ${isRedeemedItem ? 'text-amber-700' : 'text-slate-900'}`}>
                          {isRedeemedItem ? '0 đ' : `${itemTotal.toLocaleString('vi-VN')} đ`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-slate-600">
                          {isRedeemedItem ? '0 đ' : `${item.priceAtSale.toLocaleString('vi-VN')} đ`} x <strong className="text-slate-900 font-bold">{item.quantity}</strong>
                        </span>

                        {(() => {
                          const sentCount = item.sentQuantity ?? (item.kitchenStatus === 'SENT' ? item.quantity : 0);
                          const printedCount = item.printedQuantity ?? sentCount;
                          const effectivePrinted = Math.max(sentCount, printedCount);

                          if (item.kitchenStatus === 'READY') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span>Sẵn sàng</span>
                              </span>
                            );
                          }
                          if (item.kitchenStatus === 'PREPARING') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[11px] font-bold">
                                <Flame size={12} className="text-orange-600" />
                                <span>Đang làm</span>
                              </span>
                            );
                          }
                          if (effectivePrinted >= item.quantity || item.kitchenStatus === 'SENT') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span>Đã in {item.quantity}/{item.quantity}</span>
                              </span>
                            );
                          }
                          if (effectivePrinted > 0) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                                <Clock size={12} className="text-amber-600" />
                                <span>Đã in {effectivePrinted}/{item.quantity} (Chờ in +{item.quantity - effectivePrinted})</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                              <Clock size={12} className="text-amber-600" />
                              <span>Chờ in 0/{item.quantity}</span>
                            </span>
                          );
                        })()}

                        {item.discountAmount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-[#DA251D] text-[11px] font-bold">
                            <Tag size={10} />
                            <span>-{item.discountAmount.toLocaleString('vi-VN')} đ</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1 text-[#DA251D]">
                          <Clock size={13} />
                          {itemTime || 'Vừa xong'}
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center gap-1 text-emerald-700">
                          <User size={13} />
                          {staffNameDisplay}
                        </span>
                      </div>

                      {item.optionsTextSnapshot && (
                        <p className="text-xs text-slate-500 mt-1 pl-1 border-l-2 border-slate-200">
                          {item.optionsTextSnapshot}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-xs text-amber-600 mt-1 italic pl-1 border-l-2 border-amber-300">
                          * {item.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. CENTERED DASHED DIVIDER */}
            {unsentItems.length > 0 && (
              <div className="relative flex py-4 items-center justify-center">
                <div className="flex-grow border-t border-dashed border-red-200" />
                <span className="flex-shrink mx-4 text-xs font-bold text-[#DA251D] tracking-wider">
                  MÓN MỚI CHỜ GỬI
                </span>
                <div className="flex-grow border-t border-dashed border-red-200" />
              </div>
            )}

            {/* 3. UNSENT ITEMS */}
            {unsentItems.length > 0 && (
              <div className="space-y-3">
                {unsentItems.map((item: UnsentItem) => {
                  const itemTotal = item.priceAtSale * item.quantity;

                  return (
                    <div 
                      key={item.localId} 
                      onClick={() => setEditingItem({ item, isSent: false })}
                      className="py-2.5 px-3 -mx-3 rounded-2xl hover:bg-red-50/30 active:bg-red-50/70 border-b border-slate-100/80 last:border-b-0 cursor-pointer transition-colors group"
                      title="Chạm để chỉnh sửa món"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[15px] text-[#DA251D] leading-snug">
                            {item.productName}
                          </h3>
                          <span className="bg-[#DA251D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            MỚI
                          </span>
                          {item.discountAmount && item.discountAmount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
                              <Tag size={10} />
                              <span>-{(item.discountAmount).toLocaleString('vi-VN')} đ</span>
                            </span>
                          ) : null}
                        </div>
                        <span className="font-bold text-[15px] text-[#DA251D] shrink-0 font-mono">
                          {itemTotal.toLocaleString('vi-VN')} đ
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-slate-600">
                          {item.priceAtSale.toLocaleString('vi-VN')} đ x <strong className="text-slate-900 font-bold">{item.quantity}</strong>
                        </span>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity > 1) {
                                updateUnsentItem(cartKey, item.localId, { quantity: item.quantity - 1 });
                              } else {
                                removeUnsentItem(cartKey, item.localId);
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-slate-100 active:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            {item.quantity > 1 ? <Minus size={13} /> : <Trash2 size={13} className="text-rose-500" />}
                          </button>

                          <span className="text-xs font-bold text-slate-800 min-w-4 text-center font-mono">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateUnsentItem(cartKey, item.localId, { quantity: item.quantity + 1 })}
                            className="w-7 h-7 rounded-full bg-red-50 active:bg-red-100 text-[#DA251D] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          {item.selectedOptions.map(o => o.nameAtSale).join(', ')}
                        </p>
                      )}
                      {item.note && (
                        <p className="text-xs text-amber-600 mt-1 italic">
                          * {item.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {orderItems.length === 0 && unsentItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 text-[#DA251D] flex items-center justify-center mb-3">
                  <Plus size={32} />
                </div>
                <h3 className="font-bold text-base text-slate-800 mb-1">Đơn chưa có món nào</h3>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  Bấm nút "+ Thêm" bên dưới để chọn món từ thực đơn.
                </p>
                <button
                  type="button"
                  onClick={handleAddItems}
                  className="px-5 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white font-bold text-sm shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  + Thêm món ngay
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* BOTTOM SUMMARY & ACTIONS */}
      <footer className="w-full bg-white border-t border-slate-200 shrink-0 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] space-y-3 z-20">
        {showBreakdownPopover && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 shadow-sm space-y-2 text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Receipt size={14} className="text-[#DA251D]" />
                Chi tiết thanh toán
              </span>
              <button
                type="button"
                onClick={() => setShowBreakdownPopover(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Tiền hàng ({totalItemCount} món):</span>
                <span className="font-bold text-slate-900">{subTotal.toLocaleString('vi-VN')} đ</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-600 font-semibold">
                  <span>Chiết khấu / Giảm giá:</span>
                  <span>-{discountAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              {serviceChargeTotal > 0 && (
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Phí dịch vụ / Phụ thu:</span>
                  <span>+{serviceChargeTotal.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>{order?.vatPriceModeSnapshot === 'VAT_INCLUDED' ? 'Thuế VAT (Đã gồm):' : 'Thuế VAT:'}</span>
                  <span className="font-bold">{taxAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900 text-sm">
                <span>Tổng cộng:</span>
                <span className="text-[#DA251D] font-mono">{finalTotal.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Tạm tính ({totalItemCount} món)</span>
          <span className="font-bold text-slate-900">{subTotal.toLocaleString('vi-VN')} đ</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-extrabold text-slate-900">Tổng tiền</span>
            <button
              type="button"
              onClick={() => setShowBreakdownPopover(!showBreakdownPopover)}
              className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="Xem chi tiết thanh toán & thuế VAT"
            >
              <Info size={12} />
            </button>
          </div>
          <span className="text-xl font-black text-[#DA251D] tracking-tight font-mono">
            {finalTotal.toLocaleString('vi-VN')} đ
          </span>
        </div>

        {!isOnline && (
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setIsPointsOpen(true)}
              className="py-2 px-1 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 text-amber-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Coins size={15} className="text-amber-600 shrink-0" />
              <span>Đổi điểm</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTaxFeeOpen(true)}
              className="py-2 px-1 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 text-[#DA251D] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Receipt size={15} className="text-[#DA251D] shrink-0" />
              <span>Thuế & Phí</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOrderOptionsOpen(true)}
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <SlidersHorizontal size={15} className="text-slate-600 shrink-0" />
              <span>Tùy chọn</span>
            </button>
          </div>
        )}

        {/* Banner trạng thái yêu cầu thanh toán */}
        {(order?.paymentStatus === 'PAYMENT_REQUESTED' || order?.status === 'HELD') && (
          <div className="mb-2 py-1.5 px-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold animate-pulse">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Đang chờ thu ngân POS thanh toán</span>
            </div>
            <button
              type="button"
              disabled={isRequestingPayment}
              onClick={handleTogglePaymentRequest}
              className="text-[11px] underline text-amber-800 hover:text-amber-950 font-bold cursor-pointer ml-2 shrink-0"
            >
              Hủy yêu cầu
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isOnline ? (
            /* ĐỐI VỚI ĐƠN HÀNG ONLINE: CHỈ XEM, KHÔNG ĐƯỢC SỬA/XÓA MÓN, CHO PHÉP XUẤT HÓA ĐƠN VAT */
            <button
              type="button"
              onClick={() => setIsVatModalOpen(true)}
              className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Receipt size={18} strokeWidth={2.2} />
              <span>{order?.isInvoiceRequested ? 'Cập nhật thông tin HĐ VAT' : 'Thêm thông tin xuất hóa đơn VAT'}</span>
            </button>
          ) : (
            /* ĐƠN TẠI BÀN / MANG ĐI / GIAO HÀNG */
            <>
              {/* 1. Nút Thêm món */}
              <button
                type="button"
                onClick={handleAddItems}
                className="flex-1 py-3 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>Thêm</span>
              </button>

              {/* 2. Nút Báo bếp / Lưu */}
              {hasUnsentKitchenItems ? (
                <button
                  type="button"
                  disabled={isSavingKitchen}
                  onClick={handleSaveKitchen}
                  className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  title="Gửi lệnh in món tới bếp"
                >
                  <ChefHat size={18} className="text-white" />
                  <span>{isSavingKitchen ? 'Đang gửi...' : 'Báo bếp'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSavingKitchen}
                  onClick={handleSaveKitchen}
                  className="flex-1 py-3 rounded-xl bg-white hover:bg-slate-50 active:scale-95 border border-slate-300 text-slate-700 font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save size={18} className="text-slate-600" />
                  <span>{isSavingKitchen ? 'Đang lưu...' : 'Lưu'}</span>
                </button>
              )}

              {/* 3. Nút Chuông Yêu cầu TT siêu nhỏ gọn (bấm lần nữa để hủy) */}
              {(() => {
                const isRequested = order?.paymentStatus === 'PAYMENT_REQUESTED' || order?.status === 'HELD';
                return (
                  <button
                    type="button"
                    disabled={isRequestingPayment}
                    onClick={handleTogglePaymentRequest}
                    className={`w-12 h-12 rounded-xl active:scale-95 border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isRequested
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-200 animate-pulse'
                        : 'bg-white hover:bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-400'
                    }`}
                    title={isRequested ? 'Đang chờ POS thanh toán (Bấm để HỦY)' : 'Gửi yêu cầu thanh toán tới thu ngân POS'}
                  >
                    {isRequestingPayment ? (
                      <Loader2 size={20} className="animate-spin text-inherit" />
                    ) : isRequested ? (
                      <BellRing size={20} className="text-white" />
                    ) : (
                      <Bell size={20} className="text-amber-600" />
                    )}
                  </button>
                );
              })()}

              {/* 4. Nút Thanh toán */}
              <button
                type="button"
                onClick={() => setIsPaymentOpen(true)}
                className="flex-1 py-3 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 border border-emerald-600 text-emerald-700 font-bold text-sm shadow-sm flex items-center justify-center transition-all cursor-pointer"
              >
                <span>Thanh toán</span>
              </button>
            </>
          )}
        </div>
      </footer>

      <OrderActionsSheet
        isOpen={isActionsOpen}
        onClose={() => setIsActionsOpen(false)}
        order={order}
        table={table}
        onRefresh={() => mutate()}
        onOpenRedeemPoints={() => setIsPointsOpen(true)}
      />

      {table && (
        <TableQrModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          tableName={`Bàn ${table.name || table.tableCode || ''}`}
          tableCode={table.tableCode}
          tableId={table.id}
          branchId={activeBranchId || undefined}
          orderId={order?.id}
        />
      )}

      <OrderOptionsDrawer
        isOpen={isOrderOptionsOpen}
        onClose={() => setIsOrderOptionsOpen(false)}
        order={order}
        onSuccess={() => mutate()}
      />

      {isEditingGuestCount && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-2xl text-center space-y-4">
            <h3 className="font-bold text-base text-slate-800">Cập nhật số lượng khách</h3>
            <div className="flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => setTempGuests(Math.max(1, tempGuests - 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 font-bold text-xl active:scale-90 cursor-pointer"
              >
                -
              </button>
              <span className="text-3xl font-black text-slate-900 w-12 text-center">{tempGuests}</span>
              <button
                type="button"
                onClick={() => setTempGuests(tempGuests + 1)}
                className="w-11 h-11 rounded-xl bg-slate-100 font-bold text-xl active:scale-90 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingGuestCount(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!order?.id) return;
                  try {
                    const res = await fetch(`/api/pos/orders/${order.id}/update`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ guestCount: tempGuests }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(`Đã cập nhật ${tempGuests} khách`);
                      mutate();
                      setIsEditingGuestCount(false);
                    }
                  } catch {
                    toast.error('Lỗi cập nhật');
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      <RedeemPointsModal
        isOpen={isPointsOpen}
        onClose={() => setIsPointsOpen(false)}
        order={order}
        onAppliedSuccess={() => mutate()}
      />

      <TaxFeeSheet
        isOpen={isTaxFeeOpen}
        onClose={() => setIsTaxFeeOpen(false)}
        order={order || { totalAmount: finalTotal, subTotal }}
        onSuccess={() => mutate()}
      />

      <PaymentView
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        order={order ? { ...order, totalAmount: finalTotal } : null}
        onCustomerUpdated={() => mutate()}
        onSuccess={() => {
          setIsPaymentOpen(false);
          setSelectedTableId(null);
          setSelectedOrderId(null);
          setActiveTab('TABLES');
        }}
      />

      <WaiterEditItemModal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        item={editingItem?.item}
        isSent={editingItem?.isSent || false}
        activeBranchId={activeBranchId}
        order={order}
        onUpdateUnsent={(updates) => {
          if (editingItem?.item?.localId) {
            updateUnsentItem(cartKey, editingItem.item.localId, updates);
          }
        }}
        onRemoveUnsent={() => {
          if (editingItem?.item?.localId) {
            removeUnsentItem(cartKey, editingItem.item.localId);
          }
        }}
        onOrderUpdated={async () => {
          await mutate();
        }}
      />

      {/* MODAL CẢNH BÁO THOÁT ĐƠN CÓ MÓN CHƯA LƯU (3 NÚT: Hủy lưu | Tiếp tục chỉnh sửa | Lưu đơn) */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4 animate-in zoom-in-95 duration-150 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-xs">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <h4 className="text-base font-black text-slate-900">Đơn Hàng Chưa Lưu Thay Đổi!</h4>
              <p className="text-xs text-slate-500">
                Hiện có <strong className="text-amber-700">{unsentItems.length} món mới</strong> chưa được gửi bếp hoặc lưu vào hệ thống. Bạn muốn thực hiện thao tác nào?
              </p>
            </div>

            {/* List of unsent items preview */}
            <div className="max-h-36 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
              {unsentItems.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                    {it.quantity}x {it.productName}
                  </span>
                  <span className="font-mono font-bold text-slate-600">
                    {(it.priceAtSale * it.quantity).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              ))}
            </div>

            {/* 3 NÚT THAO TÁC RÕ RÀNG THEO YÊU CẦU */}
            <div className="flex flex-col gap-2 pt-1">
              {/* Nút 3: Lưu đơn */}
              <button
                type="button"
                onClick={async () => {
                  setShowExitConfirm(false);
                  await handleSaveKitchen();
                  executeExit();
                }}
                className="w-full py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu đơn</span>
              </button>

              {/* Nút 2: Tiếp tục chỉnh sửa */}
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Tiếp tục chỉnh sửa
              </button>

              {/* Nút 1: Hủy lưu */}
              <button
                type="button"
                onClick={() => {
                  clearUnsentItems(cartKey);
                  setShowExitConfirm(false);
                  toast.success('Đã hủy các món chưa lưu');
                  executeExit();
                }}
                className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 font-bold text-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Hủy lưu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CẬP NHẬT THÔNG TIN XUẤT HÓA ĐƠN VAT CHO ĐƠN ONLINE & TẤT CẢ ĐƠN */}
      {isVatModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                  <Receipt size={18} className="text-[#DA251D]" />
                  Thông tin xuất hóa đơn VAT
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đơn hàng: #{order?.orderCode || order?.temporaryOrderCode || 'Đơn hàng'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã số thuế doanh nghiệp</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vatTaxCode}
                    onChange={(e) => setVatTaxCode(e.target.value)}
                    placeholder="VD: 0101234567"
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#DA251D]"
                  />
                  <button
                    type="button"
                    disabled={isLookingUpTax || !vatTaxCode.trim()}
                    onClick={handleLookupTax}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {isLookingUpTax ? <Loader2 size={14} className="animate-spin" /> : 'Tra cứu'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên công ty / Doanh nghiệp</label>
                <input
                  type="text"
                  value={vatCompanyName}
                  onChange={(e) => setVatCompanyName(e.target.value)}
                  placeholder="Công ty TNHH..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#DA251D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ doanh nghiệp</label>
                <input
                  type="text"
                  value={vatAddress}
                  onChange={(e) => setVatAddress(e.target.value)}
                  placeholder="Số nhà, đường, phường, quận/huyện..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#DA251D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email nhận hóa đơn điện tử</label>
                <input
                  type="email"
                  value={vatEmail}
                  onChange={(e) => setVatEmail(e.target.value)}
                  placeholder="ketoan@company.com"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#DA251D]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsVatModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isSavingVat}
                onClick={handleSaveVat}
                className="flex-1 py-3 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSavingVat ? <Loader2 size={16} className="animate-spin" /> : 'Lưu thông tin VAT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
