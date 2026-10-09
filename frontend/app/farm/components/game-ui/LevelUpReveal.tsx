'use client';

import React, { useEffect, useState } from 'react';
import { farmEventBus } from '../../game/services/farmEventBus';
import { farmSound } from '../../game/services/FarmSoundManager';
import { Sparkles, Trophy, ArrowRight, Crown } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';

interface LevelRewardItem {
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
}

const LEVEL_REWARDS_MAP: Record<number, LevelRewardItem[]> = {
  2: [
    {
      icon: '🥕',
      badge: 'HẠT GIỐNG MỚI',
      badgeColor: 'from-amber-500 to-orange-500',
      title: 'Cà Rốt Hoàng Kim',
      description: 'Mở khóa tại Cửa Hàng nông trại',
    },
    {
      icon: '⚡',
      badge: 'NĂNG LƯỢNG',
      badgeColor: 'from-sky-500 to-blue-600',
      title: 'Năng Lượng Tối Đa +2⚡',
      description: 'Giới hạn tích lũy năng lượng mở rộng',
    },
  ],
  3: [
    {
      icon: '🍅',
      badge: 'HẠT GIỐNG MỚI',
      badgeColor: 'from-rose-500 to-red-600',
      title: 'Cà Chua Bi Tiên Cảnh',
      description: 'Mở khóa tại Cửa Hàng nông trại',
    },
    {
      icon: '🧪',
      badge: 'VẬT PHẨM',
      badgeColor: 'from-emerald-500 to-teal-600',
      title: 'Phân Bón Hữu Cơ',
      description: 'Rút ngắn 15% thời gian phát triển',
    },
  ],
  4: [
    {
      icon: '🌽',
      badge: 'HẠT GIỐNG MỚI',
      badgeColor: 'from-amber-400 to-yellow-500',
      title: 'Bắp Ngọt Thần Nông',
      description: 'Mở khóa tại Cửa Hàng nông trại',
    },
    {
      icon: '🏞️',
      badge: 'KHU VỰC MỚI',
      badgeColor: 'from-emerald-600 to-green-700',
      title: 'Khai Hoang Ô Đất #7',
      description: 'Mở rộng diện tích canh tác đảo',
    },
  ],
  5: [
    {
      icon: '🍓',
      badge: 'HẠT GIỐNG HIẾM',
      badgeColor: 'from-rose-600 to-pink-600',
      title: 'Dâu Tây Tuyết Sơn',
      description: 'Thảo mộc thanh mát vùng núi tuyết',
    },
    {
      icon: '🧬',
      badge: 'TÍNH NĂNG MỚI',
      badgeColor: 'from-purple-600 to-indigo-600',
      title: 'Đột Biến Thần Kỳ',
      description: 'Kích hoạt lai tạo nông sản biến dị',
    },
  ],
  6: [
    {
      icon: '🍇',
      badge: 'HẠT GIỐNG HIẾM',
      badgeColor: 'from-purple-500 to-violet-600',
      title: 'Nho Đen Ngàn Năm',
      description: 'Mở khóa tại Cửa Hàng nông trại',
    },
    {
      icon: <AvoraCoinIcon size="md" className="w-6 h-6" />,
      badge: 'ĐẶC QUYỀN',
      badgeColor: 'from-amber-500 to-yellow-600',
      title: 'Giá Bán Nông Sản +5%',
      description: 'Tăng thu nhập Xu khi xuất khẩu',
    },
  ],
  7: [
    {
      icon: '🍈',
      badge: 'THƯỢNG PHẨM',
      badgeColor: 'from-lime-500 to-emerald-600',
      title: 'Dưa Lưới Hoàng Gia',
      description: 'Nông sản thượng phẩm thơm ngọt đậm đà',
    },
    {
      icon: '🏞️',
      badge: 'KHU VỰC MỚI',
      badgeColor: 'from-emerald-600 to-green-700',
      title: 'Khai Hoang Ô Đất #8',
      description: 'Mở rộng thêm diện tích trồng trọt',
    },
  ],
  8: [
    {
      icon: '🍵',
      badge: 'HẠT GIỐNG CAO CẤP',
      badgeColor: 'from-emerald-600 to-teal-700',
      title: 'Trà Xanh Cổ Thụ',
      description: 'Mở khóa tại Cửa Hàng nông trại',
    },
    {
      icon: '🧪',
      badge: 'VẬT PHẨM MỚI',
      badgeColor: 'from-purple-600 to-violet-700',
      title: 'Phân Bón Sinh Học VIP',
      description: 'Rút ngắn 25% chu kỳ thu hoạch',
    },
  ],
  9: [
    {
      icon: '🪴',
      badge: 'BẢO VẬT',
      badgeColor: 'from-teal-500 to-cyan-600',
      title: 'Sen Đá Thần Kỳ',
      description: 'Tích tụ linh khí thần tiên',
    },
    {
      icon: '⚡',
      badge: 'NĂNG LƯỢNG',
      badgeColor: 'from-sky-500 to-blue-600',
      title: 'Năng Lượng Tối Đa +5⚡',
      description: 'Tối ưu hiệu suất chăm sóc khu vườn',
    },
  ],
  10: [
    {
      icon: '👑',
      badge: 'DANH HIỆU THẦN THOẠI',
      badgeColor: 'from-amber-500 via-rose-500 to-yellow-500',
      title: 'Thần Nông AVORA',
      description: 'Danh hiệu tối cao của vùng đất',
    },
    {
      icon: '🌸',
      badge: 'CÂY THẦN',
      badgeColor: 'from-rose-500 to-pink-600',
      title: 'Cây Thần Cực Phẩm',
      description: 'Nhận thêm phong bao Lì Xì Dạ Quang',
    },
  ],
};

