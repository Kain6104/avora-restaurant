'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Package,
  Clock,
  CheckCircle2,
  ListFilter,
  Flame,
} from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';
import { getSecondsUntilVietnamMidnight, formatCountdown } from '../../game/utils/farmTime';

interface MissionsModalProps {
  missions: any[];
  summary?: {
    unclaimedCount?: number;
    dailyCompletedCount?: number;
    dailyTotalCount?: number;
    achievementCompletedCount?: number;
    achievementTotalCount?: number;
    secondsUntilReset?: number;
    vietnamDateKey?: string;
    nextResetAt?: string;
  };
  onClose: () => void;
  onClaimReward: (missionCodeOrId: string) => Promise<void> | void;
  onClaimAllRewards?: () => Promise<void> | void;
  onRefreshMissions?: () => Promise<void> | void;
}

const CHAPTERS = [
  { id: 1, title: 'Chương 1', subtitle: 'Khởi đầu nông trang' },
  { id: 2, title: 'Chương 2', subtitle: 'Kinh doanh trong trồng trọt' },
  { id: 3, title: 'Chương 3', subtitle: 'Bậc thầy thực vật & Biến dị' },
  { id: 4, title: 'Chương 4', subtitle: 'Tinh hoa ẩm thực hoàng gia' },
];

type SubFilterType = 'ALL' | 'IN_PROGRESS' | 'CLAIMABLE' | 'COMPLETED';

