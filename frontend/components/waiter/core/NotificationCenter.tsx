'use client';

import React from 'react';
import { Bell, Utensils, QrCode, Info, X, CheckCheck, ShoppingBag } from 'lucide-react';
import { useRealtimeNotifications } from '@/contexts/NotificationRealtimeProvider';
import { useRouter } from 'next/navigation';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications();

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80]" onClick={onClose} />
      
      <div className="fixed top-0 right-0 h-full w-[85%] max-w-sm bg-slate-50 z-[90] flex flex-col shadow-2xl transition-transform">
        <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100 shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-[#DA251D]" />
            <h2 className="font-bold text-lg text-slate-800">Thông báo</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#DA251D] text-xs font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="p-1.5 text-xs text-slate-500 hover:text-[#DA251D] font-semibold flex items-center gap-1"
                title="Đọc tất cả"
              >
                <CheckCheck size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 active:bg-slate-200">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 touch-pan-y">
          {notifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400">
              <Bell size={32} className="mb-2 text-slate-300" />
              <p className="text-sm font-semibold">Chưa có thông báo nào</p>
            </div>
          ) : (
            notifications.map((n) => {
              const isKitchen = n.type === 'KITCHEN' || n.category === 'KITCHEN';
              const isOrder = n.type === 'ORDER' || n.category === 'ORDER';

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    markAsRead(n.id);
                    if (n.url) {
                      router.push(n.url);
                      onClose();
                    }
                  }}
                  className={`p-4 rounded-2xl shadow-sm border transition-all cursor-pointer flex gap-3 relative ${
                    !n.isRead ? 'bg-white border-red-200 ring-1 ring-red-100' : 'bg-white/80 border-slate-100'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isKitchen
                        ? 'bg-emerald-100 text-emerald-600'
                        : isOrder
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-red-100 text-[#DA251D]'
                    }`}
                  >
                    {isKitchen ? <Utensils size={18} /> : isOrder ? <ShoppingBag size={18} /> : <QrCode size={18} />}
                  </div>

                  <div className="flex-1 min-w-0 pr-12">
                    <h4 className={`text-sm truncate ${!n.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {n.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.content}</p>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                      {new Date(n.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {!n.isRead && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#DA251D] absolute top-4 right-4" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
