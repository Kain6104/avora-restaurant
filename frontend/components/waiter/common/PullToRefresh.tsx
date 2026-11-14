'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowDown, Loader2, CheckCircle2, CloudOff } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<any>;
  isOffline?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const PULL_THRESHOLD = 52;
const MAX_PULL = 85;

export default function PullToRefresh({
  onRefresh,
  isOffline = false,
  children,
  className = '',
  disabled = false,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshState, setRefreshState] = useState<'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'offline'>('idle');

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  // Check if scroll container is at the very top (scrollTop <= 0)
  const isAtTop = useCallback(() => {
    if (!containerRef.current) return true;
    return containerRef.current.scrollTop <= 0;
  }, []);

  // Native non-passive touchmove listener so iOS Safari respects preventDefault during pull
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNativeTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current || disabled) return;
      if (!isAtTop()) return;
      const touch = e.touches[0];
      if (!touch) return;
      const diffY = touch.clientY - startYRef.current;
      const diffX = touch.clientX - startXRef.current;
      if (diffY > 6 && Math.abs(diffY) > Math.abs(diffX) && pullDistanceRef.current > 4 && e.cancelable) {
        e.preventDefault();
      }
    };
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onNativeTouchMove);
  }, [disabled, isAtTop]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshingRef.current) return;
    if (isAtTop()) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isPullingRef.current = true;
    } else {
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshingRef.current || disabled) return;

    if (!isAtTop()) {
      isPullingRef.current = false;
      setPullDistance(0);
      setRefreshState('idle');
      return;
    }

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - startYRef.current;
    const diffX = currentX - startXRef.current;

    // Check angle: If horizontal swipe > vertical swipe, don't trigger pull to refresh
    if (Math.abs(diffX) > Math.abs(diffY)) {
      isPullingRef.current = false;
      setPullDistance(0);
      setRefreshState('idle');
      return;
    }

    if (diffY > 0) {
      // Damped curve for smooth rubber-band resistance
      const distance = Math.min(MAX_PULL, Math.pow(diffY, 0.82) * 1.6);
      pullDistanceRef.current = distance;
      setPullDistance(distance);

      if (distance >= PULL_THRESHOLD) {
        if (refreshState !== 'ready') {
          setRefreshState('ready');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(20);
          }
        }
      } else {
        setRefreshState('pulling');
      }

      // Prevent native browser overscroll if pulling down
      if (e.cancelable && distance > 5) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isRefreshingRef.current || disabled) {
      isPullingRef.current = false;
      setPullDistance(0);
      setRefreshState('idle');
      return;
    }

    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      isRefreshingRef.current = true;
      setRefreshState('refreshing');
      setPullDistance(44); // Keep height during refresh animation

      try {
        // Enforce 8s timeout safety
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Refresh timeout')), 8000)
        );
        await Promise.race([onRefresh(), timeoutPromise]);

        if (isOffline) {
          setRefreshState('offline');
        } else {
          setRefreshState('success');
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(35);
          }
        }
      } catch (err) {
        console.warn('PullToRefresh refresh failed or timed out:', err);
        setRefreshState(isOffline ? 'offline' : 'idle');
      } finally {
        // Hold success/offline state briefly (450ms) for pleasant tactile feedback
        setTimeout(() => {
          setPullDistance(0);
          setTimeout(() => {
            setRefreshState('idle');
            isRefreshingRef.current = false;
          }, 200);
        }, 450);
      }
    } else {
      // Spring back
      setPullDistance(0);
      setRefreshState('idle');
    }
  };

  return (
    <div
      ref={containerRef}
      data-pull-to-refresh="true"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y ${className}`}
    >
      {/* PULL INDICATOR HEADER */}
      <div
        className="w-full overflow-hidden transition-all duration-150 flex items-center justify-center shrink-0 select-none pointer-events-none"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 0 ? Math.min(1, pullDistance / 28) : 0,
        }}
      >
        <div className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-white/95 dark:bg-slate-800/95 border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-xs font-bold text-slate-700 dark:text-slate-200 backdrop-blur-xs">
          {refreshState === 'pulling' && (
            <>
              <ArrowDown
                size={14}
                className="text-slate-400 transition-transform"
                style={{
                  transform: `rotate(${Math.min(180, (pullDistance / PULL_THRESHOLD) * 180)}deg)`,
                }}
              />
              <span className="text-[11px] text-slate-500">Kéo xuống để làm mới</span>
            </>
          )}

          {refreshState === 'ready' && (
            <>
              <ArrowDown size={14} className="text-[#DA251D] rotate-180 transition-transform stroke-[2.5]" />
              <span className="text-[11px] text-[#DA251D]">Thả ra để làm mới</span>
            </>
          )}

          {refreshState === 'refreshing' && (
            <>
              <Loader2 size={14} className="text-[#DA251D] animate-spin" />
              <span className="text-[11px] text-slate-700 dark:text-slate-200">Đang làm mới...</span>
            </>
          )}

          {refreshState === 'success' && (
            <>
              <CheckCircle2 size={14} className="text-emerald-500 stroke-[2.5]" />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Đã cập nhật</span>
            </>
          )}

          {refreshState === 'offline' && (
            <>
              <CloudOff size={14} className="text-amber-500" />
              <span className="text-[11px] text-amber-600 dark:text-amber-400">Đang sử dụng dữ liệu ngoại tuyến</span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export { PullToRefresh };
