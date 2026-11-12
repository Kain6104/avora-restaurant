"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Utensils,
  Printer,
  MoreVertical,
  CreditCard,
  ChefHat,
  ArrowRightLeft,
  Split,
  Combine,
  Trash2,
  Save,
  Ban,
  Clock,
  Truck,
  Package,
  UserPlus,
  Edit3,
  Tag,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  FileText,
  Check,
  X,
  Gift,
  Percent,
  Info,
  ShoppingBag,
  Store,
  ListCollapse,
  Globe,
  Building2,
  Sparkles,
  QrCode,
  Lock,
} from 'lucide-react';
import { PosCartItem, PosTable, PosOrder } from './pos-types';
import { OrderCartItem } from './OrderCartItem';
import { isOnlineOrder } from './pos-utils';
import TaxBreakdownModal from '@/components/checkout/TaxBreakdownModal';
import toast from 'react-hot-toast';

export interface OrderCartProps {
  currentOrder: PosOrder | null;
  selectedTable: PosTable | null;
  cartItems: PosCartItem[];
  guestCount: number;
  onUpdateGuestCount: (count: number) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onUpdateNote: (id: string, note: string) => void;
  onClearCart: () => void;
  onSaveOrder: () => void;
  isSavingOrder?: boolean;
  onSendToKitchen: () => void;
  onHoldOrder?: () => void;
  onOpenPaymentModal: () => void;
  onOpenPrintBill: () => void;
  onOpenSplitModal: () => void;
  onOpenMergeModal: () => void;
  onOpenMoveTableModal: () => void;
  onOpenCancelModal: () => void;
  onSelectTableTab: () => void;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  onToggleOrderType: () => void;
  onSelectOrderType?: (type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => void;
  deliveryAddress?: string;
  onOpenDeliveryAddressModal?: () => void;
  orderDiscountAmount?: number;
  orderDiscountReason?: string;
  onOpenOrderDiscountModal?: () => void;
  onOpenItemDiscountModal?: (item: PosCartItem) => void;
  onOpenKeypad?: (item: PosCartItem) => void;
  onOpenItemDetail?: (item: PosCartItem) => void;
  customerName?: string;
  customerPhone?: string;
  selectedMember?: any;
  onOpenCustomerModal?: () => void;
  onOpenEditVatModal?: (customer: any) => void;
  onOpenOrderFeesModal?: () => void;
  onRemoveCustomer?: () => void;
  isSendingKitchen?: boolean;
  orderNote?: string;
  onUpdateOrderNote?: (note: string) => void;
  onOpenSettingsDrawer?: () => void;
  onExitOrder?: () => void;
  currentUser?: any;
  className?: string;
  isMenuCompactMode?: boolean;
  onToggleMenuCompact?: () => void;
  onOpenReprintLabels?: () => void;
  onResendKitchen?: () => void;
  vatPriceMode?: 'VAT_INCLUDED' | 'VAT_EXCLUDED' | string;
  onOpenBuffetModal?: () => void;
  onOpenQrManagement?: () => void;
  onOpenRedeemPointsModal?: () => void;
  redeemableRewardsCount?: number;
  isDarkMode?: boolean;
}

export const OrderCart: React.FC<OrderCartProps> = ({
  currentOrder,
  selectedTable,
  cartItems,
  guestCount,
  onUpdateGuestCount,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateNote,
  onClearCart,
  onSaveOrder,
  isSavingOrder = false,
  onSendToKitchen,
  onHoldOrder,
  onOpenPaymentModal,
  onOpenPrintBill,
  onOpenSplitModal,
  onOpenMergeModal,
  onOpenMoveTableModal,
  onOpenCancelModal,
  onSelectTableTab,
  orderType,
  onToggleOrderType,
  onSelectOrderType,
  deliveryAddress = '',
  onOpenDeliveryAddressModal,
  orderDiscountAmount = 0,
  orderDiscountReason = '',
  onOpenOrderDiscountModal,
  onOpenItemDiscountModal,
  onOpenKeypad,
  onOpenItemDetail,
  customerName = 'Khách tại bàn',
  customerPhone = '',
  selectedMember,
  currentUser,
  onOpenCustomerModal,
  onOpenEditVatModal,
  onOpenOrderFeesModal,
  onRemoveCustomer,
  isSendingKitchen = false,
  orderNote = '',
  onUpdateOrderNote,
  onOpenSettingsDrawer,
  onExitOrder,
  onOpenRedeemPointsModal,
  redeemableRewardsCount = 0,
  className = '',
  isMenuCompactMode = false,
  onToggleMenuCompact,
  onOpenReprintLabels,
  onResendKitchen,
  vatPriceMode = 'VAT_EXCLUDED',
  onOpenBuffetModal,
  onOpenQrManagement,
  isDarkMode = false,
}) => {
  const isOnline = isOnlineOrder(currentOrder);
  const isAwaitingPayment =
    currentOrder?.paymentStatus === 'AWAITING_PAYMENT' ||
    currentOrder?.paymentStatus === 'PAYMENT_REQUESTED' ||
    (currentOrder as any)?.paymentIntentStatus === 'ACTIVE';
  // Chỉ khóa khi thực sự đã phát hành mã thanh toán chuyển khoản / đang chờ thanh toán / đã khóa tài chính
  const isCodeAlreadyCreated = Boolean(
    isAwaitingPayment ||
    (currentOrder as any)?.paymentLockedAt ||
    currentOrder?.paymentStatus === 'PAID' ||
    currentOrder?.status === 'COMPLETED'
  );
  const isCartLocked = isOnline || isAwaitingPayment;
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isOrderTypeMenuOpen, setIsOrderTypeMenuOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isEditingOrderNote, setIsEditingOrderNote] = useState(!!orderNote);
  const [tempOrderNote, setTempOrderNote] = useState(orderNote || currentOrder?.note || '');
  const [showBreakdownPopover, setShowBreakdownPopover] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const cartItemsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-open order note editor if a note exists for the order
  useEffect(() => {
    if (orderNote) {
      setIsEditingOrderNote(true);
    }
  }, [orderNote]);

