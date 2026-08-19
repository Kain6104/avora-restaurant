import React from 'react';
import type { Metadata } from 'next';
import RestaurantsClient from './RestaurantsClient';

export const metadata: Metadata = {
  title: 'Hệ thống Cửa hàng | Avora Restaurant',
  description: 'Tìm chi nhánh Avora Restaurant gần bạn nhất. Xem địa chỉ, giờ mở cửa, và chỉ đường trực tiếp trên bản đồ.',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default async function RestaurantsPage() {
  const branches = await fetch(`${API_URL}/api/home/branches`, {
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' },
  })
    .then(res => res.json())
    .catch(() => []);

  return <RestaurantsClient initialBranches={Array.isArray(branches) ? branches : []} />;
}
