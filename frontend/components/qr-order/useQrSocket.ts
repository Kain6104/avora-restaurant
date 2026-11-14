'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketPayloadEnvelope {
  eventType?: string;
  payload?: unknown;
}

interface UseQrSocketOptions {
  token: string;
  orderId?: string;
  onOrderUpdated?: (order?: unknown) => void;
  onKitchenItemUpdated?: (item?: unknown) => void;
  onRoundStatusChanged?: (data?: unknown) => void;
  onPaymentCompleted?: (payment?: unknown) => void;
  onServiceRequestUpdated?: (data?: unknown) => void;
  onMenuUpdated?: (data?: unknown) => void;
}

export function useQrSocket({
  token,
  orderId,
  onOrderUpdated,
  onKitchenItemUpdated,
  onRoundStatusChanged,
  onPaymentCompleted,
  onServiceRequestUpdated,
  onMenuUpdated,
}: UseQrSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  const callbacksRef = useRef({
    onOrderUpdated,
    onKitchenItemUpdated,
    onRoundStatusChanged,
    onPaymentCompleted,
    onServiceRequestUpdated,
    onMenuUpdated,
  });

  useEffect(() => {
    callbacksRef.current = {
      onOrderUpdated,
      onKitchenItemUpdated,
      onRoundStatusChanged,
      onPaymentCompleted,
      onServiceRequestUpdated,
      onMenuUpdated,
    };
  }, [
    onOrderUpdated,
    onKitchenItemUpdated,
    onRoundStatusChanged,
    onPaymentCompleted,
    onServiceRequestUpdated,
    onMenuUpdated,
  ]);

  const orderIdRef = useRef(orderId);
  useEffect(() => {
    orderIdRef.current = orderId;
    if (socketRef.current?.connected && token && orderId) {
      socketRef.current.emit('join_qr_session', { token, orderId });
    }
  }, [token, orderId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !token) return;

    const socketUrl =
      process.env.NEXT_PUBLIC_API_URL || window.location.origin;

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
    const initTimer = window.setTimeout(() => {
      setSocketInstance(socket);
    }, 0);

    const handleEventDispatch = (eventType: string, payload: unknown) => {
      const cb = callbacksRef.current;
      switch (eventType) {
        case 'ORDER_UPDATED':
        case 'ORDER_CREATED':
          cb.onOrderUpdated?.(payload);
          break;
        case 'KITCHEN_ITEM_UPDATED':
        case 'KITCHEN_ITEM_STATUS_CHANGED':
          cb.onKitchenItemUpdated?.(payload);
          cb.onOrderUpdated?.(payload);
          break;
        case 'QR_ROUND_APPROVED':
        case 'QR_ROUND_REJECTED':
        case 'QR_ROUND_STATUS_CHANGED':
          cb.onRoundStatusChanged?.(payload);
          cb.onOrderUpdated?.(payload);
          break;
        case 'QR_ORDER_ROUND_SUBMITTED':
        case 'QR_ORDER_CREATED':
        case 'CUSTOMER_ORDER_ADDED':
          cb.onOrderUpdated?.(payload);
          cb.onServiceRequestUpdated?.(payload);
          break;
        case 'PAYMENT_COMPLETED':
          cb.onPaymentCompleted?.(payload);
          break;
        case 'PAYMENT_REQUESTED':
        case 'HELP_REQUESTED':
        case 'SERVICE_REQUEST_UPDATED':
          cb.onServiceRequestUpdated?.(payload);
          cb.onOrderUpdated?.(payload);
          break;
        case 'PRODUCT_AVAILABILITY_CHANGED':
        case 'PRODUCT_PRICE_CHANGED':
        case 'MENU_UPDATED':
          cb.onMenuUpdated?.(payload);
          break;
        default:
          break;
      }
    };

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_qr_session', {
        token,
        orderId: orderIdRef.current,
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    const eventNames = [
      'ORDER_UPDATED',
      'ORDER_CREATED',
      'KITCHEN_ITEM_UPDATED',
      'KITCHEN_ITEM_STATUS_CHANGED',
      'QR_ROUND_APPROVED',
      'QR_ROUND_REJECTED',
      'QR_ROUND_STATUS_CHANGED',
      'QR_ORDER_ROUND_SUBMITTED',
      'QR_ORDER_CREATED',
      'CUSTOMER_ORDER_ADDED',
      'PAYMENT_COMPLETED',
      'PAYMENT_REQUESTED',
      'HELP_REQUESTED',
      'SERVICE_REQUEST_UPDATED',
      'PRODUCT_AVAILABILITY_CHANGED',
      'PRODUCT_PRICE_CHANGED',
      'MENU_UPDATED',
    ];

    eventNames.forEach((eventName) => {
      socket.on(eventName, (envelope?: SocketPayloadEnvelope) => {
        handleEventDispatch(eventName, envelope?.payload ?? envelope);
      });
    });

    socket.on('pos_event', (envelope?: SocketPayloadEnvelope) => {
      if (envelope?.eventType) {
        handleEventDispatch(envelope.eventType, envelope.payload);
      }
    });

    return () => {
      window.clearTimeout(initTimer);
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [token]);

  return {
    socket: socketInstance,
    isConnected,
  };
}
