'use client';

import React, { useState } from 'react';
import { X, ShoppingBag, Sprout, Sparkles, Gift, Star, Ticket, Clock } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import Image from 'next/image';

interface FarmShopModalProps {
  shopCatalog: any;
  rewardsCatalog: any;
  userCoin: number;
  userPoints: number;
  onClose: () => void;
  onPurchaseSeed: (itemCode: string, quantity: number) => void;
  onRedeemReward: (rewardCode: string) => void;
}

const SEED_IMAGE_MAP: Record<string, string> = {
  JAPANESE_RICE: '/game/farm/crops/rice/stage_5.png',
  STRAWBERRY: '/game/farm/crops/strawberry/stage_5.png',
  GRAPE: '/game/farm/crops/grape/stage_5.png',
  MATCHA: '/game/farm/crops/matcha/stage_5.png',
  MATCHA_LEAF: '/game/farm/crops/matcha/stage_5.png',
  SAKURA: '/game/farm/crops/sakura/stage_5.png',
  SAKURA_PEARL: '/game/farm/crops/sakura/stage_5.png',
  YUZU: '/game/farm/crops/yuzu/stage_5.png',
};

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toLocaleString('vi-VN');
}

export default function FarmShopModal({
  shopCatalog,
  rewardsCatalog,
  userCoin,
  userPoints,
  onClose,
  onPurchaseSeed,
  onRedeemReward,
}: FarmShopModalProps) {
  const [activeTab, setActiveTab] = useState<'SEEDS' | 'FERTILIZERS' | 'REWARDS'>('SEEDS');

  const seeds = shopCatalog?.seeds || [];
  const fertilizers = shopCatalog?.fertilizers || [];
  const rewards = rewardsCatalog?.rewards || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fffdf7] rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border-2 border-[#d4af37] flex flex-col max-h-[95vh] relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a2e18] via-[#2c1810] to-[#4a2e18] px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-white flex items-center justify-between border-b border-[#d4af37]/60 relative shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-[#ffd54f] to-[#ff8f00] p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[10px] bg-[#2c1810] flex items-center justify-center text-amber-400 font-bold">
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-xs sm:text-sm text-[#fff8e1] tracking-wide truncate">
                CỬA HÀNG NÔNG TRẠI AVORA
              </h3>
              <p className="hidden sm:block text-[10px] sm:text-xs text-[#d7ccc8] truncate">
                Mua sắm hạt giống thần tiên & Phân bón
              </p>
            </div>
          </div>

          {/* Currency counters on top right */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[#2c1810]/80 rounded-full border border-[#d4af37]/50 shadow-inner">
              <span className="flex items-center gap-1.5 text-[10px] sm:text-xs text-amber-300 font-black">
                <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                {formatCompactNumber(userCoin)} Xu
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#5d4037]/80 hover:bg-[#8d6e63] text-[#fff8e1] border border-[#d4af37]/50 flex items-center justify-center transition cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-2 py-1.5 sm:p-2.5 bg-[#f5ecdd] gap-1.5 sm:gap-2 border-b border-[#e5d4be] shrink-0">
          <button
            onClick={() => setActiveTab('SEEDS')}
            className={`flex-1 py-1.5 sm:py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeTab === 'SEEDS'
                ? 'bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] border-[#ffd54f] shadow-xs'
                : 'bg-[#faf3e6] text-[#795548] border-[#e0cfb5] hover:bg-white'
            }`}
          >
            <Sprout className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Hạt Giống Cây Trồng</span>
          </button>

          <button
            onClick={() => setActiveTab('FERTILIZERS')}
            className={`flex-1 py-1.5 sm:py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border ${
              activeTab === 'FERTILIZERS'
                ? 'bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] border-[#ffd54f] shadow-xs'
                : 'bg-[#faf3e6] text-[#795548] border-[#e0cfb5] hover:bg-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Phân Bón Sinh Học</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {/* TAB 1: HẠT GIỐNG (Chuẩn Ref Image 5 Cards) */}
          {activeTab === 'SEEDS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {seeds.map((seed: any) => {
                const canAfford = userCoin >= seed.price;
                const seedImage = SEED_IMAGE_MAP[seed.cropCode || seed.code] || '/game/farm/crops/rice/stage_5.png';

                return (
                  <div
                    key={seed.code}
                    className="p-3.5 rounded-2xl border-2 border-[#e5d4be] bg-[#faf5eb] hover:bg-white hover:border-[#d4af37] flex flex-col justify-between transition shadow-xs relative"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-amber-100/50 to-orange-100/50 flex items-center justify-center p-1 border border-amber-300 shrink-0">
                            <div className="relative w-10 h-10">
                              <Image
                                src={seedImage}
                                alt={seed.name}
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          </div>
                          <div>
                            <h4 className="font-extrabold text-[#4e342e] text-sm leading-tight">
                              {seed.name}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 bg-[#ebd9be] text-[#5d4037] font-black rounded-md uppercase mt-1 inline-block">
                              Cấp {seed.minFarmLevel}+
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#795548] line-clamp-2 leading-relaxed">
                        {seed.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#ebd9be] flex items-center justify-between">
                      {/* Price Ribbon Badge (Chuẩn Ref Image 5) */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#880e4f] to-[#ad1457] text-white rounded-full text-xs font-black shadow-xs">
                        <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                        <span>{seed.price}</span>
                      </div>

                      <button
                        onClick={() => onPurchaseSeed(seed.code, 1)}
                        disabled={!canAfford}
                        className={`px-4 py-1.5 rounded-xl font-black text-xs transition cursor-pointer active:scale-95 border ${
                          canAfford
                            ? 'bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] border-[#ffd54f] shadow-xs hover:brightness-105'
                            : 'bg-[#e0d5c3] text-[#a1887f] border-[#d7ccc8] cursor-not-allowed'
                        }`}
                      >
                        Mua 1 Hạt
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: PHÂN BÓN */}
          {activeTab === 'FERTILIZERS' && (
            <div className="space-y-3">
              {fertilizers.map((fert: any) => {
                const canAfford = userCoin >= fert.price;
                return (
                  <div
                    key={fert.code}
                    className="p-3.5 rounded-2xl border-2 border-[#e5d4be] bg-[#faf5eb] hover:bg-white flex items-center justify-between transition shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-700 flex items-center justify-center text-xl shrink-0 border border-purple-200">
                        🧪
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[#4e342e] text-sm">{fert.name}</h4>
                        <p className="text-[11px] text-[#795548] mt-0.5">{fert.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-[#880e4f] to-[#ad1457] text-white rounded-full text-xs font-black shadow-xs">
                        <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                        <span>{fert.price}</span>
                      </div>
                      <button
                        onClick={() => onPurchaseSeed(fert.code, 1)}
                        disabled={!canAfford}
                        className={`px-4 py-1.5 rounded-xl font-black text-xs transition cursor-pointer active:scale-95 border ${
                          canAfford
                            ? 'bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] border-[#ffd54f] shadow-xs'
                            : 'bg-[#e0d5c3] text-[#a1887f] border-[#d7ccc8] cursor-not-allowed'
                        }`}
                      >
                        Mua
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: ĐỔI THƯỞNG VOUCHER (Chuẩn Ref Image 5 S-Tier Rewards) */}
          {activeTab === 'REWARDS' && (
            <div className="space-y-3">
              {rewards.map((reward: any) => (
                <div
                  key={reward.id}
                  className="p-4 rounded-2xl border-2 border-[#e5d4be] bg-gradient-to-r from-[#fff9c4]/30 via-[#faf5eb] to-[#ffebee]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-[#d4af37] transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#c62828] to-[#880e4f] text-white flex items-center justify-center shrink-0 shadow-md border border-[#ef5350]">
                      <Ticket className="w-7 h-7 text-amber-200" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-[#3e2723] text-sm">{reward.title}</h4>
                        {reward.stock !== null && (
                          <span className="text-[10px] px-2 py-0.5 bg-[#ebd9be] text-[#5d4037] rounded-md font-bold">
                            Còn {reward.stock - reward.redeemedCount} suất
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#795548] mt-0.5">{reward.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e5d4be]">
                    <div className="text-left sm:text-right">
                      {reward.costLoyaltyPoints > 0 && (
                        <span className="text-xs font-black text-[#c62828] flex items-center sm:justify-end gap-1">
                          <Star className="w-3.5 h-3.5 fill-[#c62828]" />
                          {reward.costLoyaltyPoints} Điểm
                        </span>
                      )}
                      {reward.costFarmCoin > 0 && (
                        <span className="text-xs font-black text-amber-700 flex items-center sm:justify-end gap-1">
                          <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                          {reward.costFarmCoin} Xu
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onRedeemReward(reward.code)}
                      disabled={!reward.canRedeem}
                      className={`px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer active:scale-95 shrink-0 border ${
                        reward.canRedeem
                          ? 'bg-gradient-to-b from-[#e53935] to-[#c62828] hover:brightness-105 text-white border-[#ef5350] shadow-md'
                          : 'bg-[#e0d5c3] text-[#a1887f] border-[#d7ccc8] cursor-not-allowed'
                      }`}
                    >
                      {reward.myRedeemedCount >= reward.limitPerUser
                        ? 'Đã Đạt Giới Hạn'
                        : reward.canRedeem
                        ? 'Đổi Ngay'
                        : 'Chưa Đủ Điều Kiện'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
