'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import OrderReviewComposer from '@/components/reviews/OrderReviewComposer';
import OrderReviewTimeline from '@/components/reviews/OrderReviewTimeline';
import {
  ArrowLeft,
  MapPin,
  Receipt,
  CreditCard,
  ChevronRight,
  Clock,
  ChefHat,
  Truck,
  CheckCircle2,
  XCircle,
  X,
  Phone,
  User,
  CalendarDays,
  FileText,
  AlertCircle,
  QrCode,
  Copy,
  Check,
  Building2,
  Printer,
  Sparkles,
  ShoppingBag,
  Store,
  ExternalLink,
  Star,
  Loader2,
  Gift,
} from 'lucide-react';
import Image from 'next/image';
import CancelOrderModal from '@/components/CancelOrderModal';
import { useCart } from '@/context/CartContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Chờ xác nhận', desc: 'Đơn hàng đã được gửi tới nhà hàng', icon: Clock },
  { key: 'CONFIRMED', label: 'Đã xác nhận', desc: 'Nhà hàng đã tiếp nhận đơn', icon: CheckCircle2 },
  { key: 'PREPARING', label: 'Đang chuẩn bị', desc: 'Đầu bếp đang chế biến món ăn', icon: ChefHat },
  { key: 'DELIVERING', label: 'Đang giao hàng', desc: 'Tài xế đang giao tới bạn', icon: Truck },
  { key: 'COMPLETED', label: 'Giao thành công', desc: 'Đơn hàng đã hoàn tất', icon: Sparkles },
];

