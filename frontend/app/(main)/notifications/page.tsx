'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2, Bell, ClipboardList, Gift, Trash2 } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_URL}/api/notifications`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.data || []);
        } else if (res.status === 401) {
          window.location.href = '/login?redirectURL=/notifications';
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      try {
        await fetch(`${API_URL}/api/notifications/${notif.id}/read`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      } catch {}
    }
    if (notif.url) {
      router.push(notif.url);
    } else if (notif.type === 'ORDER') {
      router.push(notif.referenceId ? `/orders/${notif.referenceId}` : '/orders');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen md:py-12 pb-20">
      <div className="container mx-auto px-0 md:px-4 max-w-4xl">
        
        {/* Breadcrumb for Desktop */}
        <div className="hidden md:flex items-center text-sm text-slate-500 mb-6">
          <Link href="/" className="hover:text-red-600 transition-colors font-medium">Trang chủ</Link>
          <ChevronRight size={16} className="mx-2" />
          <span className="text-slate-900 font-bold">Thông Báo</span>
        </div>

        <div className="bg-white md:rounded-3xl shadow-sm border-x md:border border-slate-200 min-h-screen md:min-h-[600px] overflow-hidden flex flex-col">
          
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors bg-slate-50 border border-slate-200">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Thông Báo Của Bạn</h1>
                <p className="text-sm text-slate-500 hidden md:block mt-1 font-medium">Cập nhật các chương trình khuyến mãi và trạng thái đơn hàng mới nhất.</p>
              </div>
            </div>
            {notifications.some(n => !n.isRead) && (
              <button 
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-bold text-sm"
              >
                <CheckCircle2 size={18} />
                <span className="hidden md:inline">Đánh dấu đã đọc</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="divide-y divide-slate-100 flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-sm">
                  <Bell size={40} className="text-slate-300" />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">Chưa có thông báo nào</h2>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">Các thông báo về đơn hàng, khuyến mãi sẽ xuất hiện ở đây.</p>
                <Link href="/menu" className="mt-8 px-8 py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-red-600/20 active:scale-95">
                  Tiếp tục khám phá
                </Link>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-5 md:p-6 flex gap-4 md:gap-6 cursor-pointer transition-all relative group ${!notif.isRead ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50'}`}
                >
                  {!notif.isRead && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-1 h-12 bg-red-600 rounded-r-full hidden md:block"></div>
                  )}
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl shrink-0 flex items-center justify-center shadow-sm border transition-transform group-hover:scale-105 ${!notif.isRead ? 'bg-white border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                    {notif.type === 'ORDER' ? <ClipboardList className={`w-6 h-6 md:w-7 md:h-7 ${!notif.isRead ? 'text-blue-500' : 'text-slate-400'}`} /> : 
                     notif.type === 'PROMOTION' ? <Gift className={`w-6 h-6 md:w-7 md:h-7 ${!notif.isRead ? 'text-red-500' : 'text-slate-400'}`} /> : 
                     <Bell className={`w-6 h-6 md:w-7 md:h-7 ${!notif.isRead ? 'text-amber-500' : 'text-slate-400'}`} />}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-1.5 gap-1 md:gap-4">
                      <h3 className={`text-base md:text-lg leading-tight ${!notif.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                        {notif.title}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap bg-slate-100 px-2.5 py-1 rounded-md w-fit">
                        {new Date(notif.createdAt).toLocaleString('vi-VN', { 
                          hour: '2-digit', minute: '2-digit', 
                          day: '2-digit', month: '2-digit', year: 'numeric' 
                        })}
                      </span>
                    </div>
                    <p className={`text-sm md:text-[15px] leading-relaxed ${!notif.isRead ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                      {notif.content}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <div className="w-3 h-3 bg-red-500 rounded-full shrink-0 self-center md:hidden border-2 border-white shadow-sm"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
