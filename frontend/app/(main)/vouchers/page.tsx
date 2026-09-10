import React from 'react';
import type { Metadata } from 'next';
import VouchersClient from './VouchersClient';

export const metadata: Metadata = {
  title: 'Kho Voucher & Ví Ưu Đãi | Avora Restaurant',
  description: 'Khám phá hàng loạt mã giảm giá, voucher miễn phí vận chuyển và quản lý ví voucher của bạn tại Avora Restaurant.',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getInitialVouchers(): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/api/promotions/vouchers`, {
      cache: 'no-store',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : (data?.data || []);
    }
  } catch (err) {
    console.warn('Server fetch vouchers failed, fallback to client fetch:', err);
  }
  return [];
}

export default async function VouchersPage() {
  const initialVouchers = await getInitialVouchers();
  return <VouchersClient initialVouchers={initialVouchers} />;
}
