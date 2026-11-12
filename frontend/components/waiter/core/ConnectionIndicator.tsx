'use client';

import React, { useState } from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw, AlertTriangle, CheckCircle2, Clock, Check, XCircle } from 'lucide-react';
import { useSyncStatus } from '@/lib/offline/useOfflineData';
import { useIsIPhone } from '@/lib/utils/device';
import { db, OfflineCommand } from '@/lib/offline/db';
import { useLiveQuery } from 'dexie-react-hooks';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import dayjs from 'dayjs';

export default function ConnectionIndicator() {
  const { networkState, lastSyncAt, isSyncing, pendingCount, triggerSync, processQueue } = useSyncStatus();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const isIPhone = useIsIPhone();

  // Load all offline commands for detail viewing
  const commands = useLiveQuery<OfflineCommand[]>(async () => {
    return db.offlineCommands.reverse().limit(30).toArray();
  }, []) || [];

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Chưa đồng bộ';
    try {
      const d = dayjs(iso);
      const diffSec = dayjs().diff(d, 'second');
      if (diffSec < 45) return 'Vừa xong';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}p trước`;
      return d.format('HH:mm');
    } catch {
      return 'Đã lưu';
    }
  };

  const handleManualSync = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (networkState === 'OFFLINE' || isRetrying) return;
    setIsRetrying(true);
    try {
      await processQueue();
      await triggerSync(true);
    } finally {
      setIsRetrying(false);
    }
  };

  const getCommandLabel = (cmd: OfflineCommand) => {
    switch (cmd.commandType) {
      case 'SEND_ITEMS':
        return `Gửi món vào bếp (${cmd.payload?.items?.length || 0} món)`;
      case 'OPEN_TABLE':
        return `Mở bàn (${cmd.payload?.guestCount || 1} khách)`;
      case 'UPDATE_ORDER_NOTE':
        return 'Cập nhật ghi chú';
      case 'REDEEM_POINTS':
        return 'Đổi điểm thưởng';
      default:
        return cmd.commandType || 'Thao tác POS';
    }
  };

  // If online, fully synced, and not syncing, keep indicator hidden
  if (networkState === 'ONLINE' && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        onClick={() => setIsQueueOpen(true)}
        className={`fixed ${isIPhone ? 'bottom-[70px]' : 'bottom-[58px]'} left-1/2 -translate-x-1/2 z-[60] max-w-[94vw] flex items-center gap-1.5 px-3 py-1 rounded-full shadow-md border text-[11px] font-bold select-none cursor-pointer active:scale-95 transition-all ${
          networkState === 'OFFLINE'
            ? 'bg-rose-50 text-rose-700 border-rose-300/80 hover:bg-rose-100'
            : networkState === 'SERVER_UNAVAILABLE'
            ? 'bg-amber-50 text-amber-800 border-amber-300/80 hover:bg-amber-100'
            : 'bg-emerald-50 text-emerald-800 border-emerald-300/80 hover:bg-emerald-100'
        }`}
      >
        {/* Status Icon */}
        {isSyncing || isRetrying ? (
          <RefreshCw size={12} className="animate-spin text-amber-600 shrink-0" />
        ) : networkState === 'OFFLINE' ? (
          <WifiOff size={12} className="text-rose-600 shrink-0" />
        ) : networkState === 'SERVER_UNAVAILABLE' ? (
          <AlertTriangle size={12} className="text-amber-600 shrink-0" />
        ) : (
          <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
        )}

        {/* Short Text */}
        <span className="whitespace-nowrap">
          {networkState === 'OFFLINE'
            ? 'Mất mạng'
            : networkState === 'SERVER_UNAVAILABLE'
            ? 'Máy chủ gián đoạn'
            : isSyncing
            ? 'Đang đồng bộ'
            : 'Đã kết nối'}
        </span>

        <span className="opacity-40">•</span>
        <span className="font-normal opacity-80 whitespace-nowrap">
          {formatLastSync(lastSyncAt)}
        </span>

        {/* Pending Badge */}
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isRetrying || networkState === 'OFFLINE'}
            title="Nhấn để thử gửi dữ liệu"
            className="ml-1 shrink-0 inline-flex items-center gap-1 bg-white hover:bg-slate-50 active:scale-95 px-1.5 py-0.5 rounded-md border border-slate-200/80 text-[10px] font-black text-rose-600 shadow-2xs whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <span>{pendingCount} chờ gửi</span>
            <RefreshCw size={9} className={isRetrying || isSyncing ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Offline Queue Details Modal */}
      <ResponsiveModal
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        title="Hàng đợi ngoại tuyến (Offline Queue)"
        subtitle="Các thao tác đang được lưu an toàn tại IndexedDB trên thiết bị"
        maxWidth="md"
      >
        <div className="space-y-3 py-1">
          {/* Status summary */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                networkState === 'ONLINE' ? 'bg-emerald-500' : networkState === 'SERVER_UNAVAILABLE' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="font-bold text-slate-700">
                {networkState === 'ONLINE' ? 'Máy chủ khả dụng' : networkState === 'SERVER_UNAVAILABLE' ? 'Máy chủ gián đoạn' : 'Mất kết nối Internet'}
              </span>
            </div>
            <span className="font-bold text-slate-500">
              {pendingCount} lệnh chờ đồng bộ
            </span>
          </div>

          {/* Commands list */}
          <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
            {commands.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Không có lệnh ngoại tuyến nào đang chờ.
              </div>
            ) : (
              commands.map((cmd) => (
                <div
                  key={cmd.id}
                  className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {getCommandLabel(cmd)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(cmd.createdAt).toLocaleTimeString('vi-VN')}
                      </span>
                      {cmd.retryCount > 0 && (
                        <span>• Thử lại: {cmd.retryCount} lần</span>
                      )}
                    </div>
                    {cmd.errorReason && (
                      <p className="text-[10px] text-rose-600 mt-1 truncate">
                        Lỗi: {cmd.errorReason}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      cmd.syncState === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : cmd.syncState === 'SYNCING'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : cmd.syncState === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : cmd.syncState === 'CONFLICT'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {cmd.syncState === 'COMPLETED'
                        ? 'Đã gửi'
                        : cmd.syncState === 'SYNCING'
                        ? 'Đang gửi'
                        : cmd.syncState === 'FAILED'
                        ? 'Thất bại'
                        : cmd.syncState === 'CONFLICT'
                        ? 'Xung đột'
                        : 'Đang chờ'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={networkState === 'OFFLINE' || isRetrying || pendingCount === 0}
              className="flex-1 h-[40px] bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isRetrying ? 'animate-spin' : ''} />
              <span>Gửi lại tất cả</span>
            </button>
            <button
              type="button"
              onClick={() => setIsQueueOpen(false)}
              className="px-4 h-[40px] bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
}
