'use client';

import React, { useEffect, useState } from 'react';
import { useWaiterStore } from '@/store/useWaiterStore';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { db } from '@/lib/offline/db';

export default function ConnectionIndicator() {
  const isOffline = useWaiterStore(s => s.isOffline);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (isOffline) {
      // Poll or subscribe to Dexie to get pending offline commands count
      const interval = setInterval(() => {
        db.offlineCommands.where('syncState').equals('PENDING').count().then(setPendingCount);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isOffline]);

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border text-sm font-bold transition-all ${
      isOffline 
        ? 'bg-red-50 text-red-600 border-red-200' 
        : 'bg-amber-50 text-amber-600 border-amber-200'
    }`}>
      {isOffline ? (
        <>
          <CloudOff size={16} />
          <span>Mất kết nối</span>
          {pendingCount > 0 && <span className="ml-1 bg-red-100 px-2 py-0.5 rounded text-xs">+{pendingCount} thao tác chưa đồng bộ</span>}
        </>
      ) : (
        <>
          <RefreshCw size={16} className="animate-spin" />
          <span>Đang đồng bộ {pendingCount} thay đổi...</span>
        </>
      )}
    </div>
  );
}
