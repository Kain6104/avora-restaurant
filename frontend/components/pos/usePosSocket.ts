"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { PosEventEnvelope } from './pos-types';

export type SocketConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED';

interface UsePosSocketOptions {
  branchId?: string;
  cashierId?: string;
  onEvent?: (envelope: PosEventEnvelope) => void;
  onOrderCreated?: (order: any, envelope?: PosEventEnvelope) => void;
  onOrderUpdated?: (order: any, envelope?: PosEventEnvelope) => void;
  onTableStatusChanged?: (data: { tableId: string; status: string; session?: any; order?: any }) => void;
  onKitchenTicketNew?: (ticket: any) => void;
  onKitchenItemUpdated?: (item: any) => void;
  onPaymentCompleted?: (data: { order: any; payment: any }) => void;
  onShiftUpdated?: (shift: any) => void;
  onProductAvailabilityChanged?: (data: { productId: string; available: boolean }) => void;
  onSyncSnapshot?: () => void;
  isPosTerminal?: boolean;
  onPrintDispatch?: (payload: any) => void;
  onAccessRevoked?: (data: { userId?: string; reason?: string }) => void;
  onForceLogout?: (data: { userId?: string; reason?: string }) => void;
}

export function usePosSocket(options: UsePosSocketOptions) {
  const {
    branchId,
    cashierId,
    onEvent,
    onOrderCreated,
    onOrderUpdated,
    onTableStatusChanged,
    onKitchenTicketNew,
    onKitchenItemUpdated,
    onPaymentCompleted,
    onShiftUpdated,
    onProductAvailabilityChanged,
    onSyncSnapshot,
    isPosTerminal = false,
    onPrintDispatch,
    onAccessRevoked,
    onForceLogout,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>('CONNECTING');
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Connect to /pos namespace
    const socket = io(`${socketUrl}/pos`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: {
        branchId,
        cashierId,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('CONNECTED');
      if (branchId) {
        socket.emit('join_branch', {
          branchId,
          cashierId,
          clientType: isPosTerminal ? 'POS_TERMINAL' : undefined,
          isPrintHost: !!isPosTerminal,
        });
        if (isPosTerminal) {
          socket.emit('register_pos_terminal', { branchId });
        }
      }
      // Trigger snapshot resync upon connection/reconnection
      onSyncSnapshot?.();
    });

    socket.on('disconnect', (reason) => {
      setConnectionStatus('DISCONNECTED');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('RECONNECTING');
    });

    socket.io.on('reconnect_attempt', () => {
      setConnectionStatus('RECONNECTING');
    });

    socket.io.on('reconnect', () => {
      setConnectionStatus('CONNECTED');
      if (branchId) {
        socket.emit('join_branch', {
          branchId,
          cashierId,
          clientType: isPosTerminal ? 'POS_TERMINAL' : undefined,
          isPrintHost: !!isPosTerminal,
        });
        if (isPosTerminal) {
          socket.emit('register_pos_terminal', { branchId });
        }
      }
      onSyncSnapshot?.();
    });

    // Listen for automated print dispatch from Waiter
    socket.on('print_dispatch', (payload: any) => {
      onPrintDispatch?.(payload);
    });

    // Handle generic Pos event envelope
    socket.on('pos_event', (envelope: PosEventEnvelope) => {
      setLastEventAt(envelope.timestamp);
      onEvent?.(envelope);
    });

    socket.on('ORDER_CREATED', (envelope: PosEventEnvelope) => {
      onOrderCreated?.(envelope.payload, envelope);
    });

    socket.on('ORDER_UPDATED', (envelope: PosEventEnvelope) => {
      onOrderUpdated?.(envelope.payload, envelope);
    });

    socket.on('TABLE_STATUS_CHANGED', (envelope: PosEventEnvelope) => {
      onTableStatusChanged?.(envelope.payload);
    });

    socket.on('KITCHEN_TICKET_NEW', (envelope: PosEventEnvelope) => {
      onKitchenTicketNew?.(envelope.payload);
    });

    socket.on('KITCHEN_ITEM_UPDATED', (envelope: PosEventEnvelope) => {
      onKitchenItemUpdated?.(envelope.payload);
    });

    socket.on('PAYMENT_COMPLETED', (envelope: PosEventEnvelope) => {
      onPaymentCompleted?.(envelope.payload);
    });

    socket.on('SHIFT_OPENED', (envelope: PosEventEnvelope) => {
      onShiftUpdated?.(envelope.payload);
    });

    socket.on('SHIFT_CLOSED', (envelope: PosEventEnvelope) => {
      onShiftUpdated?.(envelope.payload);
    });

    socket.on('PRODUCT_AVAILABILITY_CHANGED', (envelope: PosEventEnvelope) => {
      onProductAvailabilityChanged?.(envelope.payload);
    });

    socket.on('USER_ACCESS_REVOKED', (payload: any) => {
      onAccessRevoked?.(payload);
    });

    socket.on('FORCE_LOGOUT', (payload: any) => {
      onForceLogout?.(payload);
    });

    return () => {
      if (branchId) {
        socket.emit('leave_branch', { branchId });
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [branchId, cashierId]);

  // Đảm bảo cập nhật đăng ký POS Terminal khi isPosTerminal hoặc branchId thay đổi
  useEffect(() => {
    if (socketRef.current?.connected && branchId && isPosTerminal) {
      socketRef.current.emit('register_pos_terminal', { branchId, isAgentOnline: true });
    }
  }, [branchId, isPosTerminal]);

  const emitHealthStatus = useCallback((isAgentOnline: boolean) => {
    if (socketRef.current && branchId) {
      socketRef.current.emit('pos_health_status', { branchId, isAgentOnline });
    }
  }, [branchId]);

  const joinKitchenStation = useCallback((stationId: string) => {
    if (socketRef.current && branchId) {
      socketRef.current.emit('join_kitchen', { branchId, stationId });
    }
  }, [branchId]);

  const leaveKitchenStation = useCallback((stationId: string) => {
    if (socketRef.current && branchId) {
      socketRef.current.emit('leave_kitchen', { branchId, stationId });
    }
  }, [branchId]);

  return {
    socket: socketRef.current,
    connectionStatus,
    lastEventAt,
    joinKitchenStation,
    leaveKitchenStation,
    emitHealthStatus,
  };
}
