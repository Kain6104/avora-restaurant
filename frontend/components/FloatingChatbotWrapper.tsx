'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FloatingChatbot } from './FloatingChatbot';

export default function FloatingChatbotWrapper() {
  const pathname = usePathname();

  // Ẩn hoàn toàn Chatbot trên các màn hình đặc thù và các trang xác thực (login, register)
  if (
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
