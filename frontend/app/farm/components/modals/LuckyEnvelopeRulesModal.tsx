'use client';

import React, { useState, useEffect } from 'react';
import { X, Gift, BookOpen, Sparkles, Trophy, Award, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';

interface LuckyEnvelopeRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RewardItem {
  id: string;
  name: string;
  description?: string;
  rewardType: string;
  referenceId?: string | null;
  minAmount: number;
  maxAmount: number;
  rarity: string;
  weight: number;
  imageUrl?: string;
  globalStock?: number | null;
  claimedStock?: number;
  perUserLimit?: number | null;
  dropRate: string;
  remainingStock: number | null;
}

interface RulesData {
  config: {
    isEventActive: boolean;
    maxVisibleEnvelopes: number;
    ticketsPerMission: number;
  };
  rules: {
    title: string;
    programPurpose: string;
    howToEarnTickets: {
      category: string;
      items: string[];
    }[];
    mechanics: string[];
  };
  totalWeight: number;
  rewards: RewardItem[];
}

export default function LuckyEnvelopeRulesModal({ isOpen, onClose }: LuckyEnvelopeRulesModalProps) {
  const [activeTab, setActiveTab] = useState<'rules' | 'rewards'>('rules');
  const [data, setData] = useState<RulesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRulesAndRewards();
    }
  }, [isOpen]);

  const fetchRulesAndRewards = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/farm/lucky-envelope/rules-and-rewards');
      if (!res.ok) {
        throw new Error(`Mã lỗi HTTP: ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.message || 'Không thể tải thông tin phần thưởng');
      }
    } catch (err: any) {
      console.error('Lỗi tải thể lệ và phần thưởng lì xì:', err);
      setError(err?.message || 'Có lỗi xảy ra khi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY':
        return {
          title: 'Huyền Thoại',
          badgeClass: 'bg-red-500/15 border-red-500/40 text-red-700 font-bold',
          tagClass: 'text-red-600',
        };
      case 'EPIC':
        return {
          title: 'Sử Thi',
          badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-800 font-bold',
          tagClass: 'text-amber-700',
        };
      case 'RARE':
        return {
          title: 'Quý Hiếm',
          badgeClass: 'bg-purple-500/15 border-purple-500/40 text-purple-700 font-bold',
          tagClass: 'text-purple-600',
        };
      case 'UNCOMMON':
        return {
          title: 'Đặc Biệt',
          badgeClass: 'bg-sky-500/15 border-sky-500/40 text-sky-700 font-bold',
          tagClass: 'text-sky-600',
        };
      case 'COMMON':
      default:
        return {
          title: 'Phổ Thông',
          badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 font-semibold',
          tagClass: 'text-emerald-600',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col w-screen h-screen bg-white text-neutral-800 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
    >
      {/* Header Modal */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-neutral-200 flex items-center justify-between shrink-0 bg-neutral-50 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="px-2.5 py-1 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
          >
            ← Trở về
          </button>
          <span className="text-xl">🧧</span>
          <h2 className="text-sm sm:text-lg font-bold text-neutral-900 font-serif">
            {data?.rules?.title || 'Thể Lệ & Phần Thưởng Lì Xì May Mắn'}
          </h2>
        </div>
          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => {
              farmSound.playTap();
              setActiveTab('rules');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>Thể Lệ & Tích Lũy</span>
          </button>
          <button
            onClick={() => {
              farmSound.playTap();
              setActiveTab('rewards');
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rewards'
                ? 'border-amber-600 text-amber-900 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Gift className="w-4 h-4 text-amber-600" />
            <span>Danh Sách Phần Thưởng</span>
            {data?.rewards && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-100 text-amber-800">
                {data.rewards.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
              <p className="text-xs font-medium">Đang tải dữ liệu từ máy chủ...</p>
            </div>
          )}

          {error && !data && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
              <p className="text-sm font-semibold text-neutral-800 mb-1">Không thể tải thông tin</p>
              <p className="text-xs text-neutral-500 mb-4">{error}</p>
              <button
                onClick={fetchRulesAndRewards}
                className="px-4 py-1.5 rounded-full bg-neutral-900 text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* TAB 1: THỂ LỆ CHƯƠNG TRÌNH */}
          {activeTab === 'rules' && data && (
            <div className="space-y-5 text-neutral-700 text-xs sm:text-sm leading-relaxed">
              {/* 1. Mục đích chương trình */}
              <section className="space-y-2">
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base flex items-center gap-1.5">
                  <span className="text-amber-600 font-mono">1.</span> Mục đích chương trình
                </h3>
                <p className="text-neutral-600 bg-neutral-50 p-3.5 rounded-xl border border-neutral-100 leading-normal">
                  {data.rules.programPurpose}
                </p>
              </section>

              {/* 2. Cách thức tích lũy lượt */}
              <section className="space-y-3">
                <h3 className="font-bold text-neutral-900 text-sm sm:text-base flex items-center gap-1.5">
                  <span className="text-amber-600 font-mono">2.</span> Cách thức tích lũy lượt mở lì xì
                </h3>
                <p className="text-neutral-600 text-xs">
                  Để nhận lượt mở lì xì may mắn, bạn có thể tham gia hoàn thành các hoạt động sau:
                </p>

                {data.rules.howToEarnTickets.map((group, idx) => (
                  <div key={idx} className="space-y-2">
                    <h4 className="font-bold text-neutral-800 text-xs sm:text-sm">
                      {group.category}
                    </h4>
                    <ul className="space-y-1.5 pl-2">
                      {group.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-2">
                          <span className="text-amber-600 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>

              {/* 3. Cơ chế mở & nhận thưởng */}
              {data.rules.mechanics && data.rules.mechanics.length > 0 && (
                <section className="space-y-2 pt-2 border-t border-neutral-100">
                  <h3 className="font-bold text-neutral-900 text-sm sm:text-base flex items-center gap-1.5">
                    <span className="text-amber-600 font-mono">3.</span> Quy tắc & cơ chế trúng thưởng
                  </h3>
                  <ul className="space-y-1.5 pl-2">
                    {data.rules.mechanics.map((mech, mIdx) => (
                      <li key={mIdx} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{mech}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* TAB 2: DANH SÁCH PHẦN THƯỞNG & QUÀ CÒN LẠI */}
          {activeTab === 'rewards' && data && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-neutral-600 bg-amber-50/80 border border-amber-200/70 px-3.5 py-2.5 rounded-xl">
                <span className="flex items-center gap-1.5 text-amber-900 font-semibold">
                  <Gift className="w-4 h-4 text-amber-600" />
                  Danh sách quà tặng sự kiện Lì Xì May Mắn
                </span>
                <span className="font-bold text-amber-900 font-mono bg-white px-2 py-0.5 rounded-md border border-amber-200">
                  {data.rewards.length} Phần thưởng
                </span>
              </div>

              <div className="space-y-2.5">
                {data.rewards.map((reward) => {
                  const rarityBadge = getRarityBadge(reward.rarity);
                  const amountDisplay =
                    reward.minAmount === reward.maxAmount
                      ? `x${reward.minAmount.toLocaleString('vi-VN')}`
                      : `x${reward.minAmount.toLocaleString('vi-VN')} - x${reward.maxAmount.toLocaleString('vi-VN')}`;

                  return (
                    <div
                      key={reward.id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-neutral-200 hover:border-amber-400 hover:shadow-xs transition-all"
                    >
                      {/* Thumbnail / Icon sắc nét không bị lỗi ảnh */}
                      <div className="w-12 h-12 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-center shrink-0 p-1.5 overflow-hidden">
                        {reward.rewardType === 'COIN' ? (
                          <AvoraCoinIcon size="lg" className="w-8 h-8" />
                        ) : reward.rewardType === 'SEED' ? (
                          <span className="text-2xl select-none" title="Hạt giống">🌱</span>
                        ) : reward.rewardType === 'FERTILIZER' ? (
                          <span className="text-2xl select-none" title="Phân bón">🧪</span>
                        ) : reward.rewardType === 'ENERGY' ? (
                          <span className="text-2xl select-none" title="Năng lượng">⚡</span>
                        ) : reward.rewardType === 'EXP' ? (
                          <span className="text-2xl select-none" title="Kinh nghiệm">⭐</span>
                        ) : (
                          <Gift className="w-6 h-6 text-amber-500" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${rarityBadge.badgeClass}`}>
                            {rarityBadge.title}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-neutral-900 truncate">
                            {reward.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="font-mono font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                            {amountDisplay}
                          </span>
                        </div>

                        {reward.description && (
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {reward.description}
                          </p>
                        )}
                      </div>

                      {/* Quà Còn Lại Badge (Thay thế hoàn toàn hiển thị tỷ lệ) */}
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <div className="text-[10px] uppercase font-bold text-neutral-400">
                          Còn lại
                        </div>
                        {reward.remainingStock !== null ? (
                          <div
                            className={`font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg border ${
                              reward.remainingStock > 0
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
                                : 'text-neutral-400 bg-neutral-100 border-neutral-200'
                            }`}
                          >
                            {reward.remainingStock > 0 ? `${reward.remainingStock.toLocaleString('vi-VN')} suất` : 'Hết quà'}
                          </div>
                        ) : (
                          <div className="font-semibold text-xs text-neutral-600 bg-neutral-100 border border-neutral-200/80 px-2.5 py-1 rounded-lg">
                            Không giới hạn
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-50 border-t border-neutral-100 flex justify-end shrink-0">
          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="w-full sm:w-auto px-6 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
          >
            Đã Hiểu
          </button>
        </div>
    </div>
  );
}
