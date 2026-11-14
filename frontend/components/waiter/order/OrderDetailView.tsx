'use client';

import React, { useState, useEffect } from 'react';
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
  Printer,
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  Check,
  Home,
  CloudOff,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { isOnlineOrder } from '@/components/pos/pos-utils';
import OrderActionsSheet from './OrderActionsSheet';
import TableQrModal from './TableQrModal';
import OrderOptionsDrawer from './OrderOptionsDrawer';
import RedeemPointsModal from './RedeemPointsModal';
import TaxFeeSheet from '../financial/TaxFeeSheet';
import { PaymentModal, RealMember } from '@/components/pos/PaymentModal';
import { PosCartItem } from '@/components/pos/pos-types';
import { printAgent } from '@/lib/print-agent';
import WaiterEditItemModal from './WaiterEditItemModal';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/syncEngine';
import { useInstantOrder } from '@/lib/offline/useOfflineData';
import PullToRefresh from '../common/PullToRefresh';
import { useIsIPhone } from '@/lib/utils/device';
import { useModalZIndex } from '@/lib/modal-stack';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store', credentials: 'include' }).then(r => r.json());
const EMPTY_ITEMS: UnsentItem[] = [];

const getPaymentMethodLabel = (method?: string): string => {
  const code = String(method || '').trim().toUpperCase();
  switch (code) {
    case 'CASH':
      return 'Tiền mặt';
    case 'CARD':
    case 'POS_CARD':
    case 'SWIPE_CARD':
      return 'Thẻ / Máy POS';
    case 'SEPAY_QR':
    case 'VIETQR':
    case 'BANK_TRANSFER':
    case 'TRANSFER':
    case 'QR_TRANSFER':
    case 'DYNAMIC_QR':
      return 'Chuyển khoản ngân hàng';
    case 'MOMO':
      return 'Ví MoMo';
    case 'ZALOPAY':
      return 'Ví ZaloPay';
    case 'VNPAY':
      return 'VNPAY';
    case 'PAYOS':
      return 'PayOS';
    case 'AVORA_COIN':
    case 'POINTS':
      return 'AVORA Coin';
    default:
      return code || 'Chưa xác định';
  }
};

const isAutoConfirmedGatewayMethod = (method?: string, transactionCode?: string): boolean => {
  const code = String(method || '').trim().toUpperCase();
  if (['CASH', 'CARD', 'POS_CARD', 'SWIPE_CARD'].includes(code)) {
    return false;
  }
  if (
    [
      'SEPAY_QR',
      'VIETQR',
      'BANK_TRANSFER',
      'TRANSFER',
      'QR_TRANSFER',
      'DYNAMIC_QR',
      'PAYOS',
      'MOMO',
      'ZALOPAY',
      'VNPAY',
    ].includes(code)
  ) {
    return true;
  }
  return Boolean(transactionCode && String(transactionCode).trim());
};

