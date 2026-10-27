"use client";

import React, { useState, useEffect } from 'react';
import { useCart } from '../../../context/CartContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight,
  Store,
  FileText,
  Gift,
  CreditCard,
  MapPin,
  Receipt,
  X,
  CheckCircle2,
  Ticket,
  TruckIcon,
  Loader2,
  Navigation,
  AlertTriangle,
  Info,
  ReceiptText,
} from 'lucide-react';
import Image from 'next/image';
import AddressSelectionModal from '@/components/checkout/AddressSelectionModal';
import { Address } from '@/components/AddressModal';
import toast from 'react-hot-toast';
import CheckoutVoucherModal from '@/components/checkout/CheckoutVoucherModal';
import VATInvoiceModal from '@/components/checkout/VATInvoiceModal';
import OperatingSlotPicker, { OperatingSlot } from '@/components/checkout/OperatingSlotPicker';
import PaymentMethodSelector, { PaymentMethodItem } from '@/components/checkout/PaymentMethodSelector';
import TaxBreakdownModal from '@/components/checkout/TaxBreakdownModal';
import FreeShippingModal from '@/components/checkout/FreeShippingModal';
import OrderConfirmationModal from '@/components/checkout/OrderConfirmationModal';
import { useCheckoutSocket } from '@/hooks/useCheckoutSocket';

function getVietnamDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function CheckoutPage() {
  const {
    cartItems,
    currentBranchId,
    clearCart,
    isLoaded,
    appliedDiscountVoucher,
    appliedShippingVoucher,
    discountAmount,
    shippingDiscountAmount,
    setVouchers,
    removeDiscountVoucher,
    removeShippingVoucher,
    getCartItemTotal,
    refreshQuotas,
  } = useCart();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  
  // Khung giờ hoạt động
  const [selectedSlot, setSelectedSlot] = useState<OperatingSlot | null>(null);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => getVietnamDate());
  
  const [note, setNote] = useState('');
  
  // Phương thức thanh toán (bắt buộc)
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [selectedPaymentMethodItem, setSelectedPaymentMethodItem] = useState<PaymentMethodItem | null>(null);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [isVatModalOpen, setIsVatModalOpen] = useState(false);
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [isFreeShippingModalOpen, setIsFreeShippingModalOpen] = useState(false);
  const [isConfirmOrderModalOpen, setIsConfirmOrderModalOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ address?: boolean; slot?: boolean; payment?: boolean }>({});

  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single Source of Truth Preview State
  const [previewData, setPreviewData] = useState<any>(null);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState(false);
  const latestRequestIdRef = React.useRef(0);

  const [isInvoiceRequested, setIsInvoiceRequested] = useState(false);
  const isOrderSuccessRef = React.useRef(false);
  const [vatData, setVatData] = useState({
    companyName: '',
    taxCode: '',
    address: '',
    email: '',
  });

  const [shippingQuote, setShippingQuote] = useState<{
    distanceMeters: number;
    distanceKm: number;
    durationSeconds: number;
    durationMinutes: number;
    originalShippingFee: number;
    shippingDiscount: number;
    finalShippingFee: number;
    deliveryAvailable: boolean;
    reason?: string;
    estimatedDeliveryTime?: string;
    provider: string;
    quoteId?: string;
  } | null>(null);

  // Pricing values derived from Backend Single Source of Truth
  const fallbackSubTotal = cartItems.reduce((acc, item) => acc + getCartItemTotal(item), 0);
  const subTotal = previewData?.subTotal ?? fallbackSubTotal;

  const baseShippingFee = Number(settings.delivery_fee || 15000);
  const shippingFee = previewData?.shippingFeeOriginal ?? (shippingQuote ? shippingQuote.originalShippingFee : baseShippingFee);
  const actualShippingDiscount = previewData?.shippingDiscount ?? (shippingQuote ? shippingQuote.shippingDiscount : (shippingDiscountAmount || 0));
  const payableShipping = previewData?.shippingFeeFinal ?? (shippingQuote ? shippingQuote.finalShippingFee : Math.max(0, shippingFee - (shippingDiscountAmount || 0)));
  const finalDiscountAmount = previewData?.discountAmount ?? (discountAmount || 0);
  const taxAmount = previewData?.taxAmount ?? 0;
  const vatPriceMode = previewData?.vatPriceMode ?? (settings?.vat_price_mode || 'VAT_INCLUDED');
  const [branchInfo, setBranchInfo] = useState<any>(null);
  const [isUsingPoints, setIsUsingPoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);

  useEffect(() => {
    if (currentBranchId) {
      fetch('/api/home/branches')
        .then((res) => res.json())
        .then((branches) => {
          if (Array.isArray(branches)) {
            const found = branches.find((b: any) => b.id === currentBranchId);
            if (found) setBranchInfo(found);
          }
        })
        .catch(() => {});
    }
  }, [currentBranchId]);

  const activeBranch = previewData?.branch || branchInfo;
  const isDirectDiscountAllowed = activeBranch
    ? activeBranch.allowDirectDiscount !== false && (activeBranch.pointRedeemRate === undefined || activeBranch.pointRedeemRate > 0)
    : false;
  const pointRedeemRate = activeBranch?.pointRedeemRate && activeBranch.pointRedeemRate > 0 ? activeBranch.pointRedeemRate : 1;
  const maxPointsUsable = isDirectDiscountAllowed && pointRedeemRate > 0
    ? Math.min(user?.points || 0, Math.floor(Math.max(0, subTotal - finalDiscountAmount) / pointRedeemRate))
    : 0;
  const effectivePointsUsed = isUsingPoints && isDirectDiscountAllowed && pointRedeemRate > 0 ? pointsToUse : 0;
  const pointsDiscountAmount = previewData?.pointsDiscount ?? Math.round(effectivePointsUsed * pointRedeemRate);
  const totalAmount = previewData?.totalAmount ?? Math.max(0, Math.max(0, subTotal - finalDiscountAmount - pointsDiscountAmount) + payableShipping);

  useEffect(() => {
    if (!isDirectDiscountAllowed && isUsingPoints) {
      setIsUsingPoints(false);
      setPointsToUse(0);
    }
  }, [isDirectDiscountAllowed, isUsingPoints]);

  const earnRate = activeBranch?.loyaltyEarnRateOnline && activeBranch.loyaltyEarnRateOnline > 0 ? activeBranch.loyaltyEarnRateOnline : 40;
  const pointMultiplier = user?.membershipTier?.pointMultiplier || 1.0;
  const pointEarned = activeBranch?.isLoyaltyOnlineEnabled !== false ? Math.floor((totalAmount / earnRate) * pointMultiplier) : 0;

  const freeShippingQualified = previewData?.freeShippingQualified ?? false;
  const freeShippingThreshold = previewData?.freeShippingThreshold ?? Number(settings.free_shipping_threshold || settings.delivery_min_free || 500000);
  const freeShippingEligibleAmount = previewData?.freeShippingEligibleAmount ?? Math.max(0, subTotal - finalDiscountAmount);
  const freeShippingRemainingAmount = previewData?.freeShippingRemainingAmount ?? Math.max(0, freeShippingThreshold - freeShippingEligibleAmount);
  const shippingDiscountSource = previewData?.shippingDiscountSource ?? 'NONE';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/home/settings');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        console.error('Failed to fetch settings', e);
      }
    };
    fetchUser();
    fetchSettings();
  }, []);

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/addresses', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const addressList = Array.isArray(data) ? data : (data?.data || []);
        setAddresses(addressList);
        const defaultAddr = addressList.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        } else if (addressList.length > 0) {
          setSelectedAddressId(addressList[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (isOrderSuccessRef.current) return;
    if (cartItems.length === 0) {
      router.push('/cart');
    } else {
      fetchAddresses();
    }
  }, [isLoaded, cartItems.length, router]);

  const fetchCheckoutPreview = React.useCallback(async () => {
    if (!cartItems || cartItems.length === 0) return;
    const reqId = ++latestRequestIdRef.current;
    setIsCalculatingPreview(true);

    try {
      const payload = {
        branchId: currentBranchId,
        addressId: selectedAddressId || undefined,
        cartItems: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          optionItemIds: item.selectedOptions?.map(opt => opt.optionItemId) || [],
          isFlashSaleItem: item.isFlashSaleItem,
          flashSaleId: item.flashSaleId,
          isCombo: item.isCombo,
          comboId: item.comboId,
          note: item.note,
        })),
        discountVoucherCode: appliedDiscountVoucher?.code,
        shippingVoucherCode: appliedShippingVoucher?.code,
        operatingSlotId: selectedSlot?.id,
        deliveryDate: deliveryDate,
        paymentMethod: selectedPaymentMethodItem?.methodCode || paymentMethod || undefined,
        pointsUsed: effectivePointsUsed,
      };

      const res = await fetch('/api/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (reqId === latestRequestIdRef.current && json.data) {
          setPreviewData(json.data);
          if (json.data.shippingQuote) {
            setShippingQuote(json.data.shippingQuote);
          }
        }
      }
    } catch (err) {
      console.error('Failed to get checkout preview:', err);
    } finally {
      if (reqId === latestRequestIdRef.current) {
        setIsCalculatingPreview(false);
      }
    }
  }, [
    cartItems,
    currentBranchId,
    selectedAddressId,
    appliedDiscountVoucher?.code,
    appliedShippingVoucher?.code,
    selectedSlot?.id,
    deliveryDate,
    selectedPaymentMethodItem?.methodCode,
    paymentMethod,
    effectivePointsUsed,
  ]);

  // Realtime Checkout WebSocket subscription (Rule #28 - #41)
  useCheckoutSocket({
    branchId: currentBranchId,
    userId: user?.id,
    onDataChanged: (_signals, summaryText) => {
      toast(summaryText, {
        icon: '🔄',
        duration: 4500,
        style: {
          background: '#1e293b',
          color: '#fff',
          fontSize: '13px',
          borderRadius: '12px',
          maxWidth: '440px',
        },
      });
      fetchCheckoutPreview();
    },
  });

  useEffect(() => {
    if (!isLoaded || cartItems.length === 0) return;
    fetchCheckoutPreview();
  }, [isLoaded, cartItems.length, selectedAddressId, currentBranchId, appliedDiscountVoucher?.code, appliedShippingVoucher?.code, selectedSlot?.id, paymentMethod, effectivePointsUsed, fetchCheckoutPreview]);

  // Tự động kiểm tra và gỡ bỏ voucher nếu phương thức thanh toán không thỏa mãn điều kiện
  useEffect(() => {
    if (appliedDiscountVoucher && selectedPaymentMethodItem) {
      if (
        appliedDiscountVoucher.appliesToAllPaymentMethods === false &&
        Array.isArray(appliedDiscountVoucher.voucherPaymentMethods) &&
        appliedDiscountVoucher.voucherPaymentMethods.length > 0
      ) {
        const isAllowed = appliedDiscountVoucher.voucherPaymentMethods.some(
          (vpm: any) => vpm.paymentMethodId === selectedPaymentMethodItem.id
        );
        if (!isAllowed) {
          toast.error(
            `Voucher "${appliedDiscountVoucher.code}" không áp dụng cho phương thức "${selectedPaymentMethodItem.name}" và đã được gỡ bỏ.`
          );
          setVouchers(null, appliedShippingVoucher);
        }
      }
    }
  }, [selectedPaymentMethodItem, appliedDiscountVoucher, appliedShippingVoucher, setVouchers]);

  const handlePlaceOrder = () => {
    // 1. Kiểm tra địa chỉ nhận hàng
    if (!selectedAddressId) {
      setValidationErrors(prev => ({ ...prev, address: true }));
      toast.error('Vui lòng chọn địa chỉ giao hàng trước khi đặt hàng!');
      const el = document.getElementById('delivery-address-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (shippingQuote && !shippingQuote.deliveryAvailable) {
      toast.error(
        shippingQuote.reason ||
          'Địa chỉ này nằm ngoài phạm vi giao hàng của chi nhánh. Quý khách vui lòng chọn địa chỉ khác hoặc đổi chi nhánh!',
        { duration: 5000 }
      );
      return;
    }

    // 2. Kiểm tra khung giờ giao hàng
    if (!selectedSlot) {
      setValidationErrors(prev => ({ ...prev, slot: true }));
      toast.error('Vui lòng chọn khung giờ giao hàng trước khi đặt hàng!');
      const el = document.getElementById('operating-slot-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // 3. Kiểm tra phương thức thanh toán
    if (!selectedPaymentMethodItem || !paymentMethod) {
      setValidationErrors(prev => ({ ...prev, payment: true }));
      toast.error('Vui lòng chọn 1 phương thức thanh toán hợp lệ trước khi đặt hàng!');
      const el = document.getElementById('payment-method-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (isCalculatingPreview) {
      toast.error('Hệ thống đang tính lại giá đơn hàng, vui lòng đợi trong giây lát!');
      return;
    }

    // Kiểm tra điều kiện đơn hàng tối thiểu của phương thức thanh toán dựa trên giá trị đơn hàng trước giảm giá (chưa gồm phí ship)
    if (subTotal < (selectedPaymentMethodItem.minOrderValue || 0)) {
      const missing = selectedPaymentMethodItem.minOrderValue - subTotal;
      toast.error(
        `Phương thức "${selectedPaymentMethodItem.name}" yêu cầu đơn tối thiểu ${selectedPaymentMethodItem.minOrderValue.toLocaleString(
          'vi-VN'
        )}đ (tiền hàng hiện tại: ${subTotal.toLocaleString('vi-VN')}đ, còn thiếu ${missing.toLocaleString('vi-VN')}đ). Vui lòng chọn phương thức khác!`,
        { duration: 4500 }
      );
      return;
    }

    // 3.5. Bắt buộc kiểm tra khung giờ giao hàng
    if (!selectedSlot?.id || !deliveryDate) {
      toast.error('Vui lòng chọn khung giờ giao hàng trước khi xác nhận đơn.');
      const el = document.getElementById('operating-slot-section');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Thông tin hoàn toàn hợp lệ -> Mở modal kiểm tra lại đơn hàng lần nữa
    setValidationErrors({});
    setIsConfirmOrderModalOpen(true);
  };

  const executePlaceOrder = async () => {
    if (!selectedSlot?.id || !deliveryDate) {
      toast.error('Vui lòng chọn khung giờ giao hàng trước khi xác nhận đơn.');
      return;
    }
    setIsSubmitting(true);
    const loadingToast = toast.loading('Đang xử lý đơn hàng...');
    try {
      const fullNote = selectedSlot
        ? `[Giao lúc: ${selectedSlot.startTime} - ${selectedSlot.endTime} Ngày: ${deliveryDate}] ${note}`
        : note;

      const payload = {
        addressId: selectedAddressId,
        branchId: currentBranchId,
        cartItems: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          optionItemIds: item.selectedOptions?.map(opt => opt.optionItemId) || [],
          isFlashSaleItem: item.isFlashSaleItem,
          flashSaleId: item.flashSaleId,
          isCombo: item.isCombo,
          comboId: item.comboId,
          note: item.note,
        })),
        note: fullNote,
        paymentMethod: selectedPaymentMethodItem?.methodCode || paymentMethod,
        operatingSlotId: selectedSlot?.id || undefined,
        deliveryDate: deliveryDate || undefined,
        deliverySlotSnapshot: selectedSlot ? `${selectedSlot.startTime} - ${selectedSlot.endTime}` : undefined,
        orderType: 'DELIVERY',
        expectedTotalAmount: totalAmount,
        vatInfo: isInvoiceRequested ? {
          isInvoiceRequested: true,
          invoiceCompanyName: vatData.companyName,
          invoiceTaxCode: vatData.taxCode,
          invoiceAddress: vatData.address,
          invoiceEmail: vatData.email
        } : undefined,
        voucherCode: appliedDiscountVoucher?.code || undefined,
        shippingVoucherCode: appliedShippingVoucher?.code || undefined,
        pointsUsed: effectivePointsUsed,
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'CHECKOUT_CHANGED') {
          toast.dismiss(loadingToast);
          toast.error(errorData.message || 'Đơn hàng vừa có thay đổi về giá hoặc điều kiện ưu đãi. Tổng thanh toán đã được tính lại.', { duration: 6000 });
          fetchCheckoutPreview();
          setIsSubmitting(false);
          setIsConfirmOrderModalOpen(false);
          return;
        }
        throw new Error(errorData.message || 'Đặt hàng thất bại');
      }

      const resData = await response.json();
      const code = resData.orderCode || resData.data?.orderCode || resData.orderId || resData.data?.id;

      isOrderSuccessRef.current = true;
      clearCart();
      toast.success('🎉 Đặt hàng thành công!', { id: loadingToast });
      setIsConfirmOrderModalOpen(false);

      const currentGateway = (selectedPaymentMethodItem?.gatewayType || selectedPaymentMethodItem?.methodCode || paymentMethod || '').toUpperCase();
      const isOnlineTransfer =
        currentGateway === 'SEPAY' ||
        currentGateway === 'TRANSFER' ||
        currentGateway.includes('SEPAY') ||
        currentGateway.includes('VIETQR') ||
        currentGateway.includes('BANK') ||
        currentGateway.includes('TRANSFER');

      if (isOnlineTransfer && code) {
        window.location.href = `/payment/sepay?orderCode=${code}`;
      } else if (code) {
        window.location.href = `/checkout/success?orderCode=${code}`;
      } else {
        window.location.href = '/orders';
      }
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`, { id: loadingToast });
      setIsSubmitting(false);
    }
  };

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);

  if (!isLoaded || (cartItems.length === 0 && !isOrderSuccessRef.current)) return null;

  return (
    <div className={`min-h-screen bg-[#f5f6f8] pb-24 lg:pb-12 font-sans text-slate-800 ${isSubmitting ? 'pointer-events-none select-none' : ''}`}>

      {/* FULLSCREEN LOADING OVERLAY KHI ĐANG ĐẶT HÀNG */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[99999] flex flex-col items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#da251d]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Đang khởi tạo đơn hàng...</h3>
              <p className="text-xs text-slate-500 mt-1">Vui lòng chờ trong giây lát và không đóng trình duyệt</p>
            </div>
          </div>
        </div>
      )}

      {/* Header Mobile */}
      <div className="lg:hidden bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => router.back()} disabled={isSubmitting} className="p-2 -ml-2 text-slate-600">
            <ChevronRight className="rotate-180" size={24} />
          </button>
          <h1 className="flex-1 text-center font-bold text-lg mr-6">Thanh Toán</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
        {/* Breadcrumb Desktop */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400 mb-6">
          <Link href="/" className="hover:text-slate-700">Trang chủ</Link>
          <ChevronRight size={14} />
          <Link href="/cart" className="hover:text-slate-700">Giỏ hàng</Link>
          <ChevronRight size={14} />
          <span className="text-slate-800 font-bold">Thanh toán</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT COLUMN */}
          <div className="w-full lg:w-[65%] space-y-4 sm:space-y-6">

            {/* ĐỊA CHỈ NHẬN HÀNG */}
            <div
              id="delivery-address-section"
              onClick={() => {
                setValidationErrors(prev => ({ ...prev, address: false }));
                setIsAddressModalOpen(true);
              }}
              className={`bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border cursor-pointer transition-all ${
                validationErrors.address
                  ? 'border-red-500 ring-2 ring-red-300 bg-red-50/20'
                  : 'border-slate-200/60 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="flex items-center text-base font-bold text-slate-800">
                  <MapPin className="mr-2 text-[#da251d]" size={20} />
                  Địa chỉ nhận hàng
                </h2>
                <span className="text-xs font-bold text-[#da251d] hover:underline">
                  {selectedAddress ? 'Thay đổi' : 'Chọn địa chỉ'}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div>
                  {selectedAddress ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900 text-sm">{selectedAddress.recipientName || user?.fullName}</span>
                        <span className="text-xs text-slate-400">|</span>
                        <span className="text-xs text-slate-600 font-medium">{selectedAddress.phone || user?.phone}</span>
                        {selectedAddress.isDefault && (
                          <span className="text-[10px] bg-red-50 text-[#da251d] font-bold px-1.5 py-0.5 rounded border border-red-100">Mặc định</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {selectedAddress.streetDetail}, {selectedAddress.ward}, {selectedAddress.province}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Vui lòng chọn địa chỉ giao hàng</p>
                  )}
                </div>
                <ChevronRight className="text-slate-400 shrink-0" size={20} />
              </div>
            </div>

            {/* BƯỚC 4: THỜI GIAN NHẬN HÀNG (OPERATING SLOTS REALTIME) */}
            <div
              id="operating-slot-section"
              onClick={() => setValidationErrors(prev => ({ ...prev, slot: false }))}
              className={`transition-all rounded-2xl ${
                validationErrors.slot ? 'ring-2 ring-red-300 border-2 border-red-500 bg-red-50/20 p-1' : ''
              }`}
            >
              <OperatingSlotPicker
                branchId={currentBranchId}
                orderType="DELIVERY"
                selectedSlotId={selectedSlot?.id || null}
                selectedDate={deliveryDate}
                onSelectSlot={(slot, dateStr) => {
                  setValidationErrors(prev => ({ ...prev, slot: false }));
                  setSelectedSlot(slot);
                  setDeliveryDate(dateStr);
                }}
                sessionId={user?.id || 'guest-session'}
              />
            </div>

            {/* GHI CHÚ ĐƠN HÀNG */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Ghi chú cho đơn hàng
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Ghi chú về khẩu vị món ăn hoặc hướng dẫn giao hàng..."
                className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#da251d] resize-none font-medium"
              />
            </div>

            {/* CART ITEMS */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h2 className="flex items-center text-base font-bold text-slate-800">
                  <Store className="mr-2 text-[#da251d]" size={20} />
                  {activeBranch?.name || 'Chi nhánh phục vụ'}
                </h2>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium">{cartItems.length} món</span>
              </div>

              <div className="space-y-4">
                {cartItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex gap-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-100 shrink-0 relative bg-slate-50">
                      {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 768px) 100px, 80px" className="object-cover" />}
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</h3>
                          {item.optionsTextSnapshot && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{item.optionsTextSnapshot}</p>}
                        </div>
                        <span className="font-bold text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-2">x{item.quantity}</span>
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <span className="font-bold text-[#da251d] text-sm">{getCartItemTotal(item).toLocaleString('vi-VN')}đ</span>
                        {item.priceAtSale < item.originalPriceAtSale && (
                          <span className="text-xs text-slate-400 line-through">{(item.originalPriceAtSale * item.quantity).toLocaleString('vi-VN')}đ</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PHÍ GIAO HÀNG */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TruckIcon className="w-6 h-6 text-[#00B14F]" />
                  <span className="font-bold text-slate-800 text-sm">Phí giao hàng</span>
                  <span className="text-[10px] font-bold text-white bg-[#00B14F] px-2 py-0.5 rounded-full">
                    {shippingQuote?.provider &&
                    !shippingQuote.provider.includes('ROUTING') &&
                    !shippingQuote.provider.includes('OSRM') &&
                    !shippingQuote.provider.includes('HAVERSINE') &&
                    !shippingQuote.provider.includes('STANDARD_DELIVERY')
                      ? shippingQuote.provider
                      : 'Giao hàng tiêu chuẩn'}
                  </span>
                </div>
                <div className="text-right">
                  {isCalculatingPreview ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00B14F]" />
                      <span>Đang tính theo tọa độ...</span>
                    </div>
                  ) : freeShippingQualified ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 line-through text-xs font-medium">
                        {shippingFee.toLocaleString('vi-VN')}đ
                      </span>
                      <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[11px] tracking-wide">
                        MIỄN PHÍ
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-slate-800 text-sm">
                      {shippingFee.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
              </div>

              {shippingQuote && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Khoảng cách di chuyển: <strong className="text-slate-800 font-bold">{shippingQuote.distanceKm} km</strong></span>
                    {shippingQuote.durationMinutes > 0 && (
                      <span className="text-slate-400 font-normal">(~{shippingQuote.durationMinutes} phút)</span>
                    )}
                  </div>
                  {shippingQuote.shippingDiscount > 0 && (
                    <span className="text-emerald-600 font-bold text-[11px]">
                      Voucher freeship: -{shippingQuote.shippingDiscount.toLocaleString('vi-VN')}đ
                    </span>
                  )}
                </div>
              )}

              {shippingQuote && !shippingQuote.deliveryAvailable && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Địa chỉ nằm ngoài phạm vi giao hàng!</strong>
                    <p className="mt-0.5 leading-relaxed text-rose-700">
                      {shippingQuote.reason || `Khoảng cách (${shippingQuote.distanceKm} km) vượt quá bán kính phục vụ của chi nhánh. Quý khách vui lòng chọn địa chỉ khác gần hơn hoặc đổi chi nhánh!`}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400 mt-2">
                * Phí vận chuyển được tính tự động dựa trên quãng đường giao thông thực tế giữa chi nhánh và địa chỉ của bạn.
              </p>
            </div>

            {/* YÊU CẦU XUẤT HÓA ĐƠN */}
            <div
              onClick={() => setIsVatModalOpen(true)}
              className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ReceiptText className="text-slate-600" size={20} />
                <span className="font-bold text-slate-800 text-sm">Yêu cầu xuất hóa đơn</span>
                {isInvoiceRequested && (
                  <span className="ml-2 bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold">Đã nhập</span>
                )}
              </div>
              <ChevronRight className="text-slate-400" size={20} />
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="w-full lg:w-[35%] space-y-4 sm:space-y-6">

            {/* ƯU ĐÃI & VOUCHER */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60">
              <div className="flex items-center justify-between mb-4">
                <h2 className="flex items-center text-base font-bold text-slate-800">
                  <Gift className="mr-2 text-amber-500" size={20} />
                  Ưu đãi & Voucher
                </h2>
                {(appliedDiscountVoucher || appliedShippingVoucher) && (
                  <button
                    type="button"
                    onClick={() => setIsVoucherModalOpen(true)}
                    className="text-xs font-bold text-red-600 hover:text-red-700"
                  >
                    Thay đổi
                  </button>
                )}
              </div>

              {appliedDiscountVoucher || appliedShippingVoucher ? (
                <div className="space-y-2">
                  {/* Applied Freeship Voucher */}
                  {appliedShippingVoucher && (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="p-1 rounded bg-emerald-600 text-white text-[10px] font-black shrink-0">
                          FREESHIP
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-emerald-900 truncate">
                            {appliedShippingVoucher.code}
                          </p>
                          <p className="text-[10px] text-emerald-700 font-semibold">
                            - {shippingDiscountAmount.toLocaleString('vi-VN')}đ phí giao hàng
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeShippingVoucher();
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Applied Order Discount Voucher */}
                  {appliedDiscountVoucher && (
                    <div className="flex items-center justify-between p-2.5 bg-red-50/70 border border-red-200 rounded-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="p-1 rounded bg-red-600 text-white text-[10px] font-black shrink-0">
                          GIẢM GIÁ
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-red-900 truncate">
                            {appliedDiscountVoucher.code}
                          </p>
                          <p className="text-[10px] text-red-700 font-semibold">
                            - {discountAmount.toLocaleString('vi-VN')}đ vào tiền món
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDiscountVoucher();
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="flex items-center justify-between p-3 bg-amber-50/50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center shrink-0">
                      <Ticket size={16} />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-slate-600">
                      Chọn hoặc nhập mã ưu đãi (tối đa 2 mã)...
                    </span>
                  </div>
                  <ChevronRight className="text-slate-400 shrink-0" size={18} />
                </div>
              )}
            </div>

            {/* BƯỚC 4: PHƯƠNG THỨC THANH TOÁN (DYNAMIC VIETQR & GATEWAYS) */}
            <div
              id="payment-method-section"
              onClick={() => setValidationErrors(prev => ({ ...prev, payment: false }))}
              className={`transition-all rounded-2xl ${
                validationErrors.payment ? 'ring-2 ring-red-300 border-2 border-red-500 bg-red-50/20 p-1' : ''
              }`}
            >
              <PaymentMethodSelector
                totalAmount={subTotal}
                branchId={currentBranchId}
                selectedMethodCode={paymentMethod}
                onSelectMethod={(method) => {
                  if (method) {
                    setValidationErrors(prev => ({ ...prev, payment: false }));
                    setPaymentMethod(method.methodCode);
                    setSelectedPaymentMethodItem(method);
                  } else {
                    setPaymentMethod('');
                    setSelectedPaymentMethodItem(null);
                  }
                }}
                orderCodeHint={user?.phone ? `DH ${user.phone.slice(-4)}` : 'THANH TOAN AVORA'}
              />
            </div>

            {/* SUMMARY */}
            <div className="bg-white p-4 sm:p-6 sm:rounded-2xl shadow-sm border-y sm:border border-slate-200/60 lg:sticky lg:top-24">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <h2 className="flex items-center text-base font-bold text-slate-800">
                  <Receipt className="mr-2 text-slate-600" size={20} />
                  Chi tiết thanh toán
                </h2>
                {isCalculatingPreview && (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang tính giá...
                  </span>
                )}
              </div>

              {/* Free Shipping Progress Banner (Rule #22, #23, #24) */}
              {freeShippingThreshold > 0 && (
                <div
                  onClick={() => setIsFreeShippingModalOpen(true)}
                  className={`mb-4 p-3 rounded-xl border cursor-pointer transition-all ${
                    freeShippingQualified
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  {freeShippingQualified ? (
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                        <span className="text-emerald-800">✓ Bạn đã được miễn phí vận chuyển</span>
                      </div>
                      <Info size={14} className="text-emerald-500 shrink-0" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-amber-900">
                          Thêm <strong>{freeShippingRemainingAmount.toLocaleString('vi-VN')}₫</strong> để được freeship
                        </span>
                        <Info size={14} className="text-amber-500 shrink-0" />
                      </div>
                      <div className="w-full h-2 bg-amber-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round((freeShippingEligibleAmount / freeShippingThreshold) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Box dùng điểm tích lũy - Chỉ hiển thị khi chi nhánh BẬT đổi điểm thành giá trị giảm */}
              {user && (user.points || 0) > 0 && isDirectDiscountAllowed && pointRedeemRate > 0 && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl mb-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-900 block">Sử dụng điểm tích lũy</span>
                      <span className="text-[11px] text-amber-700 block">
                        Khả dụng: <strong>{(user.points || 0).toLocaleString('vi-VN')}</strong> điểm
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={maxPointsUsable <= 0}
                        checked={isUsingPoints}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsUsingPoints(checked);
                          setPointsToUse(checked ? maxPointsUsable : 0);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600 disabled:opacity-50"></div>
                    </label>
                  </div>
                  {isUsingPoints && (
                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs text-amber-900 font-semibold">
                      <span>Giảm trừ ({effectivePointsUsed} điểm x {pointRedeemRate}đ):</span>
                      <span className="text-emerald-600 font-bold">-{pointsDiscountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between text-slate-500">
                  <span>Tạm tính ({cartItems.length} món):</span>
                  <span className="text-slate-800 font-semibold">{subTotal.toLocaleString('vi-VN')}đ</span>
                </div>

                {/* Phí vận chuyển (Rule #22, #26) */}
                <div className="flex justify-between items-center text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span>Phí vận chuyển {shippingQuote?.distanceKm ? `(${shippingQuote.distanceKm} km)` : ''}:</span>
                    <button
                      type="button"
                      onClick={() => setIsFreeShippingModalOpen(true)}
                      title="Xem chi tiết ưu đãi vận chuyển"
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {freeShippingQualified ? (
                      <>
                        <span className="text-slate-400 line-through text-xs font-medium">
                          {shippingFee.toLocaleString('vi-VN')}đ
                        </span>
                        <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-[11px] tracking-wide">
                          MIỄN PHÍ
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-800 font-semibold">{shippingFee.toLocaleString('vi-VN')}đ</span>
                    )}
                  </div>
                </div>

                {actualShippingDiscount > 0 && !freeShippingQualified && (
                  <div className="flex justify-between text-emerald-600 text-xs sm:text-sm">
                    <span>Giảm phí vận chuyển ({appliedShippingVoucher?.code || 'Freeship'}):</span>
                    <span className="font-bold">-{actualShippingDiscount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}

                {finalDiscountAmount > 0 && (
                  <div className="flex justify-between text-red-600 text-xs sm:text-sm">
                    <span>Giảm giá món ăn ({appliedDiscountVoucher?.code}):</span>
                    <span className="font-bold">-{finalDiscountAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}

                {pointsDiscountAmount > 0 && (
                  <div className="flex justify-between text-amber-600 text-xs sm:text-sm">
                    <span>Dùng điểm tích lũy ({effectivePointsUsed} điểm):</span>
                    <span className="font-bold">-{pointsDiscountAmount.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}

                {/* Thuế VAT kèm icon ⓘ mở Modal (Rule #15, #16) */}
                <div className="flex justify-between items-center text-slate-500 text-xs sm:text-sm pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span>{vatPriceMode === 'VAT_INCLUDED' ? 'VAT đã bao gồm:' : 'Thuế VAT:'}</span>
                    <button
                      type="button"
                      onClick={() => setIsTaxModalOpen(true)}
                      title="Xem chi tiết thuế VAT"
                      className="text-slate-400 hover:text-red-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                  <span className="text-slate-700 font-semibold">
                    {taxAmount > 0 ? (
                      vatPriceMode === 'VAT_INCLUDED' ? (
                        `${taxAmount.toLocaleString('vi-VN')}đ`
                      ) : (
                        `+${taxAmount.toLocaleString('vi-VN')}đ`
                      )
                    ) : (
                      '0đ'
                    )}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline mb-2">
                <span className="font-bold text-slate-800 text-lg">Tổng cộng:</span>
                <span className="font-black text-2xl text-[#da251d]">{totalAmount.toLocaleString('vi-VN')}đ</span>
              </div>

              <div className="flex items-center justify-end gap-1 text-[11px] text-amber-600 font-medium mb-6 italic">
                <div className="w-3 h-3 bg-amber-400 rounded-full flex items-center justify-center text-white text-[8px] not-italic">V</div>
                {branchInfo?.isLoyaltyOnlineEnabled !== false ? (
                  <span>Tích lũy ~{pointEarned.toLocaleString('vi-VN')} điểm khi đơn hàng hoàn tất ({earnRate}đ = 1 điểm)!</span>
                ) : (
                  <span>Chi nhánh hiện tạm ngưng tích điểm đơn Online</span>
                )}
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isSubmitting || isCalculatingPreview || (shippingQuote !== null && !shippingQuote.deliveryAvailable)}
                className="w-full bg-[#da251d] hover:bg-[#b91c2c] text-white font-bold py-3.5 rounded-xl shadow-lg shadow-[#da251d]/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>ĐANG XỬ LÝ...</span>
                  </>
                ) : isCalculatingPreview ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>ĐANG TÍNH GIÁ...</span>
                  </>
                ) : shippingQuote !== null && !shippingQuote.deliveryAvailable ? (
                  <span>NGOÀI PHẠM VI GIAO HÀNG</span>
                ) : (
                  <span>XÁC NHẬN ĐẶT HÀNG →</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        addresses={addresses}
        selectedAddressId={selectedAddressId}
        onSelectAddress={(id) => setSelectedAddressId(id)}
        onAddressesUpdated={fetchAddresses}
      />

      <CheckoutVoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        orderValue={subTotal}
        userId={user?.id}
        currentUser={user}
        appliedDiscountVoucher={appliedDiscountVoucher}
        appliedShippingVoucher={appliedShippingVoucher}
        branchId={currentBranchId}
        paymentMethodId={selectedPaymentMethodItem?.id}
        onApply={({ discountVoucher, shippingVoucher }) => {
          setVouchers(discountVoucher, shippingVoucher);
        }}
      />

      <VATInvoiceModal
        isOpen={isVatModalOpen}
        onClose={() => setIsVatModalOpen(false)}
        initialData={vatData}
        onSave={(data) => {
          setVatData(data);
          setIsInvoiceRequested(true);
        }}
      />

      <TaxBreakdownModal
        isOpen={isTaxModalOpen}
        onClose={() => setIsTaxModalOpen(false)}
        taxBreakdown={previewData?.taxBreakdown || []}
        totalTaxAmount={taxAmount}
        vatPriceMode={vatPriceMode}
      />

      <FreeShippingModal
        isOpen={isFreeShippingModalOpen}
        onClose={() => setIsFreeShippingModalOpen(false)}
        freeShippingQualified={freeShippingQualified}
        freeShippingThreshold={freeShippingThreshold}
        freeShippingEligibleAmount={freeShippingEligibleAmount}
        freeShippingRemainingAmount={freeShippingRemainingAmount}
        shippingDiscountSource={shippingDiscountSource}
      />

      <OrderConfirmationModal
        isOpen={isConfirmOrderModalOpen}
        onClose={() => setIsConfirmOrderModalOpen(false)}
        onConfirm={executePlaceOrder}
        isSubmitting={isSubmitting}
        recipientName={selectedAddress?.recipientName || user?.fullName || 'Khách hàng'}
        phone={selectedAddress?.phone || user?.phone || 'Chưa cập nhật'}
        address={selectedAddress ? `${selectedAddress.streetDetail}, ${selectedAddress.ward}, ${selectedAddress.province}` : ''}
        deliveryTimeText={
          selectedSlot
            ? `Hôm nay (${deliveryDate ? deliveryDate.split('-').slice(1).reverse().join('/') : ''}) (${selectedSlot.startTime} - ${selectedSlot.endTime})`
            : 'Sớm nhất có thể'
        }
        discountVoucherText={
          appliedDiscountVoucher
            ? `${appliedDiscountVoucher.code} (-${discountAmount.toLocaleString('vi-VN')}đ)`
            : 'Không sử dụng'
        }
        shippingVoucherText={
          appliedShippingVoucher
            ? `${appliedShippingVoucher.code} (-${shippingDiscountAmount.toLocaleString('vi-VN')}đ)`
            : 'Không sử dụng'
        }
        paymentMethodText={selectedPaymentMethodItem?.name || paymentMethod || 'Chưa chọn'}
      />
    </div>
  );
}