export default function MissionsModal({
  missions,
  summary,
  onClose,
  onClaimReward,
  onClaimAllRewards,
  onRefreshMissions,
}: MissionsModalProps) {
  const [activeTab, setActiveTab] = useState<'MAIN' | 'DAILY'>('DAILY');
  const [currentChapter, setCurrentChapter] = useState(1);
  const [subFilter, setSubFilter] = useState<SubFilterType>('ALL');
  const [claimingCode, setClaimingCode] = useState<string | null>(null);
  const [isClaimingAll, setIsClaimingAll] = useState(false);

  // Countdown timer tới 00:00 Việt Nam
  const [secondsUntilReset, setSecondsUntilReset] = useState<number>(() => {
    return summary?.secondsUntilReset ?? getSecondsUntilVietnamMidnight();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilReset((prev) => {
        if (prev <= 1) {
          // Đến 00:00:00 Việt Nam -> Kích hoạt tự động làm mới nhiệm vụ ngày
          if (onRefreshMissions) {
            onRefreshMissions();
          }
          return getSecondsUntilVietnamMidnight();
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onRefreshMissions]);

  const mainMissions = missions.filter((m) => m.type === 'ACHIEVEMENT');
  const dailyMissions = missions.filter((m) => m.type === 'DAILY');

  // Đếm số nhiệm vụ có thể nhận thưởng
  const claimableMainCount = mainMissions.filter((m) => m.isCompleted && !m.isClaimed).length;
  const claimableDailyCount = dailyMissions.filter((m) => m.isCompleted && !m.isClaimed).length;

  // Filter main missions by chapter
  const displayedMainMissions = mainMissions.filter((m) => (m.chapter || 1) === currentChapter);
  const rawList = activeTab === 'MAIN' ? displayedMainMissions : dailyMissions;

  // Apply sub-filter
  const filteredList = rawList.filter((m) => {
    if (subFilter === 'IN_PROGRESS') return !m.isCompleted;
    if (subFilter === 'CLAIMABLE') return m.isCompleted && !m.isClaimed;
    if (subFilter === 'COMPLETED') return m.isClaimed;
    return true; // 'ALL'
  });

  // Toàn bộ nhiệm vụ có thể nhận trong tab hiện tại
  const claimableInTab = rawList.filter((m) => m.isCompleted && !m.isClaimed);

  const handleClaim = async (missionCodeOrId: string) => {
    if (claimingCode || isClaimingAll) return;
    setClaimingCode(missionCodeOrId);
    farmSound.playReward();
    try {
      await onClaimReward(missionCodeOrId);
    } finally {
      setClaimingCode(null);
    }
  };

  const handleClaimAll = async () => {
    if (claimableInTab.length === 0 || isClaimingAll) return;
    setIsClaimingAll(true);
    farmSound.playUnlock();
    try {
      if (onClaimAllRewards) {
        await onClaimAllRewards();
      } else {
        for (const m of claimableInTab) {
          await onClaimReward(m.code || m.id);
        }
      }
    } finally {
      setIsClaimingAll(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex flex-col w-full h-full min-h-[100dvh] max-h-[100dvh] bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Header */}
      <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#422006] via-[#784814] to-[#422006] text-white flex items-center justify-between border-b border-[#e0a93b]/60 shrink-0 shadow-md gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            ← Trở về
          </button>
          <span className="text-amber-400 text-xs hidden sm:inline">✦</span>
          <h3 className="font-serif font-black text-xs sm:text-sm text-[#fff8e7] tracking-wider truncate">
            DANH SÁCH NHIỆM VỤ
          </h3>
          <span className="text-amber-400 text-xs hidden sm:inline">✦</span>
        </div>

        {/* Countdown timer hiển thị chuẩn giờ Việt Nam (UTC+07:00) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-black/30 border border-amber-400/40 text-[9.5px] sm:text-[11px] font-mono font-bold text-amber-200">
            <Clock className="w-3 h-3 text-amber-300 animate-pulse" />
            <span>Làm mới: {formatCountdown(secondsUntilReset)}</span>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/25 hover:bg-black/50 flex items-center justify-center text-white/90 cursor-pointer transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

        {/* Layout: Sidebar Tabs + Content Area */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Sidebar Tabs */}
          <div className="w-full sm:w-44 bg-[#f8f1e5] border-b sm:border-b-0 sm:border-r border-[#e5dcd0] p-1.5 sm:p-3 flex sm:flex-col gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => {
                farmSound.playTap();
                setActiveTab('DAILY');
              }}
              className={`flex-1 sm:flex-initial py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl font-serif text-xs font-black text-left transition-all cursor-pointer flex items-center justify-between ${
                activeTab === 'DAILY'
                  ? 'bg-gradient-to-r from-[#c62828] to-[#b71c1c] text-white shadow-sm border border-red-400'
                  : 'bg-white/80 text-[#5a3e1b] hover:bg-white border border-[#e2d5c0]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-300" />
                <span>Hàng ngày</span>
              </div>
              {claimableDailyCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-[#422006] text-[10px] font-black animate-bounce shadow-xs">
                  {claimableDailyCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                farmSound.playTap();
                setActiveTab('MAIN');
              }}
              className={`flex-1 sm:flex-initial py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl sm:rounded-2xl font-serif text-xs font-black text-left transition-all cursor-pointer flex items-center justify-between ${
                activeTab === 'MAIN'
                  ? 'bg-gradient-to-r from-[#c62828] to-[#b71c1c] text-white shadow-sm border border-red-400'
                  : 'bg-white/80 text-[#5a3e1b] hover:bg-white border border-[#e2d5c0]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Nhiệm vụ chính</span>
              </div>
              {claimableMainCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-[#422006] text-[10px] font-black animate-bounce shadow-xs">
                  {claimableMainCount}
                </span>
              )}
            </button>
          </div>

          {/* Right Main Content */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#faf6ef]">
            {/* Chapter Navigator Banner (If in Main Quest) */}
            {activeTab === 'MAIN' && (
              <div className="bg-[#f0e6d5] border-b border-[#e5dcd0] px-4 py-2 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    farmSound.playTap();
                    setCurrentChapter((prev) => Math.max(1, prev - 1));
                  }}
                  disabled={currentChapter <= 1}
                  className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                    currentChapter > 1
                      ? 'bg-white border-[#d4af37] text-[#5a3e1b] hover:bg-amber-50 cursor-pointer shadow-xs'
                      : 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-center">
                  <div className="font-serif font-black text-xs text-[#c62828] tracking-wider uppercase">
                    {CHAPTERS[currentChapter - 1]?.title}
                  </div>
                  <div className="text-[11px] font-bold text-[#5a3e1b]">
                    {CHAPTERS[currentChapter - 1]?.subtitle}
                  </div>
                </div>

                <button
                  onClick={() => {
                    farmSound.playTap();
                    setCurrentChapter((prev) => Math.min(CHAPTERS.length, prev + 1));
                  }}
                  disabled={currentChapter >= CHAPTERS.length}
                  className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                    currentChapter < CHAPTERS.length
                      ? 'bg-white border-[#d4af37] text-[#5a3e1b] hover:bg-amber-50 cursor-pointer shadow-xs'
                      : 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sub-filters bar */}
            <div className="px-3 py-2 bg-[#f4ecdf] border-b border-[#e5dcd0] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
              <span className="text-[10px] text-stone-500 font-bold flex items-center gap-1 shrink-0">
                <ListFilter className="w-3 h-3" /> Lọc:
              </span>
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'IN_PROGRESS', label: 'Đang làm' },
                {
                  id: 'CLAIMABLE',
                  label: `Có thể nhận (${claimableInTab.length})`,
                  highlight: claimableInTab.length > 0,
                },
                { id: 'COMPLETED', label: 'Đã nhận' },
              ].map((filter) => {
                const isSelected = subFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      farmSound.playTap();
                      setSubFilter(filter.id as SubFilterType);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'bg-[#c62828] text-white shadow-xs'
                        : filter.highlight
                        ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black animate-pulse'
                        : 'bg-white/80 text-stone-600 hover:bg-white border border-stone-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {/* Missions List */}
            <div className="p-2.5 sm:p-4 overflow-y-auto min-h-0 flex-1 space-y-2 sm:space-y-3">
              {filteredList.length === 0 ? (
                <div className="text-center py-12 text-stone-400 flex flex-col items-center">
                  <CheckCircle2 className="w-10 h-10 mb-2 text-stone-300" />
                  <p className="text-xs font-bold text-stone-600">
                    Không có nhiệm vụ nào trong danh mục này
                  </p>
                </div>
              ) : (
                filteredList.map((m) => {
                  const isClaiming = claimingCode === (m.code || m.id);
                  const canClaim = m.isCompleted && !m.isClaimed;

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 transition-all shadow-xs ${
                        m.isClaimed
                          ? 'bg-[#f4efe6]/60 border-gray-200 opacity-60'
                          : canClaim
                          ? 'bg-gradient-to-r from-amber-50 via-white to-emerald-50/70 border-amber-400 ring-1 ring-amber-300/60'
                          : 'bg-white border-[#e5dcd0]'
                      }`}
                    >
                      {/* Mission Details */}
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-[#422006] truncate">
                            {m.title} ({m.currentCount}/{m.targetCount})
                          </h4>
                          {canClaim && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black border border-emerald-300 shrink-0 animate-pulse">
                              Chờ nhận
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">{m.description}</p>

                        {/* Rewards row */}
                        <div className="flex items-center flex-wrap gap-1.5 mt-2">
                          {m.rewardItemCode && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800">
                              <Package className="w-3 h-3 text-amber-600" />
                              <span>{m.rewardItemName || 'Gói ngẫu nhiên'}</span>
                            </div>
                          )}
                          {m.rewardExp > 0 && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[10px] font-bold text-sky-800 font-mono">
                              <span>+{m.rewardExp} EXP</span>
                            </div>
                          )}
                          {m.rewardFarmCoin > 0 && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-800 font-mono">
                              <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                              <span>+{m.rewardFarmCoin} Xu</span>
                            </div>
                          )}
                          {/* Lucky envelope ticket indicator */}
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-800 font-mono">
                            <span>🧧 +1 Lì xì</span>
                          </div>
                        </div>
                      </div>

                      {/* Right action button */}
                      <div className="shrink-0">
                        {m.isClaimed ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </div>
                        ) : canClaim ? (
                          <button
                            onClick={() => handleClaim(m.code || m.id)}
                            disabled={isClaiming || isClaimingAll}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-[#d4af37] hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md animate-pulse"
                          >
                            {isClaiming ? 'Đang nhận...' : 'Nhận'}
                          </button>
                        ) : (
                          <div className="px-3 py-1 rounded-xl bg-gray-100 text-gray-400 text-[11px] font-bold border border-gray-200">
                            {Math.round((m.currentCount / m.targetCount) * 100)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer with Big Claim Button */}
            <div className="p-3.5 bg-[#f5ecdd] border-t border-[#e2d5c0] flex items-center justify-between shrink-0">
              <span className="text-xs text-[#5a3e1b] font-medium">
                {claimableInTab.length > 0
                  ? `Có ${claimableInTab.length} phần thưởng sẵn sàng nhận!`
                  : 'Hoàn thành các mục tiêu để thăng cấp nông trại'}
              </span>

              <button
                onClick={handleClaimAll}
                disabled={claimableInTab.length === 0 || isClaimingAll}
                className={`px-6 sm:px-8 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                  claimableInTab.length > 0 && !isClaimingAll
                    ? 'bg-gradient-to-r from-[#c62828] to-[#b71c1c] text-white hover:from-red-700 hover:to-red-800 active:scale-95 ring-2 ring-amber-300 animate-pulse'
                    : 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed shadow-none'
                }`}
              >
                {isClaimingAll ? 'Đang nhận tất cả...' : 'Nhận Tất Cả'}
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}
