'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Receipt, CreditCard, ChevronRight,
  Clock, ChefHat, Truck, CheckCircle2, XCircle,
  Phone, User, CalendarDays, FileText, Check, AlertCircle, RefreshCw
} from 'lucide-react';
import Image from 'next/image';
import CancelOrderModal from '@/components/CancelOrderModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_STEPS = [
  { key: 'PENDING', label: 'Chờ xác nhận', icon: Clock },
  { key: 'CONFIRMED', label: 'Đã xác nhận', icon: Check },
  { key: 'PREPARING', label: 'Đang chuẩn bị', icon: ChefHat },
  { key: 'DELIVERING', label: 'Đang giao', icon: Truck },
  { key: 'COMPLETED', label: 'Hoàn thành', icon: CheckCircle2 },
];

export default function OrderDetailPage() {
  const { orderCode } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

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
  }, [orderCode, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  // Determine current step index
  let currentStepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);
  if (currentStepIndex === -1 && order.status !== 'CANCELLED') currentStepIndex = 0;

  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <CancelOrderModal 
        orderCode={orderCode as string}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={() => {
          setIsCancelModalOpen(false);
          fetchOrder();
        }}
      />
      
      {/* ── BREADCRUMB (Sticky) ── */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <Link href="/orders" className="hover:text-red-600 transition-colors">Đơn hàng</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-900 font-bold">Chi tiết {order.orderCode}</span>
          </div>
        </div>
      </div>

      {/* ── HEADER & STATUS TRACKER ── */}
      <div className="bg-white border-b border-slate-200 pt-8 pb-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-black text-slate-800">Đơn hàng {order.orderCode}</h1>
                <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${isCancelled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isCancelled ? 'Đã hủy' : 'Thành công'}
                </span>
              </div>
              <p className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                <CalendarDays className="w-4 h-4" /> 
                {new Date(order.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors flex items-center gap-2">
                <Receipt className="w-4 h-4" /> In hóa đơn
              </button>
              {order.status === 'PENDING' && (
                <button 
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-5 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl text-sm border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> Huỷ đơn
                </button>
              )}
            </div>
          </div>

          {/* Stepper */}
          {!isCancelled ? (
            <div className="relative mt-12 mb-4">
              <div className="absolute top-1/2 left-0 w-full h-1.5 bg-slate-100 -translate-y-1/2 rounded-full" />
              <div 
                className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-orange-400 to-red-500 -translate-y-1/2 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` }} 
              />
              
              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStepIndex;
                  const isActive = idx === currentStepIndex;
                  const Icon = step.icon;
                  
                  return (
                    <div key={step.key} className="flex flex-col items-center gap-3 relative z-10 w-20">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-4 shadow-sm ${
                        isActive 
                          ? 'bg-red-500 border-red-100 text-white shadow-red-500/40 scale-110' 
                          : isCompleted 
                            ? 'bg-orange-500 border-orange-100 text-white' 
                            : 'bg-white border-slate-200 text-slate-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[11px] md:text-xs font-bold text-center leading-tight transition-colors ${
                        isCompleted ? 'text-slate-800' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 text-lg">Đơn hàng đã bị hủy</h3>
                <p className="text-red-600/80 text-sm mt-1">{order.cancelReason || 'Khách hàng yêu cầu hủy đơn.'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
          
          {/* LEFT COLUMN */}
          <div className="w-full lg:w-[65%] space-y-6 md:space-y-8">
            
            {/* 1. Món ăn đã đặt */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ChefHat className="text-orange-500 w-5 h-5" /> Danh sách món ({order.orderItems?.length})
                </h2>
                <Link href="/menu" className="text-sm font-semibold text-orange-600 hover:text-orange-700">Mua lại</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {order.orderItems?.map((item: any) => (
                  <div key={item.id} className="p-6 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="relative w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                      {item.product?.imageUrl ? (
                        <Image src={item.product.imageUrl} alt={item.product.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No Image</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-slate-800 text-base line-clamp-1 pr-4">{item.product?.name}</h3>
                        <p className="font-black text-slate-800 shrink-0">
                          {new Intl.NumberFormat('vi-VN').format(item.priceAtSale * item.quantity)}đ
                        </p>
                      </div>
                      
                      {item.optionsTextSnapshot && (
                        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                          {item.optionsTextSnapshot}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                          Số lượng: <span className="text-slate-800 font-bold">{item.quantity}</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Intl.NumberFormat('vi-VN').format(item.priceAtSale)}đ / phần
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Thông tin giao hàng */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -z-0 opacity-50" />
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                <MapPin className="text-red-500 w-5 h-5" /> Thông tin nhận hàng
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Người nhận</p>
                    <p className="font-bold text-slate-800">{order.customerName}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Số điện thoại</p>
                    <p className="font-bold text-slate-800">{order.customerPhone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 md:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm text-slate-700 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Địa chỉ giao hàng</p>
                    <p className="font-medium text-slate-700 leading-relaxed">{order.deliveryAddress}</p>
                  </div>
                </div>

                {order.note && (
                  <div className="flex items-start gap-4 md:col-span-2">
                    <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Ghi chú</p>
                      <p className="font-medium text-slate-700">{order.note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Yêu cầu Hóa đơn VAT */}
            {order.isInvoiceRequested && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl shadow-sm border border-emerald-100 p-6 md:p-8">
                <h2 className="text-lg font-bold text-emerald-800 mb-6 flex items-center gap-2">
                  <Receipt className="text-emerald-500 w-5 h-5" /> Thông tin xuất hóa đơn VAT
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Tên công ty</p>
                    <p className="font-bold text-emerald-950 text-sm">{order.invoiceCompanyName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Mã số thuế</p>
                    <p className="font-bold text-emerald-950 text-sm font-mono bg-emerald-100/50 inline-block px-2 py-0.5 rounded-md">{order.invoiceTaxCode}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[11px] font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Địa chỉ công ty</p>
                    <p className="font-medium text-emerald-900 text-sm">{order.invoiceAddress}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[11px] font-bold text-emerald-600/70 uppercase tracking-wider mb-1">Email nhận hóa đơn</p>
                    <p className="font-medium text-emerald-900 text-sm">{order.invoiceEmail}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN - SUMMARY */}
          <div className="w-full lg:w-[35%]">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-200/60 p-6 md:p-8 sticky top-24">
              <h2 className="text-xl font-black text-slate-800 mb-6">Thanh toán</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-slate-600 text-sm font-medium">
                  <span>Tạm tính</span>
                  <span>{new Intl.NumberFormat('vi-VN').format(order.subTotal)}đ</span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-sm font-medium">
                  <span>Phí giao hàng</span>
                  <span>{new Intl.NumberFormat('vi-VN').format(order.shippingFee)}đ</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 text-sm font-medium">
                    <span>Khuyến mãi</span>
                    <span>-{new Intl.NumberFormat('vi-VN').format(order.discountAmount)}đ</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 border-dashed pt-4 mb-6 flex justify-between items-end">
                <span className="font-bold text-slate-800">Tổng cộng</span>
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">
                  {new Intl.NumberFormat('vi-VN').format(order.totalAmount)}đ
                </span>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Phương thức thanh toán</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      {order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng' : order.paymentMethod}
                    </p>
                    <p className={`text-xs font-bold mt-0.5 ${order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
