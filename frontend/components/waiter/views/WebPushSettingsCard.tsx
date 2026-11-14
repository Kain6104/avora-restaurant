'use client';

import React from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Send,
  HelpCircle,
  Share,
  PlusSquare,
  Lock,
} from 'lucide-react';
import { useWebPush } from '@/lib/web-push/useWebPush';
import { useWaiterStore } from '@/store/useWaiterStore';

interface WebPushSettingsCardProps {
  branchId?: string;
}

export default function WebPushSettingsCard({ branchId }: WebPushSettingsCardProps) {
  const { currentUser, currentBranch } = useWaiterStore();
  const {
    loading,
    subscribing,
    testing,
    status,
    isRegistered,
    preferences,
    capabilities,
    deviceInfo,
    subscribe,
    revoke,
    toggleCategory,
    sendTest,
    refreshStatus,
  } = useWebPush(branchId || currentBranch?.id);

  // Status visual mapping
  const renderStatusBadge = () => {
    if (loading) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
          <RefreshCw size={12} className="animate-spin" /> Đang kiểm tra...
        </span>
      );
    }
    if (status === 'ACTIVE' || (isRegistered && capabilities.permission === 'granted')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={13} className="text-emerald-600" /> Đang hoạt động
        </span>
      );
    }
    if (status === 'IOS_REQUIRED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle size={13} className="text-amber-600" /> Cần cài PWA vào màn hình chính
        </span>
      );
    }
    if (status === 'DENIED' || capabilities.permission === 'denied') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <BellOff size={13} className="text-rose-600" /> Bị từ chối trong Cài đặt
        </span>
      );
    }
    if (status === 'EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Lock size={13} className="text-amber-600" /> Phiên hết hạn (Cần đăng ký lại)
        </span>
      );
    }
    if (status === 'UNSUPPORTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
          Thiết bị không hỗ trợ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
        Chưa kích hoạt
      </span>
    );
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-red-400 shrink-0">
            {isRegistered ? <BellRing size={20} className="animate-pulse" /> : <Bell size={20} />}
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight flex items-center gap-2">
              THÔNG BÁO ĐẨY (WEB PUSH)
            </h2>
            <p className="text-[11px] text-slate-300">Nhận tin khi khóa máy, thoát app hoặc chạy nền</p>
          </div>
        </div>
        <button
          onClick={refreshStatus}
          disabled={loading}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Làm mới trạng thái"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="p-4 space-y-4 text-slate-800">
        {/* Status Bar */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-600">Trạng thái thông báo:</span>
          {renderStatusBadge()}
        </div>

        {/* Device & Session Metadata Card */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-semibold text-slate-500">
              <Smartphone size={13} /> Thiết bị:
            </span>
            <span className="font-mono text-[11px] text-slate-700 font-bold">
              {deviceInfo.platform} • {deviceInfo.browser} ({deviceInfo.deviceInstallationId ? `${deviceInfo.deviceInstallationId.substring(0, 8)}...` : 'N/A'})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-semibold text-slate-500">
              <ShieldCheck size={13} /> Nhân viên:
            </span>
            <span className="font-bold text-slate-800">
              {currentUser?.fullName || 'Chưa xác định'} ({currentUser?.role || 'WAITER'})
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span className="flex items-center gap-1.5 font-semibold text-slate-500">
              Chi nhánh:
            </span>
            <span className="font-bold text-slate-800 truncate max-w-[200px]">
              {currentBranch?.name || 'Chi nhánh hiện tại'}
            </span>
          </div>
        </div>

        {/* iOS PWA Helper Banner */}
        {capabilities.isIos && !capabilities.isIosStandalone && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Share size={15} className="shrink-0 text-amber-600" />
              Yêu cầu cài đặt trên iPhone / iPad
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Apple chỉ cho phép nhận thông báo Web Push khi ứng dụng được thêm vào Màn hình chính.
            </p>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-800 font-medium">
              <li>Nhấn biểu tượng <strong>Chia sẻ</strong> (<Share size={11} className="inline mx-0.5" />) ở thanh dưới Safari.</li>
              <li>Cuộn xuống chọn <strong>&quot;Thêm vào MH chính&quot;</strong> (<PlusSquare size={11} className="inline mx-0.5" />).</li>
              <li>Mở biểu tượng <strong>AVORA Phục vụ</strong> ngoài màn hình chính và bật thông báo lại.</li>
            </ol>
          </div>
        )}

        {/* Permission Denied Guide */}
        {capabilities.permission === 'denied' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-rose-800">
              <BellOff size={15} className="shrink-0 text-rose-600" />
              Quyền thông báo đang bị khóa
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              Trình duyệt của bạn đang chặn thông báo từ trang này. Vui lòng vào <strong>Cài đặt điện thoại &gt; Trình duyệt (hoặc AVORA) &gt; Cho phép Thông báo</strong> để tiếp tục.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {!isRegistered ? (
            <button
              type="button"
              onClick={subscribe}
              disabled={subscribing || status === 'UNSUPPORTED'}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF3B30] to-[#DA251D] hover:opacity-95 active:scale-98 text-white font-black text-xs shadow-md shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {subscribing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Đang kích hoạt...
                </>
              ) : (
                <>
                  <BellRing size={16} /> Bật thông báo thiết bị này
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={revoke}
              disabled={subscribing}
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <BellOff size={15} className="text-slate-500" /> Tắt thông báo trên thiết bị này
            </button>
          )}

          {isRegistered && (
            <button
              type="button"
              onClick={sendTest}
              disabled={testing}
              className="w-full py-2.5 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-98 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Đang gửi test...
                </>
              ) : (
                <>
                  <Send size={14} /> Gửi thông báo thử nghiệm
                </>
              )}
            </button>
          )}
        </div>

        {/* Category Settings Toggles */}
        {isRegistered && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders size={13} className="text-slate-500" /> Tùy chọn thông báo theo loại
              </span>
              <span className="text-[10px] text-slate-400">Tự động đồng bộ</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {/* 1. Đơn hàng mới */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Đơn hàng mới & Điều chỉnh món</div>
                  <div className="text-[10px] text-slate-400">Thông báo khi có món mới hoặc hủy món</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory('orders')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    preferences.orders ? 'bg-[#34C759]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      preferences.orders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 2. QR Order */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">QR Order tại bàn</div>
                  <div className="text-[10px] text-slate-400">Khách gửi lượt gọi món qua mã QR</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory('qrOrders')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    preferences.qrOrders ? 'bg-[#34C759]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      preferences.qrOrders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Gọi nhân viên */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Gọi nhân viên & Hỗ trợ bàn</div>
                  <div className="text-[10px] text-slate-400">Khách bấm chuông gọi hỗ trợ từ bàn</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory('serviceRequests')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    preferences.serviceRequests ? 'bg-[#34C759]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      preferences.serviceRequests ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 4. Yêu cầu thanh toán */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Yêu cầu thanh toán & Chốt hóa đơn</div>
                  <div className="text-[10px] text-slate-400">Khách yêu cầu tính tiền tại bàn</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory('payments')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    preferences.payments ? 'bg-[#34C759]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      preferences.payments ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 5. Hoạt động bàn */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Hoạt động bàn & Đổi bàn</div>
                  <div className="text-[10px] text-slate-400">Mở bàn, chuyển bàn, gộp bàn và dọn bàn</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory('tables')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    preferences.tables ? 'bg-[#34C759]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      preferences.tables ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 6. Buffet */}
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">Lượt gọi Buffet</div>
                  <div className="text-[10px] text-slate-400">Khách gửi thêm lượt món Buffet</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategory('buffet')}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors ${
                    preferences.buffet ? 'bg-[#34C759]' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
                      preferences.buffet ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

