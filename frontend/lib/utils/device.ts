'use client';

import { useState, useEffect } from 'react';

/**
 * Check if current client device is iPhone (or iOS) and not Android.
 */
export function isIPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPod|iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  return isIOS && !isAndroid;
}

/**
 * React hook to reactively check iPhone platform (SSR safe)
 */
export function useIsIPhone(): boolean {
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    const isIos = isIPhoneDevice();
    setIsIPhone(isIos);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-device', isIos ? 'iphone' : 'android');
    }
  }, []);

  return isIPhone;
}
