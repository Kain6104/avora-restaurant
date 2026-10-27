import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Đặt Bàn Trực Tuyến & Không Gian Riêng Tư',
  description: 'Đặt bàn trực tuyến nhanh chóng tại các chi nhánh AVORA Restaurant. Lựa chọn phòng VIP riêng tư, view ngắm cảnh và phục vụ chuẩn Nhật Bản.',
  openGraph: {
    title: 'Đặt Bàn Trực Tuyến & Không Gian Riêng Tư | AVORA Restaurant',
    description: 'Trải nghiệm không gian ẩm thực sang trọng và dịch vụ chu đáo chuẩn Nhật tại AVORA Restaurant.',
  },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