export default function OrderDetailPage() {
  const { orderCode } = useParams();
  const router = useRouter();
  const { addToCart, currentBranchId } = useCart();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [eligibility, setEligibility] = useState<any>(null);
  const [orderReview, setOrderReview] = useState<any>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [isOrderReviewModalOpen, setIsOrderReviewModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchReviewData = useCallback(async (orderId: string) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('access_token')) : null;
    setLoadingReview(true);
    try {
      const apiUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? ''
        : (process.env.NEXT_PUBLIC_API_URL || '');

      const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [eligRes, revRes] = await Promise.all([
        fetch(`${apiUrl}/api/orders/${orderId}/review-eligibility`, {
          credentials: 'include',
          headers,
        }),
        fetch(`${apiUrl}/api/orders/${orderId}/review`, {
          credentials: 'include',
          headers,
        }),
      ]);

      if (eligRes.ok) {
        const eligData = await eligRes.json();
        setEligibility(eligData.data);
      }

      if (revRes.ok) {
        const revData = await revRes.json();
        setOrderReview(revData.data);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoadingReview(false);
    }
  }, []);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderCode}`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      } else {
        toast.error('Không tìm thấy đơn hàng');
        router.push('/orders');
      }
    } catch (error) {
      toast.error('Lỗi khi tải thông tin đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderCode) fetchOrder();
  }, [orderCode]);

  useEffect(() => {
    if (order && order.status === 'COMPLETED') {
      fetchReviewData(order.id);
    }
  }, [order, fetchReviewData]);

  useEffect(() => {
    const isReviewMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('review') === '1';
    if (isReviewMode) {
      setTimeout(() => {
        document.getElementById('order-review-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
      if (eligibility?.canReview && !orderReview) {
        setIsOrderReviewModalOpen(true);
      }
    }
  }, [eligibility?.canReview, orderReview]);

  useEffect(() => {
    if (isOrderReviewModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOrderReviewModalOpen]);

  const copyOrderCode = () => {
    if (!order?.orderCode) return;
    navigator.clipboard.writeText(order.orderCode);
    setCopiedCode(true);
    toast.success(`Đã sao chép mã đơn: ${order.orderCode}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReorder = () => {
    if (!order?.orderItems) return;
    const targetBranch = order.branchId || currentBranchId;
    order.orderItems.forEach((item: any) => {
      if (item.product) {
        addToCart(
          {
            id: `${item.productId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: item.productId,
            name: item.product.name,
            priceAtSale: item.priceAtSale || item.product.price,
            originalPriceAtSale: item.originalPriceAtSale || item.product.price,
            quantity: item.quantity,
            imageUrl: item.product.imageUrl,
            optionsTextSnapshot: item.optionsTextSnapshot || '',
            selectedOptions: [],
          },
          targetBranch,
          true
        );
      }
    });
    toast.success('Đã thêm các món vào giỏ hàng!');
    router.push('/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f6f8] font-sans">
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-bold text-slate-500">Đang tải chi tiết đơn hàng...</p>
      </div>
    );
  }

  if (!order) return null;

  const isCancelled = order.status === 'CANCELLED';
  let currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
  if (currentStepIndex === -1 && !isCancelled) currentStepIndex = 0;

  const isUnpaidSepay =
    (order.paymentMethod === 'SEPAY' ||
      order.paymentMethod === 'TRANSFER' ||
      order.paymentMethod?.includes('SEPAY') ||
      order.paymentMethod?.includes('TRANSFER')) &&
    order.paymentStatus !== 'PAID' &&
    !isCancelled;

  const formattedDate = new Date(order.createdAt).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const deliveryDateFormatted = order.deliveryDate
    ? new Date(order.deliveryDate).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-[#f4f5f7] pb-16 font-sans text-slate-800">
      <CancelOrderModal
        orderCode={orderCode as string}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={() => {
          setIsCancelModalOpen(false);
          fetchOrder();
        }}
      />

      {/* ── BREADCRUMB HEADER (COMPACT ON MOBILE) ── */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs sticky top-0 z-30 print:hidden">
        <div className="max-w-5xl mx-auto px-2.5 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.back()}
              className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm truncate font-medium text-slate-500">
              <Link href="/orders" className="hover:text-red-600 transition-colors shrink-0">
                Đơn hàng
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="text-slate-900 font-bold font-mono truncate">{order.orderCode}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In đơn</span>
            </button>
            <button
              type="button"
              onClick={copyOrderCode}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Đã chép' : 'Sao chép mã'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2.5 sm:py-6 space-y-3 sm:space-y-5">
        {/* ── BANNER TRẠNG THÁI VÀ NÚT TÁC VỤ ── */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 p-3.5 sm:p-6 overflow-hidden relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-black text-slate-900 font-mono tracking-tight">
                  {order.orderCode}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-[11px] sm:text-xs font-black rounded-full uppercase tracking-wider ${
                    isCancelled
                      ? 'bg-red-100 text-red-700'
                      : order.status === 'COMPLETED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isCancelled
                    ? 'Đã hủy'
                    : STATUS_STEPS.find((s) => s.key === order.status)?.label || order.status}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md ${
                    order.paymentStatus === 'PAID'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {order.paymentStatus === 'PAID' ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                <span>Đặt lúc: {formattedDate}</span>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap print:hidden">
              {isUnpaidSepay && (
                <Link
                  href={`/payment/sepay?orderCode=${order.orderCode}`}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-[#da251d] hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Quét mã VietQR</span>
                </Link>
              )}

              {order.status === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Hủy đơn</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReorder}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>

          {/* ── THỜI GIAN GIAO HÀNG ĐẶT TRƯỚC / CHI NHÁNH BANNER ── */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {order.deliverySlotSnapshot && (
              <div className="p-2.5 bg-red-50/70 border border-red-100 rounded-xl flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-100 text-[#da251d] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Khung giờ giao hàng</span>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                    {order.deliverySlotSnapshot} {deliveryDateFormatted ? `• Ngày ${deliveryDateFormatted}` : ''}
                  </p>
                </div>
              </div>
            )}

            {order.branch && (
              <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Chi nhánh chuẩn bị</span>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{order.branch.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── STEPPER TIẾN ĐỘ ĐƠN HÀNG ── */}
          {!isCancelled ? (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-5 gap-1 text-center relative">
                {STATUS_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStepIndex;
                  const isActive = idx === currentStepIndex;
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="flex flex-col items-center group relative">
                      <div
                        className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isActive
                            ? 'bg-[#da251d] text-white shadow-md shadow-red-500/40 ring-4 ring-red-100 scale-105'
                            : isCompleted
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <span
                        className={`mt-1.5 text-[9px] sm:text-xs font-bold leading-tight line-clamp-1 ${
                          isActive
                            ? 'text-[#da251d] font-black'
                            : isCompleted
                            ? 'text-slate-900 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Đơn hàng đã hủy</p>
                <p className="text-[11px] text-red-600 mt-0.5">{order.cancelReason || 'Khách hàng yêu cầu hủy đơn'}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── THÂN NỘI DUNG 2 CỘT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
          {/* CỘT TRÁI (2/3): DANH SÁCH MÓN & ĐỊA CHỈ */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-5">
            {/* 1. Danh sách món ăn */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="px-3.5 py-3 sm:px-6 sm:py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
                  <ChefHat className="w-4 h-4 text-[#da251d]" />
                  <span>Danh sách món ăn ({order.orderItems?.length || 0})</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {order.orderItems?.map((item: any) => {
                  const dishHref = `/${item.product?.category?.slug || 'menu'}/${item.product?.slug || item.productId}`;

                  return (
                    <div key={item.id} className="p-3 sm:p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                      <Link
                        href={dishHref}
                        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 block group"
                        title={item.product?.name}
                      >
                        {item.product?.imageUrl ? (
                          <Image
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 text-[10px]">Món ăn</div>
                        )}
                      </Link>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <Link
                            href={dishHref}
                            className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1 hover:text-red-600 transition-colors"
                            title={item.product?.name}
                          >
                            {item.product?.name}
                          </Link>
                          <span className="font-black text-slate-900 text-xs sm:text-sm shrink-0">
                            {new Intl.NumberFormat('vi-VN').format((item.priceAtSale || item.originalPriceAtSale || 0) * item.quantity)}đ
                          </span>
                        </div>

                        {item.optionsTextSnapshot && (
                          <p className="text-[11px] text-slate-500 italic mt-0.5 line-clamp-2">
                            {item.optionsTextSnapshot}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded-md text-[11px] text-slate-700">
                              Số lượng: x{item.quantity}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Intl.NumberFormat('vi-VN').format(item.priceAtSale || item.originalPriceAtSale || 0)}đ/món
                            </span>
                          </div>

                          {order.status === 'COMPLETED' && (
                            <Link
                              href={`${dishHref}?openReview=1`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300/90 bg-amber-50/80 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all shadow-2xs group shrink-0 cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 group-hover:scale-110 transition-transform" />
                              <span>Đánh giá món</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Thông tin nhận hàng & Người nhận */}
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 p-3.5 sm:p-6 space-y-3">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <MapPin className="w-4 h-4 text-[#da251d]" />
                <span>Thông tin nhận hàng</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Người nhận</span>
                    <p className="font-bold text-slate-900">{order.customerName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Số điện thoại</span>
                    <p className="font-bold text-slate-900 font-mono">{order.customerPhone}</p>
                  </div>
                </div>

                <div className="sm:col-span-2 flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Địa chỉ nhận</span>
                    <p className="font-medium text-slate-800 leading-relaxed mt-0.5">{order.deliveryAddress}</p>
                  </div>
                </div>

                {order.note && (
                  <div className="sm:col-span-2 flex items-start gap-2.5 p-2.5 bg-amber-50/60 rounded-xl border border-amber-100">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-[10px] font-bold text-amber-800 uppercase">Ghi chú</span>
                      <p className="font-medium text-amber-950 mt-0.5">{order.note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Thông tin Hóa đơn VAT (nếu có) */}
            {order.isInvoiceRequested && (
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 p-3.5 sm:p-6 space-y-3">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>Hóa đơn VAT điện tử</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Công ty:</span>
                    <p className="font-bold text-slate-900">{order.invoiceCompanyName}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">MST:</span>
                    <p className="font-bold text-slate-900 font-mono">{order.invoiceTaxCode}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Địa chỉ VAT:</span>
                    <p className="font-medium text-slate-700">{order.invoiceAddress}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Email nhận HĐ:</span>
                    <p className="font-medium text-slate-700 font-mono">{order.invoiceEmail}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI (1/3): CHI TIẾT THANH TOÁN */}
          <div className="space-y-3 sm:space-y-5">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 p-3.5 sm:p-6 space-y-4 lg:sticky lg:top-20">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                Chi tiết thanh toán
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Tạm tính ({order.orderItems?.length || 0} món):</span>
                  <span className="font-semibold text-slate-800">
                    {new Intl.NumberFormat('vi-VN').format(order.subTotal)}đ
                  </span>
                </div>

                <div className="flex justify-between text-slate-500">
                  <span>Phí giao hàng:</span>
                  <span className="font-semibold text-slate-800">
                    {new Intl.NumberFormat('vi-VN').format(order.shippingFee)}đ
                  </span>
                </div>

                {(order.discountAmount > 0 || order.shippingDiscount > 0) && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Khuyến mãi Voucher:</span>
                    <span>
                      -{new Intl.NumberFormat('vi-VN').format(order.discountAmount + (order.shippingDiscount || 0))}đ
                    </span>
                  </div>
                )}

                {order.taxAmount !== undefined && order.taxAmount !== null && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Thuế GTGT (VAT):</span>
                    <span className="font-semibold text-slate-700">
                      {order.vatPriceModeSnapshot === 'VAT_INCLUDED'
                        ? `Đã bao gồm (${new Intl.NumberFormat('vi-VN').format(order.taxAmount || 0)}đ)`
                        : `+${new Intl.NumberFormat('vi-VN').format(order.taxAmount || 0)}đ (Chưa bao gồm)`}
                    </span>
                  </div>
                )}

                {order.pointsUsed > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Điểm tích lũy ({order.pointsUsed.toLocaleString('vi-VN')} điểm):</span>
                    <span>
                      -{new Intl.NumberFormat('vi-VN').format(
                        Math.round(order.pointsUsed * (order.branch?.pointRedeemRate && order.branch.pointRedeemRate > 0 ? order.branch.pointRedeemRate : 1))
                      )}đ
                    </span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 text-sm">Tổng cộng:</span>
                  <span className="font-black text-lg sm:text-2xl text-[#da251d]">
                    {new Intl.NumberFormat('vi-VN').format(order.totalAmount)}đ
                  </span>
                </div>

                {order.pointsAwarded > 0 && (
                  <p className="text-[11px] text-amber-600 font-medium text-right italic">
                    + Nhận được {order.pointsAwarded} điểm thưởng khi hoàn thành
                  </p>
                )}
              </div>

              {/* KHỐI PHƯƠNG THỨC THANH TOÁN */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phương thức</span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">
                      {order.paymentMethod === 'COD'
                        ? 'Thanh toán tiền mặt khi nhận hàng (COD)'
                        : order.paymentMethod === 'SEPAY'
                        ? 'Chuyển khoản VietQR tự động (SePay)'
                        : order.paymentMethod}
                    </p>
                    <p
                      className={`text-[11px] font-bold ${
                        order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {order.paymentStatus === 'PAID' ? '✓ Đã thanh toán' : '⏳ Chờ thanh toán'}
                    </p>
                  </div>
                </div>

                {/* NÚT THANH TOÁN VIETQR NẾU CHƯA TRẢ */}
                {isUnpaidSepay && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <Link
                      href={`/payment/sepay?orderCode=${order.orderCode}`}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-red-600 to-[#da251d] hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl text-xs shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer text-center"
                    >
                      <QrCode className="w-4 h-4 shrink-0" />
                      <span>Thanh toán ngay bằng VietQR</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* LIÊN HỆ HỖ TRỢ */}
              <div className="pt-1 text-center print:hidden">
                <a
                  href="tel:19001234"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  <span>Cần trợ giúp? Hotline: 1900 1234</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── ĐÁNH GIÁ TRẢI NGHIỆM ĐƠN HÀNG (BẢN GHI BẤT BIẾN) ── */}
        {order.status === 'COMPLETED' && (
          <div id="order-review-section" className="pt-2 sm:pt-4 scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                Đánh giá trải nghiệm đơn hàng
              </h2>
            </div>

            {loadingReview ? (
              <div className="p-8 rounded-3xl bg-white border border-amber-200/80 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="font-semibold text-slate-500">Đang tải thông tin đánh giá đơn hàng...</span>
              </div>
            ) : orderReview ? (
              <OrderReviewTimeline
                orderReview={orderReview}
                daysRemaining={eligibility?.daysRemaining ?? 0}
                isExpired={eligibility?.expired ?? false}
                onFollowUpAdded={(newFu) => {
                  setOrderReview((prev: any) => ({
                    ...prev,
                    followUps: [...(prev?.followUps || []), newFu],
                  }));
                }}
              />
            ) : eligibility?.canReview ? (
              <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
                    <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      Đánh giá đơn hàng & nhận +{eligibility.rewardPoints || 999} điểm AVORA
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ghi lại trải nghiệm ẩm thực bất biến của bạn (Còn {eligibility.daysRemaining || 14} ngày).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderReviewModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-xs font-black shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Đánh giá đơn hàng ngay</span>
                </button>
              </div>
            ) : eligibility?.expired ? (
              <div className="p-6 rounded-3xl bg-white border border-amber-200/80 text-center text-slate-500 text-sm">
                <Clock className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="font-bold text-slate-700">Đã hết thời hạn đánh giá</p>
                <p className="text-xs text-slate-400 mt-1">
                  Thời hạn đánh giá 14 ngày cho đơn hàng này đã kết thúc. Cảm ơn bạn đã tin tưởng AVORA Restaurant!
                </p>
              </div>
            ) : eligibility && !eligibility.canReview ? (
              <div className="p-6 rounded-3xl bg-amber-50/60 border border-amber-200 text-center text-slate-600 text-sm">
                <p className="font-bold text-amber-900">{eligibility.reason || 'Đơn hàng không khả dụng để đánh giá'}</p>
              </div>
            ) : (
              /* Chưa đăng nhập */
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40 border border-amber-200/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Đăng nhập để đánh giá đơn hàng & nhận +999 điểm</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Hãy đăng nhập để chia sẻ trải nghiệm và tích lũy điểm thưởng thành viên AVORA.</p>
                </div>
                <Link
                  href={`/login?redirectURL=${encodeURIComponent(`/orders/${orderCode}?review=1`)}`}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl text-xs font-black shadow-sm transition-all"
                >
                  <User className="w-4 h-4" />
                  <span>Đăng nhập ngay</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Modal Đánh giá Đơn hàng (Rendered via Portal to document.body) */}
        {isMounted && isOrderReviewModalOpen && eligibility?.canReview && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setIsOrderReviewModalOpen(false)}
          >
            <div 
              className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-amber-200/80 p-3.5 sm:p-5 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Đánh giá trải nghiệm đơn hàng</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOrderReviewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <OrderReviewComposer
                orderId={order.id}
                orderCode={order.orderCode || order.temporaryOrderCode}
                rewardPoints={eligibility.rewardPoints || 999}
                daysRemaining={eligibility.daysRemaining || 14}
                onSuccess={(created) => {
                  setIsOrderReviewModalOpen(false);
                  setOrderReview(created);
                  fetchReviewData(order.id);
                }}
              />
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
