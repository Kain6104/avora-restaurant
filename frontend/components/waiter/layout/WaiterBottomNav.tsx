'use client';

import React from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { LayoutGrid, Receipt, QrCode, SlidersHorizontal, ScanLine } from 'lucide-react';
import { useIsIPhone } from '@/lib/utils/device';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function WaiterBottomNav() {
  const { activeTab, setActiveTab, setAttendanceScannerOpen, activeBranchId, isOffline } = useWaiterStore();
  const isIPhone = useIsIPhone();

  // Fetch pending QR orders count for badge
  const { data: qrResponse } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/qr-orders?branchId=${activeBranchId}`,
    fetcher,
    { refreshInterval: 6000 }
  );

  const qrOrdersList = (qrResponse?.data?.qrOrders || []) as Array<{ status?: string }>;
  const serviceReqList = (qrResponse?.data?.serviceRequests || []) as Array<{ status?: string }>;
  const pendingQrCount =
    typeof qrResponse?.data?.pendingCount === 'number'
      ? qrResponse.data.pendingCount
      : qrOrdersList.filter((o) => o.status === 'PENDING').length +
        serviceReqList.filter((r) => r.status === 'OPEN').length;

  return (
    <>
      <style jsx global>{`
        /* Center FAB Curved Notch & Scanning Laser */
        .bottom-nav-curve {
          position: absolute;
          top: ${isIPhone ? '-22px' : '-20px'};
          width: ${isIPhone ? '72px' : '66px'};
          height: ${isIPhone ? '60px' : '54px'};
          background-color: #ffffff;
          border-radius: 50%;
          box-shadow: 0 -2px 6px rgba(0,0,0,0.03);
          z-index: 1;
        }

        .center-fab-squircle {
          width: ${isIPhone ? '52px' : '48px'};
          height: ${isIPhone ? '52px' : '48px'};
          background: linear-gradient(135deg, #FF3B30, #DA251D);
          border-radius: ${isIPhone ? '18px' : '16px'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(218, 37, 29, 0.4);
          transform: translateY(${isIPhone ? '-10px' : '-12px'});
          transition: transform 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          z-index: 2;
        }

        .center-fab-squircle:active {
          transform: translateY(${isIPhone ? '-6px' : '-8px'}) scale(0.92);
        }

        .scan-laser-line {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 2px;
          background-color: rgba(255, 255, 255, 0.95);
          box-shadow: 0 0 8px 2px rgba(255, 255, 255, 0.8);
          z-index: 1;
          animation: scanningLaser 2s ease-in-out infinite;
        }

        @keyframes scanningLaser {
          0% { top: 15%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }
      `}</style>

      <nav
        className={`w-full bg-white border-t border-slate-200/80 flex items-center shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] z-50 relative select-none touch-none overscroll-none transition-all ${
          isIPhone
            ? 'pb-[max(18px,calc(env(safe-area-inset-bottom)+8px))] pt-1.5 min-h-[64px]'
            : 'pb-[max(6px,calc(env(safe-area-inset-bottom)+2px))] pt-1 min-h-[58px]'
        }`}
      >
        
        {/* Tab 1: Sơ đồ bàn */}
        <button
          onClick={() => setActiveTab('TABLES')}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 tap-highlight-transparent active:scale-95 transition-transform"
        >
          <LayoutGrid 
            size={22} 
            strokeWidth={activeTab === 'TABLES' ? 2.5 : 2} 
            className={activeTab === 'TABLES' ? 'text-[#DA251D]' : 'text-slate-400'} 
          />
          <span className={`text-[10px] font-bold ${activeTab === 'TABLES' ? 'text-[#DA251D]' : 'text-slate-500'}`}>
            Bàn
          </span>
        </button>

        {/* Tab 2: Đơn hàng */}
        <button
          onClick={() => setActiveTab('ORDERS')}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 tap-highlight-transparent active:scale-95 transition-transform"
        >
          <Receipt 
            size={22} 
            strokeWidth={activeTab === 'ORDERS' ? 2.5 : 2} 
            className={activeTab === 'ORDERS' ? 'text-[#DA251D]' : 'text-slate-400'} 
          />
          <span className={`text-[10px] font-bold ${activeTab === 'ORDERS' ? 'text-[#DA251D]' : 'text-slate-500'}`}>
            Đơn Hàng
          </span>
        </button>

        {/* Center: Chấm công (Curved Notch & Laser Scan FAB) */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 py-1">
          <div className="bottom-nav-curve" />
          <div 
            onClick={() => setAttendanceScannerOpen(true)}
            className="flex flex-col items-center justify-center cursor-pointer z-10"
          >
            <div className="center-fab-squircle">
              <ScanLine size={24} className="z-10 relative" />
              <div className="scan-laser-line" />
            </div>
            <span className="text-[10px] text-[#DA251D] font-black -mt-2 tracking-tight whitespace-nowrap">
              Chấm công
            </span>
          </div>
        </div>

        {/* Tab 4: QR Order */}
        <button
          onClick={() => setActiveTab('QR')}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 tap-highlight-transparent active:scale-95 transition-transform relative"
        >
          <div className="relative">
            <QrCode 
              size={22} 
              strokeWidth={activeTab === 'QR' ? 2.5 : 2} 
              className={activeTab === 'QR' ? 'text-[#DA251D]' : 'text-slate-400'} 
            />
            {pendingQrCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-black shadow-xs animate-bounce">
                {pendingQrCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] font-bold ${activeTab === 'QR' ? 'text-[#DA251D]' : 'text-slate-500'}`}>
            QR Order
          </span>
        </button>

        {/* Tab 5: Tiện ích / Thêm */}
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-1 tap-highlight-transparent active:scale-95 transition-transform"
        >
          <SlidersHorizontal 
            size={22} 
            strokeWidth={activeTab === 'SETTINGS' ? 2.5 : 2} 
            className={activeTab === 'SETTINGS' ? 'text-[#DA251D]' : 'text-slate-400'} 
          />
          <span className={`text-[10px] font-bold ${activeTab === 'SETTINGS' ? 'text-[#DA251D]' : 'text-slate-500'}`}>
            Tiện ích
          </span>
        </button>

      </nav>
    </>
  );
}
