import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Tài Khoản Hội Viên & Điểm Thưởng',
  description: 'Quản lý thông tin cá nhân, hạng thẻ thành viên, điểm thưởng ẩm thực và địa chỉ giao hàng tại AVORA Restaurant.',
  openGraph: {
    title: 'Tài Khoản Hội Viên & Điểm Thưởng | AVORA Restaurant',
    description: 'Quản lý tài khoản hội viên và quyền lợi ưu đãi tại AVORA Restaurant.',
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
