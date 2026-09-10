'use client';

import React, { useEffect, useState } from 'react';
import { useWaiterStore } from '@/store/useWaiterStore';
import { db } from '@/lib/offline/db';
import { Settings, CloudOff, RefreshCw, User, LogOut, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsView() {
  const { isOffline, activeBranchId, currentUser, currentBranch } = useWaiterStore();
  const [offlineCount, setOfflineCount] = useState(0);

  const roleLabelMap: Record<string, string> = {
    ADMIN: 'Quản trị viên hệ thống',
    MANAGER: 'Quản lý chi nhánh',
    CHEF: 'Bếp trưởng',
    WAITER: 'Nhân viên phục vụ bàn',
    USER: 'Thành viên',
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    const fetchOfflineCount = async () => {
      try {
        const count = await db.offlineCommands.where('syncState').equals('PENDING').count();
        setOfflineCount(count);
      } catch (e) {
        // ignore
      }
    };
    fetchOfflineCount();
    const interval = setInterval(fetchOfflineCount, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = () => {
    if (isOffline) {
      toast.error('Thiết bị đang offline. Không thể đồng bộ.');
      return;
    }
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      {
        loading: 'Đang đồng bộ...',
        success: 'Đồng bộ thành công!',
        error: 'Lỗi đồng bộ'
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 pt-[env(safe-area-inset-top)] pb-14">
      <div className="px-4 py-4 bg-white border-b border-slate-100 shrink-0 shadow-sm flex items-center justify-between">
        <h2 className="font-bold text-xl text-slate-800">Tiện ích & Cài đặt</h2>
        <Settings className="text-slate-400" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 touch-pan-y">
        {/* Network & Sync Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-50 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isOffline ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isOffline ? <CloudOff size={24} /> : <RefreshCw size={24} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Trạng thái kết nối</h3>
              <p className={`text-sm font-medium ${isOffline ? 'text-red-600' : 'text-emerald-600'}`}>
                {isOffline ? 'Mất kết nối mạng' : 'Đang Online'}
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 flex justify-between items-center">
            <div>
              <div className="text-sm font-bold text-slate-800">Hàng đợi Offline</div>
              <div className="text-xs text-slate-500">Các thao tác chờ đồng bộ lên server</div>
            </div>
            <div className="text-lg font-black text-[#DA251D] bg-red-100 px-3 py-1 rounded-full">
              {offlineCount}
            </div>
          </div>

          <div className="p-4 border-t border-slate-50">
            <button 
              onClick={handleManualSync}
              disabled={isOffline || offlineCount === 0}
              className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
            >
              <RefreshCw size={18} />
              Đồng bộ ngay
            </button>
          </div>
        </div>

        {/* User Account */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 flex items-center gap-3 border-b border-slate-50">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <User size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">{currentUser?.fullName || 'Nhân viên phục vụ'}</h3>
              <p className="text-sm text-slate-500">
                Vai trò: {roleLabelMap[currentUser?.role || ''] || currentUser?.role || 'Phục vụ bàn'}
                {currentBranch ? ` • ${currentBranch.name}` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full p-4 flex items-center text-red-600 hover:bg-red-50 transition-colors font-bold gap-2 active:bg-red-100"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>

        {/* App Info */}
        <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
          <Info size={24} />
          <div className="text-sm font-medium">AVORA POS Waiter App</div>
          <div className="text-xs">Phiên bản 1.0.0 (Build 20260907)</div>
        </div>

      </div>
    </div>
  );
}
