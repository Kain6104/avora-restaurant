'use client';

import React, { useState } from 'react';
import { X, Sprout, Sparkles, Droplets, Gift, ArrowRight, Check, Utensils } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import { farmEventBus } from '../../game/services/farmEventBus';
import PlantSprite from '../common/PlantSprite';

interface FarmTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (rewardText?: string) => void;
}

export default function FarmTutorialModal({ isOpen, onClose, onCompleted }: FarmTutorialModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    farmSound.playReward();

    try {
      const res = await fetch('/api/farm/tutorial/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        farmEventBus.emit('GAME_TOAST', {
          type: 'reward',
          message: json.data?.rewardText || '🎉 Nhận thành công gói quà tân thủ!',
        });
        onCompleted(json.data?.rewardText);
        onClose();
      } else {
        onClose();
      }
    } catch (e) {
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col w-screen h-screen bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none">
      {/* Header */}
      <div className="relative px-3 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#422006] via-[#784814] to-[#422006] text-white flex items-center justify-between border-b border-[#e0a93b]/60 shrink-0 shadow-md">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            onClick={onClose}
            className="px-2 sm:px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
          >
            ← Trở về
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#d4af37]/30 border border-[#f5d77f] flex items-center justify-center">
            <Sprout className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ffe58f]" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-serif font-black text-[#fff8e7] tracking-wide">
              HƯỚNG DẪN TÂN THỦ
            </h3>
            <p className="text-[10px] text-[#f5d77f]/90">Khởi đầu hành trình làm nông trên Đảo Mây AVORA</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center transition-all cursor-pointer text-white/90"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

        {/* Step Progression Tabs */}
        <div className="flex border-b border-[#ebdcc8] bg-[#fbf8f2] px-6 py-2.5 items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-amber-500 text-white shadow-xs'
                    : step > s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              <span
                className={`text-xs font-semibold ${
                  step === s ? 'text-[#422006]' : 'text-gray-400'
                }`}
              >
                {s === 1 ? 'Gieo hạt' : s === 2 ? 'Chăm sóc' : 'Thu hoạch & Đổi quà'}
              </span>
            </div>
          ))}
        </div>

        {/* Body Content by Step */}
        <div className="p-6 space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="h-36 rounded-2xl bg-gradient-to-b from-amber-50 to-orange-50/50 border border-amber-200/80 p-4 flex items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-amber-200 flex items-center justify-center p-2">
                  <PlantSprite cropCode="JAPANESE_RICE" stage={1} alt="Mầm cây" />
                </div>
                <div className="max-w-[220px]">
                  <div className="text-xs font-bold text-amber-900 uppercase">Bước 1: Chọn ô đất & Gieo mầm</div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Nhấp vào bất kỳ thửa đất trống nào trên nông trại để mở <strong>Khay Hạt Giống</strong>. Chọn hạt giống bạn muốn trồng để bắt đầu mùa vụ.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#fdfbf7] border border-[#ebdcc8] text-xs text-[#5a3e1b] space-y-1">
                <div className="font-bold text-[#8c6227]">💡 Mẹo cho người mới:</div>
                <p>Gạo Koshihikari và Dâu Tây Tochigi lớn rất nhanh (chỉ từ 2 - 4 phút), rất thích hợp để tích lũy kinh nghiệm và Xu Nông Trại ban đầu!</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="h-36 rounded-2xl bg-gradient-to-b from-sky-50 to-indigo-50/50 border border-sky-200/80 p-4 flex items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-sky-200 flex items-center justify-center p-2">
                  <Droplets className="w-12 h-12 text-sky-500 animate-bounce" />
                </div>
                <div className="max-w-[220px]">
                  <div className="text-xs font-bold text-sky-900 uppercase">Bước 2: Tưới nước & Bón phân</div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Giữ đất luôn ẩm để cây phát triển tốt nhất. Sử dụng <strong>Phân Bón Siêu Tốc</strong> để rút ngắn thời gian chín, hoặc <strong>Huyết Thanh Đột Biến</strong> để tạo ra biến dị quý hiếm!
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#fdfbf7] border border-[#ebdcc8] text-xs text-[#5a3e1b] space-y-1">
                <div className="font-bold text-[#8c6227]">🌟 Cây biến dị quý giá:</div>
                <p>Cây trồng biến dị (Vàng, Pha Lê, Cầu Vồng) có giá bán ra cực kỳ cao và được ghi danh vào <strong>Bách Khoa Toàn Thư Cây Trồng</strong>!</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="h-36 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50/50 border border-emerald-200/80 p-4 flex items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white shadow-sm border border-emerald-200 flex items-center justify-center p-2">
                  <Utensils className="w-12 h-12 text-emerald-600" />
                </div>
                <div className="max-w-[220px]">
                  <div className="text-xs font-bold text-emerald-900 uppercase">Bước 3: Thu hoạch & Đổi Voucher</div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Dùng nông sản thu hoạch trong <strong>Cửa hàng Nông Sản</strong> để đổi lấy các Voucher giảm giá thực tế tại nhà hàng AVORA!
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#fff9e6] to-[#fff3d1] border border-[#eedaa2] text-xs text-[#5a3e1b] flex items-center gap-3">
                <Gift className="w-8 h-8 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold text-[#8c6227]">🎁 Quà tặng người mới bắt đầu:</div>
                  <div className="text-[#422006] font-semibold">50 Xu Nông Trại + 5 Hạt Gạo Koshihikari + 2 Phân Bón Siêu Tốc!</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Navigation */}
          <div className="flex items-center justify-between pt-2">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
              >
                Quay lại
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-[#d4af37] text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:from-amber-600 hover:to-amber-700 shadow-md active:scale-95"
              >
                <span>Tiếp theo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ring-2 ring-emerald-300"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
                <span>{isSubmitting ? 'Đang nhận quà...' : 'BẮT ĐẦU CHƠI & NHẬN QUÀ'}</span>
              </button>
            )}
          </div>
        </div>
    </div>
  );
}
