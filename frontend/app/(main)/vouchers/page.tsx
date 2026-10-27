import React from 'react';
import type { Metadata } from 'next';
import VouchersClient from './VouchersClient';

export const metadata: Metadata = {
  title: 'Kho Voucher & Ưu Đãi Độc Quyền',
  description: 'Khám phá hàng loạt mã giảm giá, voucher miễn phí món ăn và ưu đãi đặt bàn độc quyền tại AVORA Restaurant.',
  openGraph: {
    title: 'Kho Voucher & Ưu Đãi Độc Quyền | AVORA Restaurant',
    description: 'Nhận voucher ưu đãi ẩm thực hấp dẫn tại AVORA Restaurant.',
  },
};

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

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
