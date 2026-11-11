'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, MapPin, RefreshCw, CheckCircle, Clock } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AttendanceQrDisplayPage() {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(300);

  // Fetch branches
  const { data: branchRes } = useSWR('/api/pos/init', fetcher);
  const branches: any[] = branchRes?.data?.branches || [];

  // Lấy branchId từ localStorage nếu có
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('avora_attendance_display_branch_id');
      if (saved) setSelectedBranchId(saved);
      else if (branches.length > 0 && !selectedBranchId) {
        setSelectedBranchId(branches[0].id);
      }
    }
  }, [branches]);

  const handleBranchChange = (bId: string) => {
    setSelectedBranchId(bId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('avora_attendance_display_branch_id', bId);
    }
    setCountdown(300);
  };

  // Fetch QR động
  const { data: qrRes, mutate: refreshQr } = useSWR(
    selectedBranchId ? `/api/attendance/qr/dynamic?branchId=${selectedBranchId}` : null,
    fetcher,
    { refreshInterval: 180000, revalidateOnFocus: false }, // refresh mỗi 3 phút
  );
  const qrData = qrRes?.data?.qrData || '';
  const branchName = qrRes?.data?.branchName || 'Chi nhánh';

  // Fetch danh sách nhân viên vừa chấm hôm nay
  const { data: todayRes } = useSWR(
    selectedBranchId ? `/api/attendance/qr/branch-today?branchId=${selectedBranchId}` : null,
    fetcher,
    { refreshInterval: 4000 }, // polling mỗi 4 giây
  );
  const todayList: any[] = todayRes?.data || [];

  // Countdown timer 300s
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshQr();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshQr]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-6 select-none">
      {/* Top Header */}
      <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#DA251D] flex items-center justify-center font-black text-white text-lg shadow-lg shadow-[#DA251D]/30">
            A
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-white">
              MÃ QR CHẤM CÔNG TẠI QUÁN
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Tự động làm mới bảo mật chống chụp màn hình
            </p>
          </div>
        </div>

        {/* Dropdown Chi Nhánh */}
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#DA251D]" />
          <select
            value={selectedBranchId}
            onChange={(e) => handleBranchChange(e.target.value)}
            className="bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-white/15"
          >
            <option value="" className="text-slate-900">-- Chọn chi nhánh hiển thị --</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="text-slate-900">{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Center Card QR */}
      <div className="flex flex-col items-center justify-center my-auto p-8 bg-white rounded-3xl shadow-2xl text-slate-900 text-center max-w-md w-full border-4 border-slate-100 relative">
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-red-50 text-[#DA251D] text-xs font-bold tracking-wider uppercase mb-1">
            AVORA F&B RESTAURANT
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{branchName}</h2>
        </div>

        {/* Khung QR SVG */}
        <div className="p-5 bg-white rounded-2xl border-2 border-slate-100 shadow-inner flex items-center justify-center">
          {qrData ? (
            <QRCodeSVG value={qrData} size={260} level="H" includeMargin={true} />
          ) : (
            <div className="w-[260px] h-[260px] flex items-center justify-center text-slate-400">
              <RefreshCw size={32} className="animate-spin text-[#DA251D]" />
            </div>
          )}
        </div>

        {/* Countdown timer */}
        <div className="mt-5 flex flex-col items-center">
          <p className="text-xs text-slate-500 font-medium">Mã QR sẽ tự động đổi mới sau:</p>
          <div className="text-2xl font-black font-mono text-[#DA251D] mt-0.5 tracking-wider">
            {countdown}s
          </div>
        </div>
      </div>

      {/* Bottom Live Feed Nhân viên vừa chấm công */}
      <div className="w-full max-w-4xl bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Clock size={16} className="text-emerald-400" />
          <span>Vừa chấm công hôm nay ({todayList.length}):</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto py-1">
          {todayList.length === 0 ? (
            <span className="text-xs text-slate-400 italic">Chưa có ai chấm công hôm nay</span>
          ) : (
            todayList.slice(0, 5).map((item, idx) => (
              <div
                key={idx}
                className="bg-white/15 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border border-white/10 shrink-0"
              >
                <CheckCircle size={14} className={item.action === 'CHECK-IN' ? 'text-emerald-400' : 'text-amber-400'} />
                <span className="font-bold">{item.employeeName}</span>
                <span className="text-[10px] opacity-75 font-mono">({item.time})</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