function getRewardsForLevel(lvl: number): LevelRewardItem[] {
  if (LEVEL_REWARDS_MAP[lvl]) {
    return LEVEL_REWARDS_MAP[lvl];
  }
  return [
    {
      icon: '🌱',
      badge: 'QUYỀN LỢI MỚI',
      badgeColor: 'from-emerald-600 to-teal-600',
      title: `Đặc Quyền Thăng Cấp Lv.${lvl}`,
      description: 'Mở rộng hiệu suất canh tác và quyền lợi mới',
    },
    {
      icon: '⚡',
      badge: 'NĂNG LƯỢNG',
      badgeColor: 'from-sky-500 to-blue-600',
      title: 'Mở Rộng Năng Lượng Tối Đa',
      description: 'Tăng cường sức chứa năng lượng của trang trại',
    },
  ];
}

export default function LevelUpReveal() {
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number } | null>(null);

  useEffect(() => {
    const unsub = farmEventBus.on('FARM_LEVEL_UP', (data: { newLevel: number }) => {
      setLevelUpData(data);
      farmSound.playLevelUp();
    });

    return () => unsub();
  }, []);

  if (!levelUpData) return null;

  const currentLevel = levelUpData.newLevel;
  const rewards = getRewardsForLevel(currentLevel);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-[6px] select-none animate-in fade-in duration-300"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Subtle Floating Golden Micro-Particles (Không dùng confetti dày đặc) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <span className="absolute top-[30%] left-[25%] text-amber-300 text-xs animate-floatParticle1">✦</span>
        <span className="absolute top-[28%] right-[22%] text-amber-200 text-sm animate-floatParticle2">★</span>
        <span className="absolute top-[45%] left-[18%] text-yellow-300 text-[10px] animate-floatParticle3">✦</span>
        <span className="absolute top-[42%] right-[16%] text-amber-300 text-xs animate-floatParticle1">✧</span>
        <span className="absolute bottom-[35%] left-[28%] text-amber-200 text-xs animate-floatParticle2">✦</span>
        <span className="absolute bottom-[32%] right-[26%] text-yellow-200 text-[11px] animate-floatParticle3">★</span>
      </div>

      {/* 2. Main Modal Card (Royal Ivory Glass AAA Style) */}
      <div className="relative w-[90vw] max-w-[345px] sm:max-w-[375px] rounded-[28px] bg-gradient-to-b from-[#fffefc]/98 via-[#fdfbf7]/96 to-[#f8f4ec]/98 backdrop-blur-2xl border border-[#d4af37]/45 shadow-[0_20px_50px_rgba(20,12,5,0.22),0_4px_12px_rgba(212,175,55,0.15),inset_0_1px_1px_rgba(255,255,255,1)] p-4 sm:p-5 pt-0 flex flex-col items-center text-center animate-levelUpScale ring-1 ring-amber-200/40">
        {/* Soft Focused Radial Glow (Tập trung nhỏ quanh Crest, không che background) */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(218,37,29,0.2)_0%,rgba(212,175,55,0.16)_40%,transparent_70%)] blur-xl pointer-events-none" />

        {/* Imperial Corner Ornaments */}
        <span className="absolute top-3 left-4 text-[9px] text-[#d4af37]/70 select-none">❖</span>
        <span className="absolute top-3 right-4 text-[9px] text-[#d4af37]/70 select-none">❖</span>
        <span className="absolute bottom-3 left-4 text-[9px] text-[#d4af37]/70 select-none">❖</span>
        <span className="absolute bottom-3 right-4 text-[9px] text-[#d4af37]/70 select-none">❖</span>

        {/* 3. Top Premium Level Badge Crest (Tone Đỏ AVORA #DA251D + Viền Gold Champagne) */}
        <div className="relative -mt-11 sm:-mt-13 w-20 h-20 sm:w-22 sm:h-22 rounded-3xl p-1 bg-gradient-to-br from-[#d32f2f] via-[#DA251D] to-[#801313] shadow-[0_10px_24px_rgba(218,37,29,0.38),0_2px_8px_rgba(212,175,55,0.35)] flex items-center justify-center border-2 border-amber-300/80 shrink-0">
          {/* Inner Royal Dark Core */}
          <div className="w-full h-full rounded-[22px] bg-gradient-to-b from-[#2a130f] via-[#1a0c09] to-[#120705] border border-amber-400/50 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
            <Crown className="w-8 h-8 text-amber-300 drop-shadow-[0_2px_4px_rgba(212,175,55,0.5)] animate-pulse" />
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-amber-400/10 to-transparent pointer-events-none" />
          </div>

          {/* Micro Sparkle Tag */}
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center border-1.5 border-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-950" />
          </div>
        </div>

        {/* 4. Celebration Titles */}
        <div className="mt-2.5 space-y-0.5">
          <span className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-[0.22em] text-[#8d6e63]">
            CHÚC MỪNG THĂNG CẤP
          </span>

          <h2 className="text-base sm:text-lg font-black font-serif text-[#3e2723] tracking-tight flex items-baseline justify-center gap-1.5">
            <span>CẤP ĐỘ NÔNG TRẠI</span>
            <span className="text-2xl sm:text-3xl font-black font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 drop-shadow-[0_1px_3px_rgba(212,175,55,0.4)]">
              {currentLevel}
            </span>
          </h2>
        </div>

        {/* 5. Khu vực “ĐÃ MỞ KHÓA” (Reward Chips) */}
        <div className="w-full mt-3 space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-[9.5px] font-extrabold uppercase tracking-wider text-[#795548]">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            <span>QUYỀN LỢI ĐÃ MỞ KHÓA</span>
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
          </div>

          <div className="grid grid-cols-1 gap-1.5 w-full">
            {rewards.map((r, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-2.5 py-1.5 sm:py-2 rounded-2xl bg-[#fffdfa]/95 border border-amber-200/70 shadow-[0_2px_6px_rgba(90,60,20,0.06)] text-left"
              >
                {/* Reward Icon Box */}
                <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-300/60 flex items-center justify-center text-base sm:text-lg shrink-0 shadow-2xs">
                  {r.icon}
                </div>

                {/* Reward Info */}
                <div className="flex-1 min-w-0 leading-tight">
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded-full bg-gradient-to-r ${r.badgeColor} text-white font-black text-[7px] uppercase tracking-wider shadow-2xs`}
                  >
                    {r.badge}
                  </span>
                  <p className="text-xs font-bold text-[#3e2723] truncate mt-0.5">{r.title}</p>
                  <p className="text-[9.5px] text-stone-500 truncate">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. CTA Button (Đỏ AVORA #DA251D Sang Trọng & Gọn Gàng) */}
        <button
          onClick={() => setLevelUpData(null)}
          className="mt-3.5 sm:mt-4 w-full h-10 sm:h-11 rounded-2xl bg-gradient-to-r from-[#DA251D] via-[#e53935] to-[#b71c1c] hover:brightness-105 active:scale-[0.98] text-white font-bold text-xs sm:text-sm tracking-wide shadow-[0_4px_16px_rgba(218,37,29,0.35)] border border-amber-300/60 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>TIẾP TỤC CHĂM SÓC</span>
          <ArrowRight className="w-4 h-4 text-amber-200" />
        </button>
      </div>

      {/* Embedded CSS Animations */}
      <style jsx global>{`
        @keyframes levelUpScaleAnim {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-levelUpScale {
          animation: levelUpScaleAnim 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes floatParticleAnim1 {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.6);
          }
          50% {
            opacity: 0.9;
            transform: translateY(-20px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-40px) scale(0.6);
          }
        }
        @keyframes floatParticleAnim2 {
          0% {
            opacity: 0;
            transform: translateY(15px) scale(0.5);
          }
          50% {
            opacity: 0.8;
            transform: translateY(-15px) scale(0.9);
          }
          100% {
            opacity: 0;
            transform: translateY(-35px) scale(0.5);
          }
        }
        @keyframes floatParticleAnim3 {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.7);
          }
          50% {
            opacity: 0.95;
            transform: translateY(-25px) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translateY(-45px) scale(0.7);
          }
        }
        .animate-floatParticle1 {
          animation: floatParticleAnim1 2.8s ease-in-out infinite;
        }
        .animate-floatParticle2 {
          animation: floatParticleAnim2 3.4s ease-in-out 0.8s infinite;
        }
        .animate-floatParticle3 {
          animation: floatParticleAnim3 2.5s ease-in-out 0.4s infinite;
        }
      `}</style>
    </div>
  );
}
