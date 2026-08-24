'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Barcode from 'react-barcode';
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');

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
          setFullName(data.fullName || '');
          setPhone(data.phone || '');
          if (data.birthdate) {
            setBirthdate(new Date(data.birthdate).toISOString().split('T')[0]);
          }
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

  const handleAddPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/add-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Có lỗi xảy ra');
      } else {
        toast.success('Đã thiết lập mật khẩu thành công!');
        setUser({ ...user, hasPassword: true });
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
    if (phone && !phoneRegex.test(phone)) {
      toast.error('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09).');
      return;
    }

    setProfileLoading(true);
    try {
      const updatePayload: any = { fullName, phone };
      if (!user?.birthdate && birthdate) {
        updatePayload.birthdate = birthdate;
      }

      const res = await fetch(`${API_URL}/api/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include',
        body: JSON.stringify(updatePayload),
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Cập nhật thất bại');
      } else {
        toast.success('Cập nhật thông tin thành công!');
        setUser(data.user);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    
    setPasswordLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Có lỗi xảy ra');
      } else {
        toast.success('Đổi mật khẩu thành công!');
        setShowChangePasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const menuItems: { id: string; label: string; icon: React.ReactNode; href?: string }[] = [
    { id: 'dashboard', label: 'Tổng Quan', icon: <LayoutDashboard size={20} /> },
    { id: 'profile', label: 'Thông Tin Cá Nhân', icon: <User size={20} /> },
    { id: 'address', label: 'Sổ Địa Chỉ', icon: <MapPin size={20} />, href: '/profile/addresses' },
    { id: 'security', label: 'Bảo Mật', icon: <Lock size={20} /> },
  ];

  let nextTierSpending = 2000000;
  let nextTierName = 'Hạng Bạc';
  const currentSpending = user?.totalSpending || 0;
  if (currentSpending >= 15000000) {
    nextTierSpending = currentSpending; // Max tier
    nextTierName = 'Kim Cương';
  } else if (currentSpending >= 5000000) {
    nextTierSpending = 15000000;
    nextTierName = 'Hạng Kim Cương';
  } else if (currentSpending >= 2000000) {
    nextTierSpending = 5000000;
    nextTierName = 'Hạng Vàng';
  }
  
  const progressPercent = currentSpending >= nextTierSpending ? 100 : Math.min((currentSpending / nextTierSpending) * 100, 100);

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
              <p className="text-slate-500 text-sm">{user?.membershipTier?.name || 'Thành viên mới'}</p>
              <div className="mt-3 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                <Trophy size={14} className="mr-1" /> {new Intl.NumberFormat('vi-VN').format(user?.points || 0)} Điểm
              </div>
            </div>

            {/* Navigation */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex flex-col">
                {menuItems.map((item) => (
                  item.href ? (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between px-6 py-4 text-slate-600 hover:bg-slate-50 hover:text-red-600 font-medium border-l-4 border-transparent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={18} className="text-slate-300" />
                    </Link>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as Tab)}
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
                  )
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
                
                {/* Dashboard Title */}
                <h2 className="text-lg md:text-xl font-bold text-slate-900 mb-4 hidden md:block">Thành Viên Avora</h2>
                
                {/* Virtual Membership Card (Lotte Mart Style) */}
                <div className="bg-[#da291c] rounded-[24px] p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  {/* Subtle Background Lines */}
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #ffffff 10px, #ffffff 20px)' }}></div>
                  
                  {/* Decorative Background Swirl */}
                  <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[120%] opacity-90 pointer-events-none">
                    <div className="w-full h-full border-[14px] border-t-[#a7d7c5] border-l-[#cba6d7] border-b-[#eab96b] border-r-transparent rounded-[100px] rotate-[-15deg] mix-blend-screen"></div>
                  </div>
                  
                  {/* Header: Tier and Logo */}
                  <div className="relative z-10 flex justify-between items-start">
                    <div className="w-1/4"></div> {/* Spacer */}
                    <div className="text-center font-bold text-sm tracking-wider uppercase mt-1 drop-shadow-sm">
                      {user?.membershipTier?.name || 'HẠNG THÀNH VIÊN'}
                    </div>
                    <img src="/avora_logo.png" alt="Logo" className="h-6 object-contain brightness-0 invert drop-shadow-sm" />
                  </div>

                  {/* Body: Barcode Box */}
                  <div className="relative z-10 bg-white rounded-[20px] p-4 mt-6 mb-4 shadow-md mx-auto w-full max-w-[280px] flex flex-col items-center">
                    <div className="w-full flex justify-center overflow-hidden">
                      <Barcode value={user?.memberCode || 'AVO-NEW'} background="transparent" format="CODE128" height={45} lineColor="#000000" width={1.8} displayValue={false} margin={0} />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <p className="text-center text-sm md:text-base font-black font-mono tracking-widest text-slate-900">
                        {user?.memberCode?.replace(/(.{4})/g, '$1 ') || 'AVO NEW 0000'}
                      </p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(user?.memberCode || 'AVO-NEW');
                          toast.success('Đã sao chép mã thành viên');
                        }}
                        className="text-slate-500 hover:text-slate-800 transition-colors bg-slate-100 p-1.5 rounded-md"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                    </div>
                  </div>

                  {/* Footer: Points */}
                  <div className="relative z-10 flex justify-between items-center px-1">
                    <div className="text-sm font-medium drop-shadow-sm">
                      Điểm: <span className="font-bold text-lg">{new Intl.NumberFormat('vi-VN').format(user?.points || 0)}</span>
                    </div>
                    <ChevronRight size={20} className="text-white drop-shadow-sm" />
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mt-6 mb-6">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-slate-500 text-xs font-medium mb-1">Chi tiêu tích luỹ</p>
                      <p className="text-base font-bold text-slate-900">{new Intl.NumberFormat('vi-VN').format(currentSpending)} ₫</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs font-medium mb-1">{nextTierName}</p>
                      <p className="text-base font-bold text-slate-900">{new Intl.NumberFormat('vi-VN').format(nextTierSpending)} ₫</p>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-red-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  {currentSpending < nextTierSpending ? (
                    <p className="text-xs text-slate-500 font-medium text-center">Cần chi tiêu thêm <span className="text-red-600 font-bold">{new Intl.NumberFormat('vi-VN').format(Math.max(nextTierSpending - currentSpending, 0))} ₫</span> để lên hạng</p>
                  ) : (
                    <p className="text-xs text-green-600 font-bold text-center">Bạn đã đạt hạng thẻ cao nhất!</p>
                  )}
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
                  <button 
                    onClick={handleUpdateProfile} 
                    disabled={profileLoading}
                    className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-70"
                  >
                    {profileLoading ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div> : <Edit2 size={16} />} Lưu Thay Đổi
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
                        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Phone size={18} className="text-slate-400" />
                        </div>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500" />
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
                        <input 
                          type="date" 
                          value={birthdate} 
                          onChange={(e) => setBirthdate(e.target.value)}
                          disabled={!!user?.birthdate}
                          className={`block w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 ${user?.birthdate ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-slate-50'}`} 
                        />
                      </div>
                      <p className="text-xs text-orange-600 mt-2 font-medium bg-orange-50 p-2 rounded-lg border border-orange-100">
                        Lưu ý: Ngày sinh chỉ được cập nhật 1 lần duy nhất.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}



            {/* TAB: ADDRESS */}
            {activeTab === 'address' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin size={32} className="text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Sổ Địa Chỉ</h2>
                <p className="text-slate-500 text-sm">Tính năng quản lý sổ địa chỉ đang được cập nhật. Vui lòng quay lại sau!</p>
              </div>
            )}

            {/* TAB: SECURITY */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-xl font-bold text-slate-900">Bảo Mật Tài Khoản</h2>
                  <p className="text-sm text-slate-500 mt-1">Quản lý phương thức đăng nhập và bảo mật</p>
                </div>
                
                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Phương thức đăng nhập</h3>
                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Lock className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Phương thức chính</p>
                          <p className="text-sm text-slate-500">
                            {user?.authProvider === 'GOOGLE' ? 'Tài khoản Google' : 'Mật khẩu (Cơ bản)'}
                          </p>
                        </div>
                      </div>
                      {user?.hasPassword ? (
                        <button 
                          onClick={() => setShowChangePasswordModal(true)}
                          className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                          Đổi mật khẩu
                        </button>
                      ) : (
                        <button 
                          onClick={() => setShowPasswordModal(true)}
                          className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
                        >
                          Thêm mật khẩu
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Liên kết mạng xã hội</h3>
                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-2xl bg-white shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Google</p>
                          <p className="text-sm text-slate-500">
                            Đăng nhập nhanh bằng tài khoản Google
                          </p>
                        </div>
                      </div>
                      {user?.googleId ? (
                        <span className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-100 rounded-lg flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Đã liên kết
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg">
                          Chưa liên kết
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Add Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Thiết Lập Mật Khẩu</h3>
            <p className="text-slate-500 text-sm mb-6">Tạo mật khẩu để đăng nhập bằng email ngoài phương thức Google.</p>
            
            <form onSubmit={handleAddPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mật khẩu mới</label>
                <input 
                  type="password" 
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                  placeholder="Nhập mật khẩu"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Xác nhận mật khẩu</label>
                <input 
                  type="password" 
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordLoading}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-70"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center disabled:opacity-70"
                >
                  {passwordLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowChangePasswordModal(false)}></div>
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Đổi Mật Khẩu</h3>
            <p className="text-slate-500 text-sm mb-6">Tạo mật khẩu mới an toàn hơn cho tài khoản của bạn.</p>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mật khẩu hiện tại</label>
                <input 
                  type="password" 
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mật khẩu mới</label>
                <input 
                  type="password" 
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                  placeholder="Nhập mật khẩu mới"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Xác nhận mật khẩu mới</label>
                <input 
                  type="password" 
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500" 
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowChangePasswordModal(false)}
                  disabled={passwordLoading}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-70"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center disabled:opacity-70"
                >
                  {passwordLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
