import React from 'react';
import MenuClient from './MenuClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const metadata = {
  title: 'Thực Đơn - Avora Restaurant',
  description: 'Khám phá tinh hoa ẩm thực tại Avora',
};

export default async function MenuPage() {
  const categories = await fetch(`${API_URL}/api/categories`, { 
    cache: 'no-store',
    headers: { 'ngrok-skip-browser-warning': 'true' }
  })
    .then(res => res.json())
    .catch(() => []);

  return <MenuClient initialCategories={categories} />;
}
