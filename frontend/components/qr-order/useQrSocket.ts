'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseQrSocketOptions {
  token: string;
  orderId?: string;
  onOrderUpdated?: (order?: any) => void;
  onKitchenItemUpdated?: (item?: any) => void;
  onRoundStatusChanged?: (data?: any) => void;
  onPaymentCompleted?: (payment?: any) => void;
}

export function useQrSocket({
  token,
  orderId,
  onOrderUpdated,
  onKitchenItemUpdated,
  onRoundStatusChanged,
  onPaymentCompleted,
}: UseQrSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !token) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const socket = io(`${socketUrl}/pos`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_qr_session', {
        token,
        orderId,
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen to real-time events
    socket.on('ORDER_UPDATED', (envelope: any) => {
      onOrderUpdated?.(envelope?.payload);
    });

    socket.on('KITCHEN_ITEM_UPDATED', (envelope: any) => {
      onKitchenItemUpdated?.(envelope?.payload);
    });

    socket.on('QR_ROUND_APPROVED', (envelope: any) => {
      onRoundStatusChanged?.(envelope?.payload);
      onOrderUpdated?.(envelope?.payload);
    });

    socket.on('QR_ROUND_REJECTED', (envelope: any) => {
      onRoundStatusChanged?.(envelope?.payload);
      onOrderUpdated?.(envelope?.payload);
    });

    socket.on('PAYMENT_COMPLETED', (envelope: any) => {
      onPaymentCompleted?.(envelope?.payload);
    });

    socket.on('pos_event', (envelope: any) => {
      if (envelope?.eventType === 'QR_ROUND_APPROVED' || envelope?.eventType === 'QR_ROUND_REJECTED') {
        onRoundStatusChanged?.(envelope.payload);
        onOrderUpdated?.(envelope.payload);
      } else if (envelope?.eventType === 'ORDER_UPDATED') {
        onOrderUpdated?.(envelope.payload);
      } else if (envelope?.eventType === 'KITCHEN_ITEM_UPDATED') {
        onKitchenItemUpdated?.(envelope.payload);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, orderId]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
