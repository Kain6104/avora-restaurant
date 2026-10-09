'use client';

import React from 'react';
import { Sparkles, Trophy, Star, Check } from 'lucide-react';

interface MutationRevealModalProps {
  data: {
    cropName: string;
    mutation: any;
    yield: number;
  };
  onClose: () => void;
}

export default function MutationRevealModal({ data, onClose }: MutationRevealModalProps) {
  const { cropName, mutation, yield: yieldCount } = data;
  if (!mutation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl p-6 text-center text-white bg-gradient-to-b from-purple-950 via-slate-900 to-black border-2 border-purple-400/60 shadow-[0_0_50px_rgba(168,85,247,0.4)] flex flex-col items-center">
        {/* Vòng hào quang phát sáng xoay nhẹ */}
        <div className="absolute -top-12 w-28 h-28 rounded-full bg-purple-500/30 blur-2xl animate-pulse" />

        {/* Icon & Huy hiệu */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-pink-500 p-0.5 shadow-2xl mb-4 relative animate-bounce">
          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-4xl">
            ✨
          </div>
          <span className="absolute -bottom-2 px-2 py-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[10px] font-black rounded-full uppercase tracking-wider shadow-md">
            {mutation.rarity || 'LEGENDARY'}
          </span>
        </div>

        <span className="text-xs font-black tracking-widest uppercase text-purple-300">
          ★ ĐỘT BIẾN SINH HỌC THÀNH CÔNG ★
        </span>

        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-200 to-amber-200 mt-1 mb-2">
          {mutation.name}
        </h2>

        <p className="text-xs text-purple-200/80 mb-5 leading-relaxed max-w-xs">
          {mutation.description || `Biến thể đột biến quý hiếm của ${cropName}!`}
        </p>

        {/* Bảng phần thưởng nhận được */}
        <div className="w-full bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 grid grid-cols-3 gap-2 mb-6">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-purple-200">Sản lượng</span>
            <span className="text-base font-black text-white">x{yieldCount}</span>
          </div>
          <div className="flex flex-col items-center border-x border-white/15">
            <span className="text-[10px] text-purple-200">Kinh nghiệm</span>
            <span className="text-base font-black text-emerald-300">+{mutation.rewardExp}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-purple-200">Farm Coin</span>
            <span className="text-base font-black text-amber-300">+{mutation.rewardFarmCoin}</span>
          </div>
        </div>

        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 hover:brightness-110 text-white font-extrabold text-sm rounded-2xl shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Thu Nhận Vào Bộ Sưu Tập</span>
        </button>
      </div>
    </div>
  );
}
