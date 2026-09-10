'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, ShoppingBag, ArrowRight, Clock, FileText } from 'lucide-react';
import Link from 'next/link';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderCode = searchParams.get('orderCode') || '';

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sm:p-12 max-w-lg w-full text-center space-y-6">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20 animate-bounce">
          <CheckCircle2 size={44} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Đặt Hàng & Thanh Toán Thành Công!
          </h1>
          <p className="text-sm text-slate-500">
            Cảm ơn bạn đã đặt món tại <strong>Avora Restaurant</strong>. Nhà hàng đã nhận được thanh toán và đang chuẩn bị đơn hàng của bạn.
          </p>
        </div>

        {orderCode && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Mã đơn hàng
            </span>
            <p className="font-mono font-black text-xl text-red-600">{orderCode}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {orderCode ? (
            <Link
              href={`/orders/${orderCode}`}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <FileText size={16} />
              <span>Xem chi tiết đơn hàng</span>
            </Link>
          ) : (
            <Link
              href="/orders"
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
            >
              <Clock size={16} />
              <span>Theo dõi đơn hàng</span>
            </Link>
          )}

          <Link
            href="/menu"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer"
          >
            <ShoppingBag size={16} />
            <span>Tiếp tục đặt món</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="animate-spin text-red-600">Đang tải...</div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
