'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UseFlashSaleRealtimeProps {
  onCampaignChanged?: (campaignId?: string) => void;
  onStockUpdated?: (data: { flashSaleItemId: string; sold: number; remaining: number }) => void;
  onSlotChanged?: (data: { slotId: string; status: string }) => void;
}

export function useFlashSaleRealtime(callbacks?: UseFlashSaleRealtimeProps) {
  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    let socket: Socket;
    try {
      socket = io(SOCKET_URL, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });
      socketRef.current = socket;

      const triggerReload = (payload?: any) => {
        callbacksRef.current?.onCampaignChanged?.(payload?.campaignId || payload?.id);
      };

      socket.on('FLASH_SALE_CREATED', triggerReload);
      socket.on('FLASH_SALE_UPDATED', triggerReload);
      socket.on('FLASH_SALE_STARTED', triggerReload);
      socket.on('FLASH_SALE_ENDED', triggerReload);
      socket.on('FLASH_SALE_PAUSED', triggerReload);
      socket.on('FLASH_SALE_CANCELLED', triggerReload);

      socket.on('FLASH_SALE_STOCK_UPDATED', (payload: any) => {
        callbacksRef.current?.onStockUpdated?.(payload);
      });

      socket.on('FLASH_SALE_SLOT_STARTED', (payload: any) => {
        callbacksRef.current?.onSlotChanged?.(payload);
        triggerReload();
      });

      socket.on('FLASH_SALE_SLOT_ENDED', (payload: any) => {
        callbacksRef.current?.onSlotChanged?.(payload);
        triggerReload();
      });
    } catch (e) {
      console.warn('Could not initialize flash sale realtime socket:', e);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return socketRef.current;
}