export default function OrderDetailView() {
  const { 
    selectedTableId, 
    selectedOrderId, 
    setSelectedTableId, 
    setSelectedOrderId, 
    setActiveTab,
    sourceTab,
    registerModalHandler,
    activeBranchId,
    currentBranch,
    currentUser,
    isOffline,
    updateUnsentItem,
    removeUnsentItem,
    clearUnsentItems,
    shouldScrollToUnsent,
    setShouldScrollToUnsent,
  } = useWaiterStore();
  const isIPhone = useIsIPhone();

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const unsentSectionRef = React.useRef<HTMLDivElement>(null);

  const cartKey = selectedTableId || selectedOrderId || '';

  // Stable selector avoiding getSnapshot re-render loop
  const unsentMap = useWaiterStore(s => s.unsentItems);
  const unsentItems = (cartKey && unsentMap[cartKey]) || EMPTY_ITEMS;

  const { can } = useAdmin();
  const canAddItems = can('pos.item.add', activeBranchId || undefined);
  const canCollectPayment = can('pos.payment.collect', activeBranchId || undefined) || can('pos.payment.complete', activeBranchId || undefined);
  const canRequestPayment = can('waiter.payment.request', activeBranchId || undefined);
  const canHoldOrder = can('pos.order.update', activeBranchId || undefined);
  const canPrintTempBill = can('pos.temp_bill.print', activeBranchId || undefined);
  const [isPrintingTempBill, setIsPrintingTempBill] = useState(false);
  const [isHoldingOrder, setIsHoldingOrder] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Auto-scroll to newly added items when coming from MenuView "Xem món đã chọn"
  React.useEffect(() => {
    if (shouldScrollToUnsent && unsentItems.length > 0) {
      const timer = setTimeout(() => {
        if (unsentSectionRef.current) {
          unsentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
        setShouldScrollToUnsent(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [shouldScrollToUnsent, unsentItems.length, setShouldScrollToUnsent]);

  const handlePrintTempBill = async () => {
    if (!order?.id) return;
    setIsPrintingTempBill(true);
    const toastId = toast.loading('Đang gửi lệnh in phiếu tạm tính...');
    try {
      const res = await fetch(`/api/print-templates/render/order/${order.id}?type=TEMP_BILL`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi in phiếu tạm tính');
      }
      toast.success('Đã gửi lệnh in tạm tính thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi in tạm tính', { id: toastId });
    } finally {
      setIsPrintingTempBill(false);
    }
  };

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

  // Live Instant Order & Table from Dexie (0ms reactivity)
  const { localOrder: localLiveOrder, localTable: localLiveTable } = useInstantOrder(selectedTableId, selectedOrderId);

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
    { refreshInterval: 4000, keepPreviousData: true, revalidateOnFocus: false }
  );

  const table = response?.data?.table || localLiveTable;

  // Smart Reconciled Order: Instant optimistic display with zero 3-second delay
  const order = React.useMemo(() => {
    const serverOrder = selectedTableId ? response?.data?.order : response?.data;
    const hasConfirmedEmptyServerResponse = Boolean(
      response?.success && !serverOrder && !isLoading
    );
    if (localLiveOrder) {
      if (!serverOrder) {
        const isLocalDraft =
          typeof localLiveOrder.id === 'string' &&
          (localLiveOrder.id.startsWith('draft_') || localLiveOrder.id.startsWith('offline_'));
        if (hasConfirmedEmptyServerResponse && !isLocalDraft) {
          return null;
        }
        return localLiveOrder;
      }

      // Check if localLiveOrder has unconfirmed optimistic items (id starts with opt_ or offline_)
      const localItems = localLiveOrder.orderItems || [];
      const serverItems = serverOrder.orderItems || [];

      const pendingLocalItems = localItems.filter((lit: any) =>
        typeof lit.id === 'string' && (lit.id.startsWith('opt_') || lit.id.startsWith('offline_'))
      );

      if (pendingLocalItems.length > 0) {
        const unconfirmedItems = pendingLocalItems.filter(
          (pit: any) => !serverItems.some((sit: any) => sit.id === pit.id)
        );

        if (unconfirmedItems.length > 0) {
          const addedSub = unconfirmedItems.reduce((s: number, i: any) => s + (i.priceAtSale * i.quantity), 0);
          return {
            ...serverOrder,
            orderItems: [...serverItems, ...unconfirmedItems],
            subTotal: Number(serverOrder.subTotal || 0) + addedSub,
            totalAmount: Number(serverOrder.totalAmount || 0) + addedSub,
          };
        }
      }
      return serverOrder;
    }
    return serverOrder || null;
  }, [response?.data, localLiveOrder, selectedTableId]);
  const isOnline = isOnlineOrder(order);

  // Đơn hàng chỉ bị khóa sửa món khi đang chờ xác nhận chuyển khoản (paymentIntentStatus ACTIVE / AWAITING_PAYMENT) hoặc đã hoàn tất/hủy
  const isOrderLocked =
    isOnline ||
    order?.status === 'COMPLETED' ||
    order?.status === 'CANCELLED' ||
    order?.paymentStatus === 'AWAITING_PAYMENT' ||
    order?.paymentStatus === 'PAID' ||
    order?.paymentStatus === 'COMPLETED' ||
    order?.paymentIntentStatus === 'ACTIVE';

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
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    orderId: string;
    orderCode: string;
    temporaryOrderCode?: string;
    tableName?: string;
    amount?: number;
    paymentMethod?: string;
    paidAt?: string;
    transactionCode?: string;
  } | null>(null);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);

  const guestModalZIndex = useModalZIndex(isEditingGuestCount, 110);
  const exitConfirmZIndex = useModalZIndex(showExitConfirm, 130);
  const paymentSuccessZIndex = useModalZIndex(Boolean(paymentSuccessData), 200);

  // Preserve metadata of the order being viewed / paid in case closing session clears `order`
  const lastViewedOrderRef = React.useRef<{
    id?: string;
    orderCode?: string;
    temporaryOrderCode?: string;
    tableId?: string | null;
    tableName?: string;
    totalAmount?: number;
  }>({});

  React.useEffect(() => {
    if (order?.id) {
      const rawTblName = table?.name || table?.tableCode || order?.table?.name || order?.tableName || '';
      const cleanTblName = rawTblName.replace(/^Bàn\s+/i, '').trim() || rawTblName;
      lastViewedOrderRef.current = {
        id: order.id,
        orderCode: order.orderCode || undefined,
        temporaryOrderCode: order.temporaryOrderCode || undefined,
        tableId: selectedTableId || order.tableId || null,
        tableName: cleanTblName,
        totalAmount: Number(order.totalAmount || order.subTotal || 0),
      };
    }
  }, [order, table, selectedTableId]);

  const showPaymentSuccessForOrder = React.useCallback(
    async (data: any) => {
      const snapshot = lastViewedOrderRef.current;
      const finalId = data?.orderId || order?.id || snapshot.id || '';
      const finalOrderCode =
        data?.realOrderCode ||
        data?.orderCode ||
        (data as any)?.updatedOrder?.orderCode ||
        order?.orderCode ||
        snapshot.orderCode ||
        '';
      const finalTempCode =
        data?.temporaryOrderCode ||
        (data as any)?.updatedOrder?.temporaryOrderCode ||
        order?.temporaryOrderCode ||
        snapshot.temporaryOrderCode ||
        undefined;
      const rawTblName =
        data?.tableName ||
        table?.name ||
        order?.table?.name ||
        snapshot.tableName ||
        '';
      const cleanTblName = rawTblName.replace(/^Bàn\s+/i, '').trim() || rawTblName;

      const resolvedPaymentMethod =
        data?.paymentMethod ||
        (data as any)?.payments?.[0]?.paymentMethod ||
        (data as any)?.updatedOrder?.payments?.[0]?.paymentMethod ||
        (order as any)?.payments?.[0]?.paymentMethod ||
        (data?.transactionCode || isQrModalOpen ? 'SEPAY_QR' : '');

      setIsPaymentOpen(false);
      setIsQrModalOpen(false);
      clearUnsentItems(cartKey);

      if (finalId) {
        await db.activeOrders.delete(finalId).catch(() => {});
      }

      setPaymentSuccessData((prev) => {
        if (
          prev &&
          prev.orderId === finalId &&
          prev.orderCode === finalOrderCode &&
          prev.paymentMethod
        ) {
          return prev;
        }
        return {
          orderId: finalId,
          orderCode: finalOrderCode || finalTempCode || '',
          temporaryOrderCode: finalTempCode,
          tableName: cleanTblName,
          amount: Number(data?.amount ?? data?.totalPaid ?? data?.totalAmount ?? order?.totalAmount ?? snapshot.totalAmount ?? 0),
          paymentMethod: resolvedPaymentMethod || 'CASH',
          paidAt: data?.paidAt || data?.matchedAt || new Date().toISOString(),
          transactionCode: data?.transactionCode || '',
        };
      });
    },
    [order, table, cartKey, clearUnsentItems, isQrModalOpen],
  );

  // Instant WebSocket-bridged payment success detection while QR/payment or order detail is open
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePaidEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const snapshot = lastViewedOrderRef.current;
      const curId = order?.id || snapshot.id;
      const curOrderCode = order?.orderCode || snapshot.orderCode;
      const curTmpCode = order?.temporaryOrderCode || snapshot.temporaryOrderCode;
      const curTableId = selectedTableId || order?.tableId || snapshot.tableId;

      const isSameOrder =
        (detail.orderId && curId && detail.orderId === curId) ||
        (detail.orderCode && (detail.orderCode === curOrderCode || detail.orderCode === curTmpCode)) ||
        (detail.temporaryOrderCode && (detail.temporaryOrderCode === curTmpCode || detail.temporaryOrderCode === curOrderCode)) ||
        (isPaymentOpen && detail.tableId && curTableId && detail.tableId === curTableId);

      if (isSameOrder) {
        showPaymentSuccessForOrder(detail);
      }
    };

    window.addEventListener('avora:payment-completed', handlePaidEvent);
    return () => window.removeEventListener('avora:payment-completed', handlePaidEvent);
  }, [order, selectedTableId, isPaymentOpen, showPaymentSuccessForOrder]);

  // Also detect directly from polled/updated SWR order status if payment became PAID while viewing QR
  React.useEffect(() => {
    if ((isPaymentOpen || isQrModalOpen) && order && (order.paymentStatus === 'PAID' || order.status === 'COMPLETED')) {
      showPaymentSuccessForOrder(order);
    }
  }, [isPaymentOpen, isQrModalOpen, order, showPaymentSuccessForOrder]);

  const handleExitToTables = () => {
    setPaymentSuccessData(null);
    setSelectedTableId(null);
    setSelectedOrderId(null);
    clearUnsentItems(cartKey);
    setActiveTab('TABLES');
  };

  const handlePrintReceiptFromSuccess = async () => {
    if (!paymentSuccessData?.orderId) return;
    setIsPrintingReceipt(true);
    const toastId = toast.loading('Đang gửi lệnh in hóa đơn đến máy POS...');
    try {
      const effectiveBranch = currentBranch;
      const targetPrinter = (effectiveBranch as any)?.defaultReceiptPrinterId || 'Xprinter XP-350B';
      const paperSize = ((effectiveBranch as any)?.defaultPaperSize || '80mm') as any;
      const copies = Math.max(1, Number((effectiveBranch as any)?.receiptCopies || 1));

      const tplRes = await fetch(`/api/print-templates/render/order/${paymentSuccessData.orderId}?type=RECEIPT&paperSize=${encodeURIComponent(paperSize)}`, {
        credentials: 'include',
      });
      const tplJson = await tplRes.json();
      if (tplJson.success && tplJson.data?.html) {
        await printAgent.printHtml({
          printerName: targetPrinter,
          htmlContent: tplJson.data.html,
          paperSize,
          copies,
          receiptPayload: tplJson.data?.receiptPayload,
        });
        toast.success('Đã gửi lệnh in hóa đơn thành công!', { id: toastId });
      } else {
        throw new Error(tplJson.message || 'Không thể render mẫu hóa đơn');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi lệnh in hóa đơn', { id: toastId });
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  // Register all modals inside OrderDetailView with the central back navigation stack
  useEffect(() => {
    return registerModalHandler('order-detail', () => {
      // 1. Close internal modals first (LIFO order)
      if (paymentSuccessData) { handleExitToTables(); return true; }
      if (showExitConfirm) { setShowExitConfirm(false); return true; }
      if (showBreakdownPopover) { setShowBreakdownPopover(false); return true; }
      if (isVatModalOpen) { setIsVatModalOpen(false); return true; }
      if (editingItem) { setEditingItem(null); return true; }
      if (isQrModalOpen) { setIsQrModalOpen(false); return true; }
      if (isPaymentOpen) { setIsPaymentOpen(false); return true; }
      if (isTaxFeeOpen) { setIsTaxFeeOpen(false); return true; }
      if (isPointsOpen) { setIsPointsOpen(false); return true; }
      if (isOrderOptionsOpen) { setIsOrderOptionsOpen(false); return true; }
      if (isActionsOpen) { setIsActionsOpen(false); return true; }
      if (isEditingGuestCount) { setIsEditingGuestCount(false); return true; }

      // 2. If there are unsent items, trigger the exit confirmation modal!
      if (unsentItems.length > 0) {
        setShowExitConfirm(true);
        return true;
      }

      // 3. Otherwise return false to let useWaiterBackHandler perform clean exit to sourceTab
      return false;
    });
  }, [
    paymentSuccessData,
    showExitConfirm, 
    showBreakdownPopover, 
    isVatModalOpen, 
    editingItem, 
    isQrModalOpen, 
    isPaymentOpen, 
    isTaxFeeOpen, 
    isPointsOpen, 
    isOrderOptionsOpen, 
    isActionsOpen, 
    isEditingGuestCount, 
    unsentItems.length,
    registerModalHandler
  ]);

  const handleBack = () => {
    if (unsentItems.length > 0) {
      setShowExitConfirm(true);
      return;
    }
    executeExit();
  };

  const executeExit = () => {
    setSelectedTableId(null);
    setSelectedOrderId(null);
    setActiveTab(sourceTab || 'TABLES');
  };

  const handleAddItems = () => {
    if (isOnline) {
      toast('Đơn hàng trực tuyến chỉ được xem, không được thêm món!', {
        icon: <Info size={16} className="text-sky-500" />,
      });
      return;
    }
    if (isOrderLocked) {
      toast.error('Đơn hàng đang chờ thanh toán hoặc đã khóa, không thể thêm món!');
      return;
    }
    if (!canAddItems) {
      toast.error('Bạn không có quyền thêm món vào order (pos.item.add)', {
        icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
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
  const isOrderEmpty = totalItemCount === 0;

  const subTotal = totalSent + totalUnsent;
  const discountAmount = Number(order?.discountAmount) || 0;
  const serviceChargeTotal = Number(order?.serviceChargeTotal) || 0;
  const taxAmount = Number(order?.taxAmount) || 0;
  const finalTotal = order?.totalAmount !== undefined && order?.totalAmount !== null
    ? Math.max(0, Number(order.totalAmount) + totalUnsent)
    : Math.max(0, subTotal - discountAmount) + serviceChargeTotal;

  // Send unsent items to kitchen (Lưu / Báo bếp)
  const handleSaveKitchen = async () => {
    if (isOrderLocked) {
      toast.error('Đơn hàng đang chờ thanh toán hoặc đã khóa, không thể gửi bếp!');
      return;
    }
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

      // BƯỚC 1: OPTIMISTIC UPDATE TỨC THÌ (0ms) - Đảm bảo danh sách món hiển thị ngay lập tức không bị mất 3s
      const optimisticNewItems = unsentItems.map((it, idx) => ({
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
        orderedById: currentUser?.id,
        orderedByName: currentUser?.fullName,
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

      const addedTotal = unsentItems.reduce((sum, it) => sum + (it.priceAtSale * it.quantity), 0);

      // Mutate SWR cache ngay lập tức (không đợi mạng)
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
        const newSubTotal = Number(currentOrder.subTotal || 0) + addedTotal;
        const newTotal = Number(currentOrder.totalAmount || 0) + addedTotal;
        const updatedOrder = {
          ...currentOrder,
          orderItems: mergedItems,
          subTotal: newSubTotal,
          totalAmount: newTotal,
        };
        return currentData.data
          ? { ...currentData, data: { ...currentData.data, order: updatedOrder } }
          : { ...currentData, order: updatedOrder };
      }, false);

      // BƯỚC 2: CẬP NHẬT INDEXEDDB ĐỂ DUY TRÌ DỮ LIỆU KHI OFFLINE
      let targetOfflineId: string | null = null;
      if (selectedTableId && activeBranchId) {
        try {
          const cachedOrder = await db.activeOrders.where('tableId').equals(selectedTableId).first();
          if (cachedOrder) {
            const existingIds = new Set((cachedOrder.orderItems || []).map((i: any) => i.id));
            const toAppend = optimisticNewItems.filter(i => !existingIds.has(i.id));
            const merged = [...(cachedOrder.orderItems || []), ...toAppend];
            await db.activeOrders.update(cachedOrder.id, {
              orderItems: merged,
              totalAmount: Number(cachedOrder.totalAmount || 0) + addedTotal,
              subTotal: Number(cachedOrder.subTotal || 0) + addedTotal,
              kitchenStatus: 'PENDING',
              updatedAt: new Date().toISOString(),
            });
          } else {
            targetOfflineId = `offline_ord_${Date.now()}`;
            await db.activeOrders.put({
              id: targetOfflineId,
              branchId: activeBranchId,
              tableId: selectedTableId,
              orderCode: 'Lưu offline',
              temporaryOrderCode: null,
              guestCount: order?.guestCount || 1,
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
          console.warn('Lỗi ghi IndexedDB optimistic order:', dbErr);
        }
      }

      // Xóa unsent cart ngay sau khi đã lưu bền vững vào IndexedDB
      clearUnsentItems(cartKey);

      // If offline, enqueue into persistent IndexedDB command queue
      if (isOffline) {
        if (activeBranchId) {
          await syncEngine.enqueueCommand(
            'SEND_ITEMS',
            activeBranchId,
            { branchId: activeBranchId, items: itemsPayload },
            { tableId: selectedTableId || undefined, orderId: order?.id || undefined }
          );
          toast.success('Đã lưu vào hàng đợi ngoại tuyến. Món đã được lưu cục bộ.', {
            id: toastId,
            icon: <CloudOff className="w-4 h-4 text-amber-500" />,
            duration: 4000,
          });
        }
        setIsSavingKitchen(false);
        return;
      }

      let printStatus: any = null;
      let responsePayload: any = null;
      const idempotencyKey = `cmd_send_${crypto.randomUUID()}`;

      if (selectedTableId) {
        // Table order
        const res = await fetch(`/api/pos/tables/${selectedTableId}/send-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchId: activeBranchId,
            items: itemsPayload,
            idempotencyKey,
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Lỗi khi gửi bếp');
        }
        responsePayload = data;
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
        responsePayload = data;

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

      // RECONCILE TỨC THÌ TỪ RESPONSE SERVER - KHÔNG GỌI AWAIT MUTATE() ĐỂ TRÁNH TRỄ 3 GIÂY
      const serverResult = responsePayload?.data || responsePayload;
      if (serverResult?.order && activeBranchId) {
        const sOrder = serverResult.order;
        try {
          await db.activeOrders.put({
            id: sOrder.id,
            branchId: activeBranchId,
            tableId: selectedTableId || null,
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
          if (targetOfflineId) {
            await db.activeOrders.delete(targetOfflineId).catch(() => {});
          }
        } catch (dbErr) {
          console.warn('Lỗi lưu server order vào IndexedDB:', dbErr);
        }
      }

      // Revalidate SWR cache với payload server trả về (revalidate: false, 0ms latency)
      if (responsePayload) {
        mutate(responsePayload, false);
      }

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
      if (!navigator.onLine || error.message?.includes('fetch') || error.message?.includes('NetworkError')) {
        if (activeBranchId) {
          await syncEngine.enqueueCommand(
            'SEND_ITEMS',
            activeBranchId,
            { branchId: activeBranchId, items: unsentItems },
            { tableId: selectedTableId || undefined, orderId: order?.id || undefined }
          );
          clearUnsentItems(cartKey);
          toast.success('Mất kết nối. Đơn đã được chuyển vào hàng đợi ngoại tuyến an toàn!', {
            id: toastId,
            icon: <CloudOff className="w-4 h-4 text-amber-500" />,
            duration: 5000,
          });
        }
      } else {
        toast.error(error.message || 'Lỗi gửi món sang bếp', { id: toastId });
      }
    } finally {
      setIsSavingKitchen(false);
    }
  };

  const handleTogglePaymentRequest = async () => {
    if (!order?.id) return;
    const isCurrentlyRequested =
      order.paymentStatus === 'PAYMENT_REQUESTED' ||
      order.status === 'HELD' ||
      order.paymentStatus === 'AWAITING_PAYMENT';
    setIsRequestingPayment(true);
    try {
      if (isCurrentlyRequested) {
        // Hoãn thanh toán / hủy yêu cầu thanh toán -> quay về trạng thái phục vụ (PENDING)
        const res = await fetch(`/api/pos/orders/${order.id}/cancel-payment-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || json.error?.message || 'Không thể hoãn yêu cầu thanh toán');
        }
        const updatedOrder = json.data;
        if (updatedOrder && activeBranchId) {
          await db.activeOrders.put({
            id: updatedOrder.id,
            branchId: activeBranchId,
            tableId: selectedTableId || updatedOrder.tableId || null,
            orderCode: updatedOrder.orderCode,
            temporaryOrderCode: updatedOrder.temporaryOrderCode || null,
            guestCount: updatedOrder.guestCount || 1,
            totalAmount: updatedOrder.totalAmount || 0,
            subTotal: updatedOrder.subTotal || 0,
            taxAmount: updatedOrder.taxAmount || 0,
            discountAmount: updatedOrder.discountAmount || 0,
            serviceChargeTotal: updatedOrder.serviceChargeTotal || 0,
            status: updatedOrder.status,
            paymentStatus: updatedOrder.paymentStatus,
            kitchenStatus: updatedOrder.kitchenStatus || 'PENDING',
            cashierId: updatedOrder.cashierId || null,
            orderItems: updatedOrder.orderItems || [],
            user: updatedOrder.user || null,
            updatedAt: updatedOrder.updatedAt || new Date().toISOString(),
          }).catch(() => {});
        }
        toast.success('Đã chuyển về trạng thái phục vụ (Hoãn thanh toán)!', {
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
        const updatedOrder = json.data;
        if (updatedOrder && activeBranchId) {
          await db.activeOrders.put({
            id: updatedOrder.id,
            branchId: activeBranchId,
            tableId: selectedTableId || updatedOrder.tableId || null,
            orderCode: updatedOrder.orderCode,
            temporaryOrderCode: updatedOrder.temporaryOrderCode || null,
            guestCount: updatedOrder.guestCount || 1,
            totalAmount: updatedOrder.totalAmount || 0,
            subTotal: updatedOrder.subTotal || 0,
            taxAmount: updatedOrder.taxAmount || 0,
            discountAmount: updatedOrder.discountAmount || 0,
            serviceChargeTotal: updatedOrder.serviceChargeTotal || 0,
            status: updatedOrder.status,
            paymentStatus: updatedOrder.paymentStatus,
            kitchenStatus: updatedOrder.kitchenStatus || 'PENDING',
            cashierId: updatedOrder.cashierId || null,
            orderItems: updatedOrder.orderItems || [],
            user: updatedOrder.user || null,
            updatedAt: updatedOrder.updatedAt || new Date().toISOString(),
          }).catch(() => {});
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

  // Map cart items for 100% Payment Parity with POS PaymentModal
  const cartItemsForPayment: PosCartItem[] = React.useMemo(() => {
    const list: PosCartItem[] = [];

    (orderItems || []).forEach((item: any) => {
      list.push({
        id: item.id || `sent-${item.productId}-${Math.random()}`,
        productId: item.productId,
        product: item.product || {
          id: item.productId,
          name: item.productName || item.product?.name || 'Món',
          effectivePrice: item.priceAtSale,
          price: item.priceAtSale,
        },
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
        originalPriceAtSale: item.originalPriceAtSale || item.priceAtSale,
        customPrice: item.customPrice,
        discountAmount: item.discountAmount || 0,
        discountReason: item.discountReason,
        taxPercentageAtSale: item.taxPercentageAtSale,
        note: item.note,
        optionsTextSnapshot: item.optionsTextSnapshot,
        selectedOptions: item.selectedOptions?.map((so: any) => ({
          optionItemId: so.optionItemId || so.id,
          nameAtSale: so.nameAtSale || so.optionItem?.name || '',
          priceAdjustmentAtSale: so.priceAdjustmentAtSale ?? so.priceAdjustment ?? 0,
        })) || [],
        pricingMode: item.pricingMode || 'REGULAR',
        kitchenStatus: item.kitchenStatus,
        sentQuantity: item.sentQuantity,
        printedQuantity: item.printedQuantity,
        source: item.source,
      } as PosCartItem);
    });

    unsentItems.forEach((it: UnsentItem) => {
      list.push({
        id: it.localId,
        productId: it.productId,
        product: {
          id: it.productId,
          name: it.productName,
          effectivePrice: it.priceAtSale,
          price: it.priceAtSale,
        } as any,
        quantity: it.quantity,
        priceAtSale: it.priceAtSale,
        originalPriceAtSale: it.originalPriceAtSale || it.priceAtSale,
        discountAmount: it.discountAmount || 0,
        discountReason: it.discountReason,
        note: it.note,
        selectedOptions: it.selectedOptions?.map((so) => ({
          optionItemId: so.optionItemId,
          nameAtSale: so.nameAtSale,
          priceAdjustmentAtSale: so.priceAdjustment,
        })) || [],
        pricingMode: it.pricingMode || 'REGULAR',
        source: 'WAITER' as const,
      } as PosCartItem);
    });

    return list;
  }, [orderItems, unsentItems]);

  const handleProcessPayment = async (payload: {
    payments: Array<{
      paymentMethod: string;
      amount: number;
      cashReceived?: number;
      cashChange?: number;
      cardType?: string;
      cardLast4?: string;
      transactionRef?: string;
    }>;
    discountVoucherCode?: string;
    shippingVoucherCode?: string;
    pointsUsed?: number;
    userId?: string;
    discountAmount?: number;
    discountReason?: string;
    isInvoiceRequested?: boolean;
    invoiceCompanyName?: string;
    invoiceTaxCode?: string;
    invoiceAddress?: string;
    invoiceEmail?: string;
  }) => {
    if (!order?.id && unsentItems.length === 0) {
      toast.error('Không tìm thấy thông tin đơn hàng để thanh toán');
      return;
    }

    setIsProcessingPayment(true);
    const toastId = toast.loading('Đang xử lý thanh toán...');

    try {
      if (unsentItems.length > 0) {
        await handleSaveKitchen();
      }

      const orderId = order?.id;
      if (!orderId) {
        throw new Error('Chưa có mã đơn hàng hợp lệ');
      }

      const payRes = await fetch(`/api/pos/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const payJson = await payRes.json();
      if (!payRes.ok || !payJson.success) {
        throw new Error(payJson.message || payJson.error?.message || 'Thanh toán không thành công');
      }

      const finalCode = payJson.data?.updatedOrder?.orderCode || payJson.data?.orderCode || order?.orderCode || '';
      toast.success(`Thanh toán hoàn tất đơn [${finalCode}]!`, { id: toastId, duration: 4000 });

      await mutate();
      await showPaymentSuccessForOrder({
        orderId,
        orderCode: finalCode,
        temporaryOrderCode: payJson.data?.updatedOrder?.temporaryOrderCode || order?.temporaryOrderCode,
        amount: payJson.data?.updatedOrder?.totalAmount ?? order?.totalAmount,
        paymentMethod: payload?.payments?.[0]?.paymentMethod || 'CASH',
      });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thanh toán đơn hàng', { id: toastId });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleHoldOrder = async () => {
    if (!order?.id) {
      toast.error('Đơn hàng chưa được lưu để hoãn');
      return;
    }
    setIsHoldingOrder(true);
    const toastId = toast.loading('Đang hoãn thanh toán đơn...');
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ note: 'Hoãn thanh toán phục vụ bàn' }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Không thể hoãn đơn hàng');
      }
      toast.success('Đã hoãn đơn hàng thành công!', { id: toastId });
      setIsPaymentOpen(false);
      await mutate();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hoãn thanh toán', { id: toastId });
    } finally {
      setIsHoldingOrder(false);
    }
  };

  const handleResumeOrder = async () => {
    if (!order?.id) return;
    setIsHoldingOrder(true);
    const toastId = toast.loading('Đang mở lại đơn hàng...');
    try {
      const res = await fetch(`/api/pos/orders/${order.id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error?.message || 'Không thể mở lại đơn hàng');
      }
      toast.success('Đã mở lại đơn hàng!', { id: toastId });
      await mutate();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi mở lại đơn', { id: toastId });
    } finally {
      setIsHoldingOrder(false);
    }
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const staffNameDisplay = currentUser?.fullName || order?.cashierName || 'Phục vụ bàn';
  const orderCodeDisplay = order?.orderCode || order?.temporaryOrderCode || (order?.id ? order.id.slice(0, 8) : 'MỚI');

  const rawTableName = table?.name || table?.tableCode || order?.table?.name || order?.tableName || '';
  const normalizedDineInTableName = rawTableName.replace(/^Bàn\s+/i, '').trim() || rawTableName;

  const orderTitle = normalizedDineInTableName
    ? normalizedDineInTableName
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
      <header className="w-full bg-white border-b border-slate-200 shrink-0 px-4 py-3 flex items-center justify-between shadow-2xs z-10 pt-[calc(0.75rem+env(safe-area-inset-top))] select-none touch-none overscroll-none">
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

      {/* ITEMS LIST & NATURAL FLOW CONTAINER (Full width, tích hợp PullToRefresh native) */}
      <PullToRefresh
        onRefresh={async () => {
          if (swrKey) {
            const freshRes = await fetch(swrKey, { cache: 'no-store', credentials: 'include' });
            const freshJson = await freshRes.json();
            if (freshJson?.success) {
              const sOrder = selectedTableId ? freshJson.data?.order : freshJson.data;
              if (sOrder && activeBranchId) {
                await db.activeOrders.put({
                  id: sOrder.id,
                  branchId: activeBranchId,
                  tableId: selectedTableId || sOrder.tableId || null,
                  orderCode: sOrder.orderCode,
                  temporaryOrderCode: sOrder.temporaryOrderCode || null,
                  guestCount: sOrder.guestCount || 1,
                  totalAmount: sOrder.totalAmount || 0,
                  subTotal: sOrder.subTotal || 0,
                  taxAmount: sOrder.taxAmount || 0,
                  discountAmount: sOrder.discountAmount || 0,
                  serviceChargeTotal: sOrder.serviceChargeTotal || 0,
                  status: sOrder.status,
                  paymentStatus: sOrder.paymentStatus,
                  kitchenStatus: sOrder.kitchenStatus || 'PENDING',
                  cashierId: sOrder.cashierId || null,
                  orderItems: sOrder.orderItems || [],
                  user: sOrder.user || null,
                  updatedAt: sOrder.updatedAt || new Date().toISOString(),
                }).catch(() => {});
              } else if (!sOrder && selectedTableId) {
                const staleList = await db.activeOrders.where('tableId').equals(selectedTableId).toArray().catch(() => []);
                for (const st of staleList) {
                  if (st.id && !st.id.startsWith('draft_') && !st.id.startsWith('offline_')) {
                    await db.activeOrders.delete(st.id).catch(() => {});
                  }
                }
              }
              await mutate(freshJson, { revalidate: false });
            } else {
              await mutate();
            }
          } else {
            await mutate();
          }
          if (activeBranchId) {
            await syncEngine.performDeltaSync(activeBranchId, false);
          }
        }}
        isOffline={isOffline}
        className="bg-slate-50 flex flex-col justify-start"
      >
        {/* Banner Đơn Online */}
        {isOnline && (
          <div className="p-3 m-3 bg-sky-50 border border-sky-200 rounded-2xl flex items-center justify-between text-xs text-sky-900 shadow-xs">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-sky-600 shrink-0" />
              <div>
                <span className="font-bold">Đơn hàng trực tuyến:</span>
                <span className="text-sky-700 block text-[10.5px]">Chỉ được xem, không thể sửa/xóa món trong đơn.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsVatModalOpen(true)}
              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer shadow-xs"
            >
              Hóa đơn VAT
            </button>
          </div>
        )}

        {isLoading && !isOffline && orderItems.length === 0 ? (
          <div className="p-3 space-y-2.5 animate-pulse">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="bg-white rounded-2xl border border-slate-200/80 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="h-4 bg-slate-200 rounded w-3/5" />
                  <div className="h-4 bg-slate-200 rounded w-16" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="h-3 bg-slate-100 rounded w-24" />
                  <div className="h-5 bg-slate-100 rounded-full w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* 1. SENT ITEMS (Món đã gửi bếp - Full Width Edge-to-Edge with Zebra Striping) */}
            {orderItems.length > 0 && (
              <div className="w-full bg-white border-y border-slate-200/90 divide-y divide-slate-100 shadow-2xs">
                {orderItems.map((item: any, idx: number) => {
                  const isEven = idx % 2 === 0;
                  const isRedeemedItem = Boolean(
                    item.isPointRedemption === true ||
                      item.pricingMode === 'POINT_REDEMPTION' ||
                      (item.priceAtSale === 0 &&
                        (item.discountReason?.includes('đổi điểm') ||
                          item.discountReason?.includes('Đổi điểm') ||
                          item.note?.includes('ĐỔI ĐIỂM') ||
                          item.orderedByName?.includes('Đổi điểm'))),
                  );
                  const itemTotal = isRedeemedItem ? 0 : item.priceAtSale * item.quantity;
                  const itemTime = formatTime(item.createdAt || order?.createdAt);

                  const sentCount = item.sentQuantity ?? (item.kitchenStatus === 'SENT' ? item.quantity : 0);
                  const printedCount = item.printedQuantity ?? sentCount;
                  const effectivePrinted = Math.max(sentCount, printedCount);

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
                        if (isOrderLocked) {
                          toast.error('Đơn hàng đang chờ thanh toán hoặc đã khóa, không thể sửa món!');
                          return;
                        }
                        setEditingItem({ item, isSent: true });
                      }}
                      className={`w-full px-4 py-2.5 transition-colors cursor-pointer group space-y-1.5 ${
                        isEven ? 'bg-white hover:bg-slate-100/60' : 'bg-slate-50/70 hover:bg-slate-100/80'
                      }`}
                      title={isOnline ? 'Đơn hàng Online (chỉ xem)' : isOrderLocked ? 'Đơn hàng đang khóa (chỉ xem)' : 'Chạm để xem hoặc chỉnh sửa món'}
                    >
                      {/* Dòng 1: Tên món đầy đủ & Tổng tiền căn phải */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-[13px] text-slate-900 leading-snug break-words group-hover:text-[#DA251D] transition-colors">
                              {item.product?.name || item.productName || 'Món'}
                            </h3>
                            {isRedeemedItem && (
                              <span className="text-[9.5px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black shrink-0 tracking-wide">
                                ĐỔI ĐIỂM
                              </span>
                            )}
                            {item.pricingMode === 'BUFFET_TICKET' && (
                              <span className="text-[9.5px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-md font-black shrink-0 tracking-wide">
                                VÉ BUFFET
                              </span>
                            )}
                            {item.pricingMode === 'BUFFET_INCLUDED' && (
                              <span className="text-[9.5px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-md font-black shrink-0 tracking-wide">
                                BUFFET
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`font-black text-[13.5px] font-mono tabular-nums ${isRedeemedItem ? 'text-amber-600' : 'text-slate-900'}`}>
                            {isRedeemedItem ? '0 đ' : `${itemTotal.toLocaleString('vi-VN')} đ`}
                          </span>
                        </div>
                      </div>

                      {/* Dòng 2: Số lượng, Đơn giá & Trạng thái Bếp / In */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-slate-200/70 font-mono font-bold text-slate-800 text-[11px]">
                            {item.quantity}x
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            {isRedeemedItem ? '0 đ' : `${item.priceAtSale.toLocaleString('vi-VN')} đ`}
                          </span>
                          {item.discountAmount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 text-[10px] font-bold">
                              <Tag size={10} />
                              <span>-{item.discountAmount.toLocaleString('vi-VN')} đ</span>
                            </span>
                          )}
                        </div>

                        {/* Trạng thái Bếp/Máy in */}
                        <div className="shrink-0">
                          {item.kitchenStatus === 'READY' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span>Sẵn sàng</span>
                            </span>
                          ) : item.kitchenStatus === 'PREPARING' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold">
                              <Flame size={11} className="text-orange-600" />
                              <span>Đang làm</span>
                            </span>
                          ) : (effectivePrinted >= item.quantity || item.kitchenStatus === 'SENT') ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <CheckCircle2 size={11} className="text-emerald-600" />
                              <span>Đã in {item.quantity}/{item.quantity}</span>
                            </span>
                          ) : effectivePrinted > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                              <Clock size={11} className="text-amber-600" />
                              <span>Đã in {effectivePrinted}/{item.quantity}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                              <Clock size={11} className="text-slate-500" />
                              <span>Chờ in 0/{item.quantity}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dòng 3 (nếu có): Option, Ghi chú & Nguồn món - Căn toàn bộ bên TRÁI */}
                      {(item.optionsTextSnapshot || item.note || item.source || itemTime) && (
                        <div className="pt-0.5 flex flex-col gap-1 text-[10.5px]">
                          {(item.optionsTextSnapshot || item.note) && (
                            <div className="flex items-center gap-1.5 flex-wrap justify-start text-left">
                              {item.optionsTextSnapshot && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                  {item.optionsTextSnapshot}
                                </span>
                              )}
                              {item.note && (
                                <span className="italic text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                                  Ghi chú: {item.note}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-400 font-medium flex-wrap justify-start text-left">
                            {item.source && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                item.source === 'WAITER' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                item.source === 'POS' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {item.source === 'WAITER' ? 'Phục vụ' : item.source === 'POS' ? 'Thu ngân' : 'QR'}
                              </span>
                            )}
                            <span>{itemTime || 'Vừa xong'}</span>
                            {staffNameDisplay && <span>• {staffNameDisplay}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. PREMIUM DIVIDER CHO MÓN MỚI */}
            {unsentItems.length > 0 && (
              <div ref={unsentSectionRef} className="w-full pt-3 pb-1 px-4">
                <div className="flex items-center justify-between px-3.5 py-1.5 bg-gradient-to-r from-rose-50 via-red-50 to-rose-50 border border-rose-200/90 rounded-xl shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#DA251D]"></span>
                    </span>
                    <span className="text-xs font-black text-[#DA251D] uppercase tracking-wide">
                      Món mới chờ gửi ({unsentItems.reduce((s, i) => s + i.quantity, 0)})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 bg-white/90 px-2 py-0.5 rounded-full border border-rose-200">
                    Chưa báo bếp
                  </span>
                </div>
              </div>
            )}

            {/* 3. UNSENT ITEMS (Món mới chờ gửi - Full Width Edge-to-Edge with Ruby Left Border & Zebra Striping) */}
            {unsentItems.length > 0 && (
              <div className="w-full bg-white border-y border-rose-200/90 divide-y divide-rose-100 shadow-2xs">
                {unsentItems.map((item: UnsentItem, idx: number) => {
                  const isEven = idx % 2 === 0;
                  const itemTotal = item.priceAtSale * item.quantity;

                  return (
                    <div 
                      key={item.localId} 
                      onClick={() => {
                        if (isOrderLocked) {
                          toast.error('Đơn hàng đang chờ thanh toán hoặc đã khóa, không thể sửa món!');
                          return;
                        }
                        setEditingItem({ item, isSent: false });
                      }}
                      className={`w-full px-4 py-2.5 border-l-4 border-l-[#DA251D] transition-colors cursor-pointer group space-y-1.5 ${
                        isEven ? 'bg-white hover:bg-rose-50/40' : 'bg-rose-50/30 hover:bg-rose-50/50'
                      }`}
                      title={isOrderLocked ? 'Đơn hàng đang khóa (chỉ xem)' : 'Chạm để chỉnh sửa ghi chú / tùy chọn món'}
                    >
                      {/* Dòng 1: Tên món + Badge MỚI + Tổng tiền đỏ */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-[13px] text-slate-900 leading-snug break-words group-hover:text-[#DA251D] transition-colors">
                              {item.productName}
                            </h3>
                            <span className="bg-[#DA251D] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-2xs">
                              MỚI
                            </span>
                            {item.discountAmount && item.discountAmount > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-[#DA251D] text-[10px] font-bold">
                                <Tag size={10} />
                                <span>-{(item.discountAmount).toLocaleString('vi-VN')} đ</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-black text-[13.5px] font-mono tabular-nums text-[#DA251D]">
                            {itemTotal.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      </div>

                      {/* Dòng 2: Đơn giá + Ergonomic Stepper (+ / -) */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="text-xs font-mono text-slate-500">
                          {item.priceAtSale.toLocaleString('vi-VN')} đ / phần
                        </div>

                        {/* Touch-Optimized Stepper: Hit-area chuẩn ngón tay */}
                        <div 
                          className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={isOrderLocked}
                            onClick={() => {
                              if (isOrderLocked) return;
                              if (item.quantity > 1) {
                                updateUnsentItem(cartKey, item.localId, { quantity: item.quantity - 1 });
                              } else {
                                removeUnsentItem(cartKey, item.localId);
                              }
                            }}
                            className="w-7 h-7 rounded-md bg-white active:bg-slate-200 text-slate-700 flex items-center justify-center transition-all shadow-2xs cursor-pointer hover:text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={item.quantity > 1 ? "Giảm 1" : "Xóa món"}
                          >
                            {item.quantity > 1 ? (
                              <Minus size={13} strokeWidth={2.5} />
                            ) : (
                              <Trash2 size={13} className="text-rose-500" strokeWidth={2.5} />
                            )}
                          </button>

                          <span className="w-7 text-center text-xs font-black text-slate-900 font-mono">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            disabled={isOrderLocked}
                            onClick={() => {
                              if (isOrderLocked) return;
                              updateUnsentItem(cartKey, item.localId, { quantity: item.quantity + 1 });
                            }}
                            className="w-7 h-7 rounded-md bg-[#DA251D] active:bg-[#b81d16] text-white flex items-center justify-center transition-all shadow-2xs cursor-pointer hover:bg-[#b81d16] disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Tăng 1"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>

                      {/* Dòng 3 (nếu có): Options & Ghi chú */}
                      {(item.selectedOptions?.length > 0 || item.note) && (
                        <div className="pt-0.5 flex items-center gap-1.5 flex-wrap text-[10.5px]">
                          {item.selectedOptions && item.selectedOptions.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-slate-700 font-medium">
                              {item.selectedOptions.map(o => o.nameAtSale).join(', ')}
                            </span>
                          )}
                          {item.note && (
                            <span className="italic text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                              Ghi chú: {item.note}
                            </span>
                          )}
                        </div>
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
      </PullToRefresh>

      {/* CỐ ĐỊNH BOTTOM NAV TỪ PHẦN TẠM TÍNH XUỐNG DƯỚI CÙNG THEO YÊU CẦU */}
      <footer className={`flex-shrink-0 w-full bg-white border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-3 pt-2.5 space-y-2 z-20 select-none touch-none overscroll-none ${
        isIPhone ? 'pb-[max(18px,calc(env(safe-area-inset-bottom)+10px))]' : 'pb-2'
      }`}>
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
              disabled={isOrderLocked}
              onClick={() => !isOrderLocked && setIsPointsOpen(true)}
              className="py-2 px-1 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 text-amber-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Coins size={15} className="text-amber-600 shrink-0" />
              <span>Đổi điểm</span>
            </button>

            <button
              type="button"
              disabled={isOrderLocked}
              onClick={() => !isOrderLocked && setIsTaxFeeOpen(true)}
              className="py-2 px-1 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 text-[#DA251D] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Receipt size={15} className="text-[#DA251D] shrink-0" />
              <span>Thuế & Phí</span>
            </button>

            <button
              type="button"
              disabled={isOrderLocked}
              onClick={() => !isOrderLocked && setIsOrderOptionsOpen(true)}
              className="py-2 px-1 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SlidersHorizontal size={15} className="text-slate-600 shrink-0" />
              <span>Tùy chọn</span>
            </button>
          </div>
        )}

        {/* Status Banner for PAYMENT_REQUESTED (chờ thu ngân POS) */}
        {order?.paymentStatus === 'PAYMENT_REQUESTED' ? (
          <div className="py-2 px-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 font-bold shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">Đang chờ thu ngân POS xử lý thanh toán</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              {canCollectPayment && (
                <button
                  type="button"
                  disabled={isOrderEmpty}
                  onClick={() => {
                    if (isOffline) {
                      toast.error('Giao dịch thanh toán bắt buộc phải có kết nối máy chủ để tránh sai lệch tài chính.', {
                        icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
                        duration: 4500,
                      });
                      return;
                    }
                    if (isOrderEmpty) {
                      toast.error('Đơn hàng chưa có món ăn nào để thanh toán!');
                      return;
                    }
                    setIsPaymentOpen(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-2xs transition-all ${
                    isOrderEmpty 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                  }`}
                >
                  Thanh toán ngay
                </button>
              )}
              {canCollectPayment && (
                <button
                  type="button"
                  disabled={isRequestingPayment}
                  onClick={handleTogglePaymentRequest}
                  className="text-[11px] underline text-amber-800 hover:text-amber-950 font-bold cursor-pointer"
                >
                  Hủy yêu cầu
                </button>
              )}
            </div>
          </div>
        ) : null}

        <div className="w-full">
          {isOnline ? (
            /* ĐỐI VỚI ĐƠN HÀNG ONLINE: CHỈ XEM, KHÔNG ĐƯỢC SỬA/XÓA MÓN, CHO PHÉP XUẤT HÓA ĐƠN VAT */
            <button
              type="button"
              onClick={() => setIsVatModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Receipt size={16} strokeWidth={2.2} />
              <span>{order?.isInvoiceRequested ? 'Cập nhật thông tin HĐ VAT' : 'Thêm thông tin xuất hóa đơn VAT'}</span>
            </button>
          ) : canCollectPayment ? (
            /* USER CÓ QUYỀN THANH TOÁN: ĐÚNG 3 NÚT CHÍNH (Thêm | Lưu | Thanh toán) - Chữ "Thanh toán" hiển thị 1 dòng duy nhất */
            <div className="flex items-center gap-2">
              {/* 1. NÚT THÊM */}
              <button
                type="button"
                onClick={handleAddItems}
                disabled={!canAddItems}
                className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl font-bold text-xs sm:text-[13px] shadow-2xs flex items-center justify-center gap-1.5 transition-all select-none whitespace-nowrap cursor-pointer ${
                  canAddItems 
                    ? 'bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title="Mở thực đơn chọn thêm món"
              >
                <Plus size={15} strokeWidth={2.5} className="shrink-0" />
                <span className="whitespace-nowrap">Thêm</span>
              </button>

              {/* 2. NÚT LƯU */}
              <button
                type="button"
                disabled={isSavingKitchen}
                onClick={handleSaveKitchen}
                className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl font-bold text-xs sm:text-[13px] shadow-2xs flex items-center justify-center gap-1.5 transition-all select-none whitespace-nowrap disabled:opacity-50 cursor-pointer ${
                  unsentItems.length > 0
                    ? 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 active:scale-95 border border-slate-300 text-slate-700'
                }`}
                title={unsentItems.length > 0 ? `Lưu & báo bếp ${unsentItems.reduce((s, i) => s + i.quantity, 0)} món mới` : 'Lưu đơn hàng'}
              >
                {isSavingKitchen ? (
                  <Loader2 size={15} className="animate-spin text-inherit shrink-0" />
                ) : unsentItems.length > 0 ? (
                  <ChefHat size={15} className="text-white shrink-0" />
                ) : (
                  <Save size={15} className="text-slate-600 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {isSavingKitchen 
                    ? 'Đang lưu...' 
                    : unsentItems.length > 0 
                    ? `Lưu (${unsentItems.reduce((s, i) => s + i.quantity, 0)})` 
                    : 'Lưu'}
                </span>
              </button>

              {/* 3. NÚT THANH TOÁN (Bắt buộc chữ "Thanh toán" hiển thị 1 dòng duy nhất, không xuống dòng, chặn đơn trống) */}
              <button
                type="button"
                onClick={() => {
                  if (isOffline) {
                    toast.error('Giao dịch thanh toán bắt buộc phải có kết nối máy chủ để tránh sai lệch tài chính.', {
                      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
                      duration: 4500,
                    });
                    return;
                  }
                  if (isOrderEmpty) {
                    toast.error('Đơn hàng chưa có món ăn nào để thanh toán!');
                    return;
                  }
                  setIsPaymentOpen(true);
                }}
                disabled={isProcessingPayment || isOrderEmpty}
                className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl font-bold text-xs sm:text-[13px] shadow-2xs flex items-center justify-center gap-1.5 transition-all select-none whitespace-nowrap ${
                  isOrderEmpty
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xs cursor-pointer'
                }`}
                title={isOrderEmpty ? 'Đơn hàng chưa có món ăn nào' : 'Mở cổng thanh toán'}
              >
                <CreditCard size={15} className="shrink-0" />
                <span className="whitespace-nowrap inline-block tracking-tight">Thanh toán</span>
              </button>
            </div>
          ) : (
            /* USER KHÔNG CÓ QUYỀN THANH TOÁN: 3 NÚT (Thêm | Lưu | Yêu cầu thanh toán HOẶC Hoãn thanh toán) */
            <div className="grid grid-cols-12 gap-1.5">
              {/* 1. NÚT THÊM */}
              <button
                type="button"
                onClick={handleAddItems}
                disabled={!canAddItems}
                className={`col-span-3 py-2.5 px-2 rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-1 transition-all select-none whitespace-nowrap cursor-pointer ${
                  canAddItems 
                    ? 'bg-[#DA251D] hover:bg-[#b81d16] active:scale-95 text-white' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
                title="Mở thực đơn chọn thêm món"
              >
                <Plus size={15} strokeWidth={2.5} className="shrink-0" />
                <span className="whitespace-nowrap">Thêm</span>
              </button>

              {/* 2. NÚT LƯU */}
              <button
                type="button"
                disabled={isSavingKitchen}
                onClick={handleSaveKitchen}
                className={`col-span-3 py-2.5 px-2 rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-1 transition-all select-none whitespace-nowrap disabled:opacity-50 cursor-pointer ${
                  unsentItems.length > 0
                    ? 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 active:scale-95 border border-slate-300 text-slate-700'
                }`}
                title={unsentItems.length > 0 ? `Lưu & báo bếp ${unsentItems.reduce((s, i) => s + i.quantity, 0)} món mới` : 'Lưu đơn hàng'}
              >
                {isSavingKitchen ? (
                  <Loader2 size={15} className="animate-spin text-inherit shrink-0" />
                ) : unsentItems.length > 0 ? (
                  <ChefHat size={15} className="text-white shrink-0" />
                ) : (
                  <Save size={15} className="text-slate-600 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {isSavingKitchen 
                    ? 'Lưu...' 
                    : unsentItems.length > 0 
                    ? `Lưu (${unsentItems.reduce((s, i) => s + i.quantity, 0)})` 
                    : 'Lưu'}
                </span>
              </button>

              {/* 3. NÚT YÊU CẦU THANH TOÁN / HOÃN THANH TOÁN (GỘP THÀNH 1 NÚT THÔNG MINH, HIỂN THỊ ĐẦY ĐỦ 1 DÒNG CHỮ) */}
              {(() => {
                const isPaymentWaiting =
                  order?.paymentStatus === 'PAYMENT_REQUESTED' ||
                  order?.status === 'HELD' ||
                  order?.paymentStatus === 'AWAITING_PAYMENT';
                return (
                  <button
                    type="button"
                    disabled={isRequestingPayment || !canRequestPayment}
                    onClick={handleTogglePaymentRequest}
                    className={`col-span-6 py-2.5 px-2 rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-all select-none whitespace-nowrap cursor-pointer ${
                      !canRequestPayment
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : isPaymentWaiting
                        ? 'bg-slate-800 hover:bg-slate-900 active:scale-95 text-white shadow-xs'
                        : 'bg-amber-50 hover:bg-amber-100 active:scale-95 border border-amber-300 text-amber-800'
                    }`}
                    title={isPaymentWaiting ? 'Hoãn thanh toán / Hủy yêu cầu thanh toán' : 'Gửi yêu cầu thanh toán tới quầy thu ngân'}
                  >
                    {isRequestingPayment ? (
                      <Loader2 size={15} className="animate-spin text-inherit shrink-0" />
                    ) : isPaymentWaiting ? (
                      <PauseCircle size={15} className="text-white shrink-0" />
                    ) : (
                      <Bell size={15} className="text-amber-700 shrink-0" />
                    )}
                    <span className="whitespace-nowrap">
                      {isPaymentWaiting ? 'Hoãn thanh toán' : 'Yêu cầu thanh toán'}
                    </span>
                  </button>
                );
              })()}
            </div>
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
        onPrintTempBill={canPrintTempBill ? handlePrintTempBill : undefined}
        isPrintingTempBill={isPrintingTempBill}
        onSendKitchen={handleSaveKitchen}
        isSendingKitchen={isSavingKitchen}
        onTogglePaymentRequest={canRequestPayment || canCollectPayment ? handleTogglePaymentRequest : undefined}
        isPaymentRequested={order?.paymentStatus === 'PAYMENT_REQUESTED' || order?.status === 'HELD'}
        isRequestingPayment={isRequestingPayment}
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
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          style={{ zIndex: guestModalZIndex }}
        >
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

      {isPaymentOpen && (
        <PaymentModal
          fullscreen={true}
          vatPriceMode={(order as any)?.vatPriceModeSnapshot || 'VAT_INCLUDED'}
          order={order ? { ...order, totalAmount: finalTotal } : null}
          branch={currentBranch}
          table={table}
          cartItems={cartItemsForPayment}
          guestCount={order?.guestCount || table?.activeSession?.guestCount || 1}
          orderDiscount={
            discountAmount > 0
              ? {
                  discountAmount,
                  discountReason: order?.discountReason || 'Chiết khấu đơn',
                }
              : null
          }
          orderType={
            selectedTableId
              ? 'DINE_IN'
              : order?.orderType || 'TAKEAWAY'
          }
          initialMember={
            order?.user
              ? {
                  id: order.user.id,
                  fullName: order.user.fullName || '',
                  phone: order.user.phone || null,
                  email: order.user.email || null,
                  memberCode: order.user.memberCode || null,
                  points: order.user.points || 0,
                  currentPoints: order.user.points || 0,
                  totalSpending: order.user.totalSpending || 0,
                  companyName: order.user.companyName,
                  taxCode: order.user.taxCode,
                  taxAddress: order.user.taxAddress,
                  invoiceEmail: order.user.invoiceEmail,
                  membershipTier: order.user.membershipTier,
                }
              : null
          }
          customerName={order?.customerName}
          customerPhone={order?.customerPhone}
          onClose={() => setIsPaymentOpen(false)}
          onCustomerUpdated={() => mutate()}
          onPaymentSuccess={async (data: any) => {
            await mutate();
            await showPaymentSuccessForOrder(data);
          }}
          onProcessPayment={handleProcessPayment}
          isProcessing={isProcessingPayment}
          onPrintTempBill={canPrintTempBill ? handlePrintTempBill : undefined}
          onMoveToAwaiting={handleHoldOrder}
          receiptPrinterName={(currentBranch as any)?.defaultReceiptPrinterId || 'Xprinter XP-350B'}
          paperSize={((currentBranch as any)?.defaultPaperSize || '80mm') as any}
        />
      )}

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
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          style={{ zIndex: exitConfirmZIndex }}
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

      {/* RESPONSIVE BOTTOM SHEET: CẬP NHẬT THÔNG TIN XUẤT HÓA ĐƠN VAT */}
      <ResponsiveModal
        isOpen={isVatModalOpen}
        onClose={() => setIsVatModalOpen(false)}
        title="Thông tin xuất hóa đơn VAT"
        subtitle={`Đơn hàng: #${order?.orderCode || order?.temporaryOrderCode || 'Đơn hàng'}`}
        maxWidth="md"
        footer={
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={() => setIsVatModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isSavingVat}
              onClick={handleSaveVat}
              className="flex-1 py-2.5 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSavingVat ? <Loader2 size={16} className="animate-spin" /> : 'Lưu thông tin VAT'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mã số thuế doanh nghiệp</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vatTaxCode}
                onChange={(e) => setVatTaxCode(e.target.value)}
                placeholder="VD: 0101234567"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#DA251D]"
              />
              <button
                type="button"
                disabled={isLookingUpTax || !vatTaxCode.trim()}
                onClick={handleLookupTax}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center shrink-0 min-w-[36px]"
                title="Tra cứu mã số thuế"
              >
                {isLookingUpTax ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
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
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#DA251D]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ doanh nghiệp</label>
            <textarea
              rows={3}
              value={vatAddress}
              onChange={(e) => setVatAddress(e.target.value)}
              placeholder="Số nhà, đường, phường, quận/huyện..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#DA251D] resize-y leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email nhận hóa đơn điện tử</label>
            <input
              type="email"
              value={vatEmail}
              onChange={(e) => setVatEmail(e.target.value)}
              placeholder="ketoan@company.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#DA251D]"
            />
          </div>
        </div>
      </ResponsiveModal>

      {/* MODAL THANH TOÁN THÀNH CÔNG */}
      {paymentSuccessData && (() => {
        const isAutoConfirmed = isAutoConfirmedGatewayMethod(
          paymentSuccessData.paymentMethod,
          paymentSuccessData.transactionCode,
        );
        const paymentMethodLabel = getPaymentMethodLabel(paymentSuccessData.paymentMethod);

        return (
        <div
          className="fixed inset-0 bg-white flex flex-col justify-between items-center px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[max(24px,calc(env(safe-area-inset-bottom)+16px))] animate-in fade-in zoom-in-95 duration-200 select-none overflow-y-auto"
          style={{ zIndex: paymentSuccessZIndex }}
        >
          {/* Top Status Pill */}
          <div className="w-full flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                isAutoConfirmed
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isAutoConfirmed
                  ? 'Hệ thống đã xác nhận nhận được tiền'
                  : 'Thu ngân đã xác nhận thu tiền'}
              </span>
            </span>
          </div>

          {/* Centered Graphic + Order Summary */}
          <div className="flex flex-col items-center text-center max-w-sm w-full mx-auto my-4">
            {/* Green Circle with Checkmark */}
            <div className="w-22 h-22 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] animate-in zoom-in-75 duration-300">
              <Check className="w-11 h-11 stroke-[3.5]" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-black text-slate-900 mt-5 tracking-tight">
              Thanh toán thành công!
            </h2>
            <p className="text-xs font-semibold text-emerald-700 mt-1">
              {isAutoConfirmed
                ? 'Đã nhận thanh toán thực tế từ hệ thống'
                : 'Đã thanh toán hoàn tất'}
            </p>

            {/* Detailed Order Receipt Card */}
            <div className="w-full mt-5 bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-left space-y-2.5 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Trạng thái</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                  Đã thanh toán
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold">Phương thức</span>
                <span className="font-bold text-slate-900">
                  {paymentMethodLabel}
                </span>
              </div>

              {paymentSuccessData.tableName && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Bàn</span>
                  <span className="font-black text-slate-900 text-sm">
                    {paymentSuccessData.tableName}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-semibold">Mã đơn chính</span>
                <span className="font-mono font-black text-slate-900">
                  {paymentSuccessData.orderCode}
                </span>
              </div>

              {paymentSuccessData.temporaryOrderCode &&
                paymentSuccessData.temporaryOrderCode !== paymentSuccessData.orderCode && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Mã tạm</span>
                    <span className="font-mono font-bold text-slate-600">
                      {paymentSuccessData.temporaryOrderCode}
                    </span>
                  </div>
                )}

              {typeof paymentSuccessData.amount === 'number' && paymentSuccessData.amount > 0 && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-bold">Số tiền đã nhận</span>
                  <span className="font-mono font-black text-emerald-600 text-base">
                    {paymentSuccessData.amount.toLocaleString('vi-VN')} đ
                  </span>
                </div>
              )}

              {paymentSuccessData.paidAt && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Thời gian xác nhận</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {formatTime(paymentSuccessData.paidAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="w-full max-w-sm space-y-3">
            {/* 1. Primary: In hóa đơn (Gửi máy POS) */}
            <button
              type="button"
              disabled={isPrintingReceipt}
              onClick={handlePrintReceiptFromSuccess}
              className="w-full h-13 rounded-2xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-red-500/25 transition-all cursor-pointer"
            >
              {isPrintingReceipt ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              <span>In hóa đơn (Gửi máy POS)</span>
            </button>

            {/* 2. Secondary: Về sơ đồ bàn */}
            <button
              type="button"
              onClick={handleExitToTables}
              className="w-full h-13 rounded-2xl bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 text-slate-800 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer"
            >
              <Home className="w-5 h-5 text-slate-600" />
              <span>Về sơ đồ bàn</span>
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
