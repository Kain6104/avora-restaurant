import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWaiterStore } from '../store/useWaiterStore';
import toast from 'react-hot-toast';
import { mutate } from 'swr';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/syncEngine';
import { Bell, Utensils, ChefHat, AlertTriangle } from 'lucide-react';

interface WaiterRealtimePayload {
  id?: string;
  orderId?: string;
  orderCode?: string;
  temporaryOrderCode?: string;
  tableId?: string;
  tableName?: string;
  tableCode?: string;
  table?: { id?: string; name?: string };
  order?: {
    id?: string;
    orderCode?: string;
    temporaryOrderCode?: string;
    tableId?: string;
    tableName?: string;
    table?: { id?: string; name?: string };
    totalAmount?: number;
    status?: string;
    paymentStatus?: string;
    transactionId?: string;
  };
  payment?: {
    amount?: number;
    paymentMethod?: string;
    transactionRef?: string;
  };
  amount?: number;
  paymentMethod?: string;
  transactionCode?: string;
  matchedAt?: string;
  paidAt?: string;
  status?: string;
  paymentStatus?: string;
  totalAmount?: number;
  transactionId?: string;
  notificationMessage?: string;
  productId?: string;
  available?: boolean;
}

interface WaiterRealtimeEnvelope {
  eventType?: string;
  actorId?: string;
  payload?: WaiterRealtimePayload;
}

const isStringKey = (key: unknown): key is string => typeof key === 'string';

