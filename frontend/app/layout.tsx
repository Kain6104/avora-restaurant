import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import GlobalToaster from "@/components/notifications/GlobalToaster";
import { FloatingChatbot } from '@/components/FloatingChatbot';
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
  viewportFit: "cover",
  themeColor: "#da251d",
};

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
        <LanguageProvider>
          <NotificationProvider>
            <CartProvider>
              <WishlistProvider>
                <GlobalToaster />
                {children}
                <FloatingChatbot />
              </WishlistProvider>
            </CartProvider>
          </NotificationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
