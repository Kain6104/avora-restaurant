import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Thanh Toán Đơn Hàng',
  description: 'Hoàn tất đặt món và thanh toán bảo mật tiện lợi qua chuyển khoản ngân hàng, thẻ hoặc tiền mặt tại AVORA Restaurant.',
  openGraph: {
    title: 'Thanh Toán Đơn Hàng | AVORA Restaurant',
    description: 'Thanh toán bảo mật và tiện lợi tại AVORA Restaurant.',
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
