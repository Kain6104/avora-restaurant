"use client";

import { useEffect, useCallback } from 'react';

export interface PosShortcutHandlers {
  onPayment?: () => void;           // F1 trong SALE: Thanh toán
  onNewTakeaway?: () => void;       // F1 ngoài SALE: Luôn mở đơn mang đi mới
  onSendToKitchen?: () => void;     // F2 trong SALE: Gửi bếp
  onSaveOrder?: () => void;         // F3 trong SALE: Lưu đơn
  onFocusSearch?: () => void;       // F4 trong SALE: Tìm món
  onOpenTableMap?: () => void;      // Sơ đồ bàn
  onPrintBill?: () => void;         // In tạm tính
  onOpenOrdersList?: () => void;    // Danh sách đơn
  onOpenCustomer?: () => void;      // Chọn/thêm khách hàng
  onEscape?: () => void;            // ESC: Đóng modal / Thoát đơn
}

export function usePosShortcuts(
  handlers: PosShortcutHandlers,
  isSaleMode: boolean = false,
  enabled: boolean = true,
) {
  const {
    onPayment,
    onNewTakeaway,
    onSendToKitchen,
    onSaveOrder,
    onFocusSearch,
    onOpenTableMap,
    onPrintBill,
    onOpenOrdersList,
    onOpenCustomer,
    onEscape,
  } = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      // ESC always works even when typing (to blur input or close modal)
      if (e.key === 'Escape') {
        if (isTyping) {
          (target as HTMLElement).blur();
        }
        if (onEscape) {
          e.preventDefault();
          onEscape();
        }
        return;
      }

      const isFunctionKey = e.key.startsWith('F') && !isNaN(Number(e.key.slice(1)));

      // If user is actively typing in an input/textarea, block character shortcuts (like '/') but ALLOW Function Keys (F1-F12)!
      if (isTyping && !isFunctionKey) return;

      switch (e.key) {
        case 'F1':
          // F1 luôn mở đơn mang đi hoàn toàn mới
          e.preventDefault();
          onNewTakeaway?.();
          break;
        case 'F2':
          // F2 trong SALE: Lưu đơn -> rồi Gửi bếp
          if (isSaleMode) {
            e.preventDefault();
            onSendToKitchen?.();
          }
          break;
        case 'F3':
          // F3 trong SALE: Lưu đơn
          if (isSaleMode) {
            e.preventDefault();
            onSaveOrder?.();
          }
          break;
        case 'F4':
        case 'F8':
          // F4 / F8 trong SALE: Thanh toán
          if (isSaleMode) {
            e.preventDefault();
            onPayment?.();
          }
          break;
        case 'F6':
        case '/':
          if (isSaleMode && !isTyping) {
            e.preventDefault();
            onFocusSearch?.();
          }
          break;
        case 'F9':
          e.preventDefault();
          onOpenOrdersList?.();
          break;
        case 'F10':
          if (isSaleMode) {
            e.preventDefault();
            onOpenCustomer?.();
          }
          break;
        default:
          break;
      }
    },
    [
      enabled,
      isSaleMode,
      onPayment,
      onNewTakeaway,
      onSendToKitchen,
      onSaveOrder,
      onFocusSearch,
      onOpenTableMap,
      onPrintBill,
      onOpenOrdersList,
      onOpenCustomer,
      onEscape,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
