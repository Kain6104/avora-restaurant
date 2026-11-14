'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { mutate } from 'swr';
import { usePathname } from 'next/navigation';
import { useAdmin } from './AdminContext';
import { useSoundHaptic } from '@/hooks/useSoundHaptic';
import NotificationCenterDrawer, { NotificationItem } from '@/components/notifications/NotificationCenterDrawer';
import {
  X,
  ArrowRight,
} from 'lucide-react';
import { resolveNotificationVisual } from '@/components/notifications/notificationIconResolver';

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
  deleteNotification: (id: string) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  selectedNotification: NotificationItem | null;
  openNotificationDetail: (item: NotificationItem) => void;
  closeNotificationDetail: () => void;
  soundEnabled: boolean;
  toggleSound: () => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationRealtimeContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationRealtimeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWaiter = pathname?.startsWith('/admin/pos/waiter');
  const { user, selectedBranchId } = useAdmin();
  const { soundEnabled, setSoundEnabled, playSound, triggerHaptic } = useSoundHaptic();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const socketRef = useRef<Socket | null>(null);
  const recentEventIdsRef = useRef<Set<string>>(new Set());
  const eventNotificationIdMapRef = useRef<Map<string, string>>(new Map());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  interface NotificationEnvelope {
    eventId?: string;
    eventType?: string;
    notificationId?: string;
    title?: string;
    message?: string;
    content?: string;
    category?: string;
    priority?: number;
    icon?: string;
    branchId?: string;
    actorId?: string;
    url?: string;
    occurredAt?: string;
    reference?: { id?: string; url?: string; type?: string };
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }

  const isStringKey = (key: unknown): key is string => typeof key === 'string';
  const coalesceBufferRef = useRef<Map<string, { count: number; timer: NodeJS.Timeout; event: NotificationEnvelope }>>(
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
        const rawList = Array.isArray(json.data) ? (json.data as NotificationItem[]) : [];
        const sanitized = rawList.filter((n) =>
          Boolean((n?.title || '').trim() || (n?.content || '').trim())
        );
        setNotifications(sanitized);
        setUnreadCount(json.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshNotifications();
    }, 0);
    return () => window.clearTimeout(timer);
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
      } else if (data.type === 'DELETE_ONE') {
        setNotifications((prev) => {
          const target = prev.find((n) => n.id === data.notificationId);
          if (target && !target.isRead) {
            setUnreadCount((u) => Math.max(0, u - 1));
          }
          return prev.filter((n) => n.id !== data.notificationId);
        });
        setSelectedNotification((prev) => (prev?.id === data.notificationId ? null : prev));
      } else if (data.type === 'DELETE_ALL') {
        setNotifications([]);
        setUnreadCount(0);
        setSelectedNotification(null);
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

  const deleteNotification = useCallback(async (id: string) => {
    let wasUnread = false;
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      wasUnread = Boolean(target && !target.isRead);
      return prev.filter((n) => n.id !== id);
    });
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setSelectedNotification((prev) => (prev?.id === id ? null : prev));

    broadcastChannelRef.current?.postMessage({
      type: 'DELETE_ONE',
      notificationId: id,
    });

    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (typeof json.unreadCount === 'number') {
          setUnreadCount(json.unreadCount);
        }
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const deleteAllNotifications = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    setSelectedNotification(null);

    broadcastChannelRef.current?.postMessage({ type: 'DELETE_ALL' });

    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        credentials: 'include',
      });
      toast.success('Đã xóa toàn bộ thông báo');
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const openNotificationDetail = useCallback(
    (item: NotificationItem) => {
      if (!item.isRead) {
        markAsRead(item.id);
      }
      setSelectedNotification({ ...item, isRead: true });
    },
    [markAsRead],
  );

  const closeNotificationDetail = useCallback(() => {
    setSelectedNotification(null);
  }, []);

  // 4. Custom Rich Toast Renderer in AVORA Premium Light style
  const showNotificationToast = useCallback(
    (envelope: NotificationEnvelope) => {
      // 1. Tuyệt đối không hiển thị bất kỳ thông báo Toast nào ở màn hình bếp KDS (/admin/kds)
      const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
      if (currentPath.includes('/kds')) {
        return;
      }

      // Guard against blank notification envelopes with empty title and message
      if (!envelope.title?.trim() && !envelope.message?.trim()) {
        return;
      }

      const getIcon = () =>
        resolveNotificationVisual(
          envelope.category,
          envelope.eventType,
          envelope.icon || (typeof envelope.metadata?.icon === 'string' ? envelope.metadata.icon : undefined),
          20,
        ).icon;

      const resolveMarkReadTarget = () =>
        envelope.notificationId ||
        (envelope.eventId ? eventNotificationIdMapRef.current.get(envelope.eventId) : undefined);

      const openToastDetail = (toastId: string) => {
        toast.dismiss(toastId);
        const notifId = resolveMarkReadTarget();
        if (notifId) {
          markAsRead(notifId);
        }
        setSelectedNotification({
          id: notifId || envelope.eventId || `notif-${Date.now()}`,
          userId: user?.id || '',
          title: envelope.title || 'Thông báo hệ thống',
          content: envelope.message || '',
          type: envelope.category || envelope.eventType,
          category: envelope.category,
          priority: envelope.priority ?? 1,
          isRead: true,
          branchId: envelope.branchId,
          eventId: envelope.eventId,
          metadata: envelope.metadata || (envelope.icon ? { icon: envelope.icon } : undefined),
          url: envelope.reference?.url,
          referenceId: envelope.reference?.id,
          createdAt: envelope.occurredAt || new Date().toISOString(),
        });
        setIsDrawerOpen(true);
      };

      if (isWaiter) {
        // Toast dành riêng cho Phục vụ: Siêu nhỏ gọn, chuyên nghiệp, nằm giữa màn hình phía trên thanh Bottom Nav (~100px)
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-in fade-in slide-in-from-bottom-3' : 'animate-out fade-out slide-out-to-bottom-3'
                } max-w-[88vw] sm:max-w-xs w-full bg-slate-950/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-2xl pointer-events-auto flex items-center gap-3 p-3 transition-all cursor-pointer hover:bg-slate-900 duration-150 select-none`}
              onClick={() => toast.dismiss(t.id)}
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
          { duration: 3000, position: 'bottom-center' },
        );
        return;
      }

      // Toast dành cho POS & 100% Admin: BÊN TRÁI (top-left), THẤP XUỐNG 1 XÍU, NỀN TRẮNG CHUẨN AVORA
      toast.custom(
        (t) => (
          <div
            className={`${t.visible ? 'animate-in fade-in slide-in-from-top-3' : 'animate-out fade-out slide-out-to-top-3'
              } max-w-sm w-full bg-white text-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-slate-900/5 overflow-hidden border border-slate-200/90 transition-all cursor-pointer hover:bg-slate-50 duration-200 select-none`}
            onClick={() => toast.dismiss(t.id)}
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
                    <span className="text-slate-400 font-medium">Thông báo hệ thống</span>
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
        { duration: 3000, position: 'top-left' },
      );
    },
    [isWaiter, markAsRead, pathname, user?.id],
  );

  // 5. Invalidate SWR Caches for Zero-F5 live updates
  const invalidateOperationalCaches = useCallback((envelope: NotificationEnvelope) => {
    const cat = (envelope.category || envelope.eventType || '').toUpperCase();
    if (cat.includes('ORDER') || cat.includes('PAYMENT') || envelope.eventType === 'ONLINE_ORDER_CREATED') {
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/orders') || key.startsWith('/api/admin/orders') || key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/qr-orders')));
      mutate((key) => isStringKey(key) && key.startsWith('/api/admin/dashboard'));
    }
    if (cat.includes('KITCHEN') || envelope.eventType === 'KITCHEN_ITEM_READY') {
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/orders')));
    }
    if (cat.includes('RESERVATION')) {
      mutate((key) => isStringKey(key) && (key.startsWith('/api/admin/reservations') || key.startsWith('/api/pos/reservations')));
    }
    if (cat.includes('MARKETING') || envelope.eventType === 'ARTICLE_COMMENT_CREATED') {
      mutate((key) => isStringKey(key) && key.startsWith('/api/articles/comments'));
      mutate((key) => isStringKey(key) && key.startsWith('/api/admin/articles'));
    }
    if (cat.includes('SERVICE') || cat.includes('QR_') || envelope.eventType === 'CUSTOMER_HELP_REQUESTED' || envelope.eventType === 'HELP_REQUESTED' || envelope.eventType === 'PAYMENT_REQUESTED') {
      mutate((key) => isStringKey(key) && (key.startsWith('/api/pos/tables') || key.startsWith('/api/pos/qr-orders')));
    }
  }, []);

  // 6. Handle Realtime Notification Arrival with Deduplication & Coalescing
  const handleRealtimeEnvelope = useCallback(
    (envelope: NotificationEnvelope) => {
      if (!envelope) return;

      const titleText = typeof envelope.title === 'string' ? envelope.title.trim() : '';
      const messageText =
        typeof envelope.message === 'string'
          ? envelope.message.trim()
          : typeof envelope.content === 'string'
            ? envelope.content.trim()
            : '';

      // Raw operational cache-invalidation events from PosGateway (e.g. emitOrderUpdated) carry payload without title/message.
      // Only refresh caches and DO NOT create blank notification items or blank toasts.
      if (!titleText && !messageText) {
        invalidateOperationalCaches(envelope);
        return;
      }

      const eventId = envelope.eventId || `${envelope.eventType}:${Date.now()}`;

      if (envelope.eventId && envelope.notificationId) {
        const mappedEventId = envelope.eventId;
        eventNotificationIdMapRef.current.set(mappedEventId, envelope.notificationId);
        setTimeout(() => eventNotificationIdMapRef.current.delete(mappedEventId), 120000);
      }

      // Deduplication: if we already handled this exact eventId in the last 60 seconds, patch notificationId if needed and ignore duplicate toast
      if (recentEventIdsRef.current.has(eventId)) {
        const nextNotificationId = envelope.notificationId;
        if (nextNotificationId) {
          setNotifications((prev) =>
            prev.map((n) => (n.eventId === eventId ? { ...n, id: nextNotificationId } : n)),
          );
        }
        return;
      }
      recentEventIdsRef.current.add(eventId);
      setTimeout(() => recentEventIdsRef.current.delete(eventId), 60000);

      // Create new notification item for state
      const newItem: NotificationItem = {
        id: envelope.notificationId || eventId,
        userId: user?.id || '',
        title: titleText || 'Thông báo hệ thống',
        content: messageText || titleText,
        type: envelope.category || envelope.eventType,
        category: envelope.category,
        priority: envelope.priority ?? 1,
        isRead: false,
        branchId: envelope.branchId,
        eventId,
        metadata: envelope.metadata || (envelope.icon ? { icon: envelope.icon } : undefined),
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
    socket.on('notification', (envelope: NotificationEnvelope) => {
      handleRealtimeEnvelope(envelope);
    });

    // Unread count & deletion sync
    socket.on('unread_count', (data: { unreadCount: number }) => {
      if (typeof data?.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    });

    socket.on('notification_deleted', (data: { id?: string; unreadCount?: number }) => {
      if (data?.id) {
        setNotifications((prev) => prev.filter((n) => n.id !== data.id));
        setSelectedNotification((prev) => (prev?.id === data.id ? null : prev));
      }
      if (typeof data?.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    });

    socket.on('notifications_cleared', () => {
      setNotifications([]);
      setUnreadCount(0);
      setSelectedNotification(null);
    });

    // Direct operational broadcast events (14+ canonical order/payment events)
    const standardOperationalEvents = [
      'ONLINE_ORDER_CREATED',
      'ORDER_CREATED',
      'ORDER_UPDATED',
      'CUSTOMER_ORDER_ADDED',
      'ORDER_CANCELED',
      'KITCHEN_ITEM_READY',
      'CUSTOMER_HELP_REQUESTED',
      'HELP_REQUESTED',
      'PAYMENT_REQUESTED',
      'PAYMENT_REQUEST_CANCELLED',
      'PAYMENT_FAILED',
      'CUSTOMER_REDEEMED_ITEM',
      'ORDER_TABLE_CHANGED',
      'ORDER_TYPE_CHANGED',
      'ORDER_SPLIT',
      'ORDER_MERGED',
      'ORDER_STATUS_CHANGED',
      'RESERVATION_CREATED',
      'ARTICLE_COMMENT_CREATED',
      'QR_ORDER_ROUND_SUBMITTED',
      'SERVICE_REQUEST_UPDATED',
    ];

    standardOperationalEvents.forEach((eventName) => {
      socket.on(eventName, (envelope: NotificationEnvelope) => {
        handleRealtimeEnvelope(envelope);
      });
    });

    socket.on('PAYMENT_SUCCESS', (envelope: NotificationEnvelope) => {
      handleRealtimeEnvelope(envelope);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('avora_chatbot_payment_success', {
            detail: {
              orderCode: envelope?.reference?.id || envelope?.metadata?.orderCode,
              amount: envelope?.metadata?.amount,
              message: envelope?.message,
            },
          }),
        );
      }
    });

    socket.on('chatbot_payment_success', (payload: Record<string, unknown>) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('avora_chatbot_payment_success', { detail: payload }));
      }
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
        deleteNotification,
        deleteAllNotifications,
        selectedNotification,
        openNotificationDetail,
        closeNotificationDetail,
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
        onDeleteNotification={deleteNotification}
        onDeleteAllNotifications={deleteAllNotifications}
        selectedNotification={selectedNotification}
        onSelectNotification={openNotificationDetail}
        onCloseDetail={closeNotificationDetail}
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
