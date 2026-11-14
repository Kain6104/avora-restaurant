"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AvoraCoin } from '@/components/ui/AvoraCoin';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  Award,
  Search,
  CheckCircle2,
  Ticket,
  Crown,
  Printer,
  RefreshCw,
  Building2,
  Loader2,
  Check,
  Plus,
  ArrowLeft,
  Layers,
  Sparkles,
  Edit3,
  Clock,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthHeaders } from '@/lib/auth';
import { useModalZIndex } from '@/lib/modal-stack';
import { printAgent } from '@/lib/print-agent';
import { PosCartItem, PosTable, PosOrder } from './pos-types';
import { PosDeliveryInfo } from './DeliveryAddressModal';
import { CreateCustomerModal } from './CreateCustomerModal';
import { EditCustomerVatModal } from './EditCustomerVatModal';
import { MultiPaymentModal } from './MultiPaymentModal';

export interface PosPaymentMethod {
  id: string;
  methodCode: string;
  gatewayType: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  bankCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  minOrderValue?: number;
  isActiveForPos?: boolean;
  displayOrder?: number;
}

export interface RealMember {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  memberCode: string | null;
  points: number;
  currentPoints: number;
  totalSpending: number;
  companyName?: string | null;
  taxCode?: string | null;
  taxAddress?: string | null;
  invoiceEmail?: string | null;
  membershipTier?: {
    id: string;
    name: string;
    discountPercent: number;
    pointMultiplier: number;
  } | null;
  addresses?: Array<{
    id: string;
    recipientName: string;
    phone: string;
    streetDetail: string;
    ward: string;
    province: string;
    isDefault: boolean;
  }>;
}

