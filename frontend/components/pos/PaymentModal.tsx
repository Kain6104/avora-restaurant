"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { printAgent } from '@/lib/print-agent';
import { PosCartItem, PosTable, PosOrder } from './pos-types';
import { PosDeliveryInfo } from './DeliveryAddressModal';
import { CreateCustomerModal } from './CreateCustomerModal';
import { EditCustomerVatModal } from './EditCustomerVatModal';

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
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  order,
  table,
  cartItems,
  guestCount,
  orderDiscount,
  deliveryAddress,
  orderType = 'DINE_IN',
  initialMember = null,
  customerName = '',
  customerPhone = '',
  onClose,
  onCustomerUpdated,
  onProcessPayment,
  isProcessing = false,
  onPrintTempBill,
  receiptPrinterName,
  paperSize = '80mm',
  vatPriceMode = 'VAT_EXCLUDED',
  branch,
}) => {
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
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  const [multiSecondMethodCode, setMultiSecondMethodCode] = useState<string>('SEPAY_QR');
  const [isMultiSepayQrGenerated, setIsMultiSepayQrGenerated] = useState(false);

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
    (order as any)?.vatPriceModeSnapshot || vatPriceMode || 'VAT_EXCLUDED';
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
            // Default to first active method
            setSelectedMethodCode(json.data[0].methodCode);
            // Initialize multi-payment allocation
            setSplitAmounts({ [json.data[0].methodCode]: grandTotal });
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
    if (isQrGenerated && isSepayMethod && !isMultiPaymentMode) {
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
  }, [isQrGenerated, isSepayMethod, isMultiPaymentMode]);

  const handleGenerateQr = () => {
    setIsQrGenerated(true);
    setCountdown(300);
    setSepayStatus('WAITING');
    toast.success('Đã tạo mã VietQR thanh toán!', {
      icon: <QrCode className="w-4 h-4 text-blue-500" />,
    });
  };

  const handleRegenerateQr = () => {
    setCountdown(300);
    setSepayStatus('WAITING');
    toast.success('Đã làm mới mã thanh toán!');
  };

  // SePay QR Image Parameters
  const bankCode = currentMethod?.bankCode || 'OCB';
  const accountNumber = currentMethod?.accountNumber || 'SEPSUSHIWA';
  const orderCodeForQr = order?.orderCode || 'POS';
  // Real PNG image generated by SePay
  const sepayQrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(accountNumber)}&bank=${encodeURIComponent(bankCode)}&amount=${grandTotal}&des=${encodeURIComponent(orderCodeForQr)}`;

  const [isPrintingTempBill, setIsPrintingTempBill] = useState(false);

  const handlePrintTempBillWithQr = async () => {
    if (!order?.id) {
      toast.error('Chưa có thông tin đơn hàng để in tạm tính');
      return;
    }
    setIsPrintingTempBill(true);
    const toastId = toast.loading('Đang gửi lệnh in tạm tính & mã QR...');
    try {
      if (onPrintTempBill) {
        toast.dismiss(toastId);
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
      const targetPrinter = receiptPrinterName || 'Xprinter XP-350B';
      const isOnline = await printAgent.checkHealth().catch(() => false);

      if (isOnline) {
        const agentRes = await printAgent.printHtml({
          printerName: targetPrinter,
          htmlContent: html,
          paperSize: paperSize || '80mm',
          copies: 1,
          idempotencyKey: `tempbill-qr-${order.id}-${Date.now()}`,
        });

        if (agentRes.success) {
          toast.success(`Đã in phiếu tạm tính & mã QR tới máy in [${targetPrinter}]!`, {
            id: toastId,
            icon: <Printer className="w-4 h-4 text-emerald-500" />,
          });
          return;
        }
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 2000);
      };
      toast.success('Đã gửi lệnh in tạm tính qua trình duyệt!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Không thể in phiếu tạm tính & mã QR', { id: toastId });
    } finally {
      setIsPrintingTempBill(false);
    }
  };

  // Final Submit
  const handleFinalSubmit = useCallback(async (transactionRefArg?: string) => {
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

  // SePay Polling
  const checkSepayStatus = useCallback(async () => {
    const orderCodeToCheck = order?.orderCode;
    if (!orderCodeToCheck || !isQrGenerated) return;

    try {
      const res = await fetch(`${baseUrl}/api/payment/check-status/${orderCodeToCheck}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isPaid) {
          setSepayStatus('PAID');
          setSepayTxCode(data.transactionCode || '');
          toast.success('SePay: Đã nhận chuyển khoản thành công!', {
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            duration: 4000,
          });

          // Auto-trigger completion
          setTimeout(() => {
            handleFinalSubmit(data.transactionCode);
          }, 800);
        }
      }
    } catch (err) {
      console.error('Polling SePay status error:', err);
    }
  }, [baseUrl, order?.orderCode, isQrGenerated, handleFinalSubmit]);

  useEffect(() => {
    if (isSepayMethod && isQrGenerated && order?.orderCode && sepayStatus !== 'PAID' && !isMultiPaymentMode) {
      pollTimerRef.current = setInterval(checkSepayStatus, 2500);
      return () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      };
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [isSepayMethod, isQrGenerated, order?.orderCode, sepayStatus, checkSepayStatus, isMultiPaymentMode]);

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

  const headerTitle =
    orderType === 'DELIVERY'
      ? `Thanh toán - Giao hàng: ${deliveryAddress?.customerName || 'Khách giao'}`
      : orderType === 'TAKEAWAY'
      ? 'Thanh toán - Đơn mang đi'
      : `Thanh toán- ${table ? table.name : order?.table?.name || 'Bàn - 1'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* =========================================================================
            HEADER (AVORA RED BRAND ACCENT)
            ========================================================================= */}
        <div className="px-6 py-3.5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0 relative">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#da251d] text-white flex items-center justify-center font-bold shadow-xs">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">AVORA POS</span>
          </div>

          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900 text-center tracking-tight">
              {headerTitle}
            </h2>
            {orderCodeDisplay && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
                #{orderCodeDisplay}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* =========================================================================
            BODY: 3-COLUMN ADAPTIVE LAYOUT (Supports 768px-1024px and 967px side-by-side)
            ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-200 min-h-0 text-xs">
          {/* =========================================================================
              COLUMN 1 (Left: Customer Search + Tier, + Thêm KH, Dynamic PTTT, Multi-Method)
              ========================================================================= */}
          <div className="p-3 sm:p-4 space-y-3.5 overflow-y-auto bg-white flex flex-col justify-between">
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
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#da251d] focus:bg-white text-xs font-medium placeholder-gray-400 transition-all"
                    />
                  </div>

                  {/* Dropdown Search Results with Membership Tiers */}
                  {memberSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-30 max-h-52 overflow-y-auto">
                      {memberSearchResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectMember(m)}
                          className="w-full text-left px-3 py-2 hover:bg-red-50/60 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 cursor-pointer"
                        >
                          <div>
                            <div className="font-bold text-gray-800">{m.fullName}</div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {m.phone || 'Chưa có SĐT'} {m.memberCode && `• ${m.memberCode}`}
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            {renderTierBadge(m.membershipTier)}
                            <div className="text-[10px] font-bold text-amber-600">
                              {m.points?.toLocaleString('vi-VN')} điểm
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Member Display Card with Prominent Membership Tier */}
                {selectedMember ? (
                  <div className="p-3 rounded-xl bg-red-50/40 border border-red-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                          <span>{selectedMember.fullName}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">
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

                    <div className="flex items-center justify-between pt-1 border-t border-red-200/60">
                      <span className="text-[11px] text-gray-600">Hạng khách hàng:</span>
                      {renderTierBadge(selectedMember.membershipTier)}
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-600">Điểm tích lũy:</span>
                      <span className="font-extrabold text-amber-700">
                        {selectedMember.points?.toLocaleString('vi-VN')} điểm
                      </span>
                    </div>

                    {/* VAT Info and Edit VAT Button */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-red-200/60">
                      <div className="text-[10px] text-gray-600 truncate max-w-[170px]">
                        {selectedMember.taxCode ? (
                          <span className="font-mono text-slate-700 font-semibold">MST: {selectedMember.taxCode}</span>
                        ) : (
                          <span className="text-gray-400 italic">Chưa có thông tin VAT</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditCustomerVatOpen(true)}
                        className="px-2 py-0.5 bg-white hover:bg-red-100 border border-red-300 text-[#da251d] rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Chỉ cho phép sửa/thêm thông tin xuất hóa đơn VAT"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Sửa thông tin VAT</span>
                      </button>
                    </div>
                  </div>
                ) : customerName && customerName !== 'Khách lẻ' && customerName !== 'Khách tại bàn' && customerName !== 'Khách mang đi' ? (
                  <div className="p-3 rounded-xl bg-red-50/40 border border-red-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-900 text-xs">{customerName}</div>
                        {customerPhone && (
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            {customerPhone}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        Khách hàng
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Button: + Thêm khách hàng (Opens CreateCustomerModal) */}
                <button
                  type="button"
                  onClick={() => setIsCreateCustomerOpen(true)}
                  className="w-full py-2 px-3 border border-dashed border-red-300 hover:border-[#da251d] hover:bg-red-50/50 rounded-lg text-[#da251d] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Thêm khách hàng</span>
                </button>
              </div>

              {/* DYNAMIC PAYMENT METHODS FROM DATABASE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-xs">Phương thức thanh toán</span>
                  {isLoadingMethods && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Đồng bộ DB...
                    </span>
                  )}
                </div>

                {/* Render methods mapping directly from database */}
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => {
                    const isSelected = !isMultiPaymentMode && selectedMethodCode === method.methodCode;
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
                          setIsMultiPaymentMode(false);
                          setSelectedMethodCode(method.methodCode);
                          setIsQrGenerated(false);
                          setSepayStatus('WAITING');
                        }}
                        className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer min-h-[68px] ${
                          isSelected
                            ? 'border-[#da251d] bg-red-50/50 text-[#da251d] ring-1 ring-[#da251d] shadow-2xs font-bold'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {/* Red checkmark badge top-right when selected */}
                        {isSelected && (
                          <div className="absolute top-0 right-0 w-4 h-4 bg-[#da251d] rounded-bl-lg rounded-tr-xl flex items-center justify-center text-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}

                        <div className="mb-1 flex items-center justify-center">
                          {isCash ? (
                            <Banknote className={`w-5 h-5 ${isSelected ? 'text-[#da251d]' : 'text-emerald-600'}`} />
                          ) : isSepay ? (
                            <div className="flex items-center gap-1">
                              <QrCode className={`w-4 h-4 ${isSelected ? 'text-[#da251d]' : 'text-red-600'}`} />
                              <span className="text-[10px] font-black tracking-tight text-gray-900">
                                {method.bankCode || 'VIETQR'}
                              </span>
                            </div>
                          ) : (
                            <CreditCard className={`w-5 h-5 ${isSelected ? 'text-[#da251d]' : 'text-blue-600'}`} />
                          )}
                        </div>

                        <span className="text-xs leading-tight line-clamp-2 px-1">
                          {method.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Button: Thanh toán nhiều phương thức */}
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !isMultiPaymentMode;
                    setIsMultiPaymentMode(nextMode);
                    if (nextMode) {
                      const m1 = selectedMethodCode || paymentMethods[0]?.methodCode || 'COD';
                      const candidate2 =
                        paymentMethods.find(
                          (m) =>
                            m.methodCode !== m1 &&
                            (m.gatewayType === 'SEPAY' ||
                              m.methodCode.includes('SEPAY') ||
                              m.methodCode.includes('TRANSFER'))
                        ) ||
                        paymentMethods.find((m) => m.methodCode !== m1) ||
                        paymentMethods[1] ||
                        paymentMethods[0];
                      const m2 = candidate2 ? candidate2.methodCode : 'SEPAY_QR';
                      setMultiSecondMethodCode(m2);
                      const half = Math.floor(grandTotal / 2);
                      setSplitAmounts({
                        [m1]: half,
                        [m2]: grandTotal - half,
                      });
                      setIsMultiSepayQrGenerated(false);
                      toast('Chế độ thanh toán 2 phương thức');
                    }
                  }}
                  className={`w-full py-2 px-3 rounded-lg border font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isMultiPaymentMode
                      ? 'border-[#da251d] bg-red-50 text-[#da251d]'
                      : 'border-gray-200 hover:border-red-300 text-gray-700 hover:text-[#da251d] bg-white'
                  }`}
                >
                  {isMultiPaymentMode ? (
                    <>
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Quay lại thanh toán 1 phương thức</span>
                    </>
                  ) : (
                    <>
                      <Layers className="w-3.5 h-3.5 text-[#da251d]" />
                      <span>Thanh toán nhiều phương thức</span>
                    </>
                  )}
                </button>
              </div>

              {/* VAT Invoice Request Section */}
              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-800 flex items-center gap-1.5 cursor-pointer">
                    <Building2 className="w-3.5 h-3.5 text-[#da251d]" />
                    <span>Khách yêu cầu xuất hóa đơn</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsInvoiceRequested(!isInvoiceRequested)}
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                      isInvoiceRequested ? 'bg-[#da251d]' : 'bg-gray-300'
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
                          className="flex-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-mono font-bold"
                        />
                        <button
                          type="button"
                          disabled={isLookingUpTax || !invoiceTaxCode.trim()}
                          onClick={handleLookupTax}
                          className="px-2.5 py-1.5 bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs shrink-0"
                          title="Tìm kiếm nhanh thông tin công ty bằng MST"
                        >
                          {isLookingUpTax ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Search className="w-3.5 h-3.5" />
                          )}
                          <span>Tìm kiếm nhanh MST</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={invoiceCompanyName}
                        onChange={(e) => setInvoiceCompanyName(e.target.value)}
                        placeholder="Tên công ty / đơn vị..."
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={invoiceAddress}
                        onChange={(e) => setInvoiceAddress(e.target.value)}
                        placeholder="Địa chỉ công ty trên hóa đơn..."
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium"
                      />
                    </div>

                    <div>
                      <input
                        type="email"
                        value={invoiceEmail}
                        onChange={(e) => setInvoiceEmail(e.target.value)}
                        placeholder="Email nhận hóa đơn..."
                        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium"
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
          <div className="p-3 sm:p-4 space-y-3 overflow-y-auto bg-white flex flex-col justify-between">
            <div className="space-y-3">
              {/* Box 1: Tổng tiền */}
              <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 flex justify-between items-center">
                <span className="font-semibold text-gray-700 text-xs">
                  Tổng tiền ({cartItems.reduce((s, it) => s + it.quantity, 0)} món)
                </span>
                <span className="font-bold text-gray-900 text-sm">
                  {itemsSubTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>

              {/* Box 2: Sử dụng điểm - Chỉ hiển thị khi chi nhánh cho phép quy đổi trực tiếp */}
              {isBranchDirectDiscountAllowed && (
                <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-700 text-xs block">Sử dụng điểm</span>
                    </div>
                    <button
                      type="button"
                      disabled={!selectedMember || (selectedMember.points || 0) <= 0}
                      onClick={() => {
                        if (!isUsePointsEnabled) {
                          setIsUsePointsEnabled(true);
                          setPointsToUse(maxPointsUsable);
                        } else {
                          setIsUsePointsEnabled(false);
                          setPointsToUse(0);
                        }
                      }}
                      className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                        isUsePointsEnabled && selectedMember ? 'bg-[#da251d]' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          isUsePointsEnabled && selectedMember ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-2 text-[11px]">
                    {!selectedMember ? (
                      customerName && customerName !== 'Khách lẻ' && customerName !== 'Khách tại bàn' && customerName !== 'Khách mang đi' ? (
                        <div className="flex justify-between text-gray-600">
                          <span className="font-bold text-gray-800">{customerName}</span>
                          <span className="text-gray-500 italic">Khách hàng (chưa tích điểm)</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Chưa chọn khách hàng!</span>
                      )
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-gray-600">
                          <span>Điểm khả dụng:</span>
                          <span className="font-bold text-amber-600">
                            {selectedMember.points?.toLocaleString('vi-VN')} điểm
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
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
                  <span className="text-amber-800 font-medium">Giảm giá đơn:</span>
                  <span className="font-bold text-amber-700">-{effectiveOrderDiscount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              {/* Service Charge */}
              {serviceChargeTotal > 0 && (
                <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 flex justify-between items-center text-xs">
                  <span className="text-blue-800 font-medium">Phụ thu dịch vụ:</span>
                  <span className="font-bold text-blue-700">+{serviceChargeTotal.toLocaleString('vi-VN')}đ</span>
                </div>
              )}

              {/* VAT Row */}
              {computedTaxAmount > 0 && (
                <div className={`p-2.5 rounded-xl border flex justify-between items-center text-xs ${
                  isVatIncluded ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                  <span className="font-medium">
                    Thuế VAT ({avgTaxRate}%{isVatIncluded ? ' - đã gồm' : ''}):
                  </span>
                  <span className={`font-bold ${isVatIncluded ? 'text-gray-700' : 'text-orange-700'}`}>
                    {isVatIncluded ? '' : '+'}{computedTaxAmount.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              )}

              {/* Box 3: Cần thanh toán (AVORA Red Highlighted Card) */}
              <div className="p-3.5 bg-red-50/70 rounded-xl border border-red-200 flex justify-between items-center shadow-xs">
                <span className="font-bold text-gray-900 text-xs">Cần thanh toán</span>
                <span className="text-xl font-black text-[#da251d] tracking-tight">
                  {grandTotal.toLocaleString('vi-VN')}đ
                </span>
              </div>

              {/* Box 4: Khách trả */}
              <div className="p-2.5 bg-white rounded-xl border border-gray-200 flex justify-between items-center">
                <span className="font-semibold text-gray-700 text-xs">Khách trả</span>
                {isCashMethod && !isMultiPaymentMode ? (
                  <span className="font-black text-sm text-gray-900 font-mono">
                    {cashGiven.toLocaleString('vi-VN')}đ
                  </span>
                ) : (
                  <span className="font-black text-sm text-gray-900 font-mono">
                    {isMultiPaymentMode ? totalAllocated.toLocaleString('vi-VN') : grandTotal.toLocaleString('vi-VN')}đ
                  </span>
                )}
              </div>

              {/* Box 5: Tiền thừa */}
              <div className="px-2.5 py-2 flex justify-between items-center text-gray-700">
                <span className="font-semibold text-xs">Tiền thừa</span>
                <span className="font-black text-sm text-emerald-600 font-mono">
                  {cashChange.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              COLUMN 3 (Right: Bàn phím tiền mặt / VietQR Pro / Multi-Payment)
              ========================================================================= */}
          <div className="p-3 sm:p-4 space-y-3 overflow-y-auto bg-slate-50/50 flex flex-col justify-between">
            {isMultiPaymentMode ? (
              /* =========================================================
                 CASE A: MULTI-PAYMENT ALLOCATION (Thanh toán nhiều phương thức)
                 ========================================================= */
              <div className="space-y-3 flex-1 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                    <span className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#da251d]" />
                      <span>Thanh toán 2 phương thức</span>
                    </span>
                    <span className="text-[10px] bg-red-100 text-[#da251d] px-2 py-0.5 rounded-full font-bold">
                      Nhiều phương thức
                    </span>
                  </div>

                  {/* Summary progress */}
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Cần thanh toán:</span>
                      <span className="font-bold text-gray-900">{grandTotal.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Đã phân bổ:</span>
                      <span className="font-bold text-[#da251d]">{totalAllocated.toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                      <span>Còn thiếu:</span>
                      <span className={multiRemainingNeeded === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {multiRemainingNeeded === 0 ? 'Đã đủ tiền' : `${multiRemainingNeeded.toLocaleString('vi-VN')}đ`}
                      </span>
                    </div>
                  </div>

                  {/* Method 1 Card */}
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800 flex items-center gap-1 truncate max-w-[170px]">
                        <span className="w-4 h-4 rounded-full bg-red-100 text-[#da251d] text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                        <span className="truncate">{currentMethod?.name || selectedMethodCode}</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const half = Math.floor(grandTotal / 2);
                            setSplitAmounts((prev) => ({
                              ...prev,
                              [selectedMethodCode]: half,
                              [multiSecondMethodCode]: grandTotal - half,
                            }));
                          }}
                          className="text-[10px] text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSplitAmounts((prev) => ({
                              ...prev,
                              [selectedMethodCode]: grandTotal,
                              [multiSecondMethodCode]: 0,
                            }));
                          }}
                          className="text-[10px] text-[#da251d] hover:underline font-bold cursor-pointer"
                        >
                          Toàn bộ
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={splitAmounts[selectedMethodCode] ?? ''}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value || '0', 10));
                        setSplitAmounts((prev) => ({
                          ...prev,
                          [selectedMethodCode]: val,
                          [multiSecondMethodCode]: Math.max(0, grandTotal - val),
                        }));
                      }}
                      placeholder="0đ"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold text-right outline-none focus:border-[#da251d]"
                    />
                  </div>

                  {/* Method 2 Card ("Chọn thêm 1 phương thức nữa") */}
                  <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                        <span>Chọn thêm PT thứ 2:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const m1Amt = splitAmounts[selectedMethodCode] || 0;
                          const needed = Math.max(0, grandTotal - m1Amt);
                          setSplitAmounts((prev) => ({ ...prev, [multiSecondMethodCode]: needed }));
                        }}
                        className="text-[10px] text-[#da251d] hover:underline font-bold cursor-pointer"
                      >
                        Điền còn lại
                      </button>
                    </div>

                    {/* Dropdown to pick the 2nd method */}
                    <select
                      value={multiSecondMethodCode}
                      onChange={(e) => {
                        const newM2 = e.target.value;
                        const prevM2 = multiSecondMethodCode;
                        const prevM2Amt = splitAmounts[prevM2] || 0;
                        setMultiSecondMethodCode(newM2);
                        setIsMultiSepayQrGenerated(false);
                        setSplitAmounts((prev) => {
                          const updated = { ...prev };
                          delete updated[prevM2];
                          updated[newM2] = prevM2Amt;
                          return updated;
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-[#da251d] text-gray-800 cursor-pointer"
                    >
                      {paymentMethods
                        .filter((m) => m.methodCode !== selectedMethodCode)
                        .map((m) => (
                          <option key={m.id} value={m.methodCode}>
                            {m.name}
                          </option>
                        ))}
                    </select>

                    <input
                      type="number"
                      min="0"
                      value={splitAmounts[multiSecondMethodCode] ?? ''}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value || '0', 10));
                        setSplitAmounts((prev) => ({ ...prev, [multiSecondMethodCode]: val }));
                      }}
                      placeholder="0đ"
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold text-right outline-none focus:border-[#da251d]"
                    />
                  </div>

                  {/* If either Method 1 or Method 2 is SePay Transfer: Show "Tạo mã QR chuyển khoản" button and QR */}
                  {(() => {
                    const isM1Sepay = selectedMethodCode === 'SEPAY_QR' || selectedMethodCode.includes('SEPAY') || selectedMethodCode.includes('TRANSFER');
                    const isM2Sepay = multiSecondMethodCode === 'SEPAY_QR' || multiSecondMethodCode.includes('SEPAY') || multiSecondMethodCode.includes('TRANSFER');
                    const sepayCode = isM1Sepay ? selectedMethodCode : isM2Sepay ? multiSecondMethodCode : null;
                    const sepayAmt = sepayCode ? (splitAmounts[sepayCode] || 0) : 0;

                    if (!sepayCode || sepayAmt <= 0) return null;

                    const multiSepayQrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(accountNumber)}&bank=${encodeURIComponent(bankCode)}&amount=${sepayAmt}&des=${encodeURIComponent(orderCodeForQr)}`;

                    return (
                      <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 space-y-2 text-center">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-900 flex items-center gap-1.5">
                            <QrCode className="w-4 h-4 text-[#da251d]" />
                            <span>Chuyển khoản SePay</span>
                          </span>
                          <span className="font-mono font-bold text-[#da251d]">
                            {sepayAmt.toLocaleString('vi-VN')}đ
                          </span>
                        </div>

                        {!isMultiSepayQrGenerated ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIsMultiSepayQrGenerated(true);
                              toast.success('Đã tạo mã QR chuyển khoản!', {
                                icon: <QrCode className="w-4 h-4 text-blue-500" />,
                              });
                            }}
                            className="w-full py-2 px-3 bg-white hover:bg-red-50 border border-[#da251d] text-[#da251d] font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer active:scale-98 flex items-center justify-center gap-1.5"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Tạo mã QR chuyển khoản ({sepayAmt.toLocaleString('vi-VN')}đ)</span>
                          </button>
                        ) : (
                          <div className="space-y-2 pt-1 flex flex-col items-center">
                            <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm inline-block">
                              <img
                                src={multiSepayQrUrl}
                                alt="Mã QR chuyển khoản"
                                className="w-36 h-36 object-contain mx-auto"
                                loading="eager"
                              />
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Quét mã để chuyển khoản đúng <span className="font-bold text-gray-900">{sepayAmt.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsMultiSepayQrGenerated(false);
                                setTimeout(() => setIsMultiSepayQrGenerated(true), 50);
                                toast.success('Đã làm mới mã QR!');
                              }}
                              className="text-[11px] text-[#da251d] hover:underline font-bold cursor-pointer"
                            >
                              Làm mới mã QR
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Quick actions for multi-method */}
                <div className="pt-2 border-t border-gray-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitAmounts({})}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const half = Math.floor(grandTotal / 2);
                      setSplitAmounts({
                        [selectedMethodCode]: half,
                        [multiSecondMethodCode]: grandTotal - half,
                      });
                      setIsMultiSepayQrGenerated(false);
                    }}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-[#da251d] font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                  >
                    Chia đôi (50/50)
                  </button>
                </div>
              </div>
            ) : isCashMethod ? (
              /* =========================================================
                 CASE B: CASH (TIỀN MẶT) - TOUCH NUMPAD REPLACES TEXT LINES!
                 ========================================================= */
              <div className="space-y-2.5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  {/* Top Cash Amount Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                    <span className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Bàn phím tiền mặt</span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-500">Cảm ứng POS</span>
                  </div>

                  {/* Cash Given & Change Displays */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-50 rounded-xl border border-gray-200 text-right">
                      <span className="text-[10px] text-gray-500 block">Khách đưa:</span>
                      <span className="text-sm font-black text-gray-900 font-mono">
                        {cashGiven.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-right">
                      <span className="text-[10px] text-emerald-700 block font-semibold">Tiền thối lại:</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">
                        {cashChange.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {/* Quick Cash Presets */}
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: 'Đủ tiền', val: grandTotal },
                      { label: '50.000', val: 50000 },
                      { label: '100.000', val: 100000 },
                      { label: '200.000', val: 200000 },
                      { label: '500.000', val: 500000 },
                      { label: '1.000.000', val: 1000000 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setCashGivenStr(p.val.toString())}
                        className={`py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                          p.val === cashGiven
                            ? 'bg-red-50 border-[#da251d] text-[#da251d]'
                            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Touch Numpad */}
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
                            : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-100'
                        } ${k === 'DEL' ? 'col-span-1' : ''}`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : isSepayMethod ? (
              /* =========================================================
                 CASE C: SEPAY / VIETQR PRO (Ảnh 2 & Ảnh 3)
                 ========================================================= */
              <div className="space-y-3 flex flex-col items-center text-center pt-2">

                {/* State 1: Before "Tạo mã thanh toán" is clicked (Image 2) */}
                {!isQrGenerated ? (
                  <div className="w-full flex flex-col items-center space-y-2">
                    <div className="relative w-44 h-44 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shadow-inner">
                      {/* Ghosted QR graphic */}
                      <div className="absolute inset-0 opacity-20 flex items-center justify-center filter blur-xs pointer-events-none">
                        <QrCode className="w-36 h-36 text-gray-600" />
                      </div>

                      {/* Prominent Centered Button: [ Tạo mã thanh toán ] */}
                      <button
                        type="button"
                        onClick={handleGenerateQr}
                        className="relative z-10 px-4 py-2 bg-white hover:bg-red-50 border border-[#da251d] text-[#da251d] font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer transform active:scale-95"
                      >
                        Tạo mã thanh toán
                      </button>
                    </div>

                    <div className="text-xs font-semibold text-gray-800">
                      Số tiền: <span className="font-bold text-[#da251d]">{grandTotal.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                ) : (
                  /* State 2: After "Tạo mã thanh toán" is clicked (Image 3) */
                  <div className="w-full flex flex-col items-center space-y-2">
                    {/* Real Sharp VietQR PNG Image rendered from SePay */}
                    <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm inline-block">
                      <img
                        src={sepayQrUrl}
                        alt="VietQR Chuyển Khoản"
                        className="w-40 h-40 object-contain mx-auto"
                        loading="eager"
                      />
                    </div>

                    <div className="text-xs font-semibold text-gray-800">
                      Số tiền: <span className="font-bold text-[#da251d]">{grandTotal.toLocaleString('vi-VN')}đ</span>
                    </div>

                    {/* Expiration Countdown */}
                    <div className="text-xs text-gray-500">
                      Mã sẽ hết hạn sau <span className="text-[#da251d] font-bold font-mono">{countdown}</span> giây
                    </div>

                    {/* Action Button: In tạm tính & mã QR */}
                    <button
                      type="button"
                      onClick={handlePrintTempBillWithQr}
                      disabled={isPrintingTempBill}
                      className="w-full py-2 px-3 border border-red-200 bg-white hover:bg-red-50 text-[#da251d] rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {isPrintingTempBill ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5" />
                      )}
                      <span>{isPrintingTempBill ? 'Đang gửi lệnh in...' : 'In tạm tính & mã QR'}</span>
                    </button>

                    {/* Link: Tạo mã mới */}
                    <button
                      type="button"
                      onClick={handleRegenerateQr}
                      className="text-[#da251d] hover:underline font-bold text-xs cursor-pointer"
                    >
                      Tạo mã mới
                    </button>
                  </div>
                )}

                {/* Instructions */}
                <div className="w-full text-left pt-1 space-y-1 text-gray-600 text-[11px]">
                  <div className="font-bold text-gray-800">Hướng dẫn thanh toán cho người mua</div>
                  <div>Bước 1: Mở ứng dụng thanh toán</div>
                  <div>Bước 2: Chọn thanh toán và quét mã QR</div>
                  <div>Bước 3: Hoàn thành thanh toán theo hướng dẫn</div>
                </div>

                {/* Warning Alert */}
                <div className="w-full p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 text-left text-amber-900 text-[10px] space-y-1 leading-relaxed">
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
            ) : (
              /* Other Generic Methods */
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-full bg-red-50 text-[#da251d] flex items-center justify-center mx-auto shadow-inner">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">Thanh toán: {currentMethod?.name}</h4>
                <p className="text-gray-500 text-xs">
                  Thực hiện thanh toán qua thiết bị POS hoặc cổng thanh toán.
                </p>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs w-full text-left space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cần thu:</span>
                    <span className="font-bold text-gray-900">{grandTotal.toLocaleString('vi-VN')}đ</span>
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
        <div className="shrink-0">
          {isMultiPaymentMode ? (
            <button
              type="button"
              disabled={isProcessing || totalAllocated < grandTotal}
              onClick={() => handleFinalSubmit()}
              className="w-full bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-300 disabled:text-gray-500 text-white py-3.5 px-4 font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-99 shadow-md"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3]" />
              )}
              <span>
                {totalAllocated < grandTotal
                  ? `CÒN THIẾU ${(grandTotal - totalAllocated).toLocaleString('vi-VN')}đ (F8)`
                  : `XÁC NHẬN THANH TOÁN NHIỀU PHƯƠNG THỨC (${totalAllocated.toLocaleString('vi-VN')}đ) (F8)`}
              </span>
            </button>
          ) : isSepayMethod ? (
            /* Auto-confirm SePay: Disallow manual confirmation per requirement */
            <button
              type="button"
              disabled
              className="w-full bg-gradient-to-r from-[#da251d] to-rose-700 text-white py-3.5 px-4 font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-95 transition-all"
            >
              {sepayStatus === 'PAID' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white animate-bounce" />
                  <span>ĐÃ NHẬN THANH TOÁN SEPAY - ĐANG HOÀN TẤT...</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span>CHỜ XÁC NHẬN TỰ ĐỘNG SEPAY</span>
                </>
              )}
            </button>
          ) : (
            /* Cash / Manual payment method */
            <button
              type="button"
              disabled={isProcessing || (isCashMethod && cashGiven < grandTotal)}
              onClick={() => handleFinalSubmit()}
              className="w-full bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-300 disabled:text-gray-500 text-white py-3.5 px-4 font-black text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-99 shadow-md"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5 stroke-[3]" />
              )}
              <span>XÁC NHẬN THANH TOÁN (F8)</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {isCreateCustomerOpen && (
        <CreateCustomerModal
          onClose={() => setIsCreateCustomerOpen(false)}
          onSuccess={(newMember) => {
            handleSelectMember(newMember);
          }}
        />
      )}

      {/* Edit Customer VAT Info Modal */}
      {isEditCustomerVatOpen && selectedMember && (
        <EditCustomerVatModal
          customer={selectedMember}
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