  const scrollCart = (offset: number) => {
    if (cartItemsContainerRef.current) {
      cartItemsContainerRef.current.scrollBy({ top: offset, behavior: 'smooth' });
    }
  };

  // Calculate item discounts total
  const itemDiscountsTotal = Math.round(
    cartItems.reduce((sum, it) => sum + (it.discountAmount || 0) * it.quantity, 0),
  );

  // Compute Subtotal (base pricing of items)
  const baseSubTotal = Math.round(
    cartItems.reduce((sum, it) => sum + it.priceAtSale * it.quantity, 0),
  );

  // Total item quantity (rounded cleanly for Kg decimal weights)
  const totalItemCount =
    Math.round(cartItems.reduce((acc, it) => acc + it.quantity, 0) * 1000) / 1000;

  // Effective Order Discount
  const effectiveOrderDiscount = orderDiscountAmount || currentOrder?.discountAmount || 0;
  const effectiveDiscountReason = orderDiscountReason || currentOrder?.discountReason || '';

  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);

  // Surcharges & Taxes (Rule #8, #17)
  const serviceChargeTotal = currentOrder?.serviceChargeTotal || 0;
  const activeVatPriceMode = (currentOrder as any)?.vatPriceModeSnapshot || vatPriceMode || 'VAT_EXCLUDED';
  const isVatIncluded = activeVatPriceMode === 'VAT_INCLUDED';

  // Dynamic Tax Calculation & Breakdown directly from cartItems (includes unsaved items)
  const { computedTaxAmount, taxBreakdown } = React.useMemo(() => {
    if (!cartItems || cartItems.length === 0) {
      return { computedTaxAmount: 0, taxBreakdown: [] };
    }

    const map = new Map<number, { rate: number; taxableAmount: number; taxAmount: number; items: any[] }>();
    let totalTax = 0;

    cartItems.forEach((it) => {
      // 1. Get correct tax percentage (respect 0% if explicitly set, fallback to product or 8)
      const rawRate =
        (it as any).taxPercentageAtSale !== undefined && (it as any).taxPercentageAtSale !== null
          ? (it as any).taxPercentageAtSale
          : (it.product?.taxPercentage !== undefined && it.product.taxPercentage !== null)
            ? it.product.taxPercentage
            : ((it as any).taxRate !== undefined && (it as any).taxRate !== null)
              ? (it as any).taxRate
              : 8;
      const rate = Number(rawRate);

      // 2. Net taxable amount of this item line
      const itemNet = Math.max(0, (it.priceAtSale - (it.discountAmount || 0)) * it.quantity);
      // Allocate order discount proportionally
      const allocatedDiscount = baseSubTotal > 0 ? Math.round((itemNet / baseSubTotal) * effectiveOrderDiscount) : 0;
      const netTaxable = Math.max(0, itemNet - allocatedDiscount);

      let itemTax = 0;
      let baseVal = netTaxable;

      if (rate > 0 && netTaxable > 0) {
        if (isVatIncluded) {
          itemTax = Math.round((netTaxable * rate) / (100 + rate));
          baseVal = netTaxable - itemTax;
        } else {
          itemTax = Math.round((netTaxable * rate) / 100);
          baseVal = netTaxable;
        }
      }

      totalTax += itemTax;

      if (!map.has(rate)) {
        map.set(rate, { rate, taxableAmount: 0, taxAmount: 0, items: [] });
      }
      const g = map.get(rate)!;
      g.taxableAmount += baseVal;
      g.taxAmount += itemTax;
      g.items.push({
        name: it.product?.name || 'Món',
        quantity: it.quantity,
        taxableAmount: baseVal,
        taxAmount: itemTax,
      });
    });

    // Check taxable service charges from currentOrder (if any)
    if (currentOrder?.serviceCharges && Array.isArray(currentOrder.serviceCharges)) {
      currentOrder.serviceCharges.forEach((sc) => {
        if (sc.isTaxable && sc.amount > 0) {
          const scRate = Number(sc.taxPercentage ?? 10);
          let scTax = 0;
          let scBase = sc.amount;
          if (scRate > 0) {
            if (isVatIncluded) {
              scTax = Math.round((sc.amount * scRate) / (100 + scRate));
              scBase = sc.amount - scTax;
            } else {
              scTax = Math.round((sc.amount * scRate) / 100);
              scBase = sc.amount;
            }
          }
          totalTax += scTax;
          if (!map.has(scRate)) {
            map.set(scRate, { rate: scRate, taxableAmount: 0, taxAmount: 0, items: [] });
          }
          const g = map.get(scRate)!;
          g.taxableAmount += scBase;
          g.taxAmount += scTax;
          g.items.push({
            name: sc.name || 'Phụ thu dịch vụ',
            quantity: 1,
            taxableAmount: scBase,
            taxAmount: scTax,
          });
        }
      });
    }

    const breakdownList = Array.from(map.values()).sort((a, b) => a.rate - b.rate);
    return { computedTaxAmount: totalTax, taxBreakdown: breakdownList };
  }, [cartItems, baseSubTotal, effectiveOrderDiscount, isVatIncluded, currentOrder?.serviceCharges]);

  // Grand Total: accurate dynamic calculation
  const totalDiscounts = itemDiscountsTotal + effectiveOrderDiscount;
  const grandTotal = isVatIncluded
    ? Math.max(0, baseSubTotal - totalDiscounts + serviceChargeTotal)
    : Math.max(0, baseSubTotal - totalDiscounts + serviceChargeTotal + computedTaxAmount);

  // Count items not yet sent to kitchen (including newly added quantity to existing items)
  const unsentKitchenItemsCount =
    Math.round(
      cartItems.reduce((sum, it) => {
        if (!it.kitchenStatus || it.kitchenStatus === 'PENDING') {
          return sum + it.quantity;
        }
        if (it.sentQuantity !== undefined && it.quantity > it.sentQuantity) {
          return sum + (it.quantity - it.sentQuantity);
        }
        return sum;
      }, 0) * 1000,
    ) / 1000;

  const hasUnsentKitchenItems = unsentKitchenItemsCount > 0;

  const handleSaveOrderNote = () => {
    if (onUpdateOrderNote) {
      onUpdateOrderNote(tempOrderNote.trim());
    }
    setIsEditingOrderNote(false);
  };

  // Display Table / Order code (Mặc định Mang đi hoặc Giao hàng theo yêu cầu)
  const defaultNonTableName = isOnline
    ? 'Đơn Online'
    : orderType === 'DELIVERY'
    ? 'Giao hàng'
    : orderType === 'TAKEAWAY'
    ? 'Mang đi'
    : 'Tại bàn';

  const displayCode = currentOrder?.orderCode || currentOrder?.temporaryOrderCode;
  const orderTitle = selectedTable
    ? selectedTable.name
    : isOnline
    ? `Đơn Online #${displayCode ? displayCode.replace(/^POS-/i, '') : (currentOrder?.id?.slice(0, 6) || '')}`
    : displayCode
    ? `${defaultNonTableName} #${displayCode.replace(/^POS-/i, '')}`
    : defaultNonTableName;

  // Partition cart items into saved (persisted in currentOrder) and unsaved (chờ lưu)
  const isItemSaved = (item: PosCartItem) => {
    if (!currentOrder?.orderItems || currentOrder.orderItems.length === 0) return false;
    return currentOrder.orderItems.some((oi) => oi.id === item.id);
  };

  const savedItems = cartItems.filter(isItemSaved);
  const unsavedItems = cartItems.filter((item) => !isItemSaved(item));

  // Has unsaved changes: new items not yet persisted, or note changed vs saved order, or quantity increased on saved items
  const savedNoteOnOrder = currentOrder?.note || '';
  const noteChanged = (orderNote || '') !== savedNoteOnOrder;
  const hasQuantityChanged = savedItems.some(
    (item) => item.savedQuantity !== undefined && item.quantity !== item.savedQuantity
  );
  const itemsCountChanged = currentOrder?.orderItems && currentOrder.orderItems.length !== cartItems.length;
  const hasUnsaved = unsavedItems.length > 0 || noteChanged || hasQuantityChanged || Boolean(itemsCountChanged);

  const handleExitWithCheck = () => {
    if (hasUnsaved && currentOrder?.id) {
      setShowExitConfirm(true);
    } else {
      const exitFn = onExitOrder || onSelectTableTab;
      exitFn?.();
    }
  };

  return (
    <aside
      className={`border-l flex flex-col justify-between h-full select-none shadow-xs shrink-0 z-20 ${
        isDarkMode
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200 text-slate-900'
      } ${
        className || 'w-[330px] sm:w-[350px] md:w-[370px] lg:w-[390px]'
      }`}
    >
      {/* 1. Header: [ Table/Order > ] | [ Order Type Dropdown ] | [ More Options ] */}
      <div className={`h-11 sm:h-12 px-2 sm:px-2.5 border-b shrink-0 flex items-center justify-between gap-1.5 relative ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Table / Order Code Trigger (opens table switcher/floor map) */}
        <button
          type="button"
          onClick={isOnline ? undefined : onSelectTableTab}
          disabled={isOnline}
          className={`flex-1 flex items-center gap-1.5 border px-2 py-1.5 rounded-lg text-xs font-black shadow-2xs transition-colors h-9 truncate min-w-0 ${
            isDarkMode
              ? isOnline ? 'cursor-default bg-slate-800/60 border-slate-700 text-slate-400' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700 cursor-pointer'
              : isOnline ? 'cursor-default bg-slate-50 border-slate-200 text-slate-800' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 cursor-pointer'
          }`}
          title={isOnline ? 'Đơn hàng trực tuyến' : 'Nhấn để đổi / xem sơ đồ bàn (F3)'}
        >
          <div className="w-5 h-5 rounded-md bg-[#da251d] text-white flex items-center justify-center shrink-0 shadow-2xs">
            {isOnline ? (
              <Globe className="w-3 h-3 text-white" />
            ) : orderType === 'DELIVERY' ? (
              <Truck className="w-3 h-3 text-white" />
            ) : orderType === 'DINE_IN' && selectedTable ? (
              <Utensils className="w-3 h-3 text-white" />
            ) : (
              <ShoppingBag className="w-3 h-3 text-white" />
            )}
          </div>
          <span className={`font-black text-xs sm:text-sm tracking-tight truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
            {orderTitle}
          </span>
          {!isOnline && <ChevronRight className={`w-4 h-4 shrink-0 ml-auto ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />}
        </button>

        {/* Order Type Dropdown (Matching Image 3) */}
        <div className="relative shrink-0">
          {isOnline ? (
            <div
              className="h-9 px-2.5 rounded-lg bg-sky-600 text-white flex items-center gap-1.5 text-xs font-bold shadow-xs select-none"
              title="Đơn đặt hàng trực tuyến"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Online</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsOrderTypeMenuOpen(!isOrderTypeMenuOpen)}
              className="h-9 px-2 sm:px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center gap-1 text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Chọn hình thức đơn hàng"
            >
              {orderType === 'DINE_IN' ? (
                <Utensils className="w-3.5 h-3.5" />
              ) : orderType === 'TAKEAWAY' ? (
                <Package className="w-3.5 h-3.5" />
              ) : (
                <Truck className="w-3.5 h-3.5" />
              )}
              <ChevronDown className="w-3 h-3 text-white/80" />
            </button>
          )}

          {isOrderTypeMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsOrderTypeMenuOpen(false)}
              />
              <div className={`absolute right-0 top-full mt-1.5 w-44 rounded-xl shadow-xl py-1 z-40 animate-in fade-in duration-100 divide-y ${
                isDarkMode ? 'bg-slate-800 border border-slate-700 divide-slate-700' : 'bg-white border border-slate-200 divide-slate-100'
              }`}>
                {/* 1. Ăn tại bàn */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderTypeMenuOpen(false);
                    if (onSelectOrderType) onSelectOrderType('DINE_IN');
                    else onToggleOrderType();
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 cursor-pointer font-bold transition-colors ${
                    orderType === 'DINE_IN'
                      ? 'bg-blue-500 text-white'
                      : isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${orderType === 'DINE_IN' ? 'text-white' : 'text-blue-500'}`}>
                    <Utensils className="w-3.5 h-3.5" />
                  </div>
                  <span>Ăn tại bàn</span>
                </button>

                {/* 2. Mang đi */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderTypeMenuOpen(false);
                    if (onSelectOrderType) onSelectOrderType('TAKEAWAY');
                    else onToggleOrderType();
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 cursor-pointer font-bold transition-colors ${
                    orderType === 'TAKEAWAY'
                      ? 'bg-blue-500 text-white'
                      : isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${orderType === 'TAKEAWAY' ? 'text-white' : 'text-rose-500'}`}>
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <span>Mang đi</span>
                </button>

                {/* 3. Giao hàng */}
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderTypeMenuOpen(false);
                    if (onSelectOrderType) onSelectOrderType('DELIVERY');
                    else onToggleOrderType();
                    onOpenDeliveryAddressModal?.();
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 cursor-pointer font-bold transition-colors ${
                    orderType === 'DELIVERY'
                      ? 'bg-blue-500 text-white'
                      : isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${orderType === 'DELIVERY' ? 'text-white' : 'text-sky-500'}`}>
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <span>Giao hàng</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quick QR Order Button */}
        {onOpenQrManagement && (
          <button
            type="button"
            onClick={onOpenQrManagement}
            className={`w-9 h-9 flex items-center justify-center active:scale-95 border rounded-lg shadow-2xs transition-all cursor-pointer shrink-0 ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white'
                : 'bg-white hover:bg-red-50 hover:border-red-200 border-slate-200 text-slate-700 hover:text-[#da251d]'
            }`}
            title="Mở QR gọi món tại bàn"
          >
            <QrCode className="w-4 h-4 text-[#da251d]" />
          </button>
        )}

        {/* More Options Button [ ⋮ ] */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`w-9 h-9 flex items-center justify-center border rounded-lg shadow-2xs transition-colors cursor-pointer ${
              isDarkMode
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Tùy chọn khác"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsMoreMenuOpen(false)}
              />
              <div className={`absolute right-0 top-full mt-1.5 w-64 border rounded-2xl shadow-xl py-1.5 z-40 animate-in fade-in duration-100 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100 divide-slate-700' : 'bg-white border-slate-200 text-slate-800 divide-slate-100'
              }`}>
                {/* Order Information Header Card: Tên đơn | Người tạo đơn | Ngày giờ tạo đơn */}
                <div className={`px-3.5 py-2.5 border-b text-xs space-y-1.5 select-none ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-700'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Tên đơn:</span>
                    <span className={`font-bold truncate max-w-[130px] ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{orderTitle}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Người tạo đơn:</span>
                    <span className="font-bold text-[#da251d] truncate max-w-[130px]">
                      {currentOrder?.cashierName || (currentOrder as any)?.user?.fullName || currentUser?.fullName || 'HTP Official'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Ngày giờ tạo:</span>
                    <span className={`font-mono text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {currentOrder?.createdAt
                        ? new Date(currentOrder.createdAt).toLocaleString('vi-VN')
                        : new Date().toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  {/* Mở QR gọi món tại bàn */}
                  {onOpenQrManagement && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenQrManagement();
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                        isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-red-50 hover:text-[#da251d]'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-[#da251d]" />
                      <span>Mở QR gọi món tại bàn</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenPrintBill();
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>{isOnline ? 'In đơn hàng Online (F2)' : 'In tạm tính (F2)'}</span>
                  </button>

                  {!isOnline && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onOpenSplitModal();
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                          isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Split className="w-4 h-4 text-blue-500" />
                        <span>Tách đơn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onOpenMergeModal();
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                          isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Combine className="w-4 h-4 text-indigo-500" />
                        <span>Gộp đơn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsMoreMenuOpen(false);
                          onOpenMoveTableModal();
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                          isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                        <span>Chuyển bàn</span>
                      </button>
                    </>
                  )}

                  <div className={`border-t my-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`} />

                  {/* In lại Tem */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenReprintLabels?.();
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Tag className="w-4 h-4 text-sky-500" />
                    <span>In lại Tem</span>
                  </button>

                  {/* Gửi lại Bếp */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onResendKitchen?.();
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 cursor-pointer font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ChefHat className="w-4 h-4 text-orange-500" />
                    <span>Gửi lại Bếp</span>
                  </button>

                  {currentOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onOpenCancelModal();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-bold cursor-pointer border-t border-slate-100"
                    >
                      <Ban className="w-4 h-4 text-rose-600" />
                      <span>Hủy đơn hàng</span>
                    </button>
                  )}

                  {cartItems.length > 0 && !currentOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        onClearCart();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-bold cursor-pointer border-t border-slate-100"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Xóa toàn bộ giỏ</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Buffet Session Banner / Quick Buffet Button */}
      {(() => {
        const activeBuffet =
          (currentOrder as any)?.buffetSessions?.find((s: any) => s.status === 'ACTIVE') ||
          (currentOrder as any)?.buffetSessions?.[0] ||
          (currentOrder as any)?.buffetSession;
        const isBuffetActive = activeBuffet && activeBuffet.status === 'ACTIVE';

        if (isBuffetActive) {
          return (
            <div className="bg-gradient-to-r from-red-50 to-orange-50/80 border-b border-red-200 px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-red-100 text-[#da251d] flex items-center justify-center shrink-0">
                  <Utensils className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-slate-900 truncate">
                      {activeBuffet.packageNameSnapshot || activeBuffet.buffetPackage?.name || 'Gói Buffet'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#da251d] text-white text-[9px] font-black uppercase shrink-0">
                      Buffet Active
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">Món con trong gói tính 0đ</p>
                </div>
              </div>
              <div className="shrink-0 pl-2">
                <span className="text-[10px] font-extrabold text-[#da251d] bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                  Ăn thả ga
                </span>
              </div>
            </div>
          );
        }

        // If not active and table order, provide quick button to apply buffet
        if (orderType === 'DINE_IN' && !isOnline && onOpenBuffetModal) {
          return (
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-xs shrink-0 select-none">
              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Khách dùng Buffet?</span>
              </span>
              <button
                type="button"
                onClick={onOpenBuffetModal}
                className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#da251d] text-[11px] font-black border border-red-200 hover:border-red-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Áp dụng Buffet</span>
              </button>
            </div>
          );
        }

        return null;
      })()}

      {/* Online Order Notice Banner */}
      {isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-amber-900 text-xs shrink-0 select-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="font-bold truncate">Đơn hàng Online</span>
            <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded font-medium shrink-0">
              Chỉ xem
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-medium shrink-0">
            Không sửa / thêm món
          </span>
        </div>
      )}

      {/* 1.3 Awaiting Payment Notice Banner (Chờ xác nhận & Giải phóng bàn) */}
      {isAwaitingPayment && (
        <div className={`border-b px-3 py-2 flex items-center justify-between text-xs shrink-0 select-none shadow-sm ${
          isDarkMode
            ? 'bg-blue-950/80 border-blue-800 text-blue-200'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-black text-xs">
                <span>CHỜ XÁC NHẬN CHUYỂN KHOẢN</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                  Khóa đơn
                </span>
              </div>
              <p className={`text-[10px] ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                Bàn đã giải phóng &bull; Không thay đổi giá trị đơn
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-amber-500">
            <Lock className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* 2. Cart Items List: Dense, Numbered, Scrollable */}
      <div
        ref={cartItemsContainerRef}
        className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1.5 divide-y divide-slate-100"
      >
        {cartItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Utensils className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-600">Bàn chưa có món nào</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Chạm vào các món trong thực đơn bên trái để gọi món
            </p>
          </div>
        ) : (
          <>
            {/* 1. Saved Items */}
            {savedItems.map((item, index) => (
              <OrderCartItem
                key={item.id}
                item={item}
                index={index}
                isCompact={isCompactMode}
                isUnsaved={false}
                isSelected={selectedItemId === item.id}
                readOnly={isCartLocked}
                isDarkMode={isDarkMode}
                onSelect={() =>
                  setSelectedItemId(selectedItemId === item.id ? null : item.id)
                }
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onUpdateNote={onUpdateNote}
                onOpenDiscount={onOpenItemDiscountModal}
                onOpenKeypad={onOpenKeypad}
                onOpenItemDetail={onOpenItemDetail}
              />
            ))}

            {/* 2. Centered Dashed Divider: ------ Chờ lưu ------ (Tương tự Waiter) */}
            {unsavedItems.length > 0 && (
              <div className="relative flex py-2 items-center justify-center my-1.5 select-none">
                <div className="flex-grow border-t border-dashed border-amber-300 dark:border-amber-700" />
                <span className="flex-shrink mx-3 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 px-3 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 shadow-2xs">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                  <span>------ Chờ lưu ------</span>
                </span>
                <div className="flex-grow border-t border-dashed border-amber-300 dark:border-amber-700" />
              </div>
            )}

            {/* 3. Unsaved Items */}
            {unsavedItems.map((item, idx) => (
              <OrderCartItem
                key={item.id}
                item={item}
                index={savedItems.length + idx}
                isCompact={isCompactMode}
                isUnsaved={true}
                isSelected={selectedItemId === item.id}
                readOnly={isCartLocked}
                isDarkMode={isDarkMode}
                onSelect={() =>
                  setSelectedItemId(selectedItemId === item.id ? null : item.id)
                }
                onUpdateQuantity={onUpdateQuantity}
                onRemoveItem={onRemoveItem}
                onUpdateNote={onUpdateNote}
                onOpenDiscount={onOpenItemDiscountModal}
                onOpenKeypad={onOpenKeypad}
                onOpenItemDetail={onOpenItemDetail}
              />
            ))}
          </>
        )}
      </div>

      {/* 3. Bottom Block: Toolbar + Total + 4 Big Touch Buttons */}
      <div className={`border-t shrink-0 flex flex-col relative ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Breakdown Popover (Image 5) */}
        {showBreakdownPopover && (
          <div className={`absolute bottom-full left-2 right-2 mb-2 p-3 border rounded-2xl shadow-xl z-40 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <div className={`flex items-center justify-between border-b pb-1.5 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
              <span className={`text-xs font-extrabold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Chi tiết thanh toán</span>
              <button
                type="button"
                onClick={() => setShowBreakdownPopover(false)}
                className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`space-y-1.5 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              <div className="flex justify-between">
                <span>Tiền hàng ({totalItemCount} món):</span>
                <span className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  {baseSubTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
              <div className="flex justify-between text-emerald-500 font-medium">
                <span>Khuyến mại:</span>
                <span className="font-bold">0đ</span>
              </div>
              <div className="flex justify-between text-amber-500 font-medium">
                <span>Chiết khấu:</span>
                <span className="font-bold">
                  {totalDiscounts > 0 ? `-${totalDiscounts.toLocaleString('vi-VN')}đ` : '0đ'}
                </span>
              </div>
              {serviceChargeTotal > 0 && (
                <div className="flex justify-between">
                  <span>Phí dịch vụ / Phụ thu:</span>
                  <span className="font-bold text-amber-500">
                    +{serviceChargeTotal.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}
              {computedTaxAmount > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <span>{isVatIncluded ? 'Thuế VAT (Đã gồm):' : 'Thuế VAT:'}</span>
                    <button
                      type="button"
                      onClick={() => setIsTaxModalOpen(true)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-slate-700 cursor-pointer"
                      title="Xem chi tiết thuế VAT"
                    >
                      <Info size={12} />
                    </button>
                  </div>
                  <span className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {isVatIncluded
                      ? `${computedTaxAmount.toLocaleString('vi-VN')}đ`
                      : `+${computedTaxAmount.toLocaleString('vi-VN')}đ`}
                  </span>
                </div>
              )}
              <div className={`border-t pt-1.5 flex justify-between font-black ${isDarkMode ? 'border-slate-700 text-slate-100' : 'border-slate-100 text-slate-900'}`}>
                <span>Tổng cộng:</span>
                <span className="text-[#da251d] text-sm">
                  {grandTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Order Note inline editor (if active) */}
        {isEditingOrderNote && (
          <div className={`p-2.5 border-b flex flex-col gap-1.5 ${
            isDarkMode ? 'bg-amber-950/40 border-amber-800' : 'bg-amber-50 border-amber-200'
          }`}>
            <span className={`text-[11px] font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-900'}`}>Ghi chú cho toàn đơn hàng:</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={tempOrderNote}
                onChange={(e) => setTempOrderNote(e.target.value)}
                placeholder="VD: Không hành lá, chuẩn bị nhanh..."
                className={`flex-1 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-amber-500 ${
                  isDarkMode
                    ? 'bg-slate-800 border border-slate-700 text-slate-100'
                    : 'bg-white border border-amber-300 text-slate-900'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveOrderNote}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 cursor-pointer"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setIsEditingOrderNote(false)}
                className={`px-2 py-1 rounded-lg text-xs cursor-pointer ${
                  isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* 3.1 5-Icon Toolstrip + In tạm tính + Scroll Controls */}
        <div className={`h-10 border-b flex items-center justify-between px-1.5 gap-1 shrink-0 relative ${
          isDarkMode ? 'bg-slate-850 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          {/* Tooltip Overlay */}
          {activeTooltip && (
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold py-0.5 px-2 rounded shadow-md pointer-events-none z-30">
              {activeTooltip}
            </div>
          )}

          {/* Button 1: Khuyến mại / Đổi điểm */}
          <button
            type="button"
            disabled={isOnline || isCodeAlreadyCreated}
            onClick={() => {
              if (isCodeAlreadyCreated) {
                toast.error('Đơn hàng đã tạo mã, giá trị đơn hàng không được phép thay đổi!');
                return;
              }
              onOpenRedeemPointsModal?.();
            }}
            onMouseEnter={() => setActiveTooltip(isCodeAlreadyCreated ? 'Đơn đã tạo mã (Khóa đổi điểm)' : 'Đổi điểm thưởng lấy món')}
            onMouseLeave={() => setActiveTooltip(null)}
            className={`flex-1 h-8 flex items-center justify-center gap-1 rounded-md border text-xs font-bold transition-all ${
              isOnline || isCodeAlreadyCreated
                ? isDarkMode
                  ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:text-[#da251d] hover:border-red-200 active:scale-95 cursor-pointer'
            }`}
            title={isCodeAlreadyCreated ? 'Đơn hàng đã tạo mã, không được phép thay đổi' : 'Đổi điểm thưởng lấy món'}
          >
            {isCodeAlreadyCreated ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Gift className="w-3.5 h-3.5 text-slate-600" />}
            <span className="text-[10px] text-red-500 font-black">
              ({redeemableRewardsCount})
            </span>
          </button>

          {/* Button 2: Chiết khấu % */}
          <button
            type="button"
            disabled={isOnline || isCodeAlreadyCreated}
            onClick={() => {
              if (isCodeAlreadyCreated) {
                toast.error('Đơn hàng đã tạo mã, giá trị đơn hàng không được phép thay đổi!');
                return;
              }
              if (!isOnline) onOpenOrderDiscountModal?.();
            }}
            onMouseEnter={() => setActiveTooltip(isCodeAlreadyCreated ? 'Đơn đã tạo mã (Khóa chiết khấu)' : 'Chiết khấu')}
            onMouseLeave={() => setActiveTooltip(null)}
            className={`flex-1 h-8 flex items-center justify-center gap-1 rounded-md border transition-all text-xs font-bold ${
              isOnline || isCodeAlreadyCreated
                ? isDarkMode
                  ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : effectiveOrderDiscount > 0
                ? 'bg-red-50 border-[#da251d] text-[#da251d] font-black cursor-pointer active:scale-95'
                : isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:text-[#da251d] cursor-pointer active:scale-95'
            }`}
            title={isCodeAlreadyCreated ? 'Đơn hàng đã tạo mã, không được phép chiết khấu' : 'Chiết khấu'}
          >
            {isCodeAlreadyCreated ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Percent className="w-3.5 h-3.5" />}
          </button>

          {/* Button 3: Phụ thu & Thuế / Xuất hóa đơn VAT */}
          <button
            type="button"
            onClick={() => {
              if (onOpenOrderFeesModal) {
                onOpenOrderFeesModal();
              } else if (onOpenEditVatModal) {
                onOpenEditVatModal(selectedMember);
              }
            }}
            onMouseEnter={() => setActiveTooltip(isOnline ? 'Xuất HĐ VAT' : 'Phụ thu & Hóa đơn')}
            onMouseLeave={() => setActiveTooltip(null)}
            className={`flex-1 h-8 flex items-center justify-center gap-1 rounded-md border transition-all text-xs font-bold cursor-pointer active:scale-95 ${
              isOnline
                ? (currentOrder as any)?.isInvoiceRequested
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                  : 'bg-amber-500 text-white border-amber-600 shadow-2xs hover:bg-amber-600'
                : serviceChargeTotal > 0 || computedTaxAmount > 0 || (currentOrder as any)?.isInvoiceRequested
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:text-[#da251d]'
            }`}
            title={isOnline ? 'Thêm / chỉnh sửa thông tin xuất hóa đơn VAT' : 'Phụ thu dịch vụ & Xuất hóa đơn VAT'}
          >
            {isOnline ? <Building2 className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
          </button>

          {/* Button 4: Ghi chú */}
          <button
            type="button"
            disabled={isOnline}
            onClick={() => {
              if (isOnline) return;
              setTempOrderNote(orderNote || currentOrder?.note || '');
              setIsEditingOrderNote(!isEditingOrderNote);
            }}
            onMouseEnter={() => setActiveTooltip('Ghi chú')}
            onMouseLeave={() => setActiveTooltip(null)}
            className={`flex-1 h-8 flex items-center justify-center gap-1 rounded-md border transition-all text-xs font-bold ${
              isOnline
                ? isDarkMode
                  ? 'bg-slate-800/50 border-slate-700/50 text-slate-500 cursor-not-allowed opacity-60'
                  : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : orderNote || currentOrder?.note
                ? 'bg-[#da251d] text-white border-[#da251d] cursor-pointer active:scale-95'
                : isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer active:scale-95'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:text-[#da251d] cursor-pointer active:scale-95'
            }`}
            title="Ghi chú"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          {/* Button 5: In tạm tính / In đơn online */}
          <button
            type="button"
            onClick={onOpenPrintBill}
            onMouseEnter={() => setActiveTooltip(isOnline ? 'In đơn online' : 'In tạm tính')}
            onMouseLeave={() => setActiveTooltip(null)}
            className={`flex-[2] h-8 flex items-center justify-center gap-1.5 rounded-md border active:scale-95 transition-all text-xs font-bold cursor-pointer px-2 shrink-0 shadow-2xs ${
              isDarkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title={isOnline ? 'In đơn hàng Online (F2)' : 'In tạm tính (F2)'}
          >
            <Printer className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-bold">{isOnline ? 'In đơn online' : 'In tạm tính'}</span>
          </button>

          {/* Button 6: Scroll Up / Down Controls */}
          <div className={`flex items-center gap-0.5 shrink-0 pl-1 border-l ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              type="button"
              onClick={() => scrollCart(-120)}
              className={`w-7 h-8 flex items-center justify-center rounded-md border active:scale-95 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Cuộn lên"
            >
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => scrollCart(120)}
              className={`w-7 h-8 flex items-center justify-center rounded-md border active:scale-95 cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Cuộn xuống"
            >
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 3.2 Total Row with ℹ button */}
        <div className={`h-11 px-3 flex items-center justify-between border-b ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <span className={`text-xs sm:text-sm font-black ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Tổng tiền</span>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-black text-[#da251d] tracking-tight font-mono">
              {grandTotal.toLocaleString('vi-VN')}đ
            </span>
            <button
              type="button"
              onClick={() => setShowBreakdownPopover(!showBreakdownPopover)}
              className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              title="Xem chi tiết tiền hàng & chiết khấu"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3.3 Action Buttons */}
        {isOnline ? (
          <div className={`grid grid-cols-4 h-14 divide-x divide-white/20 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {/* 1. Thoát (ESC) */}
            <button
              type="button"
              onClick={handleExitWithCheck}
              className="flex flex-col items-center justify-center bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white transition-all cursor-pointer select-none"
              title="Thoát xem đơn hàng (ESC)"
            >
              <span className="text-xs font-bold leading-tight">Thoát</span>
              <span className="text-[10px] opacity-85 font-medium">(ESC)</span>
            </button>

            {/* 2. Xuất HĐ VAT */}
            <button
              type="button"
              onClick={onOpenOrderFeesModal}
              className="flex flex-col items-center justify-center bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white transition-all cursor-pointer select-none px-1 text-center"
              title="Thêm / chỉnh sửa thông tin xuất hóa đơn VAT"
            >
              <div className="text-[11px] sm:text-xs font-bold leading-tight flex items-center justify-center gap-1">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Xuất HĐ VAT</span>
              </div>
              <span className="text-[10px] opacity-85 font-medium">Hóa đơn đỏ</span>
            </button>

            {/* 3. In đơn hàng Online (col-span-2) */}
            <button
              type="button"
              onClick={onOpenPrintBill}
              className="col-span-2 flex flex-col items-center justify-center bg-[#da251d] hover:bg-[#b81d16] active:bg-[#9a1812] text-white transition-all cursor-pointer select-none px-1 text-center"
              title="In đơn hàng Online theo mẫu in online"
            >
              <div className="text-xs font-black leading-tight flex items-center justify-center gap-1.5">
                <Printer className="w-4 h-4 shrink-0" />
                <span>In đơn hàng Online</span>
              </div>
              <span className="text-[10px] opacity-85 font-medium">(Mẫu in Online)</span>
            </button>
          </div>
        ) : (
          <div className={`grid grid-cols-4 h-14 divide-x divide-white/20 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {/* 1. Thoát (ESC) */}
            <button
              type="button"
              onClick={handleExitWithCheck}
              className="flex flex-col items-center justify-center bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white transition-all cursor-pointer select-none"
              title="Thoát đơn hàng (ESC)"
            >
              <span className="text-xs font-bold leading-tight">Thoát</span>
              <span className="text-[10px] opacity-85 font-medium">(ESC)</span>
            </button>

            {/* 2. Lưu đơn (F3) - Hỗ trợ lưu đơn rỗng / giữ bàn / nháp */}
            <button
              type="button"
              disabled={isSavingOrder}
              onClick={onSaveOrder}
              className="flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white transition-all cursor-pointer select-none"
              title="Lưu đơn hàng vào hệ thống (F3)"
            >
              {isSavingOrder ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-xs font-bold leading-tight">Lưu đơn</span>
                  <span className="text-[10px] opacity-85 font-medium">(F3)</span>
                </>
              )}
            </button>

            {/* 3. Gửi bếp (F2) có huy hiệu đếm số lượng chờ gửi */}
            <button
              type="button"
              disabled={cartItems.length === 0 || isSendingKitchen}
              onClick={onSendToKitchen}
              className="flex flex-col items-center justify-center bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white transition-all cursor-pointer select-none px-1 text-center relative"
              title="Gửi lệnh in / thông báo đến bếp (F2)"
            >
              {isSendingKitchen ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <div className="text-[11px] sm:text-xs font-bold leading-tight flex items-center justify-center gap-1">
                    <ChefHat className="w-3.5 h-3.5 shrink-0" />
                    <span>Gửi bếp</span>
                    {unsentKitchenItemsCount > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-white text-amber-900 text-[10px] font-black shadow-xs font-mono">
                        {unsentKitchenItemsCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] opacity-85 font-medium">(F2)</span>
                </>
              )}
            </button>

            {/* 4. Thanh toán (F4) */}
            <button
              type="button"
              disabled={cartItems.length === 0}
              onClick={onOpenPaymentModal}
              className="flex flex-col items-center justify-center bg-[#da251d] hover:bg-[#b81d16] active:bg-[#9a1812] disabled:opacity-50 text-white transition-all cursor-pointer select-none"
              title="Tiến hành thanh toán đơn hàng (F4 / F8)"
            >
              <span className="text-xs font-black leading-tight">Thanh toán</span>
              <span className="text-[10px] opacity-85 font-bold">(F4)</span>
            </button>
          </div>
        )}
      </div>

      <TaxBreakdownModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        taxBreakdown={taxBreakdown}
        totalTaxAmount={computedTaxAmount}
        vatPriceMode={activeVatPriceMode}
        isDarkMode={isDarkMode}
      />

      {/* Exit Confirmation Modal – shown when there are unsaved changes */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className={`rounded-2xl shadow-2xl border w-[90vw] max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-150 ${
            isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isDarkMode ? 'bg-amber-950/60 text-amber-400' : 'bg-amber-100 text-amber-600'
              }`}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`text-sm font-black leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Thông tin chưa được lưu
                </h3>
                <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Có thay đổi &amp; thông tin đơn hàng chưa được lưu.<br />
                  Bạn có muốn tiếp tục thao tác?
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className={`h-px mx-5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

            {/* Actions */}
            <div className="px-5 py-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  const exitFn = onExitOrder || onSelectTableTab;
                  exitFn?.();
                }}
                className={`flex-1 h-10 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                  isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Không lưu, thoát ngay
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowExitConfirm(false);
                  await onSaveOrder();
                  const exitFn = onExitOrder || onSelectTableTab;
                  exitFn?.();
                }}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black transition-colors cursor-pointer shadow-sm"
              >
                Lưu đơn và thoát
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>

  );
};
