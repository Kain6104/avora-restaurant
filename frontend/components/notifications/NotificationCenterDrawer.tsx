'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { platformBridge } from '@/lib/platform/platform-bridge';
import {
  Bell,
  X,
  CheckCheck,
  Volume2,
  VolumeX,
  ArrowRight,
  ExternalLink,
  Check,
  Trash2,
  Clock,
  Receipt,
  MapPin,
} from 'lucide-react';
import { resolveNotificationVisual } from './notificationIconResolver';

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
  metadata?: Record<string, unknown> | null;
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
  onDeleteNotification: (id: string) => Promise<void>;
  onDeleteAllNotifications: () => Promise<void>;
  selectedNotification?: NotificationItem | null;
  onSelectNotification?: (item: NotificationItem) => void;
  onCloseDetail?: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
}

const CATEGORIES = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'UNREAD', label: 'Chưa đọc' },
  { key: 'ORDER', label: 'Đơn hàng' },
  { key: 'PAYMENT', label: 'Thanh toán' },
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
  onDeleteNotification,
  onDeleteAllNotifications,
  selectedNotification: controlledSelected,
  onSelectNotification,
  onCloseDetail,
  soundEnabled,
  onToggleSound,
  activeCategory,
  onSelectCategory,
}: NotificationCenterDrawerProps) {
  const router = useRouter();
  const { availableBranches } = useAdmin();
  const [localSelected, setLocalSelected] = useState<NotificationItem | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const detailItem = controlledSelected !== undefined ? controlledSelected : localSelected;
  const closeDetailModal = () => {
    setLocalSelected(null);
    onCloseDetail?.();
  };

  const getBranchLabel = (branchId?: string | null, metadata?: Record<string, unknown> | null) => {
    if (!branchId) return null;
    if (typeof metadata?.branchCode === 'string') return metadata.branchCode;
    if (typeof metadata?.branchName === 'string') return metadata.branchName;
    const found = availableBranches?.find((b) => b.id === branchId);
    if (found) return found.branchCode || found.name;
    return branchId.slice(0, 7);
  };

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((item) => Boolean((item.title || '').trim() || (item.content || '').trim()))
      .filter((item) => {
      if (activeCategory === 'UNREAD') return !item.isRead;
      if (activeCategory === 'ORDER') return item.category === 'ORDER' || item.type === 'ORDER';
      if (activeCategory === 'PAYMENT') return item.category === 'PAYMENT' || item.type === 'PAYMENT';
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

  const getCategoryIcon = (category?: string, type?: string, metadata?: Record<string, unknown> | null) => {
    const iconName = typeof metadata?.icon === 'string' ? metadata.icon : undefined;
    const resolved = resolveNotificationVisual(category, type, iconName, 15);
    return (
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${resolved.wrapperClass}`}
      >
        {resolved.icon}
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

  const formatExactVnDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour12: false,
      }).formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
      return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`;
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

  const isCurrentWaiter = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/pos/waiter');

  const resolveTargetUrl = (item: NotificationItem): string | null => {
    let targetUrl = item.url || null;
    if (!targetUrl) {
      if (item.category === 'ORDER' && item.referenceId) {
        targetUrl = `/admin/orders/${item.referenceId}`;
      } else if (item.category === 'RESERVATION' && item.referenceId) {
        targetUrl = `/admin/reservations?id=${item.referenceId}`;
      } else if (item.category === 'MARKETING') {
        targetUrl = '/admin/articles/comments';
      }
    }
    return targetUrl;
  };

  const navigateFromNotification = (item: NotificationItem) => {
    const targetUrl = resolveTargetUrl(item);
    if (!targetUrl) return;
    closeDetailModal();
    onClose();

    const isCurrentWaiterOrPos = typeof window !== 'undefined' && (
      window.location.pathname.startsWith('/admin/pos/waiter') ||
      window.location.pathname.startsWith('/admin/pos')
    );
    if (platformBridge.isDesktop) {
      if (!targetUrl.startsWith('/admin/pos')) return;
    } else if (isCurrentWaiterOrPos) {
      if (!targetUrl.startsWith('/admin/pos')) {
        // Do not navigate POS or Waiter away from active screens to prevent workflow disruption
        return;
      }
    }
    router.push(targetUrl);
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    if (onSelectNotification) {
      onSelectNotification(item);
    } else {
      setLocalSelected({ ...item, isRead: true });
    }
  };

  if (!isOpen && !detailItem) return null;

  return (
    <>
      {isOpen && (
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
                THÔNG BÁO
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

            {/* Delete All */}
            {notifications.length > 0 && (
              confirmClearAll ? (
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmClearAll(false);
                    await onDeleteAllNotifications();
                  }}
                  onMouseLeave={() => setConfirmClearAll(false)}
                  className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold hover:bg-red-700 transition-colors"
                >
                  Xóa hết?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  title="Xóa tất cả thông báo"
                  className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )
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
                  {getCategoryIcon(item.category, item.type, item.metadata)}

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
                      <span className="text-red-600 font-bold flex items-center gap-0.5 group-hover:underline">
                        Xem chi tiết <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>

                  {/* Action column: Unread dot / Read check + Delete single */}
                  <div className="absolute top-3 right-2.5 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
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
                        <span title="Đã đọc" className="text-slate-300">
                          <Check size={13} />
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteNotification(item.id);
                        }}
                        title="Xóa thông báo này"
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 text-xs text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <span>Tổng cộng: {filteredNotifications.length} thông báo</span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="font-bold text-slate-700 hover:text-red-600 hover:underline"
                >
                  Đọc tất cả ({unreadCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (confirmClearAll) {
                    setConfirmClearAll(false);
                    void onDeleteAllNotifications();
                  } else {
                    setConfirmClearAll(true);
                  }
                }}
                className="font-bold text-red-600 hover:underline"
              >
                {confirmClearAll ? 'Bấm lần nữa để xóa hết' : 'Xóa tất cả'}
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* Notification Full Detail Modal (HH:mm DD/MM/YYYY) */}
      {detailItem && (
        <div
          className="fixed inset-0 z-[10010] bg-slate-900/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={closeDetailModal}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {getCategoryIcon(detailItem.category, detailItem.type, detailItem.metadata)}
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 leading-snug">
                    {detailItem.title || 'Chi tiết thông báo'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <Clock size={12} className="text-[#DA251D]" />
                      {formatExactVnDateTime(detailItem.createdAt)}
                    </span>
                    {detailItem.branchId && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 text-[10px] font-bold">
                        {getBranchLabel(detailItem.branchId, detailItem.metadata)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDetailModal}
                aria-label="Đóng chi tiết"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {detailItem.content || 'Không có nội dung chi tiết.'}
                </p>
              </div>

              {(Boolean(detailItem.metadata?.orderCode) ||
                Boolean(detailItem.metadata?.tableName) ||
                typeof detailItem.metadata?.totalAmount === 'number') && (
                <div className="flex flex-wrap gap-2">
                  {typeof detailItem.metadata?.tableName === 'string' && detailItem.metadata.tableName && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-[#DA251D] border border-red-100 text-xs font-bold">
                      <MapPin size={12} />
                      {detailItem.metadata.tableName}
                    </span>
                  )}
                  {(typeof detailItem.metadata?.orderCode === 'string' || typeof detailItem.metadata?.orderCode === 'number') && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold">
                      <Receipt size={12} />
                      #{String(detailItem.metadata.orderCode).replace(/^#/, '')}
                    </span>
                  )}
                  {typeof detailItem.metadata?.totalAmount === 'number' && detailItem.metadata.totalAmount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-bold">
                      {Number(detailItem.metadata.totalAmount).toLocaleString('vi-VN')}₫
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={async () => {
                  const id = detailItem.id;
                  closeDetailModal();
                  await onDeleteNotification(id);
                }}
                className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Xóa thông báo</span>
              </button>

              <div className="flex items-center gap-2">
                {!isCurrentWaiter && resolveTargetUrl(detailItem) && (
                  <button
                    type="button"
                    onClick={() => navigateFromNotification(detailItem)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Mở chi tiết</span>
                    <ExternalLink size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeDetailModal}
                  className="px-4 py-2 rounded-xl bg-[#DA251D] hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
