import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AVORA POS - Hệ Thống Bán Hàng Nhà Hàng Thông Minh',
  description: 'Hệ thống điểm bán hàng POS chuyên nghiệp và thông minh cho AVORA Restaurant',
};

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-screen bg-gray-100 overflow-hidden select-none">
      {children}
    </div>
  );
}
