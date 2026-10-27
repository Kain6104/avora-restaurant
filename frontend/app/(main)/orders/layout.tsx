import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Lịch Sử Đơn Hàng & Đặt Bàn',
  description: 'Theo dõi tiến trình các đơn hàng giao món và lịch sử đặt bàn tại chuỗi nhà hàng AVORA.',
  openGraph: {
    title: 'Lịch Sử Đơn Hàng & Đặt Bàn | AVORA Restaurant',
    description: 'Theo dõi đơn hàng và lịch đặt bàn tại AVORA Restaurant.',
  },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
