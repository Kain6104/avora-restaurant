'use client';

import React, { useRef, useState } from 'react';
import toast, { Toast, resolveValue } from 'react-hot-toast';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from 'lucide-react';

interface SwipeableToastProps {
  t: Toast;
}

export default function SwipeableToast({ t }: SwipeableToastProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDismissing) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDismissing) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startXRef.current;
    const diffY = currentY - startYRef.current;

    // Detect primary direction after 6px movement
    if (isHorizontalRef.current === null) {
      if (Math.abs(diffX) > 6 || Math.abs(diffY) > 6) {
        isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Only swipe horizontally to the left
    if (isHorizontalRef.current) {
      if (diffX < 0) {
        setIsSwiping(true);
        // Add resistance as it pulls further
        setTranslateX(diffX);
      } else {
        // slight resistance if swiping right
        setTranslateX(Math.min(diffX * 0.2, 10));
      }
    }
  };

  const handleTouchEnd = () => {
    if (isDismissing) return;
    if (isHorizontalRef.current && translateX < -50) {
      // Threshold passed -> slide off to left and dismiss
      setIsDismissing(true);
      setTranslateX(-360);
      setTimeout(() => {
        toast.dismiss(t.id);
      }, 160);
    } else {
      // Snap back smoothly
      setTranslateX(0);
    }
    setIsSwiping(false);
    isHorizontalRef.current = null;
  };

  // Determine state icon and color styling
  const type = t.type;
  let statusIcon = null;
  let borderColor = 'border-slate-800/80';
  let iconBg = 'bg-slate-800';

  if (type === 'success') {
    statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    borderColor = 'border-emerald-500/30';
    iconBg = 'bg-emerald-950/60';
  } else if (type === 'error') {
    statusIcon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
    borderColor = 'border-rose-500/30';
    iconBg = 'bg-rose-950/60';
  } else if (type === 'loading') {
    statusIcon = <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />;
    borderColor = 'border-amber-500/30';
    iconBg = 'bg-amber-950/60';
  } else {
    // Custom / Blank / Info
    statusIcon = <Info className="w-4 h-4 text-sky-400 shrink-0" />;
    borderColor = 'border-slate-700/60';
    iconBg = 'bg-slate-800/80';
  }

  // Calculate opacity based on drag distance
  const opacity = translateX < 0 ? Math.max(0.1, 1 - Math.abs(translateX) / 200) : 1;

  return (
    <div
      onClick={() => {
        if (!isSwiping && !isDismissing && t.type !== 'loading') {
          toast.dismiss(t.id);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        transform: `translateX(${translateX}px)`,
        transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        opacity: isDismissing ? 0 : opacity,
      }}
      className={`relative group flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md text-white shadow-xl ${borderColor} border text-[11.5px] font-semibold tracking-tight max-w-[90vw] sm:max-w-md select-none touch-pan-y cursor-pointer active:cursor-grabbing`}
    >
      {/* Icon */}
      <div className={`w-6 h-6 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        {statusIcon}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0 pr-1 text-slate-100 leading-snug break-words">
        {typeof t.message === 'function' ? resolveValue(t.message, t) : t.message}
      </div>

      {/* Desktop Close Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(t.id);
        }}
        className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer shrink-0 hidden sm:flex items-center justify-center"
        aria-label="Đóng thông báo"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

