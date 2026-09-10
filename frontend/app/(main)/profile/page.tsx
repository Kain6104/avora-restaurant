'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import Barcode from 'react-barcode';
import {
  User,
  LayoutDashboard,
  ShoppingBag,
  MapPin,
  Lock,
  LogOut,
  ChevronRight,
  Edit2,
  Camera,
  Trophy,
  CreditCard,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  Crown,
  Zap,
  Flame,
  Gift,
  Sparkles,
  Copy,
  ExternalLink,
  ChevronUp,
  Award,
  ReceiptText,
  Ticket
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Tab = 'dashboard' | 'profile' | 'address' | 'security';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'dashboard';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle avatar upload to backend (saved in frontend/public/avt)
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|gif|jpg)$/i)) {
      toast.error('Chỉ chấp nhận các file ảnh (.jpg, .jpeg, .png, .webp, .gif)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setAvatarLoading(true);
    const toastId = toast.loading('Đang tải ảnh đại diện lên...');

    try {
      const res = await fetch(`${API_URL}/api/auth/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Tải ảnh thất bại', { id: toastId });
      } else {
        toast.success('Cập nhật ảnh đại diện thành công!', { id: toastId });
        const updatedUser = data.user || { ...user, avatarUrl: data.avatarUrl };
        setUser(updatedUser);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('user-updated', { detail: updatedUser }));
        }
      }
    } catch (err) {
      console.error('Avatar upload error:', err);
      toast.error('Lỗi kết nối máy chủ', { id: toastId });
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Auto-redirect if URL contains tab=orders
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'orders') {
      router.replace('/orders');
      return;
    }
    if (tabParam && ['dashboard', 'profile', 'address', 'security'].includes(tabParam)) {
      setActiveTab(tabParam as Tab);
    }
  }, [searchParams, router]);

  // Fetch authenticated user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
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

  // Update profile
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
          'ngrok-skip-browser-warning': 'true',
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

  // Add password
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
          'ngrok-skip-browser-warning': 'true',
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

  // Change password
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
          'ngrok-skip-browser-warning': 'true',
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

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Đã sao chép mã thành viên: ' + code);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-[#f8f9fa] gap-3">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-xs font-bold">Đang tải thông tin tài khoản...</p>
      </div>
    );
  }

  // Tier spending milestone calculation
  let nextTierSpending = 2000000;
  let nextTierName = 'Hạng Bạc';
  const currentSpending = user?.totalSpending || 0;
  const currentTier = user?.membershipTier?.name || 'Thành viên mới';

  if (currentSpending >= 15000000) {
    nextTierSpending = currentSpending;
    nextTierName = 'Kim Cương';
  } else if (currentSpending >= 5000000) {
    nextTierSpending = 15000000;
    nextTierName = 'Kim Cương';
  } else if (currentSpending >= 2000000) {
    nextTierSpending = 5000000;
    nextTierName = 'Hạng Vàng';
  }

  const progressPercent =
    currentSpending >= nextTierSpending
      ? 100
      : Math.min((currentSpending / nextTierSpending) * 100, 100);

  // Card Theme according to tier
  const isDiamond = currentTier.includes('Kim Cương') || currentSpending >= 15000000;
  const isGold = currentTier.includes('Vàng') || currentSpending >= 5000000;
  const isSilver = currentTier.includes('Bạc') || currentSpending >= 2000000;

  const cardGradient = isDiamond
    ? 'bg-gradient-to-br from-[#121214] via-[#2a2a32] to-[#0d0d10] border-amber-400/40 text-amber-200'
    : isGold
    ? 'bg-gradient-to-br from-[#7a4c00] via-[#c28e1c] to-[#422900] border-yellow-300/40 text-yellow-100'
    : isSilver
    ? 'bg-gradient-to-br from-[#374151] via-[#64748b] to-[#1e293b] border-slate-300/40 text-slate-100'
    : 'bg-gradient-to-br from-[#991b1b] via-[#dc2626] to-[#7f1d1d] border-red-300/30 text-white';

  const menuItems = [
    ...(user?.role && user.role !== 'USER'
      ? [{ id: 'admin', label: 'Trang Quản Trị Hệ Thống', icon: <LayoutDashboard size={18} className="text-[#da251d]" />, href: '/admin' }]
      : []),
    { id: 'dashboard', label: 'Tổng Quan VIP', icon: <LayoutDashboard size={18} /> },
    { id: 'vouchers', label: 'Kho Voucher & Ví Ưu Đãi', icon: <Ticket size={18} className="text-red-500" />, href: '/vouchers' },
    { id: 'profile', label: 'Thông Tin Cá Nhân', icon: <User size={18} /> },
    { id: 'address', label: 'Sổ Địa Chỉ', icon: <MapPin size={18} />, href: '/profile/addresses' },
    { id: 'security', label: 'Bảo Mật Tài Khoản', icon: <Lock size={18} /> },
  ];

  return (
    <div className="bg-[#f6f7fa] min-h-screen pb-24 font-sans text-slate-800">
      {/* ── BREADCRUMB ── */}
      <div className="bg-white border-b border-slate-200/80 shadow-2xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
              Trang chủ
            </Link>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="text-slate-900 font-bold">Tài Khoản Hội Viên</span>
          </div>

          <Link
            href="/loyalty"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200/80 hover:bg-amber-100 transition-colors"
          >
            <Crown size={14} className="text-amber-500" />
            <span>Đặc quyền VIP</span>
          </Link>
        </div>
      </div>

      {/* ── HERO PROFILE COVER ── */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white pt-8 pb-16 sm:pb-20 px-4 sm:px-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            {/* Hidden File Input for Avatar */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/png,image/jpeg,image/webp,image/gif,image/jpg"
              className="hidden"
            />

            {/* Avatar with luxury border */}
            <div className="relative group shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-800 border-4 border-white/20 shadow-2xl overflow-hidden relative cursor-pointer group-hover:border-red-500/60 transition-all"
                title="Nhấn để đổi ảnh đại diện"
              >
                {(user?.avatarUrl || user?.avatar) ? (
                  <img
                    src={user?.avatarUrl || user?.avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 text-white font-black text-3xl sm:text-4xl flex items-center justify-center">
                    {(user?.fullName || 'A').charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-1">
                  <Camera size={20} />
                  <span>Đổi ảnh</span>
                </div>

                {avatarLoading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="absolute -bottom-1 -right-1 p-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-lg border-2 border-slate-900 transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                title="Đổi ảnh đại diện"
              >
                <Camera size={14} />
              </button>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {user?.fullName || 'Khách hàng Avora'}
                </h1>
                {user?.role && user.role !== 'USER' ? (
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                    <ShieldCheck size={12} /> {user.role === 'ADMIN' ? 'Quản Trị Viên' : user.role === 'MANAGER' ? 'Quản Lý' : 'Bếp Trưởng'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-md">
                    <Crown size={12} /> {currentTier}
                  </span>
                )}
              </div>

              <p className="text-slate-400 text-xs flex items-center justify-center sm:justify-start gap-2">
                <span>Mã hội viên:</span>
                <span className="font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-md text-[11px] flex items-center gap-1">
                  {user?.memberCode || 'AVO-MEMBER'}
                  <button
                    onClick={() => handleCopyCode(user?.memberCode || 'AVO-MEMBER')}
                    className="hover:text-amber-300 transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                </span>
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-300">
                <span className="flex items-center gap-1">
                  <Mail size={13} className="text-red-400" /> {user?.email || 'Chưa cập nhật email'}
                </span>
                {user?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={13} className="text-emerald-400" /> {user.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Points Widget */}
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-4 sm:p-5 text-center sm:text-right shrink-0 min-w-[180px]">
              <p className="text-[11px] font-bold text-amber-300/90 uppercase tracking-wider mb-1 flex items-center justify-center sm:justify-end gap-1">
                <Trophy size={14} className="text-yellow-400" /> Điểm Tích Lũy
              </p>
              <p className="text-2xl sm:text-3xl font-black font-mono text-yellow-400">
                {new Intl.NumberFormat('vi-VN').format(user?.points || 0)}
              </p>
              <Link
                href="/loyalty"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-white/80 hover:text-white mt-1 hover:underline"
              >
                Đổi ưu đãi VIP <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI STATS BAR (Overlaps Hero) ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-10 mb-8 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Crown size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 text-xs font-semibold truncate">Hạng Thẻ</p>
              <p className="text-sm sm:text-base font-black text-slate-900 truncate">{currentTier}</p>
            </div>
          </div>

          <Link
            href="/orders"
            className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex items-center gap-3.5 group hover:border-red-300 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShoppingBag size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 text-xs font-semibold truncate flex items-center gap-1">
                Đơn Hàng <ChevronRight size={12} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </p>
              <p className="text-sm sm:text-base font-black text-slate-900 truncate">
                {user?.orders?.length || 0} Đơn
              </p>
            </div>
          </Link>

          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-slate-400 text-xs font-semibold truncate">Tổng Chi Tiêu</p>
              <p className="text-sm sm:text-base font-black text-slate-900 truncate">
                {new Intl.NumberFormat('vi-VN').format(currentSpending)}đ
              </p>
            </div>
          </div>

          <Link
            href="/flash-sale"
            className="bg-gradient-to-r from-red-600 to-rose-600 rounded-2xl p-4 sm:p-5 shadow-md shadow-red-600/20 text-white flex items-center gap-3.5 group hover:from-red-500 hover:to-rose-500 transition-all cursor-pointer"
          >
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform">
              <Zap size={22} className="text-yellow-300 fill-yellow-300" />
            </div>
            <div className="min-w-0">
              <p className="text-white/80 text-xs font-bold truncate">Giờ Vàng Sale</p>
              <p className="text-sm sm:text-base font-black text-white truncate flex items-center gap-1">
                Săn Deal Ngay <ChevronRight size={14} />
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── MAIN CONTENT (SIDEBAR + ACTIVE TAB) ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
          {/* ── SIDEBAR NAVIGATION ── */}
          <div className="w-full md:w-1/3 lg:w-1/4 space-y-4">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Trung tâm tài khoản
                </p>
              </div>

              <div className="flex flex-col py-1">
                {menuItems.map((item) =>
                  item.href ? (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center justify-between px-5 py-3.5 text-slate-600 hover:bg-slate-50 hover:text-red-600 font-semibold border-l-4 border-transparent transition-colors text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </Link>
                  ) : (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as Tab)}
                      className={`flex items-center justify-between px-5 py-3.5 transition-colors text-xs sm:text-sm cursor-pointer ${
                        activeTab === item.id
                          ? 'bg-red-50 text-red-600 border-l-4 border-red-600 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={activeTab === item.id ? 'text-red-600' : 'text-slate-400'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {activeTab === item.id && <ChevronRight size={16} className="text-red-600" />}
                    </button>
                  )
                )}

                {/* Direct Link to Orders */}
                <Link
                  href="/orders"
                  className="flex items-center justify-between px-5 py-3.5 text-slate-600 hover:bg-red-50 hover:text-red-600 font-semibold border-l-4 border-transparent transition-colors text-xs sm:text-sm group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 group-hover:text-red-600 transition-colors">
                      <ShoppingBag size={18} />
                    </span>
                    <span>Đơn Hàng Của Tôi</span>
                  </div>
                  <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {user?.orders?.length || 0}
                  </span>
                </Link>

                {/* Direct Link to Flash Sale */}
                <Link
                  href="/flash-sale"
                  className="flex items-center justify-between px-5 py-3.5 text-amber-700 bg-amber-50/50 hover:bg-amber-100/70 font-bold border-l-4 border-amber-500 transition-colors text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Zap size={18} className="text-amber-600" />
                    <span>Săn Flash Sale</span>
                  </div>
                  <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase">
                    Hot
                  </span>
                </Link>

                <hr className="border-slate-100 my-1" />

                {/* Logout Button */}
                <button
                  onClick={async () => {
                    try {
                      await fetch(`${API_URL}/api/auth/logout`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'ngrok-skip-browser-warning': 'true' },
                      });
                      window.location.href = '/login';
                    } catch (err) {
                      console.error('Logout failed:', err);
                    }
                  }}
                  className="flex items-center gap-3 px-5 py-3.5 text-slate-500 hover:bg-red-50 hover:text-red-600 font-semibold transition-colors w-full text-left text-xs sm:text-sm cursor-pointer"
                >
                  <LogOut size={18} />
                  <span>Đăng Xuất</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── ACTIVE TAB CONTENT ── */}
          <div className="flex-1 min-w-0">
            {/* ═══════════════════════════════════════════════════
                TAB: DASHBOARD
            ═══════════════════════════════════════════════════ */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {/* 3D Luxury Digital VIP Card */}
                <div
                  className={`rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden border ${cardGradient} transition-all duration-300 hover:scale-[1.01]`}
                >
                  {/* Holographic background pattern */}
                  <div
                    className="absolute inset-0 opacity-[0.08] pointer-events-none"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 15px, #ffffff 15px, #ffffff 30px)',
                    }}
                  />
                  <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Card Header: Brand & Tier */}
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block mb-0.5">
                        THẺ HỘI VIÊN ĐIỆN TỬ
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider drop-shadow-md">
                        {currentTier}
                      </h2>
                    </div>
                    <img
                      src="/avora_logo.png"
                      alt="Logo"
                      className="h-8 object-contain brightness-0 invert drop-shadow-md"
                    />
                  </div>

                  {/* Card Body: Barcode Box */}
                  <div className="relative z-10 bg-white rounded-2xl p-4 sm:p-5 mt-6 mb-5 shadow-lg mx-auto w-full max-w-sm flex flex-col items-center">
                    <div className="w-full flex justify-center overflow-hidden">
                      <Barcode
                        value={user?.memberCode || 'AVO-NEW'}
                        background="transparent"
                        format="CODE128"
                        height={46}
                        lineColor="#0f172a"
                        width={1.9}
                        displayValue={false}
                        margin={0}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                      <p className="text-center text-sm sm:text-base font-black font-mono tracking-widest text-slate-900">
                        {user?.memberCode?.replace(/(.{4})/g, '$1 ') || 'AVO NEW 0000'}
                      </p>
                      <button
                        onClick={() => handleCopyCode(user?.memberCode || 'AVO-NEW')}
                        className="text-slate-400 hover:text-slate-800 transition-colors p-1"
                        title="Sao chép"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Card Footer: Live Points & Expiry */}
                  <div className="relative z-10 flex justify-between items-center px-1">
                    <div>
                      <span className="text-[10px] uppercase font-bold opacity-75 block">Điểm khả dụng</span>
                      <span className="font-black text-xl sm:text-2xl font-mono">
                        {new Intl.NumberFormat('vi-VN').format(user?.points || 0)}
                      </span>
                    </div>
                    <Link
                      href="/loyalty"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl text-xs font-bold transition-all border border-white/20 shadow-sm"
                    >
                      <Crown size={14} /> Đặc Quyền VIP
                    </Link>
                  </div>
                </div>

                {/* Loyalty Tier Progress Bar */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                        Chi tiêu tích luỹ
                      </p>
                      <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                        {new Intl.NumberFormat('vi-VN').format(currentSpending)}đ
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                        Mục tiêu: {nextTierName}
                      </p>
                      <p className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                        {new Intl.NumberFormat('vi-VN').format(nextTierSpending)}đ
                      </p>
                    </div>
                  </div>

                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden mb-3 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {currentSpending < nextTierSpending ? (
                    <p className="text-xs text-slate-500 font-medium text-center">
                      Cần chi tiêu thêm{' '}
                      <span className="text-red-600 font-bold font-mono">
                        {new Intl.NumberFormat('vi-VN').format(Math.max(nextTierSpending - currentSpending, 0))}đ
                      </span>{' '}
                      để tự động thăng hạng <span className="font-bold text-slate-800">{nextTierName}</span>!
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600 font-bold text-center flex items-center justify-center gap-1">
                      <CheckCircle2 size={16} /> Bạn đã đạt hạng thẻ cao nhất tại Avora Restaurant!
                    </p>
                  )}
                </div>

                {/* VIP Perks Grid */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                      <Sparkles size={18} className="text-amber-500" /> Đặc Quyền Hội Viên Của Bạn
                    </h3>
                    <Link href="/loyalty" className="text-xs text-red-600 font-bold hover:underline">
                      Xem tất cả →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <Gift size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Quà Tặng Sinh Nhật</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Tặng voucher giảm 20% & món tráng miệng đặc biệt vào tháng sinh nhật.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-red-50/60 border border-red-100/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                        <Zap size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Tích Điểm VIP Thần Tốc</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Tích luỹ 5% - 10% giá trị mọi đơn hàng để trừ trực tiếp vào hoá đơn tiếp theo.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Flame size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Ưu Tiên Săn Flash Sale</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Nhận thông báo sớm 15 phút trước mỗi khung giờ vàng món ngon giảm đến 50%.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100/80 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <Crown size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">Ưu Tiên Giữ Bàn VIP</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Ưu tiên chọn vị trí bàn đẹp nhất và phục vụ nước uống chào đón miễn phí.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                TAB: PROFILE
            ═══════════════════════════════════════════════════ */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/50">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">Thông Tin Hồ Sơ</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Quản lý và cập nhật thông tin cá nhân của bạn</p>
                  </div>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={profileLoading}
                    className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 px-5 py-2.5 rounded-xl shadow-md shadow-red-600/20 transition-all disabled:opacity-70 cursor-pointer active:scale-95"
                  >
                    {profileLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Edit2 size={15} />
                    )}
                    <span>Lưu Thay Đổi</span>
                  </button>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Avatar Upload Card */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-white border-2 border-slate-200 shadow-sm overflow-hidden flex items-center justify-center">
                        {(user?.avatarUrl || user?.avatar) ? (
                          <img
                            src={user?.avatarUrl || user?.avatar}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-red-500 to-rose-600 text-white font-bold text-2xl flex items-center justify-center">
                            {(user?.fullName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1">
                      <h3 className="font-bold text-sm text-slate-900">Ảnh đại diện tài khoản</h3>
                      <p className="text-xs text-slate-500">
                        Chấp nhận file định dạng JPG, PNG, WEBP hoặc GIF. Kích thước tối đa 10MB.
                      </p>
                      <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarLoading}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Camera size={13} />
                          <span>{avatarLoading ? 'Đang tải...' : 'Tải ảnh mới'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                        Họ và Tên
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User size={16} />
                        </div>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                          placeholder="Nhập họ và tên..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                        Số Điện Thoại
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Phone size={16} />
                        </div>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                          placeholder="Nhập 10 số điện thoại..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                        Địa Chỉ Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail size={16} />
                        </div>
                        <input
                          type="email"
                          defaultValue={user?.email || ''}
                          disabled
                          className="block w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-semibold cursor-not-allowed"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">Email được liên kết với tài khoản đăng nhập.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                        Ngày Sinh (Nhận quà VIP)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Calendar size={16} />
                        </div>
                        <input
                          type="date"
                          value={birthdate}
                          onChange={(e) => setBirthdate(e.target.value)}
                          disabled={!!user?.birthdate}
                          className={`block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 transition-all ${
                            user?.birthdate ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-slate-50'
                          }`}
                        />
                      </div>
                      <p className="text-[11px] text-amber-600 mt-1.5 font-medium bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-1">
                        <Gift size={13} className="shrink-0" />
                        <span>Lưu ý: Ngày sinh chỉ được cập nhật 1 lần để nhận quà sinh nhật hàng năm.</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                TAB: ADDRESS
            ═══════════════════════════════════════════════════ */}
            {activeTab === 'address' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300 p-8 sm:p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <MapPin size={36} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Sổ Địa Chỉ Giao Hàng</h2>
                <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                  Lưu nhiều địa chỉ nhận món (Nhà riêng, Công ty...) để thanh toán tiện lợi và nhận món nhanh chóng hơn.
                </p>
                <div className="pt-2">
                  <Link
                    href="/profile/addresses"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xs sm:text-sm shadow-md shadow-red-600/30 transition-all cursor-pointer"
                  >
                    <span>Quản lý Sổ Địa Chỉ</span>
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════
                TAB: SECURITY
            ═══════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
                <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">Bảo Mật & Đăng Nhập</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Quản lý phương thức đăng nhập và mật khẩu tài khoản</p>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  {/* Password Section */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Mật khẩu tài khoản
                    </h3>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-2xs gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-600 shrink-0">
                          <Lock size={22} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {user?.hasPassword ? 'Mật khẩu bảo vệ' : 'Chưa thiết lập mật khẩu'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {user?.hasPassword
                              ? 'Đã cài đặt mật khẩu để đăng nhập bằng Email.'
                              : 'Thiết lập mật khẩu để đăng nhập trực tiếp không cần Google.'}
                          </p>
                        </div>
                      </div>

                      {user?.hasPassword ? (
                        <button
                          type="button"
                          onClick={() => setShowChangePasswordModal(true)}
                          className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
                        >
                          Đổi mật khẩu
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowPasswordModal(true)}
                          className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm shrink-0 cursor-pointer"
                        >
                          Thêm mật khẩu
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Social Login Connection */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Liên kết mạng xã hội
                    </h3>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 border border-slate-200 rounded-2xl bg-white shadow-2xs gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                          <img
                            src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                            alt="Google"
                            className="w-6 h-6"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">Tài khoản Google</p>
                          <p className="text-xs text-slate-500 mt-0.5">Đăng nhập nhanh 1 chạm với Google.</p>
                        </div>
                      </div>

                      {user?.googleId || user?.authProvider === 'GOOGLE' ? (
                        <span className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-1.5 shrink-0">
                          <CheckCircle2 size={15} /> Đã liên kết
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl shrink-0">
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

      {/* ── ADD PASSWORD MODAL ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowPasswordModal(false)}
          />
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Thiết Lập Mật Khẩu</h3>
            <p className="text-slate-500 text-xs mb-5">
              Tạo mật khẩu an toàn để đăng nhập bằng email trên mọi thiết bị.
            </p>

            <form onSubmit={handleAddPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordLoading}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center text-xs shadow-md shadow-red-600/20"
                >
                  {passwordLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Lưu Mật Khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setShowChangePasswordModal(false)}
          />
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Đổi Mật Khẩu</h3>
            <p className="text-slate-500 text-xs mb-5">Tạo mật khẩu mới an toàn hơn cho tài khoản của bạn.</p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Mật khẩu mới"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  disabled={passwordLoading}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center text-xs shadow-md shadow-red-600/20"
                >
                  {passwordLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Cập Nhật'
                  )}
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
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen bg-[#f8f9fa]">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
