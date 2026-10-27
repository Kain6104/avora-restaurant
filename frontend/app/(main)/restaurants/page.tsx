import React from 'react';
import type { Metadata } from 'next';
import RestaurantsClient from './RestaurantsClient';

export const metadata: Metadata = {
  title: 'Hệ Thống Nhà Hàng & Chi Nhánh',
  description: 'Tìm chi nhánh AVORA Restaurant gần bạn nhất. Xem địa chỉ, không gian phòng riêng, giờ mở cửa và đặt bàn trực tiếp.',
  openGraph: {
    title: 'Hệ Thống Nhà Hàng & Chi Nhánh | AVORA Restaurant',
    description: 'Hệ thống chi nhánh ẩm thực Nhật Bản sang trọng của AVORA Restaurant.',
  },
};

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

export default async function RestaurantsPage() {
  const branches = await fetch(`${API_URL}/api/home/branches`, {
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' },
  })
    .then(res => res.json())
    .catch(() => []);

  return <RestaurantsClient initialBranches={Array.isArray(branches) ? branches : []} />;
}
