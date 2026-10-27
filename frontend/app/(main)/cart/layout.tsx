import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Giỏ Hàng Của Bạn',
  description: 'Xem lại các món ăn đã chọn trong giỏ hàng và tiến hành thanh toán tại AVORA Restaurant.',
  openGraph: {
    title: 'Giỏ Hàng Của Bạn | AVORA Restaurant',
    description: 'Thưởng thức ẩm thực Nhật Bản thượng hạng được giao tận nơi từ AVORA Restaurant.',
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
