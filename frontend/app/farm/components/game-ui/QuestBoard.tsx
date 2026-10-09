'use client';

import React, { useState } from 'react';
import { X, Target, CheckCircle2, Award, Sparkles, Star, Calendar, Flame } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';
import { farmEventBus } from '../../game/services/farmEventBus';

interface QuestBoardProps {
  missions: any[];
  onClose: () => void;
  onClaimReward: (missionCodeOrId: string) => Promise<void> | void;
}

export default function QuestBoard({ missions, onClose, onClaimReward }: QuestBoardProps) {
  const [activeTab, setActiveTab] = useState<'DAILY' | 'ACHIEVEMENT'>('DAILY');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const filteredMissions = missions.filter((m) => {
    if (activeTab === 'DAILY') return m.type === 'DAILY';
    return m.type === 'ACHIEVEMENT';
  });

  const handleClaim = async (mission: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (mission.isClaimed || !mission.isCompleted || claimingId) return;

    setClaimingId(mission.id);
    farmSound.playUnlock();

    try {
      const target = mission.code || mission.id;
      await onClaimReward(target);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-[2px] animate-fadeIn"
      onPointerDown={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Wooden Quest Board Frame */}
      <div
        className="relative w-full max-w-xl max-h-[88vh] rounded-[28px] bg-gradient-to-b from-[#3a2012] via-[#2a160c] to-[#1f0f08] p-2.5 sm:p-3.5 shadow-[0_24px_70px_rgba(0,0,0,0.65)] border-4 border-[#8d5b2d] flex flex-col overflow-hidden text-[#3e2723]"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brass corner brackets */}
        <div className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-[#ffd54f]/70 pointer-events-none" />
        <div className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-[#ffd54f]/70 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-[#ffd54f]/70 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-[#ffd54f]/70 pointer-events-none" />

        {/* Board Header Banner */}
        <div className="relative px-4 py-3 bg-gradient-to-r from-[#4e2c16] via-[#6d3e20] to-[#4e2c16] rounded-2xl border-2 border-[#d4af37]/60 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd54f] to-[#ff8f00] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-[10px] bg-[#2c1810] flex items-center justify-center text-amber-300 font-black">
                <Target className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold font-serif text-base sm:text-lg text-[#fff8e1] tracking-wide">
                  AVORA QUEST BOARD
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#b71c1c] text-white text-[9px] font-black uppercase shadow-xs">
                  Bảng Treo Thưởng
                </span>
              </div>
              <p className="text-[11px] text-[#d7ccc8]">
                Hoàn thành nhiệm vụ nông trại nhận thưởng EXP, Xu và Điểm thành viên
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#2c1810]/90 hover:bg-[#4a2e18] text-[#fff8e1] border border-[#d4af37]/60 flex items-center justify-center transition cursor-pointer shadow-md shrink-0"
            title="Đóng Bảng Nhiệm Vụ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Tabs (Carved Wooden Plaques) */}
        <div className="flex gap-2 p-1.5 mt-2 bg-[#1f0f08]/80 rounded-xl border border-[#5d3b1f]">
          <button
            onClick={() => {
              farmSound.playTap();
              setActiveTab('DAILY');
            }}
            className={`flex-1 py-2 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'DAILY'
                ? 'bg-gradient-to-b from-[#ffd54f] to-[#ff8f00] text-[#2c1810] shadow-md border border-[#ffe082]'
                : 'text-[#d7ccc8] hover:bg-[#3e2212] hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Nhiệm Vụ Hằng Ngày</span>
          </button>

          <button
            onClick={() => {
              farmSound.playTap();
              setActiveTab('ACHIEVEMENT');
            }}
            className={`flex-1 py-2 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'ACHIEVEMENT'
                ? 'bg-gradient-to-b from-[#ffd54f] to-[#ff8f00] text-[#2c1810] shadow-md border border-[#ffe082]'
                : 'text-[#d7ccc8] hover:bg-[#3e2212] hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Thành Tựu Bất Hủ</span>
          </button>
        </div>

        {/* Pinned Parchment Scroll Content Container */}
        <div className="mt-2.5 p-3 flex-1 overflow-y-auto space-y-2.5 rounded-2xl bg-[#fffdf7] border-2 border-[#d4af37]/40 shadow-inner scrollbar-thin">
          {filteredMissions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#f5efe6] flex items-center justify-center border border-[#d4af37]/40 text-[#8d6e63] mb-2.5">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-[#4e342e]">Bạn đã hoàn thành tất cả nhiệm vụ!</p>
              <p className="text-xs text-[#8d6e63] mt-1">Hãy quay lại vào ngày mai để nhận thêm thử thách mới nhé.</p>
            </div>
          ) : (
            filteredMissions.map((m) => {
              const percent = Math.min(100, Math.round((m.currentCount / m.targetCount) * 100));
              const isClaiming = claimingId === m.id;

              return (
                <div
                  key={m.id}
                  className={`p-3 rounded-2xl border-2 transition-all shadow-xs ${
                    m.isClaimed
                      ? 'bg-[#f5efe6]/70 border-[#d8c8b0] opacity-65'
                      : m.isCompleted
                      ? 'bg-gradient-to-r from-[#fff9c4]/60 via-white to-[#e8f5e9]/60 border-[#ffd54f] shadow-amber-500/10'
                      : 'bg-[#faf6ed] border-[#e8dac1] hover:bg-white hover:border-[#d4af37]/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Mission Info & Progress */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-2 py-0.5 bg-[#ecdcc6] text-[#4e342e] font-black rounded-md uppercase tracking-wider">
                          {m.type === 'DAILY' ? 'HẰNG NGÀY' : 'THÀNH TỰU'}
                        </span>
                        <h4 className="font-extrabold text-[#3e2723] text-xs sm:text-sm truncate">
                          {m.title}
                        </h4>
                      </div>

                      <p className="text-[11px] text-[#6d4c41] mt-1 leading-snug">
                        {m.description}
                      </p>

                      {/* Progress Bar */}
                      <div className="w-full bg-[#e8dac1] h-2.5 rounded-full overflow-hidden mt-2.5 border border-[#c7b299]/40 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 h-full rounded-full transition-all duration-500 shadow-xs"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Progress Counter & Rewards */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-[#6d4c41] mt-1.5 gap-2">
                        <span>
                          Tiến độ: <strong className="text-[#3e2723]">{m.currentCount}/{m.targetCount}</strong>
                        </span>

                        <div className="flex items-center gap-2 font-black">
                          <span className="flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            +{m.rewardExp} EXP
                          </span>
                          <span className="flex items-center gap-1 text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                            +{m.rewardFarmCoin} Xu
                          </span>
                          {m.rewardLoyaltyPoints > 0 && (
                            <span className="flex items-center gap-1 text-rose-900 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              <Star className="w-3 h-3 text-rose-600" />
                              +{m.rewardLoyaltyPoints} Điểm
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Claim Button */}
                    <div className="shrink-0 self-center pl-2">
                      {m.isClaimed ? (
                        <span className="flex items-center gap-1 text-[#2e7d32] text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-100/70 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã nhận
                        </span>
                      ) : m.isCompleted ? (
                        <button
                          onClick={(e) => handleClaim(m, e)}
                          disabled={isClaiming}
                          className="relative px-4 py-2 bg-gradient-to-b from-[#ffca28] to-[#ff8f00] hover:from-[#ffd54f] hover:to-[#ffa000] text-[#2c1810] font-black text-xs rounded-xl shadow-md border border-[#ffe082] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 animate-pulse"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-900" />
                          <span>{isClaiming ? 'Đang nhận...' : 'Nhận Thưởng'}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-[#8d6e63] font-bold px-2 py-1">
                          {percent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
