"use client";

import { useEffect, useState } from 'react';
import { platformBridge } from '@/lib/platform/platform-bridge';

export function useDesktopUx() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktopDetected =
      platformBridge.isDesktop ||
      (typeof window !== 'undefined' &&
        (Boolean(window.IS_AVORA_DESKTOP) ||
          Boolean((window as any).__AVORA_DESKTOP__) ||
          Boolean((window as any).chrome?.webview?.hostObjects?.nativePrintService)));

    setIsDesktop(desktopDetected);

    if (!desktopDetected) return;

    // Apply desktop-pos-mode class to body & html
    document.documentElement.classList.add('desktop-pos-mode');
    document.body.classList.add('desktop-pos-mode');

    // 1. Prevent Ctrl + Mouse Wheel zoom
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // 2. Prevent Ctrl + / Ctrl - / Ctrl 0 / Ctrl = keyboard zoom
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.ctrlKey &&
        (e.key === '+' ||
          e.key === '-' ||
          e.key === '=' ||
          e.key === '0' ||
          e.code === 'NumpadAdd' ||
          e.code === 'NumpadSubtract' ||
          e.keyCode === 187 ||
          e.keyCode === 189 ||
          e.keyCode === 107 ||
          e.keyCode === 109 ||
          e.keyCode === 48 ||
          e.keyCode === 96)
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 3. Prevent dragging images like a website
    const handleDragStart = (e: DragEvent) => {
      if ((e.target as HTMLElement)?.nodeName === 'IMG') {
        e.preventDefault();
      }
    };

    // 4. Prevent browser context menu outside text inputs
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.allow-context-menu'))
      ) {
        return;
      }
      e.preventDefault();
    };

    // 5. Prevent double tap zoom on touch POS screens
    let lastTouchTime = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchTime <= 300) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
        }
      }
      lastTouchTime = now;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('touchend', handleTouchEnd, false);

    return () => {
      document.documentElement.classList.remove('desktop-pos-mode');
      document.body.classList.remove('desktop-pos-mode');
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('touchend', handleTouchEnd, false);
    };
  }, []);

  return { isDesktop };
}
