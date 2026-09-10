'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { mutate } from 'swr';
import { useRouter, usePathname } from 'next/navigation';
import { useAdmin } from './AdminContext';
import { useSoundHaptic } from '@/hooks/useSoundHaptic';
import NotificationCenterDrawer, { NotificationItem } from '@/components/notifications/NotificationCenterDrawer';
import {
  ShoppingBag,
  UtensilsCrossed,
  CalendarCheck,
  CreditCard,
  BellRing,
  MessageSquare,
  ShieldAlert,
  X,
  ArrowRight,
} from 'lucide-react';

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  soundEnabled: boolean;
  toggleSound: () => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationRealtimeContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationRealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isWaiter = pathname?.startsWith('/admin/pos/waiter');
  const { user, selectedBranchId } = useAdmin();
  const { soundEnabled, setSoundEnabled, playSound, triggerHaptic } = useSoundHaptic();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const socketRef = useRef<Socket | null>(null);
  const recentEventIdsRef = useRef<Set<string>>(new Set());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Coalesce buffer for rapid kitchen item / order events
  const coalesceBufferRef = useRef<Map<string, { count: number; timer: NodeJS.Timeout; event: any }>>(
    new Map(),
  );

  // 1. Initial Fetch of authoritative unread count & notifications
  // Không giới hạn branchQuery để Admin và Quản lý luôn nhận đầy đủ thông báo đơn hàng toàn hệ thống
  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/notifications?limit=50`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // 2. Multi-Tab Coordination via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const bc = new BroadcastChannel('avora_realtime_notifications');
    broadcastChannelRef.current = bc;

    bc.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === 'NEW_NOTIFICATION') {
        // Another tab already handled toast & sound; this tab simply updates state
        setNotifications((prev) => [data.notification, ...prev.filter((n) => n.id !== data.notification.id)]);
        setUnreadCount((prev) => prev + 1);
      } else if (data.type === 'READ_ONE') {
        setNotifications((prev) =>
          prev.map((n) => (n.id === data.notificationId ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else if (data.type === 'READ_ALL') {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    };

    return () => {
      bc.close();
    };
  }, []);

  // 3. Mark As Read Actions
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic local update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Broadcast to other open tabs
    broadcastChannelRef.current?.postMessage({
      type: 'READ_ONE',
      notificationId: id,
    });

    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    broadcastChannelRef.current?.postMessage({ type: 'READ_ALL' });

    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      });
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  // 4. Custom Rich Toast Renderer in AVORA Premium Light style
  const showNotificationToast = useCallback(
    (envelope: any) => {
      const getIcon = () => {
        const cat = (envelope.category || envelope.eventType || '').toUpperCase();
        if (cat.includes('ORDER')) return <ShoppingBag className="w-5 h-5 text-red-600" />;
        if (cat.includes('KITCHEN')) return <UtensilsCrossed className="w-5 h-5 text-emerald-600" />;
        if (cat.includes('RESERVATION')) return <CalendarCheck className="w-5 h-5 text-purple-600" />;
        if (cat.includes('PAYMENT')) return <CreditCard className="w-5 h-5 text-amber-600" />;
        if (cat.includes('SERVICE')) return <BellRing className="w-5 h-5 text-orange-600" />;
        if (cat.includes('MARKETING') || cat.includes('ARTICLE')) return <MessageSquare className="w-5 h-5 text-blue-600" />;
        return <ShieldAlert className="w-5 h-5 text-slate-700" />;
      };

      if (isWaiter) {
        // Toast dành riêng cho Phục vụ: Siêu nhỏ gọn, chuyên nghiệp, nằm giữa màn hình phía trên thanh Bottom Nav (~100px)
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-in fade-in slide-in-from-bottom-3' : 'animate-out fade-out slide-out-to-bottom-3'
              } max-w-[88vw] sm:max-w-xs w-full bg-slate-950/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-2xl pointer-events-auto flex items-center gap-3 p-3 transition-all cursor-pointer hover:bg-slate-900 duration-150 select-none`}
              onClick={() => {
                toast.dismiss(t.id);
                if (envelope.notificationId) markAsRead(envelope.notificationId);
                if (envelope.reference?.url) router.push(envelope.reference.url);
                else setIsDrawerOpen(true);
              }}
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                {getIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{envelope.title}</p>
                <p className="text-[11px] text-slate-300 line-clamp-1">{envelope.message}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t.id);
                }}
                className="p-1 text-slate-400 hover:text-white shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ),
          { duration: 4500, position: 'bottom-center' },
        );
        return;
      }

      // Toast dành cho POS & 100% Admin: BÊN TRÁI (top-left), THẤP XUỐNG 1 XÍU, NỀN TRẮNG CHUẨN AVORA
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out slide-out-to-top-3'
            } max-w-sm w-full bg-white text-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-slate-900/5 overflow-hidden border border-slate-200/90 transition-all cursor-pointer hover:bg-slate-50 duration-200 select-none`}
            onClick={() => {
              toast.dismiss(t.id);
              if (envelope.notificationId) {
                markAsRead(envelope.notificationId);
              }
              if (envelope.reference?.url) {
                router.push(envelope.reference.url);
              } else if (envelope.category === 'ORDER' && envelope.reference?.id) {
                router.push(`/admin/orders/${envelope.reference.id}`);
              } else if (envelope.category === 'RESERVATION' && envelope.reference?.id) {
                router.push(`/admin/reservations?id=${envelope.reference.id}`);
              } else {
                setIsDrawerOpen(true);
              }
            }}
          >
            <div className="flex-1 w-0 p-3.5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-50 rounded-xl mt-0.5 shrink-0 border border-slate-100">
                  {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {envelope.title}
                    </p>
                    {envelope.priority === 2 && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-md">
                        Ưu tiên
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed font-normal">
                    {envelope.message}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-red-600 flex items-center gap-0.5">
                      Bấm để xem chi tiết <ArrowRight size={10} />
                    </span>
                    <span className="text-slate-400">Vừa xong</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex border-l border-slate-100">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.dismiss(t.id);
                }}
                className="w-full px-3 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ),
        { duration: 5000, position: 'top-left' },
      );
    },
    [isWaiter, markAsRead, router],
  );

  // 5. Invalidate SWR Caches for Zero-F5 live updates
  const invalidateOperationalCaches = useCallback((envelope: any) => {
    const cat = (envelope.category || envelope.eventType || '').toUpperCase();
    if (cat.includes('ORDER') || envelope.eventType === 'ONLINE_ORDER_CREATED') {
      mutate((key: any) => typeof key === 'string' && (key.startsWith('/api/pos/orders') || key.startsWith('/api/admin/orders')));
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/admin/dashboard'));
    }
    if (cat.includes('KITCHEN') || envelope.eventType === 'KITCHEN_ITEM_READY') {
      mutate((key: any) => typeof key === 'string' && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
    }
    if (cat.includes('RESERVATION')) {
      mutate((key: any) => typeof key === 'string' && (key.startsWith('/api/admin/reservations') || key.startsWith('/api/pos/reservations')));
    }
    if (cat.includes('MARKETING') || envelope.eventType === 'ARTICLE_COMMENT_CREATED') {
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/articles/comments'));
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/admin/articles'));
    }
    if (cat.includes('SERVICE') || envelope.eventType === 'CUSTOMER_HELP_REQUESTED') {
      mutate((key: any) => typeof key === 'string' && key.startsWith('/api/pos/tables'));
    }
  }, []);

  // 6. Handle Realtime Notification Arrival with Deduplication & Coalescing
  const handleRealtimeEnvelope = useCallback(
    (envelope: any) => {
      const eventId = envelope.eventId || `${envelope.eventType}:${Date.now()}`;

      // Deduplication: if we already handled this exact eventId in the last 60 seconds, ignore
      if (recentEventIdsRef.current.has(eventId)) {
        return;
      }
      recentEventIdsRef.current.add(eventId);
      setTimeout(() => recentEventIdsRef.current.delete(eventId), 60000);

      // Create new notification item for state
      const newItem: NotificationItem = {
        id: envelope.notificationId || eventId,
        userId: user?.id || '',
        title: envelope.title,
        content: envelope.message,
        type: envelope.category || envelope.eventType,
        category: envelope.category,
        priority: envelope.priority ?? 1,
        isRead: false,
        branchId: envelope.branchId,
        eventId,
        url: envelope.reference?.url,
        referenceId: envelope.reference?.id,
        createdAt: envelope.occurredAt || new Date().toISOString(),
      };

      // Add to list and bump unread count
      setNotifications((prev) => [newItem, ...prev.filter((n) => n.id !== newItem.id)]);
      setUnreadCount((prev) => prev + 1);

      // Broadcast to other tabs so their lists and counters update
      broadcastChannelRef.current?.postMessage({
        type: 'NEW_NOTIFICATION',
        notification: newItem,
      });

      // Sound & Haptic
      playSound(envelope.priority ?? 1);
      if ((envelope.priority ?? 1) >= 2) {
        triggerHaptic([120, 60, 120]);
      }

      // Coalescing: check if we should group multiple similar events (e.g. 3 kitchen items ready at same table)
      const coalesceKey = `${envelope.eventType}:${envelope.metadata?.tableId || envelope.branchId || 'GLOBAL'}`;
      const existing = coalesceBufferRef.current.get(coalesceKey);

      if (existing) {
        existing.count += 1;
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => {
          coalesceBufferRef.current.delete(coalesceKey);
          if (existing.count > 1 && envelope.eventType === 'KITCHEN_ITEM_READY') {
            showNotificationToast({
              ...envelope,
              title: 'Món đã sẵn sàng',
              message: `${envelope.metadata?.tableName ? `Bàn ${envelope.metadata.tableName}` : 'Bàn'} có ${existing.count} món đã hoàn tất chế biến.`,
            });
          } else {
            showNotificationToast(envelope);
          }
        }, 1500);
      } else {
        const timer = setTimeout(() => {
          coalesceBufferRef.current.delete(coalesceKey);
          showNotificationToast(envelope);
        }, 300);
        coalesceBufferRef.current.set(coalesceKey, { count: 1, timer, event: envelope });
      }

      // Invalidate SWR cache
      invalidateOperationalCaches(envelope);
    },
    [user?.id, playSound, triggerHaptic, showNotificationToast, invalidateOperationalCaches],
  );

  // 7. WebSocket Connection & Event Listeners
  useEffect(() => {
    if (!user?.id) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Connect to /pos namespace with full auth credentials
    const socket: Socket = io(`${socketUrl}/pos`, {
      withCredentials: true,
      auth: {
        userId: user.id,
        branchId: selectedBranchId,
      },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[NotificationRealtimeProvider] Connected to /pos socket as user ${user.id}`);
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        socket.emit('join_branch', { branchId: selectedBranchId });
      }
      // Authoritative resync upon connect/reconnect
      refreshNotifications();
    });

    socket.on('reconnect', () => {
      refreshNotifications();
    });

    // Main notification envelope event directed to user:userId room
    socket.on('notification', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    // Unread count sync
    socket.on('unread_count', (data: { unreadCount: number }) => {
      if (typeof data?.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    });

    // Direct operational broadcast events
    socket.on('ONLINE_ORDER_CREATED', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    socket.on('KITCHEN_ITEM_READY', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    socket.on('CUSTOMER_HELP_REQUESTED', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    socket.on('PAYMENT_REQUESTED', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    socket.on('PAYMENT_SUCCESS', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    socket.on('RESERVATION_CREATED', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    socket.on('ARTICLE_COMMENT_CREATED', (envelope: any) => {
      handleRealtimeEnvelope(envelope);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, selectedBranchId, refreshNotifications, handleRealtimeEnvelope]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(!soundEnabled);
  }, [soundEnabled, setSoundEnabled]);

  return (
    <NotificationRealtimeContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        isDrawerOpen,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        toggleDrawer: () => setIsDrawerOpen((prev) => !prev),
        markAsRead,
        markAllAsRead,
        soundEnabled,
        toggleSound,
        activeCategory,
        setActiveCategory,
        refreshNotifications,
      }}
    >
      {children}

      {/* Global Notification Center Drawer */}
      <NotificationCenterDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />
    </NotificationRealtimeContext.Provider>
  );
}

export function useRealtimeNotifications() {
  const context = useContext(NotificationRealtimeContext);
  if (!context) {
    throw new Error('useRealtimeNotifications must be used within a NotificationRealtimeProvider');
  }
  return context;
}
