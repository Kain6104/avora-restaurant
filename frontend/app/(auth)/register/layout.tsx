import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Đăng Ký Tài Khoản',
  description: 'Đăng ký tài khoản hội viên AVORA Restaurant ngay hôm nay để nhận voucher giảm giá và tích luỹ điểm thưởng ẩm thực thượng hạng.',
  openGraph: {
    title: 'Đăng Ký Tài Khoản | AVORA Restaurant',
    description: 'Trở thành hội viên AVORA Restaurant để nhận đặc quyền và voucher ưu đãi.',
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
