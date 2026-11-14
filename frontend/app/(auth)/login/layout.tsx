import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Đăng Nhập Hội Viên',
  description: 'Đăng nhập vào tài khoản AVORA Restaurant để tích điểm thưởng, quản lý đơn hàng và nhận ưu đãi độc quyền.',
  openGraph: {
    title: 'Đăng Nhập Hội Viên | AVORA Restaurant',
    description: 'Đăng nhập tài khoản AVORA Restaurant để nhận ưu đãi và quản lý đặt bàn dễ dàng.',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
