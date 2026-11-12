import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWaiterStore } from '../store/useWaiterStore';
import toast from 'react-hot-toast';
import { mutate } from 'swr';
import { db } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/syncEngine';
import { Bell, Utensils, ChefHat, AlertTriangle } from 'lucide-react';

export function useWaiterRealtime(token?: string, branchId?: string, userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const setOffline = useWaiterStore((state) => state.setOffline);
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

    // Hàm phụ trợ thông báo cập nhật bàn (chống hiển thị trùng lặp 2 lần)
    const notifyTableChange = (tableName: string, fallbackMsg: string, keyId: string, customMsg?: string) => {
      const now = Date.now();
      const last = lastTableToastRef.current.get(keyId) || 0;
      if (now - last < 3500) {
        return; // Bỏ qua vì vừa hiển thị cho bàn này cách đây dưới 3.5s
      }
      lastTableToastRef.current.set(keyId, now);

      const msg = customMsg || (tableName ? `Có thay đổi ở bàn ${tableName}` : fallbackMsg);
      toast(msg, {
        id: `table-notify-${keyId}`,
        icon: <Bell size={16} className="text-[#DA251D]" />,
        duration: 3500,
      });
      if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(80);
    };

    // Realtime Event Listeners
    socket.on('TABLE_STATUS_CHANGED', (envelope: any) => {
      const payload = envelope?.payload || envelope;
      const tableName = payload.tableName || payload.table?.name || '';
      const keyId = payload.tableId || payload.table?.id || tableName || 'table';
      notifyTableChange(tableName, 'Bàn có cập nhật trạng thái', keyId, payload.notificationMessage);
      
      // Invalidate and re-fetch table sessions and table list
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/pos/tables'));
      syncEngine.triggerBackgroundSync();
    });

    socket.on('ORDER_UPDATED', (envelope: any) => {
      const payload = envelope?.payload || envelope;
      const tableName = payload.tableName || payload.table?.name || '';
      const keyId = payload.tableId || payload.table?.id || tableName || payload.id || 'order';
      notifyTableChange(tableName, 'Đơn hàng có cập nhật', keyId, payload.notificationMessage);

      // Invalidate and re-fetch orders, tables, and sessions
      mutate((key: any) => typeof key === 'string' && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
      syncEngine.triggerBackgroundSync();
    });

    socket.on('PRODUCT_AVAILABILITY_CHANGED', async (envelope: any) => {
      const payload = envelope?.payload || envelope;
      if (payload.productId) {
        await db.products.update(payload.productId, { available: payload.available });
      }
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/pos/products'));
    });

    socket.on('ORDER_CREATED', (envelope: any) => {
      const payload = envelope?.payload || envelope;
      const tableName = payload.tableName || payload.table?.name || '';
      const msg = tableName ? `Bàn mới mở: ${tableName}` : 'Có đơn hàng mới vừa tạo';
      toast(msg, {
        icon: <Utensils size={16} className="text-slate-700" />,
        id: `order-create-${payload.id}`,
        duration: 3500,
      });
      
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/pos/tables'));
    });

    socket.on('KITCHEN_ITEM_STATUS_CHANGED', (payload: any) => {
      if (payload.status === 'READY') {
        toast.success(`Món ăn đã sẵn sàng phục vụ! (Bàn: ${payload.tableCode || payload.tableName || '...'})`, {
          icon: <ChefHat size={16} className="text-emerald-600" />,
          duration: 4000,
        });
        if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/pos/tables'));
    });

    socket.on('QR_ORDER_CREATED', () => {
      toast('Khách hàng gửi yêu cầu gọi món mới!', {
        icon: <Bell size={16} className="text-[#DA251D]" />,
        duration: 3500,
      });
      if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate([100]);
      mutate('/api/pos/qr-orders');
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/pos/tables'));
    });

    socket.on('PRODUCT_PRICE_CHANGED', () => {
      toast('Giá một số món vừa thay đổi.', {
        icon: <AlertTriangle size={16} className="text-amber-500" />,
        duration: 3500,
      });
      mutate('/api/pos/products');
    });

    return () => {
      socket.disconnect();
    };
  }, [token, branchId, userId, setOffline]);

  return socketRef.current;
}
