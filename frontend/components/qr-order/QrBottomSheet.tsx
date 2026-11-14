'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface QrBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerIcon?: React.ReactNode;
  headerBadge?: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightClass?: string;
  showDragHandle?: boolean;
  contentClassName?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

export const QrBottomSheet: React.FC<QrBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerIcon,
  headerBadge,
  footer,
  maxHeightClass = 'max-h-[86dvh]',
  showDragHandle = true,
  contentClassName = 'p-4',
  ariaLabel,
  children,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      sheetRef.current?.focus();
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null || e.touches.length !== 1) return;
    const delta = e.touches[0].clientY - dragStartYRef.current;
    if (delta > 0) {
      setDragOffsetY(Math.min(delta, 220));
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 75) {
      setDragOffsetY(0);
      dragStartYRef.current = null;
      onClose();
      return;
    }
    setDragOffsetY(0);
    dragStartYRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/45 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Hộp thoại'}
    >
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <div
        ref={sheetRef}
        tabIndex={-1}
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: dragOffsetY > 0 ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`bg-white rounded-t-2xl border-t border-slate-200 w-full max-w-lg mx-auto flex flex-col overflow-hidden shadow-lg animate-in slide-in-from-bottom-6 duration-200 pb-[env(safe-area-inset-bottom)] outline-none ${maxHeightClass}`}
      >
        {(showDragHandle || title) && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="shrink-0 bg-white border-b border-slate-100 touch-none"
          >
            {showDragHandle && (
              <div className="pt-2 pb-1 flex justify-center" aria-hidden="true">
                <span className="w-9 h-1 rounded-full bg-slate-300" />
              </div>
            )}

            {(title || headerBadge) && (
              <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {headerIcon && (
                    <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 text-[#DA251D] flex items-center justify-center shrink-0">
                      {headerIcon}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {title && (
                        <h3 className="text-sm font-bold text-slate-900 truncate leading-tight">
                          {title}
                        </h3>
                      )}
                      {headerBadge}
                    </div>
                    {subtitle && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Đóng"
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-500 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className={`flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

