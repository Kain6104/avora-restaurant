import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#dc2626',
};

export const metadata: Metadata = {
  title: 'AvoBOT - Trợ lý Ẩm thực Thông minh AVORA Restaurant',
  description: 'Trò chuyện toàn màn hình với AvoBOT AI: tư vấn món ăn, tra cứu chi nhánh gần nhất, đề xuất mã giảm giá hợp lệ và hỗ trợ đặt món nhanh chóng.',
  alternates: {
    canonical: 'https://avorafnb.com/chatbot',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ChatbotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-slate-50 flex flex-col">
      {children}
    </div>
  );
}
