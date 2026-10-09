"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Store,
  Clock,
  User as UserIcon,
  ShoppingBag,
  LayoutGrid,
  CalendarCheck,
  QrCode,
  ListOrdered,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  MoreHorizontal,
  ArrowLeft,
  Printer,
  Split,
  Combine,
  ArrowRightLeft,
  Ban,
  Trash2,
  Settings,
  Menu,
  Bell,
  Monitor,
  Power,
  FileText,
  Receipt,
} from 'lucide-react';
import { platformBridge } from '@/lib/platform/platform-bridge';
import { PosBranch, PosActiveTab, PosOrder, PosTable, PosUserData } from './pos-types';
export type { PosUserData };
import { SocketConnectionStatus } from './usePosSocket';
import { useRealtimeNotifications } from '@/contexts/NotificationRealtimeProvider';
import { PosExitConfirmModal } from './PosExitConfirmModal';

interface PosHeaderProps {
  currentBranch: PosBranch | null;
  branches: PosBranch[];
  onSelectBranch: (branch: PosBranch) => void;
  activeTab: PosActiveTab;
  onSelectTab: (tab: PosActiveTab) => void;
  orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  onSelectTakeaway?: () => void;
  onSelectDelivery?: () => void;
  connectionStatus: SocketConnectionStatus;
  user: PosUserData | null;
  orderCounts?: {
    allOrders?: number;
    qrOrders?: number;
    reservations?: number;
  };
  onLogout: () => void;
  onGoToAdmin: () => void;
  onOpenSettingsDrawer?: () => void;
  isDetailMode?: boolean;
  currentOrder?: PosOrder | null;
  selectedTable?: PosTable | null;
  grandTotal?: number;
  guestCount?: number;
  customerName?: string;
  onBackFromDetailMode?: () => void;
  onOpenPrintBill?: () => void;
  onOpenSplitModal?: () => void;
  onOpenMergeModal?: () => void;
  onOpenMoveTableModal?: () => void;
  onOpenCancelModal?: () => void;
  onClearCart?: () => void;
  onOpenQrManagement?: () => void;
  onOpenDesktopLaunch?: () => void;
  onOpenEndOfDayReport?: () => void;
}

