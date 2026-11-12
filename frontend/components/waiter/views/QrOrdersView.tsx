'use client';

import React from 'react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import { QrCode, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PullToRefresh } from '../common/PullToRefresh';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function QrOrdersView() {
  const isOffline = useWaiterStore(s => s.isOffline);
  const activeBranchId = useWaiterStore(s => s.activeBranchId);

  const { data: response, isLoading, mutate } = useSWR(
    isOffline || !activeBranchId ? null : `/api/pos/qr-orders?branchId=${activeBranchId}`,
    fetcher,
    { refreshInterval: 5000 }
  );

  const qrRequests = response?.data?.qrOrders || [];

  const handleConfirmQr = async (orderId: string, tableName?: string) => {
    try {
      const res = await fetch(`/api/pos/qr-orders/${orderId}/confirm`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi xác nhận đơn QR');
      }
      toast.success(`Đã duyệt đơn QR cho ${tableName || 'bàn'}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Không thể duyệt đơn');
    }
  };

  const handleRejectQr = async (orderId: string, tableName?: string) => {
    try {
      const res = await fetch(`/api/pos/qr-orders/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Nhân viên từ chối nhận món' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi từ chối đơn QR');
      }
      toast.success(`Đã từ chối đơn QR cho ${tableName || 'bàn'}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Không thể từ chối đơn');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-50 select-none">
      <div className="px-4 pt-[max(10px,calc(env(safe-area-inset-top)+4px))] pb-3 bg-white border-b border-slate-200/80 shrink-0 shadow-2xs select-none">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <QrCode className="text-[#DA251D]" size={18} />
          Yêu cầu từ khách (QR)
        </h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Các món khách hàng tự gọi qua mã QR tại bàn</p>
      </div>

      <PullToRefresh
        onRefresh={async () => {
          await mutate();
        }}
        isOffline={isOffline}
        className="p-3 space-y-2.5 pb-8"
      >
        {isLoading && !isOffline ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DA251D]"></div>
          </div>
        ) : qrRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <QrCode size={24} className="text-slate-300" />
            </div>
            <p className="font-medium">Chưa có yêu cầu mới.</p>
          </div>
        ) : (
          qrRequests.map((req: any) => (
            <div key={req.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Bàn {req.table?.name || req.tableId}</h3>
                <span className="text-xs font-medium text-slate-500">
                  {new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                {req.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-semibold text-slate-700">{item.quantity}x {item.product?.name}</span>
                    <span className="text-slate-600 font-medium">{(item.price * item.quantity).toLocaleString('vi-VN')}₫</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-1">
                <button 
                  onClick={() => handleRejectQr(req.id, req.table?.name)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                  <XCircle size={18} />
                  Từ chối
                </button>
                <button 
                  onClick={() => handleConfirmQr(req.id, req.table?.name)}
                  className="flex-1 bg-[#DA251D] hover:bg-red-700 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm shadow-red-200 active:scale-95 transition-transform"
                >
                  <CheckCircle size={18} />
                  Xác nhận
                </button>
              </div>
            </div>
          ))
        )}
      </PullToRefresh>
    </div>
  );
}
