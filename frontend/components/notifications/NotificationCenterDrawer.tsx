'use client';

import React, { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { platformBridge } from '@/lib/platform/platform-bridge';
import {
  Bell,
  X,
  CheckCheck,
  ShoppingBag,
  UtensilsCrossed,
  CalendarCheck,
  CreditCard,
  BellRing,
  MessageSquare,
  ShieldAlert,
  Volume2,
  VolumeX,
  ArrowRight,
  ExternalLink,
  Check,
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  type?: string;
  category?: string;
  priority?: number;
  isRead: boolean;
  readAt?: string | null;
  branchId?: string | null;
  eventId?: string | null;
  actorId?: string | null;
  metadata?: any;
  url?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
}

const CATEGORIES = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'UNREAD', label: 'Chưa đọc' },
  { key: 'ORDER', label: 'Đơn hàng' },
  { key: 'KITCHEN', label: 'Bếp KDS' },
  { key: 'RESERVATION', label: 'Đặt bàn' },
  { key: 'SYSTEM', label: 'Hệ thống' },
];

export default function NotificationCenterDrawer({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  soundEnabled,
  onToggleSound,
  activeCategory,
  onSelectCategory,
}: NotificationCenterDrawerProps) {
  const router = useRouter();
  const { availableBranches } = useAdmin();

  const getBranchLabel = (branchId?: string | null, metadata?: any) => {
    if (!branchId) return null;
    if (metadata?.branchCode) return metadata.branchCode;
    if (metadata?.branchName) return metadata.branchName;
    const found = availableBranches?.find((b) => b.id === branchId);
    if (found) return found.branchCode || found.name;
    return branchId.slice(0, 7);
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeCategory === 'UNREAD') return !item.isRead;
      if (activeCategory === 'ORDER') return item.category === 'ORDER' || item.type === 'ORDER';
      if (activeCategory === 'KITCHEN') return item.category === 'KITCHEN' || item.type === 'KITCHEN';
      if (activeCategory === 'RESERVATION') return item.category === 'RESERVATION' || item.type === 'RESERVATION';
      if (activeCategory === 'SYSTEM') {
        return (
          item.category === 'SYSTEM' ||
          item.category === 'SERVICE' ||
          item.category === 'MARKETING' ||
          item.type === 'SYSTEM' ||
          item.type === 'ARTICLE'
        );
      }
      return true;
    });
  }, [notifications, activeCategory]);

  if (!isOpen) return null;

  const getCategoryIcon = (category?: string, type?: string) => {
    const cat = (category || type || '').toUpperCase();
    if (cat === 'ORDER') {
      return (
        <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
          <ShoppingBag size={15} />
        </div>
      );
    }
    if (cat === 'KITCHEN') {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
          <UtensilsCrossed size={15} />
        </div>
      );
    }
    if (cat === 'RESERVATION') {
      return (
        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
          <CalendarCheck size={15} />
        </div>
      );
    }
    if (cat === 'PAYMENT') {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
          <CreditCard size={15} />
        </div>
      );
    }
    if (cat === 'SERVICE') {
      return (
        <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
          <BellRing size={15} />
        </div>
      );
    }
    if (cat === 'MARKETING' || cat === 'ARTICLE') {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
          <MessageSquare size={15} />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
        <ShieldAlert size={15} />
      </div>
    );
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
      if (diffSec < 45) return 'Vừa xong';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  // Prevent body horizontal scroll when drawer is active
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflowX;
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = prevOverflow;
    };
  }, [isOpen]);

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    onClose();

    let targetUrl = item.url;
    if (!targetUrl) {
      if (item.category === 'ORDER' && item.referenceId) {
        targetUrl = `/admin/orders/${item.referenceId}`;
      } else if (item.category === 'RESERVATION' && item.referenceId) {
        targetUrl = `/admin/reservations?id=${item.referenceId}`;
      } else if (item.category === 'MARKETING') {
        targetUrl = '/admin/articles/comments';
      }
    }

    if (!targetUrl) return;

    const isCurrentPos = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/pos');

    // 1. In Desktop POS app: NEVER navigate WebView to non-POS pages!
    if (platformBridge.isDesktop) {
      if (!targetUrl.startsWith('/admin/pos')) {
        platformBridge.openExternalBrowser(targetUrl);
        return;
      }
    } else if (isCurrentPos) {
      // 2. On Web POS: Do not lose active table/order cashier session
      if (!targetUrl.startsWith('/admin/pos')) {
        window.open(targetUrl, '_blank');
        return;
      }
    }

    router.push(targetUrl);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9998] transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer (Touch-friendly & Safe Area aware, strictly contained) */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] max-w-[100vw] bg-white z-[9999] shadow-2xl flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-250 select-none overflow-x-hidden">
        {/* Drawer Header */}
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-xs">
              <Bell size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Trung Tâm Thông Báo
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {unreadCount > 0 ? (
                  <span className="text-[11px] font-bold text-red-600">
                    {unreadCount} thông báo chưa đọc
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-500">
                    Đã đọc toàn bộ
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
              className={`p-2 rounded-xl transition-colors ${
                soundEnabled
                  ? 'text-slate-600 hover:bg-slate-200/60'
                  : 'text-slate-400 hover:bg-slate-200/60'
              }`}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-red-500" />}
            </button>

            {/* Mark All Read */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                title="Đánh dấu tất cả là đã đọc"
                className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-slate-200/60 transition-colors"
              >
                <CheckCheck size={16} />
              </button>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onSelectCategory(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Notifications Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1 touch-pan-y">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Bell size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {activeCategory === 'UNREAD'
                  ? 'Không có thông báo chưa đọc'
                  : 'Chưa có thông báo nào'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Các thông báo vận hành mới nhất từ POS, KDS, đơn Online và đặt bàn sẽ xuất hiện ngay lập tức tại đây.
              </p>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const priorityBadge =
                item.priority === 2
                  ? 'bg-amber-100 text-amber-700'
                  : item.priority === 3
                  ? 'bg-red-100 text-red-700'
                  : null;

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex gap-3 relative group border ${
                    item.isRead
                      ? 'bg-white border-transparent hover:bg-slate-50'
                      : 'bg-red-50/40 border-red-100/80 hover:bg-red-50/70 shadow-2xs'
                  }`}
                >
                  {/* Category Icon */}
                  {getCategoryIcon(item.category, item.type)}

                  {/* Content Body */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4
                        className={`text-xs font-bold leading-tight ${
                          item.isRead ? 'text-slate-800' : 'text-slate-950 font-black'
                        }`}
                      >
                        {item.title}
                      </h4>

                      {/* Priority or Category Badges */}
                      {priorityBadge && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded-md uppercase tracking-wider ${priorityBadge}`}
                        >
                          Ưu tiên
                        </span>
                      )}

                      {item.branchId && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {getBranchLabel(item.branchId, item.metadata)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2 font-normal">
                      {item.content}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400 font-medium">
                      <span>{formatRelativeTime(item.createdAt)}</span>
                      {item.url && (
                        <span className="text-red-600 font-bold flex items-center gap-0.5 group-hover:underline">
                          Xem chi tiết <ArrowRight size={11} />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Unread Ping Dot / Mark Read Action */}
                  <div className="absolute top-3.5 right-3 flex items-center">
                    {!item.isRead ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsRead(item.id);
                        }}
                        title="Đánh dấu đã đọc"
                        className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center hover:scale-110 transition-transform shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        title="Đã đọc"
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500 transition-opacity"
                      >
                        <Check size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span>Tổng cộng: {filteredNotifications.length} thông báo</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="font-bold text-red-600 hover:underline"
              >
                Đọc tất cả ({unreadCount})
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
