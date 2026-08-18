import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { Toaster } from 'react-hot-toast';
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50">
        <CartProvider>
          <Toaster 
            position="top-center" 
            toastOptions={{
              className: 'text-sm font-medium',
              duration: 3000,
            }} 
          />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
