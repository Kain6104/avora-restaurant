'use client';

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Lock,
  Trophy,
  Gift,
  Check,
  Crown,
  ArrowLeft,
  Store,
  Clock,
  Package,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import PlantSprite from '../common/PlantSprite';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';
import FarmPlantDetailCard from '../cards/FarmPlantDetailCard';

interface CollectionModalProps {
  collection: any;
  userLevel?: number;
  inventory?: any[];
  onClose: () => void;
  onRefresh?: () => void;
  onNavigateToShop?: (cropCode: string) => void;
}

export default function CollectionModal({
  collection,
  userLevel = 1,
  inventory = [],
  onClose,
  onRefresh,
  onNavigateToShop,
}: CollectionModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [claimingTier, setClaimingTier] = useState<number | null>(null);
  const [claimingCropId, setClaimingCropId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Detailed view state for selected specimen
  const [activeDetailItem, setActiveDetailItem] = useState<{
    type: 'BASE' | 'MUTATION';
    crop: any;
    mutation?: any;
  } | null>(null);

  // Normalize collection list
  const crops: any[] = Array.isArray(collection)
    ? collection
    : (collection?.items || []);

  const totalSpecimens = collection?.totalSpecimens ?? (() => {
    let count = 0;
    crops.forEach((c) => {
      count += 1;
      count += (c.mutations?.length || 0);
    });
    return count;
  })();

  const unlockedSpecimens = collection?.unlockedSpecimens ?? (() => {
    let count = 0;
    crops.forEach((c) => {
      if (c.isUnlocked) count += 1;
      c.mutations?.forEach((m: any) => {
        if (m.isUnlocked) count += 1;
      });
    });
    return count;
  })();

  const progressPercent = totalSpecimens > 0
    ? Math.round((unlockedSpecimens / totalSpecimens) * 100)
    : 0;

  const milestones = collection?.milestones || [
    {
      tier: 1,
      targetPercent: 20,
      title: 'Thợ Vườn Khởi Sự',
      rewardDescription: '150 Xu + 3 Hạt giống Bí Ẩn Phổ Thông',
      isReached: progressPercent >= 20,
      isClaimed: false,
    },
    {
      tier: 2,
      targetPercent: 40,
      title: 'Nông Dân Chăm Chỉ',
      rewardDescription: '350 Xu + 1 Bình Phân Bón Siêu Cấp',
      isReached: progressPercent >= 40,
      isClaimed: false,
    },
    {
      tier: 3,
      targetPercent: 60,
      title: 'Chuyên Gia Thần Nông',
      rewardDescription: '700 Xu + 3 Hạt giống Quý Hiếm',
      isReached: progressPercent >= 60,
      isClaimed: false,
    },
    {
      tier: 4,
      targetPercent: 80,
      title: 'Đại Sư Nông Nghiệp AVORA',
      rewardDescription: '1.200 Xu + 2 Túi Phân Thần Tốc',
      isReached: progressPercent >= 80,
      isClaimed: false,
    },
    {
      tier: 5,
      targetPercent: 100,
      title: 'Huyền Thoại Thần Nông Độc Bản',
      rewardDescription: 'VOUCHER GIẢM 500K ĐƠN TỪ 0đ (GIỚI HẠN 11 VOUCHER)',
      isReached: progressPercent >= 100,
      isClaimed: false,
      totalLimitedVouchers: 11,
      remainingVouchers: collection?.remainingTier5Vouchers ?? 11,
    },
  ];

  const remainingTier5Vouchers = collection?.remainingTier5Vouchers ?? 11;

  const filteredCrops = crops.filter((crop) => {
    if (selectedCategory === 'ALL') return true;
    return crop.category === selectedCategory;
  });

  // Claim Milestone
  const handleClaimMilestone = async (tier: number) => {
    if (claimingTier !== null) return;
    setClaimingTier(tier);
    farmSound.playCoin();
    try {
      const res = await fetch('/api/farm/collection/claim-milestone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAlertMessage({
          type: 'success',
          text: `🎉 Chúc mừng! Bạn đã nhận mốc ${tier}: ${json.data?.rewardText || 'Phần thưởng'}!`,
        });
        onRefresh?.();
      } else {
        setAlertMessage({
          type: 'error',
          text: json.message || 'Không thể nhận phần thưởng mốc này',
        });
      }
    } catch {
      setAlertMessage({ type: 'error', text: 'Lỗi kết nối khi nhận thưởng mốc tiến độ' });
    } finally {
      setClaimingTier(null);
    }
  };

  // Claim Crop Reward
  const handleClaimCropReward = async (cropId: string) => {
    if (claimingCropId !== null) return;
    setClaimingCropId(cropId);
    farmSound.playLevelUp();
    try {
      const res = await fetch('/api/farm/collection/claim-crop-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cropId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAlertMessage({
          type: 'success',
          text: `🎁 Nhận thành công Gói Hạt Bí Ẩn: +3x Hạt giống và +${json.data?.coinsEarned || 100} Xu!`,
        });
        onRefresh?.();
      } else {
        setAlertMessage({
          type: 'error',
          text: json.message || 'Không thể nhận gói hạt của loại cây này',
        });
      }
    } catch {
      setAlertMessage({ type: 'error', text: 'Lỗi kết nối khi nhận thưởng' });
    } finally {
      setClaimingCropId(null);
    }
  };

  // Open specimen detail
  const handleOpenSpecimen = (crop: any, mutation?: any) => {
    farmSound.playTap();
    setActiveDetailItem({
      type: mutation ? 'MUTATION' : 'BASE',
      crop,
      mutation,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col w-full h-full min-h-[100dvh] max-h-[100dvh] bg-[#fcf9f2] text-stone-900 select-none font-sans overflow-hidden animate-in fade-in duration-200"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Subtle Radiant Sunburst Decorative Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(244, 219, 150, 0.45) 0%, rgba(253, 246, 230, 0.2) 50%, rgba(245, 230, 205, 0.6) 100%)',
        }}
      />

      {/* 1. TOP GAME SCENE HEADER */}
      <header className="px-2.5 sm:px-5 py-1.5 sm:py-2.5 bg-gradient-to-b from-[#fffefc] to-[#f8efe0] border-b border-[#d4af37]/70 shadow-xs flex items-center justify-between shrink-0 relative z-10 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => {
              farmSound.playTap();
              if (activeDetailItem) {
                setActiveDetailItem(null);
              } else {
                onClose();
              }
            }}
            className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-amber-100/80 hover:bg-amber-200/90 text-[#78350f] border border-[#d4af37]/60 text-[11px] sm:text-xs font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="font-serif">{activeDetailItem ? 'Trở về Album' : 'Trở về Vườn'}</span>
          </button>

          <span className="text-[#d4af37]/60 hidden sm:inline">|</span>

          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 shadow-xs flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-xs sm:text-sm text-[#5c3a10] font-serif tracking-wide leading-tight truncate">
                BÁCH KHOA THẦN NÔNG AVORA
              </h2>
              <span className="text-[9.5px] sm:text-[10px] text-amber-800 font-medium truncate block">
                Đã mở khóa: {unlockedSpecimens}/{totalSpecimens} Mẫu vật ({progressPercent}%)
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            farmSound.playTap();
            onClose();
          }}
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white border border-[#fef08a] flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs shrink-0"
        >
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </header>

      {/* Alert toast if message exists */}
      {alertMessage && (
        <div
          className={`px-3 py-1.5 text-xs font-bold flex items-center justify-between border-b ${
            alertMessage.type === 'success'
              ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
              : 'bg-rose-900/60 border-rose-500 text-rose-200'
          }`}
        >
          <span className="truncate mr-2">{alertMessage.text}</span>
          <button onClick={() => setAlertMessage(null)} className="p-0.5 cursor-pointer shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. SPECIMEN DETAIL VIEW (IF AN ITEM IS CLICKED)            */}
      {/* ========================================================= */}
      {activeDetailItem ? (
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 bg-[#faf5eb] flex flex-col items-center justify-start w-full">
          <FarmPlantDetailCard
            cropCode={activeDetailItem.crop.code}
            mutationCode={activeDetailItem.type === 'MUTATION' ? activeDetailItem.mutation?.code : undefined}
            data={{
              cropId: activeDetailItem.crop.id || activeDetailItem.crop.cropId,
              cropCode: activeDetailItem.crop.code,
              cropName: activeDetailItem.crop.name,
              mutationId: activeDetailItem.mutation?.mutationId || activeDetailItem.mutation?.id,
              mutationCode: activeDetailItem.mutation?.code,
              mutationName: activeDetailItem.mutation?.name,
              isMutation: activeDetailItem.type === 'MUTATION',
              rarity: activeDetailItem.type === 'MUTATION' ? activeDetailItem.mutation?.rarity || 'RARE' : activeDetailItem.crop.rarity,
              description: (activeDetailItem.type === 'MUTATION' ? activeDetailItem.mutation?.description : activeDetailItem.crop.description) || '',
              growDurationSeconds: activeDetailItem.crop.growDurationSeconds,
              growDurationLabel: activeDetailItem.crop.growDurationLabel,
              effectiveSellPrice: activeDetailItem.type === 'MUTATION' ? activeDetailItem.mutation?.effectiveSellPrice : activeDetailItem.crop.effectiveSellPrice,
              harvestCount: activeDetailItem.type === 'MUTATION' ? activeDetailItem.mutation?.harvestCount : activeDetailItem.crop.harvestCount,
              inventoryQuantity: activeDetailItem.type === 'MUTATION' ? activeDetailItem.mutation?.inventoryQuantity : activeDetailItem.crop.inventoryQuantity,
              isUnlocked: activeDetailItem.type === 'MUTATION' ? Boolean(activeDetailItem.mutation?.isUnlocked) : Boolean(activeDetailItem.crop.isUnlocked),
              mutationChance: activeDetailItem.mutation?.mutationChance,
              unlockLevel: activeDetailItem.crop.minFarmLevel || 1,
            }}
            mode="ALBUM"
            userLevel={userLevel}
            onClose={() => setActiveDetailItem(null)}
            onNavigateToShop={onNavigateToShop}
          />
        </main>
      ) : (
        /* ========================================================= */
        /* 3. MAIN CATALOG OVERVIEW GRID                              */
        /* ========================================================= */
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#faf4e8]">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* 5-TIER MILESTONE PROGRESSION RIBBON */}
            <div className="bg-[#fffbf2] p-3 sm:p-4 rounded-3xl border border-[#e2cca4] shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-[#5c3a10]">
                  <Trophy className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>5 MỐC TIẾN ĐỘ THẦN NÔNG — QUÀ ĐẶC BIỆT</span>
                </div>
                <div className="text-xs font-mono font-bold text-[#78350f] bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Tiến độ: {progressPercent}%
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 text-center">
                {milestones.map((m: any) => {
                  const isTier5 = m.tier === 5;
                  const isClaimed = m.isClaimed;
                  const canClaim = m.isReached && !isClaimed;

                  return (
                    <div
                      key={m.tier}
                      className={`p-2 sm:p-2.5 rounded-2xl border flex flex-col items-center justify-between transition relative ${
                        isTier5
                          ? 'bg-gradient-to-b from-amber-100 to-amber-200/80 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                          : canClaim
                          ? 'bg-amber-50 border-amber-400 shadow-md'
                          : isClaimed
                          ? 'bg-emerald-50 border-emerald-400 opacity-90'
                          : 'bg-white/80 border-[#e5d4be]'
                      }`}
                    >
                      {isTier5 && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-red-600 to-amber-600 text-white text-[7.5px] sm:text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter whitespace-nowrap shadow-xs">
                          Cực Phẩm ({remainingTier5Vouchers}/11)
                        </div>
                      )}

                      <div className="w-full flex items-center justify-center gap-0.5 mb-1 mt-0.5">
                        {isTier5 ? (
                          <Crown className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
                        ) : (
                          <span className="text-[10px] font-black text-[#5c3a10]">Mốc {m.tier}</span>
                        )}
                        <span className="text-[10px] font-mono text-amber-700 font-bold">({m.targetPercent}%)</span>
                      </div>

                      <p className="text-[9px] sm:text-[10px] font-bold text-[#5c3a10] line-clamp-2 leading-tight mb-1.5">
                        {isTier5 ? 'Voucher 500K Đơn 0đ' : m.title}
                      </p>

                      {isClaimed ? (
                        <span className="w-full py-0.5 text-[8.5px] font-black text-emerald-300 bg-emerald-900/60 rounded border border-emerald-500/40 flex items-center justify-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Đã Nhận
                        </span>
                      ) : canClaim ? (
                        <button
                          disabled={claimingTier === m.tier}
                          onClick={() => handleClaimMilestone(m.tier)}
                          className="w-full py-1 text-[8.5px] font-black text-stone-900 bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 hover:from-amber-400 hover:to-yellow-500 rounded border border-amber-500 shadow-xs cursor-pointer animate-pulse transition active:scale-95"
                        >
                          {claimingTier === m.tier ? '...' : '🎁 Nhận'}
                        </button>
                      ) : (
                        <span className="w-full py-0.5 text-[8.5px] font-bold text-stone-500 bg-black/30 rounded flex items-center justify-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Chưa đạt
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              {[
                { id: 'ALL', label: 'Tất Cả Mẫu Vật' },
                { id: 'JAPANESE_INGREDIENT', label: 'Ẩm Thực Nhật' },
                { id: 'FRUIT', label: 'Trái Cây Thần' },
                { id: 'FANTASY_FOOD', label: 'Đặc Sản AVORA' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    farmSound.playTap();
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-[#e0a93b] to-[#c67d00] text-[#2c1810] font-black border-[#ffd54f] shadow-md'
                      : 'bg-[#25170a] text-[#f5e5c9] border-[#4d3215] hover:bg-[#382312]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Crops Grid */}
            <div className="space-y-3 sm:space-y-4">
              {filteredCrops.map((crop) => {
                const mutations = crop.mutations || [];
                const unlockedMutationsCount = mutations.filter((m: any) => m.isUnlocked).length;
                const isFullyCompleted =
                  crop.isUnlocked && mutations.length > 0 && unlockedMutationsCount === mutations.length;
                const isMasteryClaimed = Boolean(crop.isMasteryClaimed);

                return (
                  <div
                    key={crop.cropId || crop.id}
                    className="bg-[#fffbf2] p-3 sm:p-4 rounded-3xl border border-[#e2cca4] shadow-xs"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-[#ebdcc4]">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-[#5c3a10]">
                          {crop.name}
                        </span>
                        <span className="text-[9px] px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full uppercase border border-amber-300">
                          {crop.rarity}
                        </span>
                      </div>

                      {/* Mastery Gift Action */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-xs text-stone-400 font-medium">
                          Đột biến: {unlockedMutationsCount}/{mutations.length}
                        </span>

                        {isFullyCompleted ? (
                          isMasteryClaimed ? (
                            <span className="text-[9px] sm:text-[10px] font-black text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Đã nhận Gói Hạt
                            </span>
                          ) : (
                            <button
                              disabled={claimingCropId === (crop.cropId || crop.id)}
                              onClick={() => handleClaimCropReward(crop.cropId || crop.id)}
                              className="text-[9px] sm:text-[10px] font-black text-stone-900 bg-gradient-to-r from-amber-300 to-yellow-400 hover:from-amber-400 hover:to-yellow-500 px-2.5 py-1 rounded-full border border-amber-500 shadow-xs cursor-pointer flex items-center gap-1 animate-pulse"
                            >
                              <Gift className="w-3 h-3" />
                              <span>
                                {claimingCropId === (crop.cropId || crop.id)
                                  ? 'Đang nhận...'
                                  : 'Nhận Gói Hạt Bí Ẩn'}
                              </span>
                            </button>
                          )
                        ) : (
                          <span className="text-[9px] font-semibold text-stone-500 bg-black/30 px-2 py-0.5 rounded-full">
                            Mở hết nhận Gói Hạt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specimen Cards Row: Base Crop + Mutations */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                      {/* 1. Base Crop Card */}
                      <div
                        onClick={() => handleOpenSpecimen(crop)}
                        className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center text-center transition cursor-pointer select-none relative hover:scale-102 ${
                          crop.isUnlocked
                            ? 'bg-white border-[#e0a93b] hover:border-amber-500 shadow-xs'
                            : 'bg-[#f7ede0]/70 border-[#e0cba0] opacity-75'
                        }`}
                      >
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-amber-50/80 border border-[#e8d5be] flex items-center justify-center p-1 mb-1.5">
                          {crop.isUnlocked ? (
                            <div className="relative w-10 h-10 sm:w-14 sm:h-14">
                              <PlantSprite
                                cropCode={crop.code?.replace('_SEED', '').toLowerCase()}
                                stage={5}
                                alt={crop.name}
                              />
                            </div>
                          ) : (
                            <Lock className="w-5 h-5 text-stone-400" />
                          )}
                        </div>
                        <span className="font-bold text-xs text-[#5c3a10] truncate w-full">
                          {crop.isUnlocked ? crop.name : '??? Cây Chưa Mở'}
                        </span>
                        <span className="text-[9.5px] text-amber-700 mt-0.5 font-medium">
                          {crop.isUnlocked ? 'Dạng Chuẩn' : `Cần Lv.${crop.minFarmLevel || 1}`}
                        </span>
                      </div>

                      {/* 2. Mutations Cards */}
                      {mutations.map((mutation: any) => {
                        const isMutUnlocked = Boolean(mutation.isUnlocked);
                        return (
                          <div
                            key={mutation.mutationId || mutation.code}
                            onClick={() => handleOpenSpecimen(crop, mutation)}
                            className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center text-center transition cursor-pointer select-none relative hover:scale-102 ${
                              isMutUnlocked
                                ? 'bg-white border-purple-400 hover:border-purple-500 shadow-xs ring-1 ring-purple-300'
                                : 'bg-[#f7ede0]/70 border-[#e0cba0] opacity-75'
                            }`}
                          >
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-purple-50/80 border border-purple-200/60 flex items-center justify-center p-1 mb-1.5 relative overflow-hidden">
                              {isMutUnlocked ? (
                                <div className="relative w-10 h-10 sm:w-14 sm:h-14">
                                  <PlantSprite
                                    cropCode={crop.code?.replace('_SEED', '').toLowerCase()}
                                    stage={5}
                                    mutationCode={mutation.code}
                                    isMutated={true}
                                    alt={mutation.name}
                                  />
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <span className="text-xl font-black text-purple-400/50">?</span>
                                  <Sparkles className="w-3 h-3 text-purple-400/50 absolute top-1 right-1" />
                                </div>
                              )}
                            </div>

                            <span
                              className={`font-black text-xs truncate w-full ${
                                isMutUnlocked ? 'text-purple-900' : 'text-stone-500'
                              }`}
                            >
                              {isMutUnlocked ? mutation.name : '??? Đột Biến'}
                            </span>
                            <span className="text-[9.5px] text-purple-700 font-bold mt-0.5">
                              {isMutUnlocked ? mutation.rarity || 'Hiếm' : `${Math.round(((mutation.mutationChance ?? 0.05) * 100))}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
