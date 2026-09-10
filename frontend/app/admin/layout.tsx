import React from 'react';
import type { Metadata } from 'next';
import AdminLayoutWrapper from './AdminLayoutWrapper';

export const metadata: Metadata = {
  title: 'AVORA Admin & POS Management',
  description: 'Hệ thống quản trị và điểm bán hàng POS AVORA Restaurant',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutWrapper>{children}</AdminLayoutWrapper>;
}
