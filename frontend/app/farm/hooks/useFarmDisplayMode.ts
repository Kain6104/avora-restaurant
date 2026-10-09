'use client';

import { useState, useEffect, useCallback } from 'react';

export interface FarmDisplayMode {
  isTouchDevice: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  isMobileLandscape: boolean;
  isUltraCompact: boolean;
  isFullscreen: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  supportsNativeFullscreen: boolean;
  isSimulatedFullscreen: boolean;
  viewportWidth: number;
  viewportHeight: number;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
  requestLandscapeFullscreen: () => Promise<{ fullscreen: boolean; locked: boolean }>;
}

export function useFarmDisplayMode(): FarmDisplayMode {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [isUltraCompact, setIsUltraCompact] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [supportsNativeFullscreen, setSupportsNativeFullscreen] = useState(true);
  const [isSimulatedFullscreen, setIsSimulatedFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Kiểm tra thiết bị iOS (iPhone / iPad / iPod)
  const checkIsIOS = useCallback(() => {
    if (typeof navigator === 'undefined') return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }, []);

  // Kiểm tra hỗ trợ Native HTML5 Fullscreen API
  const checkSupportsNativeFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const docEl: any = document.documentElement;
    return Boolean(
      docEl.requestFullscreen ||
      docEl.webkitRequestFullscreen ||
      docEl.mozRequestFullScreen ||
      docEl.msRequestFullscreen
    );
  }, []);

  // Source-of-truth fullscreen check (Native + iOS PWA Standalone + Simulated)
  const checkFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const doc: any = document;
    const hasNative = Boolean(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
    if (hasNative) return true;

    // Chế độ PWA Standalone trên iOS luôn là Toàn Màn Hình 100% không viền
    const isPwa =
      (typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (navigator as any).standalone === true)) ||
      false;
    if (isPwa) return true;

    return isSimulatedFullscreen;
  }, [isSimulatedFullscreen]);

  const updateDisplayMetrics = useCallback(() => {
    if (typeof window === 'undefined') return;

    const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    const ios = checkIsIOS();
    const touch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    const landscape = w >= h;
    const mobileLandscape = landscape && (h <= 520 || (touch && h <= 640));
    const ultraCompact = mobileLandscape && h <= 420;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    const nativeSupport = checkSupportsNativeFullscreen();

    setIsIOS(ios);
    setIsSupportsNative(nativeSupport);
    setIsTouchDevice(touch);
    setIsLandscape(landscape);
    setIsMobileLandscape(mobileLandscape);
    setIsUltraCompact(ultraCompact);
    setIsStandalone(standalone);
    setSupportsNativeFullscreen(nativeSupport);
    setIsFullscreen(checkFullscreen());
    setDimensions({ width: w, height: h });
  }, [checkIsIOS, checkSupportsNativeFullscreen, checkFullscreen]);

  const [isSupportsNative, setIsSupportsNative] = useState(true);

  useEffect(() => {
    updateDisplayMetrics();

    let rafId: number;
    const onResizeOrOrientation = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateDisplayMetrics);
    };

    window.addEventListener('resize', onResizeOrOrientation);
    window.addEventListener('orientationchange', onResizeOrOrientation);
    document.addEventListener('fullscreenchange', onResizeOrOrientation);
    document.addEventListener('webkitfullscreenchange', onResizeOrOrientation);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResizeOrOrientation);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResizeOrOrientation);
      window.removeEventListener('orientationchange', onResizeOrOrientation);
      document.removeEventListener('fullscreenchange', onResizeOrOrientation);
      document.removeEventListener('webkitfullscreenchange', onResizeOrOrientation);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onResizeOrOrientation);
      }
    };
  }, [updateDisplayMetrics]);

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    if (typeof document === 'undefined') return false;
    const docEl: any = document.documentElement;

    // 1. Thử Fullscreen API tiêu chuẩn (Desktop, Android, iPadOS có hỗ trợ)
    try {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen({ navigationUI: 'hide' });
        setIsFullscreen(true);
        setIsSimulatedFullscreen(false);
        return true;
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
        setIsFullscreen(true);
        setIsSimulatedFullscreen(false);
        return true;
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
        setIsFullscreen(true);
        setIsSimulatedFullscreen(false);
        return true;
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
        setIsFullscreen(true);
        setIsSimulatedFullscreen(false);
        return true;
      }
    } catch {
      // Fallback xuống giải pháp iOS
    }

    // 2. Chế độ Toàn Màn Hình Giả Lập cho iOS Safari (Tự động thu gọn thanh công cụ)
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 1, left: 0, behavior: 'smooth' });
      } catch {}
    }
    setIsSimulatedFullscreen(true);
    setIsFullscreen(true);
    return true;
  }, []);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    if (typeof document === 'undefined') return false;
    const doc: any = document;

    try {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
    } catch {}

    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch {}
    }
    setIsSimulatedFullscreen(false);
    setIsFullscreen(false);
    return true;
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (checkFullscreen() || isFullscreen) {
      return await exitFullscreen();
    } else {
      return await enterFullscreen();
    }
  }, [checkFullscreen, isFullscreen, enterFullscreen, exitFullscreen]);

  /**
   * Request Fullscreen + Lock Orientation to Landscape on valid user gesture
   */
  const requestLandscapeFullscreen = useCallback(async (): Promise<{ fullscreen: boolean; locked: boolean }> => {
    let fullscreen = false;
    let locked = false;

    // 1. Attempt Fullscreen (Native hoặc Simulated iOS)
    fullscreen = await enterFullscreen();

    // 2. Attempt Screen Orientation Lock
    try {
      const screenAny: any = typeof screen !== 'undefined' ? screen : null;
      if (screenAny?.orientation?.lock) {
        await screenAny.orientation.lock('landscape');
        locked = true;
      }
    } catch {
      // Orientation lock không hỗ trợ trên iOS Safari
      locked = false;
    }

    updateDisplayMetrics();
    return { fullscreen, locked };
  }, [enterFullscreen, updateDisplayMetrics]);

  return {
    isTouchDevice,
    isLandscape,
    isPortrait: !isLandscape,
    isMobileLandscape,
    isUltraCompact,
    isFullscreen,
    isStandalone,
    isIOS,
    supportsNativeFullscreen,
    isSimulatedFullscreen,
    viewportWidth: dimensions.width,
    viewportHeight: dimensions.height,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    requestLandscapeFullscreen,
  };
}