export function useWaiterRealtime(token?: string, branchId?: string, userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
  const setNetworkState = useWaiterStore((state) => state.setNetworkState);
  const lastTableToastRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!branchId) return;

    syncEngine.setActiveBranch(branchId);

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Connect to the POS Gateway with credentials and branch subscription
    const socket = io(`${socketUrl}/pos`, {
      withCredentials: true,
      auth: { token, branchId, userId },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;
    const initTimer = window.setTimeout(() => {
      setSocketInstance(socket);
    }, 0);

    socket.on('connect', async () => {
      setNetworkState('ONLINE');
      syncEngine.setNetworkState('ONLINE');
      socket.emit('join_branch', { branchId, cashierId: userId });

      // Trigger delta sync and process any offline queue
      syncEngine.triggerBackgroundSync();
      syncEngine.processOfflineQueue();
    });

    socket.on('connect_error', () => {
      const state = navigator.onLine ? 'SERVER_UNAVAILABLE' : 'OFFLINE';
      setNetworkState(state);
      syncEngine.setNetworkState(state);
    });

    socket.on('disconnect', (reason) => {
      const state = navigator.onLine ? 'SERVER_UNAVAILABLE' : 'OFFLINE';
      setNetworkState(state);
      syncEngine.setNetworkState(state);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    const unwrapPayload = (envelope: WaiterRealtimeEnvelope | WaiterRealtimePayload): WaiterRealtimePayload => {
      if (envelope && 'payload' in envelope && envelope.payload) {
        return envelope.payload;
      }
      return envelope as WaiterRealtimePayload;
    };

    // Hàm phụ trợ thông báo cập nhật bàn (chống hiển thị trùng lặp 2 lần)
    const notifyTableChange = (tableName: string, fallbackMsg: string, keyId: string, customMsg?: string) => {
      const now = Date.now();
      const last = lastTableToastRef.current.get(keyId) || 0;
      if (now - last < 3500) {
        return; // Bỏ qua vì vừa hiển thị cho bàn này cách đây dưới 3.5s
      }
      lastTableToastRef.current.set(keyId, now);

      const cleanTableName = (tableName || '').replace(/^Bàn\s+/i, '').trim() || tableName;
      const normalizedCustomMsg = customMsg
        ? customMsg.replace(/bàn\s+Bàn\s+/gi, 'bàn ')
        : undefined;
      const msg = normalizedCustomMsg || (cleanTableName ? `Có thay đổi ở bàn ${cleanTableName}` : fallbackMsg);
      toast(msg, {
        id: `table-notify-${keyId}`,
        icon: <Bell size={16} className="text-[#DA251D]" />,
        duration: 3000,
      });
      if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
    };

    const dispatchPaymentCompleted = (rawPayload?: WaiterRealtimePayload) => {
      if (typeof window === 'undefined' || !rawPayload) return;
      const ord = rawPayload.order || rawPayload;
      const pmt = rawPayload.payment || {};
      const detail = {
        orderId: rawPayload.orderId || ord?.id || '',
        orderCode: rawPayload.orderCode || ord?.orderCode || '',
        temporaryOrderCode: rawPayload.temporaryOrderCode || ord?.temporaryOrderCode || '',
        tableId: rawPayload.tableId || ord?.tableId || ord?.table?.id || '',
        tableName: rawPayload.tableName || ord?.tableName || ord?.table?.name || '',
        amount: Number(rawPayload.amount ?? pmt?.amount ?? ord?.totalAmount ?? 0),
        paymentMethod: rawPayload.paymentMethod || pmt?.paymentMethod || 'SEPAY_QR',
        transactionCode: rawPayload.transactionCode || pmt?.transactionRef || ord?.transactionId || '',
        paidAt: rawPayload.matchedAt || rawPayload.paidAt || new Date().toISOString(),
        status: rawPayload.status || ord?.status || 'COMPLETED',
        paymentStatus: ord?.paymentStatus || 'PAID',
      };
      if (detail.orderId || detail.orderCode || detail.temporaryOrderCode) {
        window.dispatchEvent(new CustomEvent('avora:payment-completed', { detail }));
      }
    };

    // Realtime Event Listeners
    socket.on('TABLE_STATUS_CHANGED', (envelope: WaiterRealtimeEnvelope | WaiterRealtimePayload) => {
      const payload = unwrapPayload(envelope);
      const actorId = 'actorId' in envelope ? envelope.actorId : undefined;
      const isSelf = Boolean(actorId && userId && actorId === userId);
      const tableName = payload.tableName || payload.table?.name || '';
      const keyId = payload.tableId || payload.table?.id || tableName || 'table';
      if (!isSelf) {
        notifyTableChange(tableName, 'Bàn có cập nhật trạng thái', keyId, payload.notificationMessage);
      }

      // Invalidate and re-fetch table sessions and table list
      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/tables'));
      syncEngine.triggerBackgroundSync();
    });

    socket.on('ORDER_UPDATED', (envelope: WaiterRealtimeEnvelope | WaiterRealtimePayload) => {
      const payload = unwrapPayload(envelope);
      const actorId = 'actorId' in envelope ? envelope.actorId : undefined;
      const isSelf = Boolean(actorId && userId && actorId === userId);
      const tableName = payload.tableName || payload.table?.name || '';
      const keyId = payload.tableId || payload.table?.id || tableName || payload.id || 'order';

      if (payload?.paymentStatus === 'PAID' || payload?.status === 'COMPLETED') {
        dispatchPaymentCompleted(payload);
      } else if (!isSelf) {
        notifyTableChange(tableName, 'Đơn hàng có cập nhật', keyId, payload.notificationMessage);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('avora:order-updated', { detail: payload }));
      }

      // Invalidate and re-fetch orders, tables, and sessions
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
      syncEngine.triggerBackgroundSync();
    });

    socket.on('PAYMENT_COMPLETED', (envelope: WaiterRealtimeEnvelope | WaiterRealtimePayload) => {
      const payload = unwrapPayload(envelope);
      dispatchPaymentCompleted(payload);
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
      syncEngine.triggerBackgroundSync();
    });

    socket.on('pos_order_paid', (payload: WaiterRealtimePayload) => {
      dispatchPaymentCompleted(payload);
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
      syncEngine.triggerBackgroundSync();
    });

    socket.on('pos_event', (envelope: WaiterRealtimeEnvelope) => {
      if (envelope?.eventType === 'bank.transaction.matched' && envelope?.payload) {
        dispatchPaymentCompleted(envelope.payload);
        mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
      }
    });

    socket.on('KITCHEN_ITEM_UPDATED', () => {
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
    });

    socket.on('PRODUCT_AVAILABILITY_CHANGED', async (envelope: WaiterRealtimeEnvelope | WaiterRealtimePayload) => {
      const payload = unwrapPayload(envelope);
      if (payload.productId && typeof payload.available === 'boolean') {
        await db.products.update(payload.productId, { available: payload.available });
      }
      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/products'));
    });

    socket.on('ORDER_CREATED', (envelope: WaiterRealtimeEnvelope | WaiterRealtimePayload) => {
      const payload = unwrapPayload(envelope);
      const tableName = payload.tableName || payload.table?.name || '';
      const msg = tableName ? `Bàn mới mở: ${tableName}` : 'Có đơn hàng mới vừa tạo';
      toast(msg, {
        icon: <Utensils size={16} className="text-slate-700" />,
        id: `order-create-${payload.id}`,
        duration: 3500,
      });

      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/tables'));
    });

    socket.on('KITCHEN_ITEM_STATUS_CHANGED', (payload: WaiterRealtimePayload) => {
      if (payload.status === 'READY') {
        toast.success(`Món ăn đã sẵn sàng phục vụ! (Bàn: ${payload.tableCode || payload.tableName || '...'})`, {
          icon: <ChefHat size={16} className="text-emerald-600" />,
          duration: 4000,
        });
        if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/tables'));
    });

    socket.on('QR_ORDER_CREATED', () => {
      toast('Khách hàng gửi yêu cầu từ QR mới!', {
        icon: <Bell size={16} className="text-[#DA251D]" />,
        duration: 3500,
      });
      if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate([100]);
      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/qr-orders'));
      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/tables'));
    });

    const refreshQrTabCache = () => {
      mutate((key) => isStringKey(key) && key.startsWith('/api/pos/qr-orders'));
    };

    socket.on('QR_ORDER_ROUND_SUBMITTED', refreshQrTabCache);
    socket.on('CUSTOMER_ORDER_ADDED', refreshQrTabCache);
    socket.on('HELP_REQUESTED', refreshQrTabCache);
    socket.on('PAYMENT_REQUESTED', refreshQrTabCache);
    socket.on('SERVICE_REQUEST_UPDATED', refreshQrTabCache);

    socket.on('PRODUCT_PRICE_CHANGED', () => {
      toast('Giá một số món vừa thay đổi.', {
        icon: <AlertTriangle size={16} className="text-amber-500" />,
        duration: 3500,
      });
      mutate('/api/pos/products');
    });

    return () => {
      window.clearTimeout(initTimer);
      socket.disconnect();
      socketRef.current = null;
      setSocketInstance(null);
    };
  }, [token, branchId, userId, setNetworkState]);

  return socketInstance;
}