interface PaymentModalProps {
  order: PosOrder | null;
  table: PosTable | null;
  cartItems: PosCartItem[];
  guestCount: number;
  fullscreen?: boolean;
  orderDiscount?: {
    discountAmount: number;
    discountReason: string;
  } | null;
  deliveryAddress?: PosDeliveryInfo | null;
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  initialMember?: RealMember | null;
  customerName?: string;
  customerPhone?: string;
  onClose: () => void;
  onCustomerUpdated?: (member: RealMember) => void;
  onPaymentSuccess?: (data: any) => void;
  onProcessPayment: (data: {
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
  }) => Promise<void>;
  isProcessing?: boolean;
  onPrintTempBill?: (qrUrl?: string) => Promise<void>;
  receiptPrinterName?: string;
  paperSize?: '80mm' | '58mm';
  vatPriceMode?: 'VAT_INCLUDED' | 'VAT_EXCLUDED' | string;
  branch?: any;
  onMoveToAwaiting?: () => Promise<void> | void;
  isDarkMode?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  order: propOrder,
  table: propTable,
  cartItems: propCartItems,
  guestCount,
  fullscreen = false,
  orderDiscount,
  deliveryAddress,
  orderType = 'DINE_IN',
  initialMember = null,
  customerName = '',
  customerPhone = '',
  onClose,
  onCustomerUpdated,
  onPaymentSuccess,
  onProcessPayment,
  isProcessing = false,
  onPrintTempBill,
  receiptPrinterName,
  paperSize = '80mm',
  vatPriceMode = 'VAT_INCLUDED',
  branch,
  onMoveToAwaiting,
  isDarkMode = false,
}) => {
  const modalZIndex = useModalZIndex(true, fullscreen ? 120 : 100);

  // Preserve active order snapshot if parent session closes right after auto-payment confirmation
  const [cachedSnapshot, setCachedSnapshot] = useState<{
    order: PosOrder | null;
    table: PosTable | null;
    cartItems: PosCartItem[];
  }>({
    order: propOrder,
    table: propTable,
    cartItems: propCartItems,
  });

  if (
    propOrder &&
    propCartItems &&
    propCartItems.length > 0 &&
    (propOrder !== cachedSnapshot.order ||
      (propTable && propTable !== cachedSnapshot.table) ||
      propCartItems !== cachedSnapshot.cartItems)
  ) {
    setCachedSnapshot({
      order: propOrder,
      table: propTable || cachedSnapshot.table,
      cartItems: propCartItems,
    });
  }

  const order = propOrder || cachedSnapshot.order;
  const table = propTable || cachedSnapshot.table;
  const cartItems = (propCartItems && propCartItems.length > 0)
    ? propCartItems
    : cachedSnapshot.cartItems;
  const hasTriggeredSuccessRef = useRef(false);

  const isAwaitingPayment =
    order?.paymentStatus === 'AWAITING_PAYMENT' ||
    (order as any)?.paymentIntentStatus === 'ACTIVE';
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // 1. Payment Methods Dynamically from Database
  const [paymentMethods, setPaymentMethods] = useState<PosPaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [selectedMethodCode, setSelectedMethodCode] = useState<string>('COD');

  // 2. Customer / Member State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<RealMember[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<RealMember | null>(
    initialMember || deliveryAddress?.member || (order as any)?.user || null
  );
  const [isUsePointsEnabled, setIsUsePointsEnabled] = useState(false);
  const [pointsToUse, setPointsToUse] = useState<number>(0);

  // Sync selectedMember whenever initialMember, deliveryAddress, or order changes
  useEffect(() => {
    if (initialMember) {
      setSelectedMember(initialMember);
    } else if (deliveryAddress?.member) {
      setSelectedMember(deliveryAddress.member);
    } else if ((order as any)?.user) {
      setSelectedMember((order as any).user);
    } else {
      const q =
        customerPhone ||
        (order as any)?.customerPhone ||
        (order as any)?.userId ||
        (customerName &&
        customerName !== 'Khách lẻ' &&
        customerName !== 'Khách tại bàn' &&
        customerName !== 'Khách mang đi'
          ? customerName
          : '');
      if (q) {
        fetch(`${baseUrl}/api/pos/members?search=${encodeURIComponent(q)}`, {
          credentials: 'include',
        })
          .then((r) => r.json())
          .then((j) => {
            if (j.success && Array.isArray(j.data) && j.data.length > 0) {
              const matched =
                j.data.find(
                  (m: any) =>
                    m.id === (order as any)?.userId ||
                    m.phone === customerPhone ||
                    m.fullName.toLowerCase() === (customerName || '').toLowerCase(),
                ) || j.data[0];
              setSelectedMember(matched);
              onCustomerUpdated?.(matched);
            }
          })
          .catch(console.error);
      }
    }
  }, [
    initialMember,
    deliveryAddress?.member,
    (order as any)?.user,
    (order as any)?.userId,
    customerPhone,
    customerName,
  ]);

  // Quick Create Customer Modal
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);

  // 3. Multi-Payment (Thanh toán nhiều phương thức) State
  const [isMultiPaymentMode, setIsMultiPaymentMode] = useState(false);
  const [isMultiConfigModalOpen, setIsMultiConfigModalOpen] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  // Edit Customer VAT Modal
  const [isEditCustomerVatOpen, setIsEditCustomerVatOpen] = useState(false);

  // 4. Invoice VAT Request State
  const [isInvoiceRequested, setIsInvoiceRequested] = useState(Boolean(order?.isInvoiceRequested));
  const [invoiceTaxCode, setInvoiceTaxCode] = useState(order?.invoiceTaxCode || '');
  const [invoiceCompanyName, setInvoiceCompanyName] = useState(order?.invoiceCompanyName || '');
  const [invoiceAddress, setInvoiceAddress] = useState(order?.invoiceAddress || '');
  const [invoiceEmail, setInvoiceEmail] = useState(order?.invoiceEmail || '');
  const [isLookingUpTax, setIsLookingUpTax] = useState(false);

  // Sync VAT invoice state whenever order or member changes
  useEffect(() => {
    if (order?.isInvoiceRequested) {
      setIsInvoiceRequested(true);
      if (order.invoiceTaxCode) setInvoiceTaxCode(order.invoiceTaxCode);
      if (order.invoiceCompanyName) setInvoiceCompanyName(order.invoiceCompanyName);
      if (order.invoiceAddress) setInvoiceAddress(order.invoiceAddress);
      if (order.invoiceEmail) setInvoiceEmail(order.invoiceEmail);
    } else if (selectedMember?.taxCode && !invoiceTaxCode) {
      setInvoiceTaxCode(selectedMember.taxCode || '');
      setInvoiceCompanyName(selectedMember.companyName || '');
      setInvoiceAddress(selectedMember.taxAddress || '');
      setInvoiceEmail(selectedMember.invoiceEmail || '');
    }
  }, [
    order?.isInvoiceRequested,
    order?.invoiceTaxCode,
    order?.invoiceCompanyName,
    order?.invoiceAddress,
    order?.invoiceEmail,
    selectedMember?.taxCode,
  ]);

  // 5. Voucher State
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    title: string;
    discountAmount: number;
  } | null>(null);

  // 6. QR Generation & Countdown State
  const [isQrGenerated, setIsQrGenerated] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 7. SePay Polling State
  const [sepayStatus, setSepayStatus] = useState<'WAITING' | 'CHECKING' | 'PAID' | 'ERROR'>('WAITING');
  const [sepayTxCode, setSepayTxCode] = useState<string>('');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculations
  const activeVatPriceMode =
    (order as any)?.vatPriceModeSnapshot || vatPriceMode || 'VAT_INCLUDED';
  const isVatIncluded = activeVatPriceMode === 'VAT_INCLUDED';

  const itemsSubTotal = cartItems.reduce((sum, it) => {
    const itemNetPrice = Math.max(0, it.priceAtSale - (it.discountAmount || 0));
    return sum + itemNetPrice * it.quantity;
  }, 0);

  const effectiveOrderDiscount = orderDiscount?.discountAmount || order?.discountAmount || 0;
  const effectiveDiscountReason = orderDiscount?.discountReason || order?.discountReason || '';

  const activeBranch = branch || (order as any)?.branch;
  const branchLoyaltyRate = activeBranch?.pointRedeemRate && activeBranch.pointRedeemRate > 0 ? activeBranch.pointRedeemRate : 1;
  const isBranchDirectDiscountAllowed = activeBranch?.allowDirectDiscount !== false && branchLoyaltyRate > 0;

  const pointsDiscountValue = isUsePointsEnabled && isBranchDirectDiscountAllowed ? Math.round(pointsToUse * branchLoyaltyRate) : 0;
  const voucherDiscountValue = appliedVoucher?.discountAmount || 0;
  const totalDeductions = effectiveOrderDiscount + voucherDiscountValue + pointsDiscountValue;

  const serviceChargeTotal = (order as any)?.serviceChargeTotal || 0;

  // Dynamic Tax Calculation & Breakdown aligned with order-pricing.service.ts
  const { computedTaxAmount, avgTaxRate } = React.useMemo(() => {
    if (!cartItems || cartItems.length === 0) {
      return { computedTaxAmount: 0, avgTaxRate: 8 };
    }

    let totalTax = 0;
    const rates: number[] = [];

    cartItems.forEach((it) => {
      const rawRate =
        (it as any).taxPercentageAtSale !== undefined && (it as any).taxPercentageAtSale !== null
          ? (it as any).taxPercentageAtSale
          : (it.product?.taxPercentage !== undefined && it.product.taxPercentage !== null)
            ? it.product.taxPercentage
            : ((it as any).taxRate !== undefined && (it as any).taxRate !== null)
              ? (it as any).taxRate
              : 8;
      const rate = Number(rawRate);
      rates.push(rate);

      const itemNet = Math.max(0, (it.priceAtSale - (it.discountAmount || 0)) * it.quantity);
      // Allocate order discount & voucher proportionally
      const totalOrderLevelDiscount = effectiveOrderDiscount + voucherDiscountValue;
      const allocatedDiscount =
        itemsSubTotal > 0
          ? Math.round((itemNet / itemsSubTotal) * totalOrderLevelDiscount)
          : 0;
      const netTaxable = Math.max(0, itemNet - allocatedDiscount);

      let itemTax = 0;
      if (rate > 0 && netTaxable > 0) {
        if (isVatIncluded) {
          itemTax = Math.round((netTaxable * rate) / (100 + rate));
        } else {
          itemTax = Math.round((netTaxable * rate) / 100);
        }
      }
      totalTax += itemTax;
    });

    // Taxable service charges
    if ((order as any)?.serviceCharges && Array.isArray((order as any).serviceCharges)) {
      (order as any).serviceCharges.forEach((sc: any) => {
        if (sc.isTaxable && sc.amount > 0) {
          const scRate = sc.taxPercentage !== undefined && sc.taxPercentage !== null ? Number(sc.taxPercentage) : 10;
          let scTax = 0;
          if (isVatIncluded) {
            scTax = Math.round((sc.amount * scRate) / (100 + scRate));
          } else {
            scTax = Math.round((sc.amount * scRate) / 100);
          }
          totalTax += scTax;
        }
      });
    }

    const calculatedAvgRate = rates.length > 0
      ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
      : 8;

    return { computedTaxAmount: totalTax, avgTaxRate: calculatedAvgRate || 8 };
  }, [cartItems, itemsSubTotal, effectiveOrderDiscount, voucherDiscountValue, isVatIncluded, (order as any)?.serviceCharges]);

  // Grand Total: matches order-pricing.service.ts
  const grandTotal = isVatIncluded
    ? Math.max(0, itemsSubTotal - totalDeductions + serviceChargeTotal)
    : Math.max(0, itemsSubTotal - totalDeductions + serviceChargeTotal + computedTaxAmount);

  // Cash State
  const [cashGivenStr, setCashGivenStr] = useState<string>(grandTotal.toString());
  useEffect(() => {
    setCashGivenStr(grandTotal.toString());
  }, [grandTotal]);

  const cashGiven = parseInt(cashGivenStr || '0', 10);
  const cashChange = Math.max(0, cashGiven - grandTotal);

  // Multi-Payment calculations
  const totalAllocated = Object.values(splitAmounts).reduce((sum, v) => sum + (v || 0), 0);
  const multiRemainingNeeded = Math.max(0, grandTotal - totalAllocated);

  // Fetch POS Payment Methods from DB
  useEffect(() => {
    let isMounted = true;
    const fetchMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const res = await fetch(`${baseUrl}/api/pos/payment-methods`, { credentials: 'include' });
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          if (isMounted) {
            setPaymentMethods(json.data);
            // Ưu tiên chọn mặc định TIỀN MẶT theo yêu cầu của hệ thống
            const defaultCash = json.data.find(
              (m: any) =>
                m.methodCode === 'CASH' ||
                m.methodCode === 'COD' ||
                m.gatewayType === 'CASH' ||
                m.gatewayType === 'COD' ||
                /tiền\s*mặt/i.test(m.name || '')
            );
            const initialCode = defaultCash ? defaultCash.methodCode : json.data[0].methodCode;
            setSelectedMethodCode(initialCode);
            // Initialize multi-payment allocation
            setSplitAmounts({ [initialCode]: grandTotal });
          }
        }
      } catch (err) {
        console.error('Failed to load POS payment methods:', err);
      } finally {
        if (isMounted) setIsLoadingMethods(false);
      }
    };
    fetchMethods();
    return () => {
      isMounted = false;
    };
  }, [baseUrl, grandTotal]);

  // Current method object
  const currentMethod = paymentMethods.find((m) => m.methodCode === selectedMethodCode) || paymentMethods[0];
  const isCashMethod = currentMethod?.gatewayType === 'COD' || currentMethod?.gatewayType === 'CASH' || currentMethod?.methodCode === 'COD' || currentMethod?.methodCode === 'CASH';
  const isSepayMethod = currentMethod?.gatewayType === 'SEPAY' || currentMethod?.methodCode === 'SEPAY_QR' || currentMethod?.methodCode === 'TRANSFER';

  // Identify active QR method & amount in both single and multi-payment modes
  const activeQrEntry = React.useMemo(() => {
    if (isMultiPaymentMode) {
      for (const [code, amt] of Object.entries(splitAmounts)) {
        if ((amt || 0) > 0) {
          const m = paymentMethods.find((pm) => pm.methodCode === code);
          const c = code.toUpperCase();
          const g = (m?.gatewayType || '').toUpperCase();
          if (c.includes('SEPAY') || c.includes('TRANSFER') || c.includes('VIETQR') || g === 'SEPAY') {
            return {
              method: m || currentMethod,
              methodCode: code,
              amount: amt,
            };
          }
        }
      }
      return null;
    } else {
      if (isSepayMethod) {
        return {
          method: currentMethod,
          methodCode: selectedMethodCode,
          amount: grandTotal,
        };
      }
      return null;
    }
  }, [isMultiPaymentMode, splitAmounts, paymentMethods, isSepayMethod, currentMethod, selectedMethodCode, grandTotal]);

  const hasActiveQr = Boolean(activeQrEntry && activeQrEntry.amount > 0);
  const isOrderLockedByQr = Boolean(isQrGenerated && hasActiveQr);
  const isCodeAlreadyCreated = Boolean(
    isAwaitingPayment ||
      (order as any)?.paymentLockedAt ||
      order?.paymentStatus === 'PAID' ||
      order?.status === 'COMPLETED' ||
      isOrderLockedByQr
  );

  // If member has tax info, prefill
  useEffect(() => {
    if (selectedMember && (selectedMember.taxCode || selectedMember.companyName)) {
      if (selectedMember.taxCode) setInvoiceTaxCode(selectedMember.taxCode);
      if (selectedMember.companyName) setInvoiceCompanyName(selectedMember.companyName);
      if (selectedMember.taxAddress) setInvoiceAddress(selectedMember.taxAddress);
      if (selectedMember.invoiceEmail) setInvoiceEmail(selectedMember.invoiceEmail);
    }
  }, [selectedMember]);

  // QR Countdown Timer
  useEffect(() => {
    if (isQrGenerated && hasActiveQr) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current as NodeJS.Timeout);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isQrGenerated, hasActiveQr]);

  // Anti-Fake Bill Verifier (Feature 2)
  const [isScanningBank, setIsScanningBank] = useState(false);
  const [scanCountdown, setScanCountdown] = useState<number | null>(null);
  const [scanWarning, setScanWarning] = useState<{
    message: string;
    gatewayInfo?: string;
  } | null>(null);

  const handleTriggerBankScan = async () => {
    if (isScanningBank) return;
    setIsScanningBank(true);
    setScanCountdown(3);
    setScanWarning(null);

    const activeCode = order?.orderCode || (order as any)?.temporaryOrderCode || (order as any)?.code || '';

    try {
      // 1. Gửi lệnh scan khẩn cấp tới Gateway Android
      fetch(`${baseUrl}/api/bank-connect/v1/admin/scan-request`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          branchId: branch?.id,
          orderId: order?.id,
          expectedAmount: grandTotal,
          orderCode: activeCode,
        }),
      }).catch(console.error);

      // 2. Chạy đếm ngược 3s
      for (let sec = 3; sec > 0; sec--) {
        setScanCountdown(sec);
        await new Promise((r) => setTimeout(r, 1000));
        if (sepayStatus === 'PAID') {
          setIsScanningBank(false);
          setScanCountdown(null);
          return;
        }
      }
      setScanCountdown(0);

      // 3. Thử kiểm tra lại trạng thái SePay
      await checkSepayStatus();

      // 4. Nếu chưa khớp, lấy thông tin Gateway để cảnh báo minh bạch
      let gatewayStatusText = 'Chưa nhận diện thiết bị Gateway';
      let isDevOnline = false;
      let hasDev = false;
      try {
        const devRes = await fetch(`${baseUrl}/api/bank-connect/v1/admin/devices`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const devJson = await devRes.json();
        if (devJson.success && Array.isArray(devJson.data)) {
          const activeDev = devJson.data.find((d: any) => d.status === 'ACTIVE') || devJson.data[0];
          if (activeDev) {
            hasDev = true;
            isDevOnline = Boolean(activeDev.isOnline);
            gatewayStatusText = `Thiết bị: ${activeDev.deviceName || 'Android Gateway'} (${isDevOnline ? 'Online' : 'Offline'}) • Pin: ${activeDev.batteryLevel ?? '--'}% • Mạng: ${activeDev.networkType || 'Wifi'}`;
          }
        }
      } catch {}

      if (sepayStatus !== 'PAID') {
        const warningMessage = !hasDev
          ? '⚠️ Chưa kết nối thiết bị nhận biến động số dư. Vui lòng đối chiếu với khách hàng hoặc kiểm tra sao kê.'
          : !isDevOnline
          ? '🔴 Thiết bị Gateway đang OFFLINE (Tắt nguồn hoặc Mất mạng)! Không thể nhận biến động số dư tự động.'
          : '⚠️ Thiết bị Gateway đang kết nối, nhưng CHƯA NHẬN ĐƯỢC TIỀN biến động số dư! Yêu cầu khách kiểm tra lại giao dịch.';

        setScanWarning({
          message: warningMessage,
          gatewayInfo: gatewayStatusText,
        });
        toast.error('Chưa phát hiện biến động số dư cho đơn này! Vui lòng đối chiếu với khách hàng.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi kiểm tra ngân hàng');
    } finally {
      setIsScanningBank(false);
      setScanCountdown(null);
    }
  };

  // SePay QR Image Parameters (resolves both single and multi-payment)
  const qrBankCode = activeQrEntry?.method?.bankCode || currentMethod?.bankCode || 'OCB';
  const qrAccountNumber = activeQrEntry?.method?.accountNumber || currentMethod?.accountNumber || 'SEPSUSHIWA';
  const qrAmount = activeQrEntry ? activeQrEntry.amount : grandTotal;
  const orderCodeForQr = order?.orderCode || (order as any)?.temporaryOrderCode || (order as any)?.code || 'POS';
  // Real PNG image generated by SePay with the EXACT allocated QR amount
  const sepayQrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(qrAccountNumber)}&bank=${encodeURIComponent(qrBankCode)}&amount=${qrAmount}&des=${encodeURIComponent(orderCodeForQr)}`;

  const handleGenerateQr = () => {
    setIsQrGenerated(true);
    setCountdown(300);
    setSepayStatus('WAITING');
    toast.success(`Đã tạo mã VietQR (${qrAmount.toLocaleString('vi-VN')}đ)! Đơn hàng đã cố định giá trị.`, {
      icon: <QrCode className="w-4 h-4 text-emerald-500" />,
    });
  };

  const handleRegenerateQr = () => {
    setCountdown(300);
    setSepayStatus('WAITING');
    toast.success('Đã làm mới mã thanh toán!');
  };

  const handleCancelQrCode = () => {
    setIsQrGenerated(false);
    setSepayStatus('WAITING');
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    toast('Đã hủy mã QR. Bạn có thể thay đổi đơn hàng hoặc phương thức thanh toán.', {
      icon: '🔓',
    });
  };

  const [isPrintingTempBill, setIsPrintingTempBill] = useState(false);

  const handlePrintTempBillWithQr = async () => {
    if (!order?.id) {
      toast.error('Chưa có thông tin đơn hàng để in tạm tính');
      return;
    }
    setIsPrintingTempBill(true);
    try {
      if (onPrintTempBill) {
        await onPrintTempBill(sepayQrUrl);
        return;
      }

      const res = await fetch(`${baseUrl}/api/print-templates/render/order/${order.id}?type=TEMP_BILL&qrPayload=${encodeURIComponent(sepayQrUrl)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success || !data.data?.html) {
        throw new Error(data.message || 'Lỗi render phiếu tạm tính');
      }

      const html = data.data.html;
      const resolvedPaperSize = data.data.paperSize || '80mm';
      const targetPrinter = 'Xprinter XP-350B';

      const agentRes = await printAgent.printHtml({
        printerName: targetPrinter,
        htmlContent: html,
        paperSize: resolvedPaperSize,
        copies: 1,
        idempotencyKey: `tempbill-qr-${order.id}-${Date.now()}`,
        receiptPayload: data.data?.receiptPayload,
      });

      if (agentRes.success) {
        toast.success(`Đã in phiếu tạm tính & mã QR!`, {
          icon: <Printer className="w-4 h-4 text-emerald-500" />,
        });
      } else {
        toast.error(`Lỗi máy in: ${agentRes.message || 'Không thể in'}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể in phiếu tạm tính & mã QR');
    } finally {
      setIsPrintingTempBill(false);
    }
  };

  const [isMovingToAwaiting, setIsMovingToAwaiting] = useState(false);

  const handleMoveToAwaitingAndReleaseTable = async () => {
    if (!order?.id) {
      toast.error('Chưa có thông tin đơn hàng để chuyển chờ xác nhận');
      return;
    }
    setIsMovingToAwaiting(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/orders/${order.id}/await-confirmation-release-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Lỗi khi chuyển trạng thái đơn');
      }
      toast.success('Đã chuyển đơn vào hàng đợi Chờ xác nhận & giải phóng bàn thành công!', {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      if (onMoveToAwaiting) {
        await onMoveToAwaiting();
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Không thể chuyển đơn vào Chờ xác nhận');
    } finally {
      setIsMovingToAwaiting(false);
    }
  };

  // Final Submit
  const handleFinalSubmit = useCallback(async (transactionRefArg?: string) => {
    if (!cartItems || cartItems.length === 0) {
      toast.error('Đơn hàng không có món ăn nào để thanh toán!');
      return;
    }

    let payments: any[] = [];

    if (isMultiPaymentMode) {
      // Multiple Payment Methods
      payments = Object.entries(splitAmounts)
        .filter(([_, amt]) => (amt || 0) > 0)
        .map(([code, amt]) => ({
          paymentMethod: code,
          amount: amt,
          cashReceived: (code === 'COD' || code === 'CASH') ? amt : undefined,
          transactionRef: code === 'SEPAY_QR' ? `SEPAY-${Date.now()}` : undefined,
        }));

      if (payments.length === 0) {
        toast.error('Vui lòng phân bổ số tiền thanh toán');
        return;
      }
    } else {
      // Single Payment Method
      payments = [
        {
          paymentMethod: currentMethod?.methodCode || selectedMethodCode,
          amount: grandTotal,
          cashReceived: isCashMethod ? cashGiven : undefined,
          cashChange: isCashMethod ? cashChange : undefined,
          transactionRef: transactionRefArg || (isSepayMethod ? `SEPAY-${Date.now()}` : undefined),
        },
      ];
    }

    await onProcessPayment({
      payments,
      discountVoucherCode: appliedVoucher?.code,
      pointsUsed: isUsePointsEnabled ? pointsToUse : 0,
      userId: selectedMember?.id,
      discountAmount: effectiveOrderDiscount,
      discountReason: effectiveDiscountReason,
      isInvoiceRequested,
      invoiceCompanyName: isInvoiceRequested ? invoiceCompanyName.trim() : undefined,
      invoiceTaxCode: isInvoiceRequested ? invoiceTaxCode.trim() : undefined,
      invoiceAddress: isInvoiceRequested ? invoiceAddress.trim() : undefined,
      invoiceEmail: isInvoiceRequested ? invoiceEmail.trim() : undefined,
    });
  }, [
    isMultiPaymentMode,
    splitAmounts,
    currentMethod,
    selectedMethodCode,
    grandTotal,
    isCashMethod,
    cashGiven,
    cashChange,
    isSepayMethod,
    onProcessPayment,
    appliedVoucher?.code,
    isUsePointsEnabled,
    pointsToUse,
    selectedMember?.id,
    effectiveOrderDiscount,
    effectiveDiscountReason,
    isInvoiceRequested,
    invoiceCompanyName,
    invoiceTaxCode,
    invoiceAddress,
    invoiceEmail,
  ]);

  // SePay Polling + Realtime Socket Payment Confirmation Listener
  const triggerPaymentSuccessOnce = useCallback(
    (payload: any) => {
      if (hasTriggeredSuccessRef.current) return;
      hasTriggeredSuccessRef.current = true;
      setSepayStatus('PAID');
      if (payload?.transactionCode) {
        setSepayTxCode(payload.transactionCode);
      }
      toast.success('Đã nhận chuyển khoản thành công!', {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        duration: 4000,
      });
      setTimeout(() => {
        onPaymentSuccess?.(payload);
      }, 250);
    },
    [onPaymentSuccess],
  );

  const checkSepayStatus = useCallback(async () => {
    const orderCodeToCheck =
      order?.orderCode ||
      (order as any)?.temporaryOrderCode ||
      (order as any)?.code ||
      order?.id;
    if (!orderCodeToCheck || !isQrGenerated || hasTriggeredSuccessRef.current) return;

    try {
      const res = await fetch(`${baseUrl}/api/payment/check-status/${encodeURIComponent(orderCodeToCheck)}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isPaid) {
          if (
            data.rawStatus === 'COMPLETED' ||
            data.status === 'COMPLETED' ||
            data.status === 'PAID' ||
            data.paymentStatus === 'PAID' ||
            (data.orderCode && !String(data.orderCode).startsWith('TMP-'))
          ) {
            triggerPaymentSuccessOnce({
              ...data,
              orderId: data.orderId || order?.id,
              orderCode: data.realOrderCode || data.orderCode || order?.orderCode,
              temporaryOrderCode: data.temporaryOrderCode || (order as any)?.temporaryOrderCode,
              amount: data.totalPaid || data.totalAmount || grandTotal,
              tableName: table?.name || order?.table?.name,
            });
          } else {
            hasTriggeredSuccessRef.current = true;
            setSepayStatus('PAID');
            setSepayTxCode(data.transactionCode || '');
            setTimeout(() => {
              handleFinalSubmit(data.transactionCode);
            }, 400);
          }
        } else if (data.hasTransferPayment && sepayStatus !== 'PAID') {
          setSepayStatus('PAID');
          setSepayTxCode(data.transactionCode || '');
          toast.success('Đã nhận chuyển khoản phần tiền QR ngân hàng!', {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            duration: 4000,
          });
          if (isMultiPaymentMode && data.totalPaid >= grandTotal) {
            triggerPaymentSuccessOnce({
              ...data,
              orderId: data.orderId || order?.id,
              orderCode: data.realOrderCode || data.orderCode || order?.orderCode,
              temporaryOrderCode: data.temporaryOrderCode || (order as any)?.temporaryOrderCode,
              amount: data.totalPaid || grandTotal,
              tableName: table?.name || order?.table?.name,
            });
          }
        }
      }
    } catch (err) {
      console.error('Polling SePay status error:', err);
    }
  }, [
    baseUrl,
    order?.id,
    order?.orderCode,
    (order as any)?.temporaryOrderCode,
    order?.table?.name,
    table?.name,
    isQrGenerated,
    handleFinalSubmit,
    sepayStatus,
    isMultiPaymentMode,
    grandTotal,
    triggerPaymentSuccessOnce,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleRealtimePaid = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || hasTriggeredSuccessRef.current) return;

      const curId = order?.id;
      const curOrderCode = order?.orderCode;
      const curTmpCode = (order as any)?.temporaryOrderCode;
      const curTableId = table?.id || order?.tableId;

      const isMatch =
        (detail.orderId && curId && detail.orderId === curId) ||
        (detail.orderCode && (detail.orderCode === curOrderCode || detail.orderCode === curTmpCode)) ||
        (detail.temporaryOrderCode && (detail.temporaryOrderCode === curTmpCode || detail.temporaryOrderCode === curOrderCode)) ||
        (isQrGenerated && detail.tableId && curTableId && detail.tableId === curTableId);

      if (isMatch) {
        triggerPaymentSuccessOnce({
          ...detail,
          orderId: detail.orderId || curId,
          orderCode: detail.orderCode || curOrderCode || curTmpCode,
          temporaryOrderCode: detail.temporaryOrderCode || curTmpCode,
          amount: detail.amount || grandTotal,
          tableName: detail.tableName || table?.name || order?.table?.name,
        });
      }
    };

    window.addEventListener('avora:payment-completed', handleRealtimePaid);
    return () => window.removeEventListener('avora:payment-completed', handleRealtimePaid);
  }, [order?.id, order?.orderCode, (order as any)?.temporaryOrderCode, order?.tableId, order?.table?.name, table?.id, table?.name, isQrGenerated, grandTotal, triggerPaymentSuccessOnce]);

  useEffect(() => {
    const activeCode =
      order?.orderCode ||
      (order as any)?.temporaryOrderCode ||
      (order as any)?.code ||
      order?.id;
    if (hasActiveQr && isQrGenerated && activeCode && sepayStatus !== 'PAID') {
      checkSepayStatus();
      pollTimerRef.current = setInterval(checkSepayStatus, 2500);
      return () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      };
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [hasActiveQr, isQrGenerated, order?.id, order?.orderCode, (order as any)?.temporaryOrderCode, sepayStatus, checkSepayStatus]);

  // Auto-Save Customer to Order when Selected or Created
  const handleSelectMember = async (member: RealMember) => {
    setSelectedMember(member);
    setMemberSearchResults([]);
    setMemberSearchQuery('');
    setPointsToUse(0);

    // Auto-populate invoice info if customer has it
    if (member.taxCode) setInvoiceTaxCode(member.taxCode);
    if (member.companyName) setInvoiceCompanyName(member.companyName);
    if (member.taxAddress) setInvoiceAddress(member.taxAddress);
    if (member.invoiceEmail) setInvoiceEmail(member.invoiceEmail);

    // Auto-save customer to existing order in DB immediately!
    if (order?.id) {
      try {
        const res = await fetch(`${baseUrl}/api/pos/orders/${order.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            expectedVersion: order.version,
            userId: member.id,
            customerName: member.fullName,
            customerPhone: member.phone || '',
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success(`Đã tự động lưu khách hàng ${member.fullName} vào đơn [${order.orderCode}]!`, {
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          });
          onCustomerUpdated?.(member);
        }
      } catch (e) {
        console.error('Failed to auto-save customer to order:', e);
      }
    } else {
      toast.success(`Đã chọn khách hàng: ${member.fullName}`);
      onCustomerUpdated?.(member);
    }
  };

  // Search Members
  const handleSearchMembers = async (q: string) => {
    setMemberSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setMemberSearchResults([]);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/members/search?query=${encodeURIComponent(q.trim())}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMemberSearchResults(json.data);
      }
    } catch (e) {
      console.error('Member search failed:', e);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  // Max points usable
  const maxPointsUsable = Math.min(
    selectedMember?.points || 0,
    Math.floor((itemsSubTotal - effectiveOrderDiscount - voucherDiscountValue) / (branchLoyaltyRate || 1))
  );

  // Fast Tax Lookup
  const handleLookupTax = async () => {
    const cleanMst = invoiceTaxCode.trim();
    if (!cleanMst || cleanMst.length < 4) {
      toast.error('Vui lòng nhập mã số thuế hợp lệ');
      return;
    }
    setIsLookingUpTax(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/tax-lookup/${encodeURIComponent(cleanMst)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setInvoiceCompanyName(json.data.companyName || '');
        setInvoiceAddress(json.data.address || '');
        toast.success('Đã tự động điền & chuẩn hóa địa chỉ công ty!', {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        });
      } else {
        toast.error(json.message || 'Không tìm thấy thông tin doanh nghiệp');
      }
    } catch (e: any) {
      toast.error('Lỗi khi tra cứu MST');
    } finally {
      setIsLookingUpTax(false);
    }
  };

  // Touch Numpad Handler
  const handleNumpadPress = (k: string) => {
    if (k === 'C') {
      setCashGivenStr('0');
    } else if (k === 'DEL') {
      setCashGivenStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (k === '000') {
      setCashGivenStr((prev) => (prev === '0' ? '0' : prev + '000'));
    } else {
      setCashGivenStr((prev) => (prev === '0' ? k : prev + k));
    }
  };

  // Render Membership Tier Badge
  const renderTierBadge = (tier?: { name: string; discountPercent?: number; pointMultiplier?: number } | null) => {
    if (!tier) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-bold text-[10px] flex items-center gap-1">
          <Award className="w-3 h-3 text-gray-500" />
          <span>Thành viên</span>
        </span>
      );
    }

    const name = tier.name;
    const isDiamond = name.includes('Kim Cương') || name.toLowerCase().includes('diamond');
    const isGold = name.includes('Vàng') || name.toLowerCase().includes('gold');
    const isSilver = name.includes('Bạc') || name.toLowerCase().includes('silver');

    if (isDiamond) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-900 border border-purple-200 font-bold text-[10px] flex items-center gap-1 shadow-2xs">
          <Crown className="w-3 h-3 text-purple-600 fill-purple-200" />
          <span>Hạng {name}</span>
          {tier.discountPercent ? <span className="text-purple-700">(-{tier.discountPercent}%)</span> : null}
        </span>
      );
    }
    if (isGold) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center gap-1 shadow-2xs">
          <Crown className="w-3 h-3 text-amber-600 fill-amber-300" />
          <span>Hạng {name}</span>
          {tier.discountPercent ? <span className="text-amber-800">(-{tier.discountPercent}%)</span> : null}
        </span>
      );
    }
    if (isSilver) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[10px] flex items-center gap-1">
          <Award className="w-3 h-3 text-slate-600" />
          <span>Hạng {name}</span>
          {tier.discountPercent ? <span className="text-slate-600">(-{tier.discountPercent}%)</span> : null}
        </span>
      );
    }

    // Default Bronze / Other
    return (
      <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-900 border border-orange-200 font-bold text-[10px] flex items-center gap-1">
        <Award className="w-3 h-3 text-orange-600" />
        <span>Hạng {name}</span>
      </span>
    );
  };

  // Keyboard shortcut: F8 or Enter for confirm (cash only), Escape for close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F8' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        if (isMultiPaymentMode) {
          if (totalAllocated >= grandTotal) handleFinalSubmit();
        } else if (isCashMethod && cashGiven >= grandTotal) {
          handleFinalSubmit();
        } else if (isSepayMethod) {
          toast('Phương thức SePay tự động xác nhận khi khách thanh toán thành công');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isCashMethod, isSepayMethod, cashGiven, grandTotal, handleFinalSubmit, isMultiPaymentMode, totalAllocated]);

  // Title header text
  const orderCodeDisplay = order?.orderCode || order?.temporaryOrderCode || '';

  const rawDineInTableName = table?.name || order?.table?.name || '';
  const cleanDineInTableName = rawDineInTableName.replace(/^Bàn\s+/i, '').trim() || rawDineInTableName;

  const headerTitle =
    orderType === 'DELIVERY'
      ? `Thanh toán - Giao hàng: ${deliveryAddress?.customerName || 'Khách giao'}`
      : orderType === 'TAKEAWAY'
      ? 'Thanh toán - Đơn mang đi'
      : `Thanh toán - ${cleanDineInTableName || 'Mở bàn'}`;

  return (
    <div
      style={{ zIndex: modalZIndex }}
      className={
        fullscreen
          ? "fixed inset-0 w-full h-[100dvh] flex flex-col bg-white dark:bg-[#181f2c] overflow-hidden select-none animate-in fade-in duration-150"
          : "fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 select-none animate-in fade-in duration-150"
      }
    >
      <div className={
        fullscreen
          ? "w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#181f2c] text-gray-900 dark:text-slate-100"
          : `rounded-t-3xl sm:rounded-2xl shadow-2xl border w-full max-w-6xl max-h-[92dvh] sm:max-h-[94vh] flex flex-col overflow-hidden transition-all animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
              isDarkMode
                ? 'bg-[#181f2c] border-[#2c374c] text-slate-100 shadow-slate-950/80'
                : 'bg-white border-gray-200 text-gray-900'
            }`
      }>
        {/* Mobile Drag Handle */}
        {!fullscreen && (
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />
        )}

        {/* =========================================================================
            HEADER (AVORA RED BRAND ACCENT)
            ========================================================================= */}
        <div className={`px-4 sm:px-6 py-3 sm:py-3.5 border-b flex items-center justify-between shrink-0 relative ${
          fullscreen ? 'pt-[calc(0.75rem+env(safe-area-inset-top))]' : ''
        } ${
          isDarkMode ? 'bg-[#1e2738] border-[#2c374c] text-slate-100' : 'bg-white border-gray-200 text-gray-900'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              title="Quay lại"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#da251d] text-white flex items-center justify-center font-bold shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>AVORA POS</span>
          </div>

          <div className="flex-1 min-w-0 mx-2 text-center flex flex-col items-center justify-center">
            <h2 className={`text-sm sm:text-base font-bold tracking-tight w-full truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {headerTitle}
            </h2>
            {orderCodeDisplay && (
              <span className={`text-[11px] font-mono font-medium ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                #{orderCodeDisplay}
              </span>
            )}
          </div>

          {!fullscreen ? (
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-[#253046]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-8 shrink-0" />
          )}
        </div>

        {/* =========================================================================
            BODY: ADAPTIVE LAYOUT (Single seamless scroll on fullscreen mobile, 3-column on desktop POS)
            ========================================================================= */}
        <div className={`flex-1 ${
          fullscreen
            ? 'overflow-y-auto min-h-0 p-3 sm:p-4 space-y-4 text-xs'
            : 'grid grid-cols-1 md:grid-cols-3 overflow-hidden divide-y md:divide-y-0 md:divide-x min-h-0 text-xs'
        } ${isDarkMode ? 'divide-[#2c374c] bg-[#181f2c]' : 'divide-slate-200 bg-white'}`}>
          {/* =========================================================================
              COLUMN 1 (Left: Customer Search + Tier, + Thêm KH, Dynamic PTTT, Multi-Method)
              ========================================================================= */}
          <div className={`${
            fullscreen
              ? 'space-y-3.5 bg-white dark:bg-[#181f2c] p-3 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-[#2c374c]'
              : 'p-3 sm:p-4 space-y-3.5 overflow-y-auto flex flex-col justify-between'
          } ${isDarkMode ? 'bg-[#181f2c] text-slate-100' : 'bg-white text-gray-900'}`}>
            <div className="space-y-3.5">
              {/* Customer Search Bar */}
              <div className="space-y-2">
                <div className="relative">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => handleSearchMembers(e.target.value)}
                      placeholder="Tìm kiếm khách hàng theo SĐT, tên..."
                      className={`w-full pl-9 pr-3 py-2 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium transition-all border ${
                        isDarkMode
                          ? 'bg-[#1e2738] border-[#2c374c] text-white placeholder-slate-400 focus:bg-[#253046]'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white'
                      }`}
                    />
                  </div>

                  {/* Dropdown Search Results with Membership Tiers */}
                  {memberSearchResults.length > 0 && (
                    <div className={`absolute left-0 right-0 top-full mt-1 border rounded-xl shadow-xl py-1 z-30 max-h-52 overflow-y-auto ${
                      isDarkMode
                        ? 'bg-[#1e2738] border-[#2c374c] text-white divide-y divide-[#2c374c]'
                        : 'bg-white border-gray-200 text-gray-900 divide-y divide-gray-50'
                    }`}>
                      {memberSearchResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectMember(m)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                            isDarkMode
                              ? 'hover:bg-[#253046] text-slate-100'
                              : 'hover:bg-red-50/60 text-gray-800'
                          }`}
                        >
                          <div>
                            <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{m.fullName}</div>
                            <div className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              {m.phone || 'Chưa có SĐT'} {m.memberCode && `• ${m.memberCode}`}
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            {renderTierBadge(m.membershipTier)}
                            <div className="text-[10px] font-bold text-amber-500">
                              <AvoraCoin amount={m.points || 0} size="xs" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Member Display Card with Prominent Membership Tier */}
                {selectedMember ? (
                  <div className={`p-3 rounded-xl space-y-2 border ${
                    isDarkMode ? 'bg-red-950/20 border-red-900/50 text-slate-100' : 'bg-red-50/40 border-red-200/80 text-gray-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold text-xs flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          <span>{selectedMember.fullName}</span>
                        </div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                          {selectedMember.phone || 'Chưa SĐT'} {selectedMember.memberCode && `• ${selectedMember.memberCode}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(null);
                          setIsUsePointsEnabled(false);
                          setPointsToUse(0);
                        }}
                        className="text-[11px] text-rose-500 hover:underline font-semibold cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    </div>

                    <div className={`flex items-center justify-between pt-1 border-t ${isDarkMode ? 'border-red-900/40' : 'border-red-200/60'}`}>
                      <span className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>Hạng khách hàng:</span>
                      {renderTierBadge(selectedMember.membershipTier)}
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>Điểm tích lũy:</span>
                      <span className="font-extrabold text-amber-500">
                        <AvoraCoin amount={selectedMember.points || 0} size="xs" />
                      </span>
                    </div>

                    {/* VAT Info and Edit VAT Button */}
                    <div className={`flex items-center justify-between pt-1.5 border-t ${isDarkMode ? 'border-red-900/40' : 'border-red-200/60'}`}>
                      <div className="text-[10px] truncate max-w-[170px]">
                        {selectedMember.taxCode ? (
                          <span className={`font-mono font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>MST: {selectedMember.taxCode}</span>
                        ) : (
                          <span className="text-gray-400 italic">Chưa có thông tin VAT</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditCustomerVatOpen(true)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                          isDarkMode
                            ? 'bg-[#1e2738] hover:bg-[#253046] border-[#2c374c] text-red-400'
                            : 'bg-white hover:bg-red-100 border-red-300 text-[#da251d]'
                        }`}
                        title="Chỉ cho phép sửa/thêm thông tin xuất hóa đơn VAT"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Sửa thông tin VAT</span>
                      </button>
                    </div>
                  </div>
                ) : customerName && customerName !== 'Khách lẻ' && customerName !== 'Khách tại bàn' && customerName !== 'Khách mang đi' ? (
                  <div className={`p-3 rounded-xl space-y-1.5 border ${
                    isDarkMode ? 'bg-red-950/20 border-red-900/50 text-slate-100' : 'bg-red-50/40 border-red-200/80 text-gray-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{customerName}</div>
                        {customerPhone && (
                          <div className={`text-[10px] font-mono mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                            {customerPhone}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-600'
                      }`}>
                        Khách hàng
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Button: + Thêm khách hàng (Opens CreateCustomerModal) */}
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerOpen(true)}
                  className={`w-full py-2 px-3 border border-dashed rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isDarkMode
                      ? 'border-red-900/60 hover:border-red-500 hover:bg-red-950/30 text-red-400'
                      : 'border-red-300 hover:border-[#da251d] hover:bg-red-50/50 text-[#da251d]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Thêm khách hàng</span>
                </button>
              </div>

              {/* DYNAMIC PAYMENT METHODS FROM DATABASE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`font-bold text-xs ${isDarkMode ? 'text-slate-200' : 'text-gray-900'}`}>Phương thức thanh toán</span>
                  {isLoadingMethods && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Đồng bộ DB...
                    </span>
                  )}
                </div>

                {/* Render methods mapping directly from database */}
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => {
                    const isSingleSelected = !isMultiPaymentMode && selectedMethodCode === method.methodCode;
                    const isMultiSelected = isMultiPaymentMode && (splitAmounts[method.methodCode] || 0) > 0;
                    const isSelected = isSingleSelected || isMultiSelected;
                    const allocatedAmt = splitAmounts[method.methodCode] || 0;

                    const code = method.methodCode.toUpperCase();
                    const gateway = method.gatewayType.toUpperCase();
                    const isCash = code.includes('CASH') || code.includes('COD') || gateway === 'COD' || gateway === 'CASH';
                    const isSepay = code.includes('SEPAY') || gateway === 'SEPAY' || code.includes('TRANSFER');
                    const isCard = code.includes('CARD') || gateway === 'CARD';

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          if (isMultiPaymentMode) {
                            // Switch back to this single method
                            setIsMultiPaymentMode(false);
                            setSelectedMethodCode(method.methodCode);
                            setSplitAmounts({ [method.methodCode]: grandTotal });
                            setIsQrGenerated(false);
                            setSepayStatus('WAITING');
                            toast.success(`Đã chuyển sang thanh toán ${method.name}`);
                          } else {
                            setSelectedMethodCode(method.methodCode);
                            setIsQrGenerated(false);
                            setSepayStatus('WAITING');
                          }
                        }}
                        className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[72px] ${
                          isMultiSelected
                            ? isDarkMode
                              ? 'border-red-500/80 bg-red-950/30 text-red-300 ring-1 ring-red-500/40 shadow-2xs font-bold'
                              : 'border-red-500 bg-red-50/70 text-[#da251d] ring-1 ring-red-200 shadow-2xs font-bold'
                            : isSingleSelected
                            ? isDarkMode
                              ? 'border-[#da251d] bg-red-950/40 text-red-400 ring-1 ring-[#da251d] shadow-2xs font-bold'
                              : 'border-[#da251d] bg-red-50/50 text-[#da251d] ring-1 ring-[#da251d] shadow-2xs font-bold'
                            : isDarkMode
                            ? 'border-[#2c374c] bg-[#1e2738] hover:bg-[#253046] text-slate-200'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {/* Checkmark badge top-right */}
                        {isMultiSelected && (
                          <div className="absolute top-0 right-0 w-4 h-4 bg-[#da251d] rounded-bl-lg rounded-tr-xl flex items-center justify-center text-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        {isSingleSelected && (
                          <div className="absolute top-0 right-0 w-4 h-4 bg-[#da251d] rounded-bl-lg rounded-tr-xl flex items-center justify-center text-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}

                        <div className="mb-1 flex items-center justify-center">
                          {isCash ? (
                            <Banknote className={`w-5 h-5 ${isMultiSelected ? 'text-[#da251d]' : isSingleSelected ? 'text-[#da251d]' : 'text-emerald-500'}`} />
                          ) : isSepay ? (
                            <div className="flex items-center gap-1">
                              <QrCode className={`w-4 h-4 ${isMultiSelected ? 'text-[#da251d]' : isSingleSelected ? 'text-[#da251d]' : 'text-red-500'}`} />
                              <span className={`text-[10px] font-black tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>
                                {method.bankCode || 'VIETQR'}
                              </span>
                            </div>
                          ) : (
                            <CreditCard className={`w-5 h-5 ${isMultiSelected ? 'text-[#da251d]' : isSingleSelected ? 'text-[#da251d]' : 'text-blue-500'}`} />
                          )}
                        </div>

                        <span className="text-xs leading-tight line-clamp-1 px-1">
                          {method.name}
                        </span>

                        {isMultiSelected && (
                          <span className="text-[10px] font-mono font-black text-[#da251d] dark:text-red-400 mt-0.5">
                            {allocatedAmt.toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Button: Thanh toán nhiều phương thức */}
                <div className="pt-1 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiConfigModalOpen(true);
                    }}
                    className={`w-full py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs ${
                      isMultiPaymentMode
                        ? isDarkMode
                          ? 'border-red-500/80 bg-red-950/30 text-red-300 ring-1 ring-red-500/40'
                          : 'border-red-400 bg-red-50 text-[#da251d] ring-1 ring-red-200'
                        : isDarkMode
                        ? 'border-[#2c374c] hover:border-red-500/50 text-slate-200 hover:text-red-300 bg-[#1e2738] hover:bg-[#253046]'
                        : 'border-slate-200 hover:border-red-300 text-slate-700 hover:text-[#da251d] bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className={`w-4 h-4 ${isMultiPaymentMode ? 'text-[#da251d]' : isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
                      <span>Thanh toán nhiều phương thức</span>
                    </div>
                    {isMultiPaymentMode ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#da251d] text-white shadow-2xs">
                        {Object.keys(splitAmounts).length} PT (Chạm để sửa)
                      </span>
                    ) : (
                      <ChevronRight className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                    )}
                  </button>

                  {isMultiPaymentMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiPaymentMode(false);
                        const firstCode = Object.keys(splitAmounts)[0] || selectedMethodCode;
                        setSelectedMethodCode(firstCode);
                        setSplitAmounts({ [firstCode]: grandTotal });
                        setIsQrGenerated(false);
                        toast('Đã quay lại thanh toán 1 phương thức');
                      }}
                      className="w-full py-1 text-center text-[11px] font-semibold transition-colors cursor-pointer text-slate-500 hover:text-[#da251d] underline"
                    >
                      Quay lại thanh toán 1 phương thức
                    </button>
                  )}
                </div>
              </div>

              {/* VAT Invoice Request Section */}
              <div className={`p-3 rounded-xl border space-y-2 ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-100' : 'bg-gray-50/80 border-gray-200 text-gray-800'
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`font-bold flex items-center gap-1.5 cursor-pointer ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                    <Building2 className="w-3.5 h-3.5 text-[#da251d]" />
                    <span>Khách yêu cầu xuất hóa đơn</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsInvoiceRequested(!isInvoiceRequested)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      isInvoiceRequested ? 'bg-[#da251d]' : isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isInvoiceRequested ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isInvoiceRequested && (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={invoiceTaxCode}
                          onChange={(e) => setInvoiceTaxCode(e.target.value)}
                          placeholder="Mã số thuế..."
                          className={`flex-1 px-2.5 py-1.5 rounded-lg outline-none focus:border-[#da251d] text-xs font-mono font-bold border ${
                            isDarkMode
                              ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                          }`}
                        />
                        <button
                          type="button"
                          disabled={isLookingUpTax || !invoiceTaxCode.trim()}
                          onClick={handleLookupTax}
                          className="px-2.5 py-1.5 bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-bold text-[11px] flex items-center justify-center transition-colors cursor-pointer shadow-xs shrink-0 min-w-[32px]"
                          title="Tra cứu thông tin công ty bằng MST"
                        >
                          {isLookingUpTax ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={invoiceCompanyName}
                        onChange={(e) => setInvoiceCompanyName(e.target.value)}
                        placeholder="Tên công ty / đơn vị..."
                        className={`w-full px-2.5 py-1.5 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium border ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={invoiceAddress}
                        onChange={(e) => setInvoiceAddress(e.target.value)}
                        placeholder="Địa chỉ công ty trên hóa đơn..."
                        className={`w-full px-2.5 py-1.5 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium border resize-y leading-relaxed ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>

                    <div>
                      <input
                        type="email"
                        value={invoiceEmail}
                        onChange={(e) => setInvoiceEmail(e.target.value)}
                        placeholder="Email nhận hóa đơn..."
                        className={`w-full px-2.5 py-1.5 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium border ${
                          isDarkMode
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400'
                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =========================================================================
              COLUMN 2 (Center: Subtotal, Sử dụng điểm, Cần thanh toán, Khách trả, Tiền thừa)
              ========================================================================= */}
          <div className={`${
            fullscreen
              ? 'space-y-3 bg-white dark:bg-[#181f2c] p-3 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-[#2c374c]'
              : 'p-3 sm:p-4 space-y-3 overflow-y-auto flex flex-col justify-between'
          } ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-gray-900'}`}>
            <div className="space-y-3">
              {/* Box 1: Tổng tiền */}
              <div className={`p-3 rounded-xl border flex justify-between items-center ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-gray-50/90 border-gray-200 text-gray-700'
              }`}>
                <span className="font-semibold text-xs">
                  Tổng tiền ({cartItems.reduce((s, it) => s + it.quantity, 0)} món)
                </span>
                <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {itemsSubTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>

              {/* Box 2: Sử dụng điểm - Chỉ hiển thị khi chi nhánh cho phép quy đổi trực tiếp */}
              {isBranchDirectDiscountAllowed && (
                <div className={`p-3 rounded-xl border space-y-2 ${
                  isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-gray-50/90 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-semibold text-xs block ${isDarkMode ? 'text-slate-200' : 'text-gray-700'}`}>Sử dụng điểm</span>
                    </div>
                    <button
                      type="button"
                      disabled={isCodeAlreadyCreated || !selectedMember || (selectedMember.points || 0) <= 0}
                      onClick={() => {
                        if (isCodeAlreadyCreated) {
                          toast.error('Đơn hàng đã tạo mã, giá trị đơn hàng không được phép thay đổi!');
                          return;
                        }
                        if (!isUsePointsEnabled) {
                          setIsUsePointsEnabled(true);
                          setPointsToUse(maxPointsUsable);
                        } else {
                          setIsUsePointsEnabled(false);
                          setPointsToUse(0);
                        }
                      }}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                        isCodeAlreadyCreated
                          ? 'opacity-40 cursor-not-allowed bg-gray-300 dark:bg-slate-700'
                          : 'cursor-pointer ' + (isUsePointsEnabled && selectedMember ? 'bg-[#da251d]' : 'bg-gray-300 dark:bg-slate-600')
                      }`}
                      title={isCodeAlreadyCreated ? 'Đơn hàng đã tạo mã, giá trị đơn hàng không được phép thay đổi' : 'Bật/tắt sử dụng điểm'}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          isUsePointsEnabled && selectedMember ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {isCodeAlreadyCreated && (
                    <div className="flex items-center gap-1.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 font-medium select-none">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Đơn đã tạo mã ({orderCodeDisplay}), không cho phép sử dụng điểm vì giá trị đơn hàng đã cố định!</span>
                    </div>
                  )}

                  <div className={`border-t border-dashed pt-2 text-[11px] ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    {!selectedMember ? (
                      customerName && customerName !== 'Khách lẻ' && customerName !== 'Khách tại bàn' && customerName !== 'Khách mang đi' ? (
                        <div className={`flex justify-between ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{customerName}</span>
                          <span className={`${isDarkMode ? 'text-slate-400' : 'text-gray-500'} italic`}>Khách hàng (chưa tích điểm)</span>
                        </div>
                      ) : (
                        <span className={`${isDarkMode ? 'text-slate-500' : 'text-gray-400'} italic`}>Chưa chọn khách hàng!</span>
                      )
                    ) : (
                      <div className="space-y-1.5">
                        <div className={`flex justify-between ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                          <span>Điểm khả dụng:</span>
                          <span className="font-bold text-amber-600">
                            <AvoraCoin amount={selectedMember.points || 0} size="xs" />
                          </span>
                        </div>
                        {isUsePointsEnabled && (
                          <div className="flex justify-between text-emerald-600 font-bold">
                            <span>Giảm bằng điểm (1 điểm = {branchLoyaltyRate}đ):</span>
                            <span>-{(pointsToUse * branchLoyaltyRate).toLocaleString('vi-VN')}đ</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order Discount */}
              {effectiveOrderDiscount > 0 && (
                <div className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                  isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <span className="font-medium">Giảm giá đơn:</span>
                  <span className="font-bold text-amber-500">-{effectiveOrderDiscount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              {/* Service Charge */}
              {serviceChargeTotal > 0 && (
                <div className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                  isDarkMode ? 'bg-blue-950/40 border-blue-800 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <span className="font-medium">Phụ thu dịch vụ:</span>
                  <span className="font-bold text-blue-400">+{serviceChargeTotal.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              {/* VAT Row */}
              {computedTaxAmount > 0 && (
                <div className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                  isVatIncluded
                    ? isDarkMode ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-gray-50 border-gray-200 text-gray-700'
                    : isDarkMode ? 'bg-orange-950/40 border-orange-800 text-orange-200' : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                  <span className="font-medium">
                    Thuế VAT ({avgTaxRate}%{isVatIncluded ? ' - đã gồm' : ''}):
                  </span>
                  <span className={`font-bold ${isVatIncluded ? (isDarkMode ? 'text-slate-200' : 'text-gray-700') : 'text-orange-500'}`}>
                    {isVatIncluded ? '' : '+'}{computedTaxAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}

              {/* Box 3: Cần thanh toán (AVORA Red Highlighted Card) */}
              <div className={`p-3.5 rounded-xl border flex justify-between items-center shadow-xs ${
                isDarkMode ? 'bg-red-950/40 border-red-900/60' : 'bg-red-50/70 border-red-200'
              }`}>
                <span className={`font-bold text-xs ${isDarkMode ? 'text-slate-100' : 'text-gray-900'}`}>Cần thanh toán</span>
                <span className="text-xl font-black text-[#da251d] tracking-tight">
                  {grandTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>

              {/* Box 4: Khách đưa */}
              <div className={`p-2.5 rounded-xl border flex justify-between items-center ${
                isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className={`font-semibold text-xs ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Khách đưa</span>
                  {isMultiPaymentMode && (
                    <button
                      type="button"
                      disabled={isOrderLockedByQr}
                      onClick={() => {
                        if (isOrderLockedByQr) {
                          toast.error('Đơn hàng đã tạo mã QR thanh toán, không thể thay đổi giá trị!', {
                            icon: <Lock className="w-4 h-4 text-amber-500" />,
                          });
                          return;
                        }
                        setIsMultiConfigModalOpen(true);
                      }}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isOrderLockedByQr
                          ? 'text-slate-500 cursor-not-allowed opacity-50'
                          : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                      }`}
                      title={isOrderLockedByQr ? 'Đơn đã tạo mã QR, không thể sửa' : 'Chỉnh sửa phân bổ thanh toán'}
                    >
                      {isOrderLockedByQr ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Edit3 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {isCashMethod && !isMultiPaymentMode ? (
                  <span className={`font-black text-sm font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {cashGiven.toLocaleString('vi-VN')}đ
                  </span>
                ) : (
                  <div className="text-right">
                    <span className={`font-black text-sm font-mono ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {isMultiPaymentMode ? totalAllocated.toLocaleString('vi-VN') : grandTotal.toLocaleString('vi-VN')}đ
                    </span>
                    {isMultiPaymentMode && (
                      <div className="text-[10px] text-blue-500 font-medium truncate max-w-[180px]">
                        {Object.entries(splitAmounts)
                          .filter(([_, a]) => (a || 0) > 0)
                          .map(([code]) => paymentMethods.find((m) => m.methodCode === code)?.name || code)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Box 5: Tiền thừa */}
              <div className={`px-2.5 py-2 flex justify-between items-center ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                <span className="font-semibold text-xs">
                  {isMultiPaymentMode && totalAllocated < grandTotal ? 'Còn thiếu' : 'Tiền thừa'}
                </span>
                {isMultiPaymentMode ? (
                  <span className={`font-black text-sm font-mono ${
                    totalAllocated === grandTotal
                      ? 'text-emerald-500'
                      : totalAllocated > grandTotal
                      ? 'text-emerald-500'
                      : 'text-rose-500'
                  }`}>
                    {totalAllocated === grandTotal
                      ? '0đ'
                      : totalAllocated > grandTotal
                      ? `+${(totalAllocated - grandTotal).toLocaleString('vi-VN')}đ`
                      : `-${(grandTotal - totalAllocated).toLocaleString('vi-VN')}đ`}
                  </span>
                ) : (
                  <span className="font-black text-sm text-emerald-500 font-mono">
                    {cashChange.toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* =========================================================================
              COLUMN 3 (Right: Bàn phím tiền mặt / VietQR Pro / Multi-Payment)
              ========================================================================= */}
          <div className={`${
            fullscreen
              ? 'space-y-3 bg-white dark:bg-[#181f2c] p-3 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-[#2c374c]'
              : 'p-3 sm:p-4 space-y-3 overflow-y-auto flex flex-col justify-between'
          } ${isDarkMode ? 'bg-[#181f2c] text-slate-100' : 'bg-slate-50/50 text-gray-900'}`}>
            {hasActiveQr ? (
              /* =========================================================
                 CASE 1: SEPAY / VIETQR PRO (Ảnh 2 & Ảnh 3 Sapo - Dù là 1 hay nhiều PT)
                 Sửa triệt để lỗi QR hiển thị không đúng: dùng chính xác qrAmount!
                 ========================================================= */
              <div className="space-y-3 flex flex-col items-center text-center pt-1">
                {/* QR Method Title Banner */}
                <div className={`w-full px-3 py-1.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  isDarkMode ? 'bg-[#1e2738] border-[#2c374c] text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-red-500" />
                    <span>{activeQrEntry?.method?.name || 'VietQR Chuyển khoản'}</span>
                  </div>
                  <span className="font-mono text-red-600 dark:text-red-400 font-black">
                    {qrAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>

                {/* State 1: Trước khi bấm "Tạo mã thanh toán" (Ảnh 3 Sapo) */}
                {!isQrGenerated ? (
                  <div className="w-full flex flex-col items-center space-y-2.5">
                    <div className={`relative w-48 h-48 rounded-2xl border flex items-center justify-center overflow-hidden shadow-inner ${
                      isDarkMode ? 'bg-[#141b27] border-[#2c374c]' : 'bg-slate-100 border-slate-200'
                    }`}>
                      {/* Ghosted blurred QR graphic */}
                      <div className="absolute inset-0 opacity-15 flex items-center justify-center filter blur-xs pointer-events-none">
                        <QrCode className={`w-40 h-40 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
                      </div>

                      {/* Prominent Centered Button: [ Tạo mã thanh toán ] (Y hệt SAPO) */}
                      <button
                        type="button"
                        onClick={handleGenerateQr}
                        className={`relative z-10 px-5 py-2.5 border-2 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer transform active:scale-95 flex items-center gap-1.5 ${
                          isDarkMode
                            ? 'bg-[#1e2738] hover:bg-[#253046] border-red-500 text-red-400 hover:text-white'
                            : 'bg-white hover:bg-red-50 border-[#da251d] text-[#da251d]'
                        }`}
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Tạo mã thanh toán</span>
                      </button>
                    </div>

                    <div className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                      Số tiền: <span className="font-black text-sm text-[#da251d] font-mono">{qrAmount.toLocaleString('vi-VN')}đ</span>
                    </div>

                    <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Bấm tạo mã để hiển thị mã VietQR chính xác số tiền cần chuyển.
                    </p>
                  </div>
                ) : (
                  /* State 2: Sau khi bấm "Tạo mã thanh toán" (Đơn hàng bị KHÓA không được thay đổi) */
                  <div className="w-full flex flex-col items-center space-y-2">
                    {/* Real Sharp VietQR PNG Image rendered from SePay with exact qrAmount */}
                    <div className="p-2.5 bg-white rounded-2xl border border-gray-200 shadow-md inline-block">
                      <img
                        src={sepayQrUrl}
                        alt="VietQR Chuyển Khoản"
                        className="w-44 h-44 object-contain mx-auto"
                        loading="eager"
                      />
                    </div>

                    <div className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-gray-800'}`}>
                      Số tiền: <span className="font-black text-base text-[#da251d] font-mono">{qrAmount.toLocaleString('vi-VN')}đ</span>
                    </div>

                    {/* Expiration Countdown */}
                    <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                      Mã sẽ hết hạn sau <span className="text-[#da251d] font-black font-mono">{countdown}</span> giây
                    </div>

                    {/* Action Button: In tạm tính & mã QR */}
                    <button
                      type="button"
                      onClick={handlePrintTempBillWithQr}
                      disabled={isPrintingTempBill}
                      className={`w-full py-2 px-3 border rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50 ${
                        isDarkMode
                          ? 'border-[#2c374c] bg-[#1e2738] hover:bg-[#253046] text-red-400'
                          : 'border-red-200 bg-white hover:bg-red-50 text-[#da251d]'
                      }`}
                    >
                      {isPrintingTempBill ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5" />
                      )}
                      <span>{isPrintingTempBill ? 'Đang gửi lệnh in...' : 'In tạm tính & mã QR'}</span>
                    </button>

                    {/* Feature 2: Anti-Fake Bill Verifier Button */}
                    <button
                      type="button"
                      disabled={isScanningBank}
                      onClick={handleTriggerBankScan}
                      className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-98 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-60"
                      title="Yêu cầu điện thoại AVORA Bank Connect quét ngay các thông báo ngân hàng đang có trên thanh trạng thái"
                    >
                      {isScanningBank ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>ĐANG QUÉT THÔNG BÁO NGÂN HÀNG ({scanCountdown}s)...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>CHƯA THẤY TIỀN? BẤM KIỂM TRA NÓNG</span>
                        </>
                      )}
                    </button>

                    {/* Scan Warning Banner if not found */}
                    {scanWarning && (
                      <div className="w-full p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-left space-y-1.5 animate-in fade-in duration-200">
                        <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-black text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{scanWarning.message}</span>
                        </div>
                        <p className="text-[11px] text-rose-800/90 dark:text-rose-300 leading-relaxed font-medium">
                          Gateway chưa nhận được thông báo biến động số dư khớp với số tiền <strong>{qrAmount.toLocaleString('vi-VN')}đ</strong>. Vui lòng đối chiếu với khách hàng.
                        </p>
                        {scanWarning.gatewayInfo && (
                          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-rose-100 dark:border-rose-900/50">
                            {scanWarning.gatewayInfo}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Nút Chờ xác nhận & Giải phóng bàn */}
                    <button
                      type="button"
                      onClick={handleMoveToAwaitingAndReleaseTable}
                      disabled={isMovingToAwaiting}
                      className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {isMovingToAwaiting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>Chờ xác nhận & Giải phóng bàn</span>
                    </button>

                    {/* Action buttons: Hủy mã để sửa đơn & Tạo lại mã */}
                    <div className="flex items-center justify-between w-full pt-1 px-1 text-xs">
                      <button
                        type="button"
                        onClick={handleCancelQrCode}
                        className="text-amber-500 hover:text-amber-600 font-bold flex items-center gap-1 cursor-pointer"
                        title="Hủy mã để cho phép chỉnh sửa lại món, điểm hoặc phương thức"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Hủy mã để sửa đơn</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRegenerateQr}
                        className="text-[#da251d] hover:underline font-bold cursor-pointer"
                      >
                        Làm mới mã QR
                      </button>
                    </div>
                  </div>
                )}

                {/* Sapo-Style Instructions for Buyer */}
                <div className={`w-full text-left pt-2 border-t space-y-1 text-[11px] ${
                  isDarkMode ? 'border-[#2c374c] text-slate-300' : 'border-slate-200 text-gray-600'
                }`}>
                  <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                    Hướng dẫn thanh toán cho người mua
                  </div>
                  <div>Bước 1: Mở ứng dụng thanh toán</div>
                  <div>Bước 2: Chọn thanh toán và quét mã QR</div>
                  <div>Bước 3: Hoàn thành thanh toán theo hướng dẫn</div>
                </div>

                {/* Sapo-Style Warning Alert Box */}
                <div className="w-full p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/80 text-left text-amber-900 dark:text-amber-200 text-[10px] space-y-1 leading-relaxed">
                  <div className="flex items-start gap-1">
                    <span className="shrink-0">•</span>
                    <span>Kiểm tra kỹ và không chỉnh sửa thông tin giao dịch khi thanh toán</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="shrink-0">•</span>
                    <span>Sau khi tạo mã QR, giá trị thanh toán sẽ không thể thay đổi.</span>
                  </div>
                </div>
              </div>
            ) : isMultiPaymentMode ? (
              /* =========================================================
                 CASE 2: MULTI-PAYMENT WITHOUT QR (e.g. Tiền mặt + Cà thẻ)
                 ========================================================= */
              <div className="space-y-3 flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-2.5">
                  <div className={`flex items-center justify-between pb-1.5 border-b ${isDarkMode ? 'border-[#2c374c]' : 'border-gray-200'}`}>
                    <span className={`font-bold text-xs flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <Layers className="w-4 h-4 text-blue-500" />
                      <span>Phân bổ nhiều phương thức</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMultiConfigModalOpen(true)}
                      className="text-xs text-blue-500 hover:underline font-bold cursor-pointer"
                    >
                      Sửa phân bổ
                    </button>
                  </div>

                  {/* Summary progress */}
                  <div className={`p-3 rounded-xl space-y-1 text-xs border ${
                    isDarkMode ? 'bg-[#1e2738] border-[#2c374c] text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Cần thanh toán:</span>
                      <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{grandTotal.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Đã phân bổ:</span>
                      <span className="font-bold text-blue-500">{totalAllocated.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className={`flex justify-between pt-1 border-t font-bold ${isDarkMode ? 'border-[#2c374c]' : 'border-slate-200'}`}>
                      <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>Còn thiếu:</span>
                      <span className={multiRemainingNeeded === 0 ? 'text-emerald-500' : 'text-rose-500'}>
                        {multiRemainingNeeded === 0 ? 'Đã đủ tiền' : `${multiRemainingNeeded.toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>
                  </div>

                  {/* Allocated Methods Cards */}
                  <div className="space-y-1.5">
                    {Object.entries(splitAmounts)
                      .filter(([_, amt]) => (amt || 0) > 0)
                      .map(([code, amt]) => {
                        const m = paymentMethods.find((pm) => pm.methodCode === code);
                        return (
                          <div
                            key={code}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                              isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-white border-slate-200'
                            }`}
                          >
                            <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {m?.name || code}
                            </span>
                            <span className="font-mono font-bold text-blue-500">
                              {amt.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Cash given & change if Cash is in the split */}
                  {splitAmounts['COD'] || splitAmounts['CASH'] ? (
                    <div className={`p-2.5 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-emerald-50/50 border-emerald-200'
                    }`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <Banknote className="w-4 h-4" />
                          <span>Phần tiền mặt:</span>
                        </span>
                        <span className="font-mono font-bold">
                          {((splitAmounts['COD'] || 0) + (splitAmounts['CASH'] || 0)).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Khách đưa:</span>
                        <span className="font-bold font-mono">{cashGiven.toLocaleString('vi-VN')}đ</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">Tiền thừa:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                          {Math.max(0, cashGiven - ((splitAmounts['COD'] || 0) + (splitAmounts['CASH'] || 0))).toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setIsMultiConfigModalOpen(true)}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Mở bảng chỉnh sửa phân bổ (Sapo)</span>
                </button>
              </div>
            ) : isCashMethod ? (
              /* =========================================================
                 CASE 3: CASH (TIỀN MẶT ĐƠN) - TOUCH NUMPAD
                 ========================================================= */
              <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className={`flex items-center justify-between pb-1.5 border-b ${
                    isDarkMode ? 'border-[#2c374c]' : 'border-gray-100'
                  }`}>
                    <span className={`font-bold text-xs flex items-center gap-1.5 ${
                      isDarkMode ? 'text-slate-200' : 'text-gray-800'
                    }`}>
                      <Banknote className="w-4 h-4 text-emerald-500" />
                      <span>Thông tin tiền mặt</span>
                    </span>
                    <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>AVORA POS</span>
                  </div>

                  {/* Cash Given & Change Displays */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className={`p-2.5 rounded-xl border ${
                      isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] block font-bold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Khách đưa:</span>
                        <button
                          type="button"
                          onClick={() => setCashGivenStr(grandTotal.toString())}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#da251d]/10 text-[#da251d] hover:bg-[#da251d]/20 transition-colors"
                        >
                          Đủ tiền
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cashGivenStr ? Number(cashGivenStr).toLocaleString('vi-VN') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setCashGivenStr(raw);
                          }}
                          placeholder="0"
                          className={`w-full text-right text-base font-black font-mono pr-5 py-1 rounded-lg border outline-none focus:border-[#da251d] ${
                            isDarkMode ? 'bg-[#181f2c] border-[#2c374c] text-white' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                          đ
                        </span>
                      </div>
                    </div>

                    <div className={`p-2.5 rounded-xl border text-right flex flex-col justify-between ${
                      isDarkMode ? 'bg-emerald-950/40 border-emerald-900/60' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold">Tiền thừa:</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {cashChange.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* For POS Desktop (!fullscreen): Full Touch Numpad + Quick Presets */}
                  {!fullscreen ? (
                    <div className="space-y-1.5 pt-1">
                      {/* Quick Cash Presets */}
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { label: 'Đúng số tiền', val: grandTotal },
                          { label: '100.000', val: 100000 },
                          { label: '200.000', val: 200000 },
                          { label: '500.000', val: 500000 },
                          { label: '1.000.000', val: 1000000 },
                          { label: '2.000.000', val: 2000000 },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setCashGivenStr(p.val.toString())}
                            className={`h-8 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                              p.val === cashGiven
                                ? isDarkMode ? 'bg-red-950/50 border-[#da251d] text-red-400' : 'bg-red-50 border-[#da251d] text-[#da251d]'
                                : isDarkMode ? 'bg-[#1e2738] border-[#2c374c] text-slate-200 hover:bg-[#253046]' : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {/* Touch Numpad (Cash Keypad) - 100% trả lại cho /admin/pos */}
                      <div className="grid grid-cols-3 gap-1 pt-1">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '000', 'DEL'].map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => handleNumpadPress(k)}
                            className={`h-9 rounded-xl font-mono font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                              k === 'C'
                                ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                                : k === 'DEL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : k === '000'
                                ? 'bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200'
                                : isDarkMode
                                ? 'bg-[#1e2738] text-slate-200 border border-[#2c374c] hover:bg-[#253046]'
                                : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-100'
                            } ${k === 'DEL' ? 'col-span-1' : ''}`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Fullscreen Waiter POS mode: Compact Quick Cash Presets without the numpad grid */
                    <div className="space-y-1">
                      <span className={`text-[10px] font-bold block ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Mệnh giá nhanh:</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { label: 'Đủ tiền', val: grandTotal },
                          { label: '50k', val: 50000 },
                          { label: '100k', val: 100000 },
                          { label: '200k', val: 200000 },
                          { label: '500k', val: 500000 },
                          { label: '1.000k', val: 1000000 },
                          { label: '2.000k', val: 2000000 },
                          { label: 'Xóa', val: 0 },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setCashGivenStr(p.val === 0 ? '' : p.val.toString())}
                            className={`py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              p.val !== 0 && p.val === cashGiven
                                ? isDarkMode ? 'bg-red-950/50 border-[#da251d] text-red-400' : 'bg-red-50 border-[#da251d] text-[#da251d]'
                                : isDarkMode ? 'bg-[#1e2738] border-[#2c374c] text-slate-200 hover:bg-[#253046]' : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Other Generic Methods (Card, Wallet, etc.) */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                  isDarkMode ? 'bg-blue-950/50 text-blue-400' : 'bg-red-50 text-[#da251d]'
                }`}>
                  <CreditCard className="w-8 h-8" />
                </div>
                <h4 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Thanh toán: {currentMethod?.name}
                </h4>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  Thực hiện thanh toán qua thiết bị POS hoặc cổng thanh toán.
                </p>
                <div className={`p-3 rounded-xl border text-xs w-full text-left space-y-1 ${
                  isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-400' : 'text-gray-500'}>Cần thu:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{grandTotal.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            BOTTOM BAR (AVORA RED BRAND ACCENT)
            - Multi-method / Cash: Active Red Bar "XÁC NHẬN THANH TOÁN (F8)"
            - SePay: Disabled Red-Rose Bar "CHỜ XÁC NHẬN TỰ ĐỘNG"
            ========================================================================= */}
        <div className={`shrink-0 border-t ${
          fullscreen ? 'pb-[max(18px,calc(env(safe-area-inset-bottom)+10px))] select-none touch-none overscroll-none' : ''
        } ${isDarkMode ? 'bg-[#1e2738] border-[#2c374c]' : 'bg-white border-slate-200'}`}>
          {hasActiveQr && isQrGenerated ? (
            /* Khi đã tạo mã QR: Thanh trạng thái chờ xác nhận tự động + Nút xác nhận thủ công F8 */
            <div className={`flex flex-col sm:flex-row gap-2 p-2.5 ${
              isDarkMode ? 'bg-[#1e2738]' : 'bg-slate-50'
            }`}>
              <button
                type="button"
                disabled
                className="flex-1 bg-gradient-to-r from-[#da251d] to-rose-700 text-white py-3 px-4 font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-95 rounded-xl shadow-xs"
              >
                {sepayStatus === 'PAID' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
                    <span>ĐÃ NHẬN TIỀN - ĐANG HOÀN TẤT...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    <span>CHỜ XÁC NHẬN TỰ ĐỘNG NGÂN HÀNG (F2)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isMovingToAwaiting || !cartItems?.length}
                onClick={handleMoveToAwaitingAndReleaseTable}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white py-3 px-4 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer shadow-md shrink-0"
                title="Giải phóng bàn ngay để đón khách mới, đơn chuyển vào tab Chờ xác nhận"
              >
                {isMovingToAwaiting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Chờ xác nhận & Giải phóng bàn</span>
              </button>
            </div>
          ) : isMultiPaymentMode ? (
            /* Nhiều phương thức chưa tạo QR hoặc không có QR */
            <button
              type="button"
              disabled={isProcessing || !cartItems?.length || totalAllocated < grandTotal}
              onClick={() => handleFinalSubmit()}
              className="w-full bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-300 dark:disabled:bg-slate-800 disabled:text-gray-500 text-white py-3.5 px-4 font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-99 shadow-md"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3]" />
              )}
              <span>
                {!cartItems?.length
                  ? 'ĐƠN HÀNG TRỐNG (0 MÓN)'
                  : totalAllocated < grandTotal
                  ? `CÒN THIẾU ${(grandTotal - totalAllocated).toLocaleString('vi-VN')}đ (F8)`
                  : `XÁC NHẬN THANH TOÁN NHIỀU PHƯƠNG THỨC (${totalAllocated.toLocaleString('vi-VN')}đ) (F8)`}
              </span>
            </button>
          ) : (
            /* Phương thức đơn tiền mặt / thẻ thông thường */
            <button
              type="button"
              disabled={isProcessing || !cartItems?.length || (isCashMethod && cashGiven < grandTotal)}
              onClick={() => handleFinalSubmit()}
              className="w-full bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-300 dark:disabled:bg-slate-800 disabled:text-gray-500 text-white py-3.5 px-4 font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-99 shadow-md"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3]" />
              )}
              <span>{!cartItems?.length ? 'ĐƠN HÀNG TRỐNG (0 MÓN)' : 'XÁC NHẬN THANH TOÁN (F8)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sapo-Style Multi Payment Configuration Modal */}
      <MultiPaymentModal
        isOpen={isMultiConfigModalOpen}
        onClose={() => setIsMultiConfigModalOpen(false)}
        grandTotal={grandTotal}
        paymentMethods={paymentMethods}
        initialSplitAmounts={splitAmounts}
        isDarkMode={isDarkMode}
        onApply={(newSplits) => {
          setSplitAmounts(newSplits);
          setIsMultiPaymentMode(true);
          setIsQrGenerated(false);
          setSepayStatus('WAITING');
          toast.success('Đã áp dụng phân bổ nhiều phương thức thanh toán!');
        }}
      />

      {/* Quick Add Customer Modal */}
      {isCreateCustomerOpen && (
        <CreateCustomerModal
          onClose={() => setIsCreateCustomerOpen(false)}
          isDarkMode={isDarkMode}
          onSuccess={(newMember) => {
            handleSelectMember(newMember);
          }}
        />
      )}

      {/* Edit Customer VAT Info Modal */}
      {isEditCustomerVatOpen && selectedMember && (
        <EditCustomerVatModal
          customer={selectedMember}
          isDarkMode={isDarkMode}
          onClose={() => setIsEditCustomerVatOpen(false)}
          onSuccess={(updated) => {
            setSelectedMember(updated);
            if (updated.taxCode) setInvoiceTaxCode(updated.taxCode);
            if (updated.companyName) setInvoiceCompanyName(updated.companyName);
            if (updated.taxAddress) setInvoiceAddress(updated.taxAddress);
            if (updated.invoiceEmail) setInvoiceEmail(updated.invoiceEmail);
            if (updated.taxCode || updated.companyName) setIsInvoiceRequested(true);
            if (onCustomerUpdated) onCustomerUpdated(updated);
          }}
        />
      )}
    </div>
  );
};
