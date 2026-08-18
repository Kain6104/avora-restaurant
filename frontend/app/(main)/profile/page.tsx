'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  User, LayoutDashboard, ShoppingBag, MapPin, 
  Lock, LogOut, ChevronRight, Edit2, Camera,
  Trophy, CreditCard, Clock, CheckCircle2,
  Phone, Mail, Calendar, ShieldCheck
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'dashboard' | 'profile' | 'address' | 'security';

function ProfileContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'dashboard';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab as Tab);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          toast.error('Vui lòng đăng nhập để tiếp tục');
          window.location.href = '/login?redirectURL=/profile';
        }
      } catch (err) {
        toast.error('Vui lòng đăng nhập để tiếp tục');
        window.location.href = '/login?redirectURL=/profile';
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab;
    if (tab && ['dashboard', 'profile', 'address', 'security'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const menuItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Tổng Quan', icon: <LayoutDashboard size={20} /> },
    { id: 'profile', label: 'Thông Tin Cá Nhân', icon: <User size={20} /> },
    { id: 'address', label: 'Sổ Địa Chỉ', icon: <MapPin size={20} /> },
    { id: 'security', label: 'Bảo Mật', icon: <Lock size={20} /> },
  ];

  return (
    <div className="bg-slate-50 min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        
        {/* Breadcrumb */}
        <div className="flex items-center text-sm text-slate-500 mb-8">
          <Link href="/" className="hover:text-red-600 transition-colors">Trang chủ</Link>
          <ChevronRight size={16} className="mx-2" />
          <span className="text-slate-900 font-medium">Tài Khoản Của Tôi</span>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Sidebar */}
          <div className="w-full md:w-1/4">
            {/* User Short Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white shadow-md overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-md text-slate-600 hover:text-red-600 transition-colors border border-slate-100">
                  <Camera size={16} />
                </button>
              </div>
              <h3 className="font-bold text-lg text-slate-900">{user?.fullName || 'Khách hàng'}</h3>
              <p className="text-slate-500 text-sm">Thành viên Hạng Vàng</p>
              <div className="mt-3 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                <Trophy size={14} className="mr-1" /> {new Intl.NumberFormat('vi-VN').format(user?.points || 0)} Điểm
              </div>
            </div>

            {/* Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex flex-col">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-between px-6 py-4 transition-colors ${
                      activeTab === item.id 
                        ? 'bg-red-50 text-red-600 border-l-4 border-red-600 font-bold' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {activeTab === item.id && <ChevronRight size={18} />}
                  </button>
                ))}

                {/* Orders — external link to /orders page */}
                <Link
                  href="/orders"
                  className="flex items-center justify-between px-6 py-4 text-slate-600 hover:bg-slate-50 hover:text-red-600 font-medium border-l-4 border-transparent hover:border-red-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingBag size={20} />
                    <span>Lịch Sử Đơn Hàng</span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </Link>
                
                <hr className="border-slate-100" />
                
                <button onClick={async () => {
                  try {
                    await fetch(`${API_URL}/api/auth/logout`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'ngrok-skip-browser-warning': 'true'
                      }
                    });
                    window.location.href = '/login';
                  } catch (err) {
                    console.error('Logout failed:', err);
                  }
                }} className="flex items-center gap-3 px-6 py-4 text-slate-600 hover:bg-slate-50 hover:text-red-600 font-medium transition-colors w-full text-left">
                  <LogOut size={20} />
                  <span>Đăng Xuất</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="w-full md:w-3/4">
            
            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Virtual Membership Card */}
                <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl p-8 text-white shadow-xl shadow-amber-600/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-black opacity-10 rounded-full blur-xl"></div>
                  
                  <div className="relative z-10 flex justify-between items-start mb-8">
                    <div>
                      <p className="text-amber-100 text-sm font-medium uppercase tracking-wider mb-1">Thành Viên</p>
                      <h2 className="text-3xl font-black tracking-tight">GOLD TIER</h2>
                    </div>
                    <img src="/avora_logo.png" alt="Logo" className="h-10 brightness-0 invert opacity-90" />
                  </div>

                  <div className="relative z-10">
                    <p className="text-amber-100 text-xs uppercase tracking-wider mb-1">Chủ Thẻ</p>
                    <p className="text-2xl font-semibold tracking-widest font-mono">{user?.fullName?.toUpperCase() || 'KHÁCH HÀNG'}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative z-10 mt-8 pt-6 border-t border-amber-300/30">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <p className="text-amber-100 text-xs">Điểm hiện tại</p>
                        <p className="text-xl font-bold">{new Intl.NumberFormat('vi-VN').format(user?.points || 0)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-100 text-xs">Hạng Kim Cương</p>
                        <p className="text-xl font-bold">5,000</p>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(((user?.points || 0) / 5000) * 100, 100)}%` }}></div>
                    </div>
                    <p className="text-center text-xs text-amber-100 mt-2">Cần tích lũy thêm {new Intl.NumberFormat('vi-VN').format(Math.max(5000 - (user?.points || 0), 0))} điểm để lên hạng tiếp theo</p>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      <ShoppingBag size={24} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Đơn Hàng</p>
                      <p className="text-xl font-black text-slate-900">{user?.orders?.length || 0}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Tổng Chi Tiêu</p>
                      <p className="text-xl font-black text-slate-900">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(user?.totalSpending || 0)}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Bảo Mật</p>
                      <p className="text-lg font-bold text-slate-900">Đã Xác Thực</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PROFILE */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Thông Tin Cá Nhân</h2>
                    <p className="text-sm text-slate-500 mt-1">Quản lý thông tin hồ sơ để bảo mật tài khoản</p>
                  </div>
                  <button className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors">
                    <Edit2 size={16} /> Lưu Thay Đổi
                  </button>
                </div>
                
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Họ và Tên</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <User size={18} className="text-slate-400" />
                        </div>
                        <input type="text" defaultValue={user?.fullName || ''} className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone size={18} className="text-slate-400" />
                        </div>
                        <input type="tel" defaultValue={user?.phone || ''} className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail size={18} className="text-slate-400" />
                        </div>
                        <input type="email" defaultValue={user?.email || ''} disabled className="block w-full pl-11 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium cursor-not-allowed" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Ngày sinh</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Calendar size={18} className="text-slate-400" />
                        </div>
                        <input type="date" defaultValue="1999-01-01" className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* TAB: ADDRESS & SECURITY placeholders to avoid too long code, they follow similar patterns */}
            {(activeTab === 'address' || activeTab === 'security') && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'address' ? <MapPin size={32} className="text-slate-400" /> : <Lock size={32} className="text-slate-400" />}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Tính năng đang được phát triển</h2>
                <p className="text-slate-500 text-sm">Chúng tôi đang cập nhật giao diện mới cho tính năng này. Vui lòng quay lại sau!</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <ProfileContent />
    </Suspense>
  );
}
