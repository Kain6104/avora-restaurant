import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { Toaster } from 'react-hot-toast';
import { FloatingChatbot } from '@/components/FloatingChatbot';

import { Be_Vietnam_Pro } from "next/font/google";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ["vietnamese", "latin"],
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  title: "Avora Restaurant",
  description: "Khám phá hương vị đặc trưng tại Avora Restaurant",
  icons: {
    icon: "/avora_logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${beVietnamPro.variable} font-sans h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50">
        <CartProvider>
          <Toaster 
            position="top-center" 
            containerStyle={{ zIndex: 999999 }}
            toastOptions={{
              className: 'text-sm font-medium',
              duration: 3000,
            }} 
          />
          {children}
          <FloatingChatbot />
        </CartProvider>
      </body>
    </html>
  );
}
