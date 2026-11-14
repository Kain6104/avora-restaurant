'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const FloatingChatbot = dynamic(
  () => import('./FloatingChatbot').then((mod) => mod.FloatingChatbot),
  { ssr: false },
);

export default function FloatingChatbotWrapper() {
  const pathname = usePathname();

  // Ẩn hoàn toàn Chatbot và không tải bundle trên QR Ordering, POS, KDS, Admin và Auth
  if (
    pathname?.startsWith('/qr') ||
    pathname?.startsWith('/chatbot') ||
    pathname?.startsWith('/farm') ||
    pathname?.startsWith('/pos') ||
    pathname?.startsWith('/kds') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/forgot-password')
  ) {
    return null;
  }

  return <FloatingChatbot />;
}
