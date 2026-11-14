'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getTopModalZIndex, useModalZIndex } from '@/lib/modal-stack';

export interface ResponsiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  maxHeight?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  dragHandle?: boolean;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  hideHeader?: boolean;
  zIndex?: number;
}

const maxWidthMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  full: 'sm:max-w-3xl',
};

export default function ResponsiveModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  headerExtra,
  children,
  footer,
  maxWidth = 'md',
  maxHeight,
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  dragHandle = true,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  footerClassName = '',
  hideHeader = false,
  zIndex = 100,
}: ResponsiveModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stackedZIndex = useModalZIndex(isOpen, zIndex);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape' && stackedZIndex >= getTopModalZIndex()) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (getTopModalZIndex() === 0) {
        document.body.style.overflow = originalOverflow;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose, stackedZIndex]);

  if (!isOpen) return null;

  const maxWidthClass = maxWidthMap[maxWidth] || maxWidthMap.md;

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden"
      style={{ zIndex: stackedZIndex }}
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={() => {
          if (closeOnBackdrop) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Modal / Bottom Sheet Positioner */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4 pointer-events-none z-10">
        <div
          ref={containerRef}
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-auto w-full ${maxWidthClass} bg-white text-slate-800 flex flex-col overflow-hidden shadow-2xl
            rounded-t-[26px] sm:rounded-3xl
            ${maxHeight || 'max-h-[92dvh] sm:max-h-[88vh]'}
            animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ease-out
            border border-slate-100/80
            pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0
            ${className}`}
        >
          {/* Mobile Drag Handle */}
          {dragHandle && (
            <div
              className="sm:hidden pt-2 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing"
              onClick={onClose}
              title="Kéo hoặc chạm để đóng"
            >
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
          )}

          {/* Modal Header */}
          {!hideHeader && (title || showCloseButton || headerExtra) && (
            <div
              className={`px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white ${headerClassName}`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {icon && (
                  <div className="w-8 h-8 rounded-xl bg-red-50 text-[#DA251D] flex items-center justify-center shrink-0 text-sm">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  {typeof title === 'string' ? (
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate tracking-tight">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {headerExtra}
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Đóng"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Modal Body: independent scrolling */}
          <div
            className={`flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 touch-pan-y ${bodyClassName}`}
          >
            {children}
          </div>

          {/* Modal Footer: pinned action bar */}
          {footer && (
            <div
              className={`shrink-0 border-t border-slate-100 px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-50/90 flex items-center justify-end gap-2 ${footerClassName}`}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

