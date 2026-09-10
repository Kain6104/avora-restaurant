"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface CheckoutSignalEnvelope<T = any> {
  eventId: string;
  eventType: string;
  branchId?: string;
  version?: number;
  timestamp: string;
  payload?: T;
}

export interface UseCheckoutSocketOptions {
  branchId?: string;
  userId?: string;
  sessionId?: string;
  onDataChanged?: (signals: CheckoutSignalEnvelope[], summaryText: string) => void;
}

export function useCheckoutSocket(options: UseCheckoutSocketOptions) {
  const { branchId, userId, sessionId, onDataChanged } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Debounce buffer
  const pendingSignalsRef = useRef<CheckoutSignalEnvelope[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onDataChangedRef = useRef(onDataChanged);
  onDataChangedRef.current = onDataChanged;

  const flushSignals = useCallback(() => {
    const signals = [...pendingSignalsRef.current];
    pendingSignalsRef.current = [];
    if (signals.length === 0) return;

    let summaryText = '';
    if (signals.length === 1) {
      const s = signals[0];
      switch (s.eventType) {
        case 'PRODUCT_PRICE_CHANGED': {
          const name = s.payload?.productName || 'Sản phẩm';
          const newPrice = s.payload?.newPrice ? `${Number(s.payload.newPrice).toLocaleString('vi-VN')}₫` : '';
          summaryText = `Giá của ${name} đã thay đổi${newPrice ? ` thành ${newPrice}` : ''}. Tổng thanh toán đã được cập nhật.`;
          break;
        }
        case 'PRODUCT_TAX_UPDATED':
          summaryText = 'Mức thuế VAT của sản phẩm trong đơn đã được cập nhật. Tổng thanh toán đã được tính lại.';
          break;
        case 'PRODUCT_AVAILABILITY_CHANGED':
          summaryText = 'Tình trạng còn hàng của một số món vừa thay đổi. Vui lòng kiểm tra lại đơn hàng.';
          break;
        case 'FLASH_SALE_UPDATED':
          summaryText = 'Ưu đãi Flash Sale vừa có thay đổi. Vui lòng kiểm tra lại tổng thanh toán.';
          break;
        case 'VOUCHER_UPDATED':
          summaryText = 'Mã khuyến mãi hoặc ưu đãi vừa thay đổi điều kiện áp dụng.';
          break;
        case 'OPERATING_SLOT_UPDATED':
          summaryText = 'Khung giờ giao hàng đã chọn vừa thay đổi trạng thái hoặc hết chỗ.';
          break;
        case 'PAYMENT_METHOD_UPDATED':
          summaryText = 'Phương thức thanh toán vừa có cập nhật trạng thái.';
          break;
        case 'FREE_SHIPPING_THRESHOLD_UPDATED':
        case 'SHIPPING_SETTING_UPDATED':
          summaryText = 'Chính sách phí giao hàng vừa được cập nhật.';
          break;
        case 'VAT_SETTING_UPDATED':
          summaryText = 'Chính sách thuế VAT của hệ thống đã thay đổi. Tổng thanh toán đã được tính lại theo cấu hình mới.';
          break;
        default:
          summaryText = 'Đơn hàng vừa được cập nhật dữ liệu mới nhất từ máy chủ.';
      }
    } else {
      // Rule #45: Toast không được spam khi nhiều sự kiện tới cùng lúc
      summaryText = 'Đơn hàng vừa được cập nhật: Một số giá, ưu đãi hoặc chính sách đã thay đổi. Tổng thanh toán đã được tính lại.';
    }

    if (onDataChangedRef.current) {
      onDataChangedRef.current(signals, summaryText);
    }
  }, []);

  const handleIncomingSignal = useCallback(
    (signal: CheckoutSignalEnvelope) => {
      pendingSignalsRef.current.push(signal);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Rule #44: Debounce 600ms để gom event rồi Preview một lần
      debounceTimerRef.current = setTimeout(() => {
        flushSignals();
      }, 600);
    },
    [flushSignals],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const socket: Socket = io(`${socketUrl}/checkout`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        branchId,
        userId,
        sessionId,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_checkout', { branchId, userId, sessionId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Các event realtime bắt buộc (Rule #30)
    const eventNames = [
      'PRODUCT_PRICE_CHANGED',
      'PRODUCT_TAX_UPDATED',
      'PRODUCT_AVAILABILITY_CHANGED',
      'PRODUCT_UPDATED',
      'FLASH_SALE_UPDATED',
      'VOUCHER_UPDATED',
      'OPERATING_SLOT_UPDATED',
      'PAYMENT_METHOD_UPDATED',
      'SHIPPING_SETTING_UPDATED',
      'FREE_SHIPPING_THRESHOLD_UPDATED',
      'VAT_SETTING_UPDATED',
      'BRANCH_UPDATED',
    ];

    eventNames.forEach((ev) => {
      socket.on(ev, (envelope: CheckoutSignalEnvelope) => {
        handleIncomingSignal(envelope || { eventId: '', eventType: ev, timestamp: new Date().toISOString() });
      });
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [branchId, userId, sessionId, handleIncomingSignal]);

  return {
    isConnected,
  };
}
