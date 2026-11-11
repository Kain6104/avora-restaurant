'use client';

import React from 'react';
import AttendanceModal from '../attendance/AttendanceModal';
import { useWaiterStore } from '@/store/useWaiterStore';
import { Clock, Camera, Calendar, ShieldCheck, MapPin } from 'lucide-react';

export default function AttendanceView() {
  const { setAttendanceModalOpen, currentBranch, currentUser } = useWaiterStore();

  return (
    <div className="w-full h-full p-4 flex flex-col items-center justify-center bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center">
        <div className="w-20 h-20 bg-red-50 text-[#DA251D] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
          <Clock size={40} />
        </div>

        <h2 className="text-xl font-black text-slate-900 tracking-tight">Hệ Thống Chấm Công AVORA</h2>
        <p className="text-xs text-slate-500 mt-1">
          Ghi nhận ca làm việc, giờ công, định vị GPS và chống gian lận
        </p>

        <div className="my-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-2 text-left">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Nhân viên:</span>
            <span className="font-bold text-slate-800">{currentUser?.fullName || 'Chưa đăng nhập'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Chi nhánh:</span>
            <span className="font-bold text-slate-800 flex items-center gap-1">
              <MapPin size={12} className="text-[#DA251D]" />
              {currentBranch?.name || 'Mặc định'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Bảo mật thiết bị:</span>
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <ShieldCheck size={13} />
              Đã kích hoạt
            </span>
          </div>
        </div>

        <button
          onClick={() => setAttendanceModalOpen(true)}
          className="w-full py-3.5 bg-gradient-to-r from-[#FF3B30] to-[#DA251D] hover:opacity-95 active:scale-95 text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#DA251D]/30 flex items-center justify-center gap-2 transition-all"
        >
          <Camera size={20} />
          <span>Mở Bảng Chấm Công & Quét QR</span>
        </button>
      </div>

      <AttendanceModal />
    </div>
  );
}

