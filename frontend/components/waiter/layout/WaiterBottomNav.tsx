'use client';

import React from 'react';
import { useWaiterStore, WaiterTab } from '@/store/useWaiterStore';
import { LayoutGrid, Receipt, QrCode, Settings } from 'lucide-react';

const TABS: { id: WaiterTab; label: string; icon: any; path: string }[] = [
  { id: 'TABLES', label: 'Bàn', icon: LayoutGrid, path: '/admin/pos/waiter' },
  { id: 'ORDERS', label: 'Đơn', icon: Receipt, path: '/admin/pos/waiter?tab=ORDERS' },
  { id: 'QR', label: 'QR', icon: QrCode, path: '/admin/pos/waiter?tab=QR' },
  { id: 'SETTINGS', label: 'Thêm', icon: Settings, path: '/admin/pos/waiter?tab=SETTINGS' },
];

export default function WaiterBottomNav() {
  const { activeTab, setActiveTab } = useWaiterStore();

  return (
    <nav className="w-full bg-white border-t border-slate-100 flex justify-around items-center shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] pb-[env(safe-area-inset-bottom)] z-50">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 tap-highlight-transparent active:scale-95 transition-transform"
            style={{ minHeight: '56px' }}
          >
            <Icon 
              size={24} 
              strokeWidth={isActive ? 2.5 : 2} 
              className={isActive ? 'text-[#DA251D]' : 'text-slate-400'} 
            />
            <span 
              className={`text-[10px] font-medium ${isActive ? 'text-[#DA251D]' : 'text-slate-400'}`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
