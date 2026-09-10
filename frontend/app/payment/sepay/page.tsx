'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SePayCheckoutForm from '@/components/checkout/SePayCheckoutForm';

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const orderCode = searchParams.get('orderCode') || '';

  if (!orderCode) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 max-w-md text-center space-y-3">
          <p className="font-bold text-gray-800">Thiếu mã đơn hàng</p>
          <p className="text-xs text-gray-500">Vui lòng cung cấp tham số orderCode trên đường dẫn.</p>
        </div>
      </div>
    );
  }

  return <SePayCheckoutForm orderCode={orderCode} />;
}

export default function SePayPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center font-sans">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
