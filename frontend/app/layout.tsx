import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import GlobalToaster from "@/components/notifications/GlobalToaster";
import FloatingChatbotWrapper from '@/components/FloatingChatbotWrapper';
import { Be_Vietnam_Pro } from "next/font/google";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ["vietnamese", "latin"],
  variable: "--font-be-vietnam-pro",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#da251d",
};

export const metadata: Metadata = {
  metadataBase: new URL('https://avorafnb.com'),
  title: {
    default: 'AVORA Restaurant - Tinh Hoa Ẩm Thực Nhật Bản Đương Đại & Omakase Thượng Hạng',
    template: '%s | AVORA Restaurant',
  },
  description: 'Khám phá thế giới ẩm thực Nhật Bản tinh hoa tại AVORA Restaurant. Tận hưởng sushi, sashimi tươi sống tuyển chọn, set omakase thượng hạng và không gian sang trọng đẳng cấp.',
  keywords: [
    'AVORA Restaurant',
    'nhà hàng Nhật Bản',
    'sushi tươi sống',
    'sashimi cao cấp',
    'omakase thượng hạng',
    'đặt bàn nhà hàng',
    'ẩm thực Nhật Bản đương đại',
    'AVORA F&B',
  ],
  authors: [{ name: 'AVORA Culinary Team' }],
  creator: 'AVORA Restaurant',
  publisher: 'AVORA F&B Group',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: 'https://avorafnb.com',
  },
  openGraph: {
    title: 'AVORA Restaurant - Tinh Hoa Ẩm Thực Nhật Bản Đương Đại',
    description: 'Trải nghiệm sushi, sashimi tươi ngon cùng phong cách phục vụ đẳng cấp Nhật Bản tại AVORA Restaurant.',
    url: 'https://avorafnb.com',
    siteName: 'AVORA Restaurant',
    locale: 'vi_VN',
    type: 'website',
    images: [
      {
        url: '/avora_logo.png',
        width: 800,
        height: 600,
        alt: 'AVORA Restaurant Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AVORA Restaurant - Tinh Hoa Ẩm Thực Nhật Bản Đương Đại',
    description: 'Trải nghiệm sushi, sashimi tươi ngon cùng phong cách phục vụ đẳng cấp Nhật Bản tại AVORA Restaurant.',
    images: ['/avora_logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/avora_logo.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/avora_logo.png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${beVietnamPro.variable} font-sans h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50">
        <LanguageProvider>
          <NotificationProvider>
            <CartProvider>
              <WishlistProvider>
                <GlobalToaster />
                {children}
                <FloatingChatbotWrapper />
              </WishlistProvider>
            </CartProvider>
          </NotificationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
