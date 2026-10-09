'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Gift, Flame, ArrowRight } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import LuckyEnvelopeRulesModal from './LuckyEnvelopeRulesModal';

interface LuckyEnvelopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTickets: number;
  onOpenEnvelope: () => Promise<any>;
  lastReward: any | null;
}

export default function LuckyEnvelopeModal({
  isOpen,
  onClose,
  availableTickets,
  onOpenEnvelope,
  lastReward,
}: LuckyEnvelopeModalProps) {
  const [openingState, setOpeningState] = useState<'IDLE' | 'OPENING' | 'REVEALED'>('IDLE');
  const [rewardData, setRewardData] = useState<any | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (lastReward) {
        setRewardData(lastReward);
        setOpeningState('REVEALED');
      } else {
        setOpeningState('IDLE');
        setRewardData(null);
      }
    } else {
      setOpeningState('IDLE');
      setRewardData(null);
    }
  }, [isOpen, lastReward]);

  if (!isOpen) return null;

  const handleOpenClick = async () => {
    if (isOpening || availableTickets <= 0) return;
    setIsOpening(true);
    setOpeningState('OPENING');
    farmSound.playTap();

    try {
      const res = await onOpenEnvelope();
      if (res && res.reward) {
        setTimeout(() => {
          setRewardData(res.reward);
          setOpeningState('REVEALED');
          setIsOpening(false);
          if (res.reward.rarity === 'LEGENDARY' || res.reward.rarity === 'EPIC') {
            farmSound.playLevelUp();
          } else {
            farmSound.playUnlock();
          }
        }, 900);
      } else {
        setOpeningState('IDLE');
        setIsOpening(false);
      }
    } catch (e) {
      console.error(e);
      setOpeningState('IDLE');
      setIsOpening(false);
    }
  };

  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case 'LEGENDARY':
        return {
          title: 'HUYỀN THOẠI',
          badgeBg: 'bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse text-white shadow-lg shadow-red-500/50',
          cardGlow: 'border-amber-400 shadow-[0_0_40px_rgba(239,68,68,0.55)]',
          textGradient: 'from-amber-300 via-rose-300 to-amber-200',
        };
      case 'EPIC':
        return {
          title: 'SỬ THI',
          badgeBg: 'bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-black shadow-md shadow-amber-500/40',
          cardGlow: 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.45)]',
          textGradient: 'from-amber-200 to-amber-400',
        };
      case 'RARE':
        return {
          title: 'QUÝ HIẾM',
          badgeBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/40',
          cardGlow: 'border-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.4)]',
          textGradient: 'from-purple-200 to-pink-200',
        };
      case 'UNCOMMON':
        return {
          title: 'ĐẶC BIỆT',
          badgeBg: 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-500/30',
          cardGlow: 'border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.35)]',
          textGradient: 'from-sky-200 to-cyan-200',
        };
      case 'COMMON':
      default:
        return {
          title: 'PHỔ THÔNG',
          badgeBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30',
          cardGlow: 'border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
          textGradient: 'from-emerald-200 to-teal-100',
        };
    }
  };

  const rarityInfo = rewardData ? getRarityConfig(rewardData.rarity) : getRarityConfig('COMMON');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* Container Thẻ Quà Lì Xì Cung Đình */}
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[96vh] rounded-3xl bg-gradient-to-b from-[#8B0000] via-[#5C0606] to-[#3B0202] border-2 border-[#d4af37]/80 shadow-[0_10px_40px_rgba(180,20,20,0.6)] text-white overflow-y-auto p-5 sm:p-7 md:p-8 flex flex-col items-center text-center">
        {/* Họa tiết góc Cung Đình Á Đông */}
        <div className="absolute top-2 left-2 text-[#d4af37]/40 text-xl font-serif">❖</div>
        <div className="absolute top-2 right-2 text-[#d4af37]/40 text-xl font-serif">❖</div>
        <div className="absolute bottom-2 left-2 text-[#d4af37]/40 text-xl font-serif">❖</div>
        <div className="absolute bottom-2 right-2 text-[#d4af37]/40 text-xl font-serif">❖</div>

        {/* Nút Thể Lệ & Phần Thưởng (!) - Yêu cầu người dùng */}
        <button
          onClick={() => {
            farmSound.playTap();
            setShowRulesModal(true);
          }}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-amber-400/60 text-amber-300 hover:text-white flex items-center justify-center font-black text-lg shadow-md transition-all cursor-pointer z-10 active:scale-95"
          title="Thể lệ & Danh sách phần thưởng"
        >
          !
        </button>

        {/* Nút Đóng */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-amber-200/80 hover:text-white transition-all cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Tiêu Đề */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
          <h2 className="text-xl sm:text-2xl font-serif font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 drop-shadow-sm">
            LÌ XÌ MAY MẮN
          </h2>
          <Sparkles className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
        </div>

        {/* Số Lượt Còn Lại Badge */}
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-950/80 border border-amber-400/50 text-xs font-semibold text-amber-200 mb-4 shadow-inner">
          <span>🧧 Còn lại:</span>
          <span className="font-mono font-black text-white text-sm">{availableTickets}</span>
          <span>lượt</span>
        </div>

        {/* ========================================================= */}
        {/* TRẠNG THÁI 1: CHUẨN BỊ MỞ HOẶC ĐANG MỞ (Swaying/Opening Envelope) */}
        {/* ========================================================= */}
        {openingState !== 'REVEALED' && (
          <div className="flex flex-col items-center my-1 w-full">
            <div
              className={`relative cursor-pointer transition-transform duration-300 flex items-center justify-center ${
                openingState === 'OPENING'
                  ? 'animate-bounce scale-110'
                  : 'hover:scale-105 active:scale-95'
              }`}
              onClick={handleOpenClick}
            >
              {/* Quầng sáng vàng hoàng kim rực rỡ xung quanh bao lì xì */}
              <div className="absolute inset-0 rounded-full bg-amber-400/35 blur-3xl scale-125 animate-pulse" />

              {/* Hình ảnh bao lì xì to lớn, nổi bật và sắc nét */}
              <img
                src="/game/farm/environment/props/lucky_envelope.webp"
                alt="Bao Lì Xì May Mắn"
                className="relative w-52 sm:w-64 md:w-72 h-auto max-h-[48vh] sm:max-h-[350px] md:max-h-[390px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all"
              />

              {openingState === 'OPENING' && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Flame className="w-16 h-16 text-amber-300 animate-ping" />
                </div>
              )}
            </div>

            <p className="text-amber-200/90 text-sm mt-4 font-serif">
              {openingState === 'OPENING'
                ? 'Đang khui lộc may mắn đầu xuân...'
                : 'Chạm vào bao lì xì để mở thưởng!'}
            </p>

            {availableTickets > 0 && openingState === 'IDLE' && (
              <button
                onClick={handleOpenClick}
                disabled={isOpening}
                className="mt-5 px-7 py-2.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-red-950 font-black text-sm tracking-wide shadow-[0_4px_18px_rgba(245,158,11,0.5)] transition-all transform active:scale-95 cursor-pointer"
              >
                MỞ NGAY
              </button>
            )}

            {availableTickets === 0 && (
              <div className="mt-4 p-3 rounded-2xl bg-black/30 border border-amber-500/20 text-xs text-amber-200/70 max-w-xs">
                Bạn đã dùng hết lượt lì xì. Hãy hoàn thành các nhiệm vụ nông trại để nhận thêm lượt nhé!
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TRẠNG THÁI 2: ĐÃ MỞ RA PHẦN THƯỞNG (REVEALED REWARD) */}
        {/* ========================================================= */}
        {openingState === 'REVEALED' && rewardData && (
          <div className="w-full flex flex-col items-center animate-in zoom-in-90 duration-300">
            {/* Rarity Pill */}
            <div className={`px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase mb-4 ${rarityInfo.badgeBg}`}>
              ✦ {rarityInfo.title} ✦
            </div>

            {/* Khung Hiển Thị Phần Thưởng */}
            <div className={`w-full p-5 rounded-2xl bg-gradient-to-b from-[#4A0A0A]/90 to-[#2A0505]/95 border-2 ${rarityInfo.cardGlow} backdrop-blur-sm flex flex-col items-center mb-6`}>
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-black/40 border border-amber-400/40 p-2.5 flex items-center justify-center mb-3 shadow-inner">
                {rewardData.imageUrl ? (
                  <img
                    src={rewardData.imageUrl}
                    alt={rewardData.name}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                ) : (
                  <Gift className="w-12 h-12 text-amber-400" />
                )}
              </div>

              <h3 className={`text-lg sm:text-xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r ${rarityInfo.textGradient}`}>
                {rewardData.name}
              </h3>

              <div className="text-2xl sm:text-3xl font-mono font-black text-amber-300 mt-1">
                +{rewardData.rewardAmount.toLocaleString('vi-VN')}
              </div>

              {rewardData.description && (
                <p className="text-xs text-amber-100/70 mt-2 italic max-w-xs">
                  "{rewardData.description}"
                </p>
              )}
            </div>

            {/* Các Nút Hành Động */}
            <div className="w-full flex flex-col sm:flex-row items-center gap-2.5 justify-center">
              {availableTickets > 0 ? (
                <>
                  <button
                    onClick={handleOpenClick}
                    disabled={isOpening}
                    className="w-full sm:w-auto flex-1 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-red-950 font-black text-sm shadow-[0_4px_16px_rgba(245,158,11,0.5)] transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Mở Tiếp</span>
                    <span className="text-xs bg-red-950/20 px-1.5 py-0.5 rounded-full font-mono">
                      (Còn {availableTickets})
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black/40 hover:bg-black/60 border border-amber-400/40 text-amber-200 font-bold text-sm transition-all cursor-pointer"
                  >
                    Thu Nhận & Đóng
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-red-950 font-black text-sm shadow-[0_4px_16px_rgba(245,158,11,0.5)] transition-all active:scale-95 cursor-pointer"
                >
                  Xác Nhận & Thu Thập
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Thể Lệ & Danh Sách Phần Thưởng (Lấy động 100% từ Database) */}
      <LuckyEnvelopeRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
      />
    </div>
  );
}