export const PosHeader: React.FC<PosHeaderProps> = ({
  currentBranch,
  branches,
  onSelectBranch,
  activeTab,
  onSelectTab,
  orderType = 'DINE_IN',
  onSelectTakeaway,
  onSelectDelivery,
  connectionStatus,
  user,
  orderCounts = { allOrders: 0, qrOrders: 0, reservations: 0 },
  onLogout,
  onGoToAdmin,
  onOpenSettingsDrawer,
  isDetailMode = false,
  currentOrder,
  selectedTable,
  grandTotal = 0,
  guestCount = 1,
  customerName = 'Khách tại bàn',
  onBackFromDetailMode,
  onOpenPrintBill,
  onOpenSplitModal,
  onOpenMergeModal,
  onOpenMoveTableModal,
  onOpenCancelModal,
  onClearCart,
  onOpenQrManagement,
  onOpenDesktopLaunch,
  onOpenEndOfDayReport,
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDetailMoreOpen, setIsDetailMoreOpen] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

  const { unreadCount, openDrawer } = useRealtimeNotifications();

  const userMenuRef = useRef<HTMLDivElement>(null);
  const detailMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (detailMoreRef.current && !detailMoreRef.current.contains(e.target as Node)) {
        setIsDetailMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = user?.fullName || user?.email?.split('@')[0] || 'Thu ngân';
  const userRole =
    user?.role === 'ADMIN'
      ? 'Quản trị viên'
      : user?.role === 'MANAGER'
      ? 'Quản lý chi nhánh'
      : 'Thu ngân / Bán hàng';

  const userInitials = (user?.fullName || 'TN')
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  // -------------------------------------------------------------
  // 1. COMPACT STICKY HEADER FOR ORDER DETAIL MODE (48–56px)
  // [ ← Back ] | [ #OrderCode ] | [ Bàn / Loại đơn ] | [ Khách ] | [ Trạng thái ] | [ Tổng tiền ] | [ More ⋮ ]
  // -------------------------------------------------------------
  if (isDetailMode) {
    return (
      <header className="h-12 sm:h-14 px-3 sm:px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shadow-xs shrink-0 z-30 sticky top-0 select-none">
        {/* Left: Back button + Order Context */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={onBackFromDetailMode}
            className="h-9 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title="Quay lại danh mục món"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>

          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-1 rounded-lg text-xs shrink-0">
            {currentOrder?.orderCode || 'ĐƠN MỚI'}
          </span>

          <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold truncate max-w-[140px] shrink-0">
            {selectedTable?.name || (orderType === 'TAKEAWAY' ? 'Mang đi' : orderType === 'DELIVERY' ? 'Giao hàng' : 'Tại bàn')}
          </span>

          <span className="text-xs text-slate-600 hidden md:inline truncate max-w-[160px]">
            {customerName} • {guestCount} khách
          </span>

          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hidden sm:inline shrink-0">
            {currentOrder?.status === 'COMPLETED' ? 'Đã thanh toán' : currentOrder?.status === 'HELD' ? 'Tạm giữ đơn' : 'Đang phục vụ'}
          </span>
        </div>

        {/* Right: QR Button + Grand Total + More actions dropdown */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {onOpenQrManagement && (selectedTable || currentOrder?.tableId) && (
            <button
              type="button"
              onClick={onOpenQrManagement}
              className="h-9 px-2.5 sm:px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-[#da251d] text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
              title="Mở QR gọi món cho bàn này"
            >
              <QrCode className="w-4 h-4 text-[#da251d]" />
              <span className="hidden sm:inline">QR Gọi món</span>
            </button>
          )}

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:inline mr-1">
              Tổng tiền:
            </span>
            <span className="text-sm sm:text-base font-black text-[#da251d] font-mono">
              {(grandTotal || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>

          {/* Notification Bell in Detail Mode */}
          <button
            type="button"
            onClick={openDrawer}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-95 text-slate-600 cursor-pointer"
            title="Thông báo POS"
            aria-label="Thông báo POS"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#da251d] text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* More actions dropdown in Detail Mode */}
          <div className="relative" ref={detailMoreRef}>
            <button
              type="button"
              onClick={() => setIsDetailMoreOpen(!isDetailMoreOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-100 active:scale-95 text-slate-600 cursor-pointer"
              title="Thao tác khác"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isDetailMoreOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in duration-100">
                {onOpenQrManagement && (selectedTable || currentOrder?.tableId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailMoreOpen(false);
                      onOpenQrManagement();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-[#da251d] hover:bg-red-50 flex items-center gap-2.5 font-bold cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-[#da251d]" />
                    <span>QR Gọi món bàn</span>
                  </button>
                )}

                {onOpenPrintBill && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailMoreOpen(false);
                      onOpenPrintBill();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>In tạm tính (F4)</span>
                  </button>
                )}

                {onOpenSplitModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailMoreOpen(false);
                      onOpenSplitModal();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                  >
                    <Split className="w-4 h-4 text-blue-500" />
                    <span>Tách đơn</span>
                  </button>
                )}

                {onOpenMergeModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailMoreOpen(false);
                      onOpenMergeModal();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                  >
                    <Combine className="w-4 h-4 text-indigo-500" />
                    <span>Gộp đơn</span>
                  </button>
                )}

                {onOpenMoveTableModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailMoreOpen(false);
                      onOpenMoveTableModal();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 font-medium cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                    <span>Chuyển bàn</span>
                  </button>
                )}

                {currentOrder && onOpenCancelModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsDetailMoreOpen(false);
                      onOpenCancelModal();
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-bold cursor-pointer"
                  >
                    <Ban className="w-4 h-4 text-rose-600" />
                    <span>Hủy đơn</span>
                  </button>
                )}

                {onClearCart && (
                  <>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailMoreOpen(false);
                        onClearCart();
                      }}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 font-bold cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa toàn bộ món</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  // -------------------------------------------------------------
  // 2. STANDARD FULL POS HEADER
  // -------------------------------------------------------------
  return (
    <header className="h-12 sm:h-14 px-2.5 sm:px-4 bg-white border-b border-slate-200 flex items-center justify-between gap-1.5 sm:gap-3 shadow-xs shrink-0 z-30 select-none">
      {/* 1. Left: Hamburger 3-gạch + Brand Logo */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Menu / Cài đặt POS Button: 3 gạch nằm ngoài cùng bên trái cạnh logo */}
        {onOpenSettingsDrawer && (
          <button
            type="button"
            onClick={onOpenSettingsDrawer}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 hover:text-[#da251d] active:scale-95 text-slate-700 flex items-center justify-center shadow-2xs transition-all cursor-pointer"
            title="Menu POS / Cài đặt hệ thống (Toàn màn hình)"
          >
            <Menu className="w-4 sm:w-5 h-4 sm:h-5 text-slate-700 hover:text-[#da251d]" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <img
            src="/avora_logo_ngang.png"
            alt="AVORA Restaurant"
            className="h-8 sm:h-9 w-auto max-w-[130px] sm:max-w-[160px] object-contain cursor-pointer"
          />
        </div>
      </div>

      {/* 2. Center: Functional Tabs (F1, F3, F9, Bàn, Đặt bàn, QR) */}
      <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
        {/* F3: Bán hàng / Sơ đồ bàn */}
        <button
          type="button"
          onClick={() => onSelectTab('SALE')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 h-8 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'SALE'
              ? 'bg-white text-[#da251d] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
          title="Bán hàng & Thực đơn món (F3)"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Thực đơn</span>
          <span className="text-[10px] text-slate-400 font-normal hidden lg:inline">(F3)</span>
        </button>

        {/* Sơ đồ bàn */}
        <button
          type="button"
          onClick={() => onSelectTab('TABLES')}
          className={`flex items-center gap-1 px-2.5 sm:px-3 h-8 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'TABLES'
              ? 'bg-white text-[#da251d] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
          title="Sơ đồ bàn phòng"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Bàn phòng</span>
        </button>

        {/* F9: Danh sách đơn */}
        <button
          type="button"
          onClick={() => onSelectTab('ORDERS')}
          className={`flex items-center gap-1 px-2 sm:px-2.5 h-8 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'ORDERS'
              ? 'bg-white text-[#da251d] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
          title="Tất cả đơn hàng (F9)"
        >
          <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden md:inline">Đơn hàng</span>
          {orderCounts.allOrders !== undefined && orderCounts.allOrders > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-[#da251d] text-white rounded-full font-bold">
              {orderCounts.allOrders}
            </span>
          )}
        </button>

        {/* Đặt bàn (Reservations) */}
        <button
          type="button"
          onClick={() => onSelectTab('RESERVATIONS')}
          className={`flex items-center gap-1 px-2 sm:px-2.5 h-8 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'RESERVATIONS'
              ? 'bg-white text-[#da251d] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
          title="Quản lý đặt bàn"
        >
          <CalendarCheck className="w-3.5 h-3.5 text-sky-600" />
          <span className="hidden lg:inline">Đặt bàn</span>
          {orderCounts.reservations !== undefined && orderCounts.reservations > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-600 text-white rounded-full font-bold">
              {orderCounts.reservations}
            </span>
          )}
        </button>

        {/* QR Orders */}
        <button
          type="button"
          onClick={() => onSelectTab('QR_ORDERS')}
          className={`flex items-center gap-1 px-2 sm:px-2.5 h-8 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'QR_ORDERS'
              ? 'bg-white text-[#da251d] shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
          title="Đơn đặt qua mã QR bàn"
        >
          <QrCode className="w-3.5 h-3.5 text-amber-500" />
          <span className="hidden lg:inline">QR Order</span>
          {orderCounts.qrOrders !== undefined && orderCounts.qrOrders > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500 text-white rounded-full font-bold">
              {orderCounts.qrOrders}
            </span>
          )}
        </button>
      </nav>

      {/* 3. Right: Live Clock, Connection Status, Fullscreen, User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Realtime Live Clock */}
        <div
          className="hidden xl:flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200"
          title="Đồng hồ hệ thống POS"
        >
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{timeStr}</span>
        </div>

        {/* Socket Connection Status Indicator */}
        {connectionStatus !== 'CONNECTED' && (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
              connectionStatus === 'RECONNECTING' || connectionStatus === 'CONNECTING'
                ? 'bg-amber-50 text-amber-700 border-amber-300'
                : 'bg-rose-50 text-rose-700 border-rose-300'
            }`}
            title={`Trạng thái mạng POS: ${connectionStatus}`}
          >
            {connectionStatus === 'RECONNECTING' || connectionStatus === 'CONNECTING' ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                <span className="hidden sm:inline">Đang kết nối lại...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-600" />
                <span className="hidden sm:inline">Mất kết nối</span>
              </>
            )}
          </div>
        )}

        {/* Notification Bell Button */}
        <button
          type="button"
          onClick={openDrawer}
          className="relative w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Thông báo hệ thống POS"
          aria-label="Thông báo hệ thống POS"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-[#da251d] text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-xs animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Quick Launch Desktop App Button (Only visible on Web) */}
        {!platformBridge.isDesktop && onOpenDesktopLaunch && (
          <button
            type="button"
            onClick={onOpenDesktopLaunch}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#da251d] border border-red-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Mở ứng dụng AVORA POS Desktop (Tự động đăng nhập SSO)"
          >
            <Monitor className="w-3.5 h-3.5 text-[#da251d]" />
            <span>Mở POS Desktop</span>
          </button>
        )}

        {/* User Profile Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
            title="Menu tài khoản"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={userName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-red-100 text-[#da251d] flex items-center justify-center font-bold text-xs">
                {userInitials}
              </div>
            )}
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight max-w-[100px] truncate">
                {userName}
              </span>
              <span className="text-[10px] text-slate-400 font-medium leading-none">
                {userRole}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in duration-100">
              <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={userName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-red-100 text-[#da251d] flex items-center justify-center font-bold text-xs">
                    {userInitials}
                  </div>
                )}
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold text-slate-800 truncate">{userName}</span>
                  <span className="text-[10px] text-slate-400 truncate">{userRole}</span>
                </div>
              </div>

              {/* Mở AVORA POS Desktop (khi đang duyệt Web) */}
              {!platformBridge.isDesktop && onOpenDesktopLaunch && (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenDesktopLaunch();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-[#da251d] hover:bg-red-50 flex items-center gap-2.5 transition-colors font-bold cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 text-[#da251d]" />
                    <div className="flex flex-col">
                      <span>Mở AVORA POS Desktop</span>
                      <span className="text-[10px] text-slate-400 font-normal">Tự động đăng nhập SSO</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Tổng kết cuối ngày / Kết ca */}
              {onOpenEndOfDayReport && (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenEndOfDayReport();
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-800 hover:bg-red-50 hover:text-[#da251d] flex items-center gap-2.5 transition-colors font-bold cursor-pointer"
                  >
                    <Receipt className="w-4 h-4 text-[#da251d]" />
                    <span>Tổng kết cuối ngày</span>
                  </button>
                </div>
              )}

              {/* Trang quản trị */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onGoToAdmin();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors font-semibold cursor-pointer"
                >
                  <LayoutDashboard className="w-4 h-4 text-slate-600" />
                  <span>Trang quản trị AVORA</span>
                </button>
              </div>

              <div className="border-t border-slate-100 my-0.5" />

              {/* Đóng ứng dụng (Desktop only) */}
              {platformBridge.isDesktop && (
                <div className="py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsExitConfirmOpen(true);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors font-bold cursor-pointer"
                  >
                    <Power className="w-4 h-4 text-[#da251d]" />
                    <div className="flex items-center justify-between flex-1">
                      <span>Đóng ứng dụng</span>
                      <kbd className="px-1 py-0.2 bg-red-100 text-red-700 rounded text-[9px] font-mono font-bold">Alt+F4</kbd>
                    </div>
                  </button>
                </div>
              )}

              {/* Đăng xuất */}
              <div className="py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors font-bold cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-600" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal xác nhận đóng ứng dụng AVORA POS */}
      <PosExitConfirmModal
        isOpen={isExitConfirmOpen}
        onClose={() => setIsExitConfirmOpen(false)}
        onConfirm={async () => {
          setIsExitConfirmOpen(false);
          await platformBridge.exitApp?.();
        }}
      />
    </header>
  );
};
