'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { Bell, ShoppingBag, Gift, Award, Info, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuthToken, getAuthHeaders, getApiBaseUrl } from '@/lib/auth';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'SYSTEM' | 'ORDER' | 'PROMOTION' | 'REWARD';
  referenceId?: string | null;
  url?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  // Kiểm tra user hiện tại
  useEffect(() => {
    const checkUser = async () => {
      const token = getAuthToken();
      if (!token) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/forgot-password')) {
          setCurrentUser(null);
          setLoading(false);
          return;
        }
      }

      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/auth/me`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.data || data);
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      }
    };

    checkUser();

    // Lắng nghe cập nhật auth từ toàn hệ thống
    const handleUserUpdate = (e: any) => {
      if (e.detail) {
        setCurrentUser(e.detail);
      } else {
        setCurrentUser(null);
        setNotifications([]);
        setUnreadCount(0);
      }
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  // Lấy danh sách thông báo từ API
  const fetchNotifications = useCallback(async () => {
    if (!getAuthToken()) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/notifications`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const rawList: any[] = Array.isArray(data.data) ? data.data : [];
        const seen = new Set<string>();
        const uniqueList: AppNotification[] = [];
        for (const item of rawList) {
          const id = item.id || item.notificationId || item.eventId || `notif-${Math.random().toString(36).slice(2, 9)}`;
          if (!seen.has(id)) {
            seen.add(id);
            uniqueList.push({
              ...item,
              id,
              content: item.content || item.message || '',
            });
          }
        }
        setNotifications(uniqueList);
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : uniqueList.filter((n) => !n.isRead).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
    }
  }, [currentUser, fetchNotifications]);

  // Đánh dấu 1 thông báo là đã đọc
  const markAsRead = async (id: string) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Đánh dấu tất cả thông báo là đã đọc
  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      const apiBase = getApiBaseUrl();
      await fetch(`${apiBase}/api/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      toast.success('Đã đánh dấu tất cả là đã đọc');
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Thiết lập kết nối WebSocket Realtime
  useEffect(() => {
    if (!currentUser?.id) return;

    const socketUrl = API_URL.replace('/api', '');
    const socket: Socket = io(`${socketUrl}/notifications`, {
      withCredentials: true,
      query: {
        userId: currentUser.id,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('Connected to realtime notifications socket');
      socket.emit('join_user_room', { userId: currentUser.id });
    });

    // Lắng nghe sự kiện nhận thông báo mới realtime
    socket.on('notification', (rawNotif: any) => {
      console.log('Received realtime notification:', rawNotif);
      if (!rawNotif) return;

      const notifId =
        rawNotif.id ||
        rawNotif.notificationId ||
        rawNotif.eventId ||
        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newNotif: AppNotification = {
        id: notifId,
        userId: rawNotif.userId || currentUser?.id || '',
        title: rawNotif.title || 'Thông báo mới',
        content: rawNotif.content || rawNotif.message || '',
        type: rawNotif.type || rawNotif.category || 'SYSTEM',
        referenceId: rawNotif.referenceId || rawNotif.reference?.id || null,
        url: rawNotif.url || rawNotif.reference?.url || null,
        isRead: rawNotif.isRead ?? false,
        createdAt: rawNotif.createdAt || rawNotif.occurredAt || new Date().toISOString(),
      };

      // Cập nhật danh sách thông báo và số lượng chưa đọc ngay lập tức, loại bỏ trùng lặp id
      setNotifications((prev) => {
        const filtered = prev.filter((n) => n.id && n.id !== newNotif.id);
        return [newNotif, ...filtered];
      });
      setUnreadCount((prev) => prev + 1);

      // Đã loại bỏ popup Toast bên phải tại NotificationContext để tránh trùng lặp 2 thông báo
      // Toàn bộ thông báo trực quan trên giao diện được đảm nhiệm thống nhất bởi NotificationRealtimeProvider (top-left)
    });

    // Lắng nghe cập nhật số lượng thông báo chưa đọc
    socket.on('unread_count', (data: { unreadCount: number }) => {
      if (typeof data?.unreadCount === 'number') {
        setUnreadCount(data.unreadCount);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser?.id, router]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
