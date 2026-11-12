'use client';

import React, { useEffect, useState } from 'react';
import { useWaiterStore, WaiterTheme } from '@/store/useWaiterStore';
import { db, getStorageEstimate, purgeOldOfflineData } from '@/lib/offline/db';
import { syncEngine } from '@/lib/offline/syncEngine';
import { useSyncStatus } from '@/lib/offline/useOfflineData';
import {
  Headphones,
  CalendarCheck,
  Palette,
  Wifi,
  Receipt,
  Calendar,
  Bell,
  UserCog,
  LogOut,
  ChevronRight,
  ArrowLeft,
  Building2,
  Check,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldCheck,
  CheckCircle2,
  Info,
  Clock,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logoutUser } from '@/lib/auth';
import { useAdmin } from '@/contexts/AdminContext';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import PersonalTimecardView from './PersonalTimecardView';

type SettingsSubScreen =
  | 'MAIN'
  | 'TIMECARD'
  | 'THEME'
  | 'OFFLINE'
  | 'NOTIFICATIONS'
  | 'ACCOUNT'
  | 'SUPPORT'
  | 'RESERVATIONS';

export default function SettingsView() {
  const {
    isOffline,
    activeBranchId,
    setActiveBranchId,
    currentUser,
    currentBranch,
    setCurrentBranch,
    theme,
    setTheme,
    soundEnabled,
    setSoundEnabled,
    hapticEnabled,
    setHapticEnabled,
    setActiveTab,
    registerModalHandler,
  } = useWaiterStore();

  const { availableBranches, setSelectedBranchId } = useAdmin();
  const [subScreen, setSubScreen] = useState<SettingsSubScreen>('MAIN');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('default');

  const [offlineCount, setOfflineCount] = useState(0);
  const { networkState, isSyncing, pendingCount } = useSyncStatus();
  const [storageInfo, setStorageInfo] = useState<{ usageMB: number; quotaMB: number } | null>(null);

  // Android Back Button support
  useEffect(() => {
    return registerModalHandler('settings-subscreen', () => {
      if (isBranchModalOpen) {
        setIsBranchModalOpen(false);
        return true;
      }
      if (subScreen !== 'MAIN') {
        setSubScreen('MAIN');
        return true;
      }
      return false;
    });
  }, [subScreen, isBranchModalOpen, registerModalHandler]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }
    getStorageEstimate().then(setStorageInfo);
  }, []);

  useEffect(() => {
    const fetchOfflineCount = async () => {
      try {
        const count = await db.offlineCommands.where('syncState').equals('PENDING').count();
        setOfflineCount(count);
      } catch {}
    };
    fetchOfflineCount();
    const interval = setInterval(fetchOfflineCount, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/admin/pos/waiter';
    await logoutUser({ redirectUrl: `/login?redirect=${encodeURIComponent(currentPath)}`, reload: true });
  };

  const handleSelectBranch = (branch: any) => {
    setSelectedBranchId(branch.id);
    setActiveBranchId(branch.id);
    setCurrentBranch({
      id: branch.id,
      name: branch.name,
      branchCode: branch.branchCode,
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('avora_waiter_selected_branch', branch.id);
      localStorage.setItem('avora_admin_selected_branch', branch.id);
    }
    setIsBranchModalOpen(false);
    toast.success(`Đã chuyển sang: ${branch.name}`);
  };

  const handleManualSync = async () => {
    if (networkState === 'OFFLINE') {
      toast.error('Thiết bị đang offline. Vui lòng kết nối mạng để đồng bộ.');
      return;
    }
    const toastId = toast.loading('Đang đồng bộ dữ liệu ngầm với máy chủ...');
    try {
      await syncEngine.processOfflineQueue();
      const ok = await syncEngine.triggerBackgroundSync(true);
      if (ok) {
        toast.success('Đồng bộ dữ liệu thành công!', { id: toastId });
        getStorageEstimate().then(setStorageInfo);
      } else {
        toast.error('Máy chủ chưa phản hồi. Dữ liệu cục bộ được bảo toàn.', { id: toastId });
      }
    } catch (e: any) {
      toast.error('Lỗi đồng bộ: ' + (e?.message || 'Không rõ'), { id: toastId });
    }
  };

  const handleCleanCache = async () => {
    const deleted = await purgeOldOfflineData(3);
    const info = await getStorageEstimate();
    setStorageInfo(info);
    toast.success(`Đã dọn dẹp ${deleted} bản ghi cache cũ.`);
  };

  const playTestSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);

      if (hapticEnabled && 'vibrate' in navigator) {
        navigator.vibrate([150, 80, 150]);
      }
      toast.success('Đã phát âm thanh thông báo mẫu!');
    } catch {
      toast.error('Không thể phát âm thanh trên trình duyệt này');
    }
  };

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo Web Push');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushStatus(perm);
      if (perm === 'granted') {
        toast.success('Đã kích hoạt quyền nhận thông báo thiết bị!');
        playTestSound();
      } else {
        toast.error('Bạn đã từ chối quyền thông báo trên trình duyệt');
      }
    } catch {
      toast.error('Lỗi yêu cầu quyền thông báo');
    }
  };

  // SUB-SCREEN 1: BẢNG CÔNG CÁ NHÂN
  if (subScreen === 'TIMECARD') {
    return <PersonalTimecardView onBack={() => setSubScreen('MAIN')} />;
  }

  // SUB-SCREEN 2: TÙY CHỈNH GIAO DIỆN
  if (subScreen === 'THEME') {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans">
        <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            onClick={() => setSubScreen('MAIN')}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-base text-slate-900 tracking-tight">Tùy chỉnh giao diện</h1>
          <div className="w-8" />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="font-black text-xs text-slate-400 uppercase tracking-wider">Chủ đề hiển thị</h3>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'light', label: 'Sáng chuẩn', desc: 'Tone Trắng / Đỏ AVORA' },
                { id: 'dark', label: 'Tối dịu mắt', desc: 'Chống mỏi mắt ca đêm' },
                { id: 'luxury', label: 'Luxury Black', desc: 'Đẳng cấp nhà hàng' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id as WaiterTheme);
                    if (typeof document !== 'undefined') {
                      document.documentElement.setAttribute('data-theme', t.id);
                    }
                    toast.success(`Đã chuyển sang giao diện: ${t.label}`);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all relative ${
                    theme === t.id
                      ? 'border-[#DA251D] bg-red-50/40 ring-2 ring-[#DA251D]/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900">{t.label}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">{t.desc}</div>
                  {theme === t.id && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#DA251D] text-white flex items-center justify-center">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUB-SCREEN 3: ĐƠN HÀNG OFFLINE & DỮ LIỆU
  if (subScreen === 'OFFLINE') {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans">
        <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            onClick={() => setSubScreen('MAIN')}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-base text-slate-900 tracking-tight">Đơn hàng Offline & Dữ liệu</h1>
          <div className="w-8" />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Trạng thái kết nối */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Trạng thái mạng</span>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                  networkState === 'ONLINE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {networkState === 'ONLINE' ? 'Trực tuyến (Online)' : 'Ngoại tuyến (Offline)'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Đơn chờ đồng bộ:</span>
              <span className="font-mono font-bold text-amber-600">{offlineCount} lệnh</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Bộ nhớ lưu đệm (Cache):</span>
              <span className="font-mono font-bold text-slate-700">
                {storageInfo?.usageMB ? `${storageInfo.usageMB.toFixed(2)} MB` : 'Đang tính...'}
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex-1 py-2.5 bg-[#DA251D] hover:bg-red-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Đồng bộ ngay</span>
              </button>

              <button
                type="button"
                onClick={handleCleanCache}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Trash2 size={14} />
                <span>Dọn cache</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUB-SCREEN 4: CÀI ĐẶT THÔNG BÁO & ÂM THANH
  if (subScreen === 'NOTIFICATIONS') {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans">
        <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            onClick={() => setSubScreen('MAIN')}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-base text-slate-900 tracking-tight">Cài đặt thông báo</h1>
          <div className="w-8" />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-4">
            {/* Âm thanh chuông báo */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">Âm thanh chuông báo</div>
                <div className="text-[11px] text-slate-500">Phát âm thanh khi có món mới hoặc tin nhắn</div>
              </div>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors ${
                  soundEnabled ? 'bg-[#34C759]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Rung phản hồi (Haptic) */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">Rung phản hồi (Haptic)</div>
                <div className="text-[11px] text-slate-500">Rung nhẹ khi thao tác và quét QR</div>
              </div>
              <button
                type="button"
                onClick={() => setHapticEnabled(!hapticEnabled)}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors ${
                  hapticEnabled ? 'bg-[#34C759]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    hapticEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Quyền Web Push */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-900">Thông báo thiết bị (Web Push)</div>
                <div className="text-[11px] text-slate-500">
                  {pushStatus === 'granted' ? 'Đã cấp quyền thông báo' : 'Chưa kích hoạt'}
                </div>
              </div>
              <button
                type="button"
                onClick={requestPushPermission}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-xl font-bold text-xs transition-all"
              >
                {pushStatus === 'granted' ? 'Đã bật' : 'Kích hoạt'}
              </button>
            </div>

            <button
              type="button"
              onClick={playTestSound}
              className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              <Volume2 size={16} />
              <span>Phát thử âm thanh</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUB-SCREEN 5: TÀI KHOẢN & BẢO MẬT
  if (subScreen === 'ACCOUNT') {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans">
        <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            onClick={() => setSubScreen('MAIN')}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-base text-slate-900 tracking-tight">Thông tin tài khoản</h1>
          <div className="w-8" />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF3B30] to-[#DA251D] text-white flex items-center justify-center font-black text-xl shadow-md">
                {currentUser?.fullName?.slice(0, 2).toUpperCase() || 'AV'}
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">{currentUser?.fullName || 'Nhân viên'}</h3>
                <span className="text-xs font-bold text-[#DA251D]">{currentUser?.role || 'SERVER'}</span>
                <p className="text-[11px] text-slate-400 mt-0.5">{currentUser?.email || 'N/A'}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã nhân viên (ID):</span>
                <span className="font-mono font-bold text-slate-700">{currentUser?.id?.slice(-8) || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chi nhánh trực thuộc:</span>
                <span className="font-bold text-slate-800">{currentBranch?.name || 'Mặc định'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SUB-SCREEN 6: HỖ TRỢ KHÁCH HÀNG (CSKH)
  if (subScreen === 'SUPPORT') {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans">
        <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            onClick={() => setSubScreen('MAIN')}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-base text-slate-900 tracking-tight">Hỗ trợ khách hàng (CSKH)</h1>
          <div className="w-8" />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#007AFF] flex items-center justify-center mx-auto shadow-inner">
              <Headphones size={32} />
            </div>
            <h3 className="font-black text-sm text-slate-900">Trung tâm tin nhắn CSKH & Yêu cầu bàn</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Nhận và phản hồi các yêu cầu gọi món, gọi nhân viên và thanh toán từ khách quét mã QR tại bàn.
            </p>
            <button
              onClick={() => setActiveTab('QR')}
              className="px-5 py-2.5 bg-[#007AFF] hover:bg-blue-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
            >
              Mở Tab QR Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUB-SCREEN 7: QUẢN LÝ BÀN ĐẶT
  if (subScreen === 'RESERVATIONS') {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans">
        <div className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <button
            onClick={() => setSubScreen('MAIN')}
            className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="font-extrabold text-base text-slate-900 tracking-tight">Quản lý bàn đặt</h1>
          <div className="w-8" />
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#AF52DE] flex items-center justify-center mx-auto shadow-inner">
              <Calendar size={32} />
            </div>
            <h3 className="font-black text-sm text-slate-900">Lịch đặt bàn hôm nay</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Xem chi tiết sơ đồ bàn và các lịch đặt bàn sắp tới của chi nhánh {currentBranch?.name || ''}.
            </p>
            <button
              onClick={() => setActiveTab('TABLES')}
              className="px-5 py-2.5 bg-[#AF52DE] hover:bg-purple-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
            >
              Mở Sơ đồ bàn
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN MENU SCREEN: TIỆN ÍCH & TÀI KHOẢN (KHỚP 100% ẢNH 1 ĐÍNH KÈM)
  // =========================================================================
  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] select-none text-slate-800 font-sans overflow-hidden">
      {/* 1. Header Tiêu đề Tab (Safe area iPhone) */}
      <div className="px-4 pt-[max(12px,calc(env(safe-area-inset-top)+4px))] pb-3 bg-white border-b border-slate-200/80 shrink-0 shadow-2xs">
        <h1 className="font-extrabold text-base text-slate-900 tracking-tight">
          Tiện ích & Tài khoản
        </h1>
      </div>

      {/* 2. Scrollable Menu Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 touch-pan-y">
        {/* User Card: Avatar, Name, Role, Branch with (Thay đổi) */}
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          {/* Avatar Vàng / Trứng như ảnh 1 */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 border-2 border-white shadow-xs flex items-center justify-center text-2xl shrink-0 overflow-hidden">
            🍣
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-black text-base text-slate-900 truncate">
              {currentUser?.fullName || 'Thành Phát'}
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              <span>Vai trò: </span>
              <span className="font-black text-slate-700">{currentUser?.role || 'SERVER'}</span>
            </div>

            {/* Chi nhánh với nút (Thay đổi) */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#007AFF] text-[11px] font-bold border border-blue-200/60 max-w-[190px] truncate">
                <Building2 size={11} className="shrink-0" />
                <span className="truncate">{currentBranch?.name || 'Chi nhánh mặc định'}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(true)}
                className="text-[11px] font-bold text-[#007AFF] hover:underline cursor-pointer"
              >
                (Thay đổi)
              </button>
            </div>
          </div>
        </div>

        {/* Nhóm Menu 1 (CSKH, Lịch sử & Bảng công, Giao diện, Offline, Hóa đơn, Bàn đặt) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* 1. Hỗ trợ khách hàng (CSKH) */}
          <button
            type="button"
            onClick={() => setSubScreen('SUPPORT')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Headphones size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Hỗ trợ khách hàng (CSKH)
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Quản lý tin nhắn yêu cầu hỗ trợ
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>

          {/* 2. Lịch sử & Bảng công (MỤC QUAN TRỌNG ĐÃ CHUYỂN VÀO ĐÂY) */}
          <button
            type="button"
            onClick={() => setSubScreen('TIMECARD')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-xs">
                <CalendarCheck size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Lịch sử & Bảng công
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Xem giờ làm dạng danh sách và ma trận
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>

          {/* 3. Tùy chỉnh giao diện */}
          <button
            type="button"
            onClick={() => setSubScreen('THEME')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FF2D55] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Palette size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Tùy chỉnh giao diện
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Dark Mode, Luxury, Màu sắc...
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>

          {/* 4. Đơn hàng Offline */}
          <button
            type="button"
            onClick={() => setSubScreen('OFFLINE')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#FF9500] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Wifi size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Đơn hàng Offline
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Xử lý đơn khi mất mạng
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>

          {/* 5. Quản lý hóa đơn */}
          <button
            type="button"
            onClick={() => setActiveTab('ORDERS')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#007AFF] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Receipt size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Quản lý hóa đơn
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Lịch sử đơn hàng
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>

          {/* 6. Quản lý bàn đặt */}
          <button
            type="button"
            onClick={() => setSubScreen('RESERVATIONS')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#AF52DE] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Calendar size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Quản lý bàn đặt
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Xem lịch đặt bàn
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>
        </div>

        {/* Nhóm Menu 2 (Cài đặt thông báo & Tài khoản) */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Cài đặt thông báo */}
          <button
            type="button"
            onClick={() => setSubScreen('NOTIFICATIONS')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#34C759] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bell size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Cài đặt thông báo
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Âm thanh & Hiển thị
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>

          {/* Tài khoản */}
          <button
            type="button"
            onClick={() => setSubScreen('ACCOUNT')}
            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/80 active:bg-slate-100/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#5856D6] text-white flex items-center justify-center shrink-0 shadow-xs">
                <UserCog size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Tài khoản
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Đổi mật khẩu, thông tin cá nhân
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
          </button>
        </div>

        {/* Nút Đăng Xuất (Nền đỏ nhạt, icon và chữ đỏ) */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3.5 bg-[#FFF2F2] hover:bg-red-100 active:scale-95 text-[#DA251D] border border-red-200/80 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
        >
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>

        {/* Phiên bản ứng dụng */}
        <div className="pt-2 text-center text-xs text-slate-400 font-medium">
          Phiên bản 2.1.0
        </div>
      </div>

      {/* Modal Thay Đổi Chi Nhánh */}
      {isBranchModalOpen && (
        <ResponsiveModal
          isOpen={isBranchModalOpen}
          onClose={() => setIsBranchModalOpen(false)}
          title="Chọn chi nhánh làm việc"
        >
          <div className="space-y-2 p-2">
            {availableBranches?.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleSelectBranch(branch)}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                  currentBranch?.id === branch.id
                    ? 'border-[#DA251D] bg-red-50/40 ring-1 ring-[#DA251D]'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-slate-900">{branch.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{branch.branchCode || 'BR'}</div>
                </div>
                {currentBranch?.id === branch.id && (
                  <CheckCircle2 size={18} className="text-[#DA251D]" />
                )}
              </button>
            ))}
          </div>
        </ResponsiveModal>
      )}
    </div>
  );
}
