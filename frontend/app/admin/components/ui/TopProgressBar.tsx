'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export function startTopProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('avora:loading:start'));
  }
}

export function completeTopProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('avora:loading:done'));
  }
}

/**
 * Thanh tiến trình tải mảnh mép trên màn hình phong cách Premium Native.
 * Sử dụng màu đỏ thương hiệu AVORA Burgundy (#800020) với hiệu ứng dạ quang ở đầu thanh.
 * Tự động kích hoạt khi:
 * - Click vào bất kỳ liên kết nội bộ /admin/* nào
 * - Nhấn nút Back / Forward trên trình duyệt (popstate)
 * - Chuyển đổi tham số hoặc route
 * - Gọi startTopProgress() / completeTopProgress() thủ công
 */
export default function TopProgressBar() {
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
  }, []);

  const startProgress = useCallback(() => {
    clearAllTimers();
    isRunningRef.current = true;
    setVisible(true);
    setProgress(15);

    // Tự động tăng dần tiến trình (trickle effect)
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 40) return prev + Math.random() * 15 + 10;
        if (prev < 70) return prev + Math.random() * 8 + 4;
        if (prev < 88) return prev + Math.random() * 3 + 1;
        return prev;
      });
    }, 200);

    // Safety timeout: Tự động hoàn tất sau 8s để không bao giờ bị treo vĩnh viễn
    safetyTimeoutRef.current = setTimeout(() => {
      completeProgress();
    }, 8000);
  }, [clearAllTimers]);

  const completeProgress = useCallback(() => {
    clearAllTimers();
    if (!isRunningRef.current && !visible) return;

    setProgress(100);
    isRunningRef.current = false;

    // Sau khi đạt 100%, mờ dần và ẩn thanh đi
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setProgress(0);
      }, 250);
    }, 180);
  }, [clearAllTimers, visible]);

  // Hoàn tất tiến trình khi pathname thay đổi xong
  useEffect(() => {
    if (isRunningRef.current) {
      completeProgress();
    }
  }, [pathname, completeProgress]);

  // Lắng nghe sự kiện click link nội bộ và browser back/forward
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Click link
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      // Bỏ qua external link, download, new tab, hoặc hash link
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        target.target === '_blank' ||
        target.hasAttribute('download')
      ) {
        return;
      }

      // Chỉ bắt các link nội bộ /admin
      if (href.startsWith('/admin') || href.startsWith('/')) {
        const currentFullPath = window.location.pathname + window.location.search;
        // Nếu click đúng trang hiện tại thì không kích hoạt
        if (href === currentFullPath) return;

        startProgress();
      }
    };

    // 2. Browser Back / Forward buttons
    const handlePopState = () => {
      startProgress();
    };

    // 3. Custom events
    const handleCustomStart = () => startProgress();
    const handleCustomDone = () => completeProgress();

    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('avora:loading:start', handleCustomStart);
    window.addEventListener('avora:loading:done', handleCustomDone);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('avora:loading:start', handleCustomStart);
      window.removeEventListener('avora:loading:done', handleCustomDone);
      clearAllTimers();
    };
  }, [startProgress, completeProgress, clearAllTimers]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-200"
      style={{
        opacity: visible ? 1 : 0,
        height: '2.5px',
      }}
    >
      {/* Background track (cực mỏng, trong suốt) */}
      <div className="w-full h-full relative overflow-hidden bg-transparent">
        {/* Animated Progress Bar */}
        <div
          className="h-full relative transition-all ease-out"
          style={{
            width: `${progress}%`,
            transitionDuration: progress === 100 ? '150ms' : '280ms',
            background: 'linear-gradient(90deg, #800020 0%, #b91c1c 70%, #dc2626 100%)',
          }}
        >
          {/* Luminous Glow at the leading tip */}
          <div
            className="absolute top-0 right-0 bottom-0 w-24 h-full"
            style={{
              boxShadow: '0 0 10px #dc2626, 0 0 5px #800020',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4))',
            }}
          />
        </div>
      </div>
    </div>
  );
}
