'use client';

import React, { useState } from 'react';
import { Bell, Wifi, WifiOff, ChevronDown, Building2, Check, X } from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';
import { useRealtimeNotifications } from '@/contexts/NotificationRealtimeProvider';
import { useAdmin } from '@/contexts/AdminContext';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function WaiterHeader() {
  const isOffline = useWaiterStore((state) => state.isOffline);
  const currentBranch = useWaiterStore((state) => state.currentBranch);
  const setCurrentBranch = useWaiterStore((state) => state.setCurrentBranch);
  const setActiveBranchId = useWaiterStore((state) => state.setActiveBranchId);
  const { unreadCount, openDrawer } = useRealtimeNotifications();
  const { availableBranches, setSelectedBranchId, selectedBranchId } = useAdmin();

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  const handleSelectBranch = (b: any) => {
    setSelectedBranchId(b.id);
    setCurrentBranch({
      id: b.id,
      name: b.name,
      branchCode: b.branchCode,
    });
    setActiveBranchId(b.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('avora_waiter_selected_branch', b.id);
      localStorage.setItem('avora_admin_selected_branch', b.id);
      localStorage.setItem('avora_pos_selected_branch', b.id);
    }
    setIsBranchModalOpen(false);
    toast.success(`Đã chuyển sang ${b.name}`);
  };

  return (
    <>
      <header className="w-full max-w-full box-border h-14 bg-white border-b border-slate-100 flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-xs z-40 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Image src="/avora_logo_ngang.png" alt="AVORA" width={76} height={22} className="object-contain shrink-0" />
          
          <button
            type="button"
            onClick={() => setIsBranchModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 px-2.5 py-1 rounded-full transition-all truncate cursor-pointer max-w-[170px] sm:max-w-[220px]"
            title="Bấm để đổi chi nhánh"
          >
            <Building2 className="w-3.5 h-3.5 text-[#da251d] shrink-0" />
            <span className="truncate">{currentBranch?.name || 'Chọn chi nhánh'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Connection Status */}
          {isOffline ? (
            <div className="flex items-center gap-1 text-red-500">
              <WifiOff size={16} />
              <span className="text-[11px] font-medium hidden xs:inline">Ngoại tuyến</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-emerald-500">
              <Wifi size={16} />
            </div>
          )}

          {/* Notification Bell */}
          <button
            type="button"
            onClick={openDrawer}
            className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full active:bg-slate-200 transition-colors cursor-pointer shrink-0"
            title="Thông báo phục vụ"
            aria-label="Thông báo phục vụ"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-[#DA251D] text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Branch Selection Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Chọn Chi Nhánh</h3>
                  <p className="text-[11px] text-slate-400">Chọn điểm phục vụ của bạn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {(availableBranches && availableBranches.length > 0 ? availableBranches : [currentBranch].filter(Boolean)).map((b: any) => {
                const isSelected = b.id === currentBranch?.id || b.id === selectedBranchId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBranch(b)}
                    className={`w-full p-3 rounded-2xl text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-red-50/80 border border-red-200 text-[#da251d]'
                        : 'bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-800'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold leading-snug">{b.name}</p>
                      {b.branchCode && (
                        <span className="text-[10px] text-slate-400 font-mono">Mã: {b.branchCode}</span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#da251d] stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
