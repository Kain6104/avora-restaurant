'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Gift,
  Ticket,
  Sparkles,
  ArrowRightLeft,
  Info,
  Check,
  Copy,
  Clock,
  ShieldCheck,
  Store,
  QrCode,
  Tag,
  AlertCircle,
} from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import VoucherTermsModal, { VoucherDetail } from './VoucherTermsModal';
import toast from 'react-hot-toast';

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 10_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toLocaleString('vi-VN');
}

interface AvoraRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoin: number;
  userPoints: number;
  farmLevel: number;
  rewardsCatalog: any[];
  onRedeemReward: (rewardCode: string) => Promise<void> | void;
  onExchangePoints?: (coinsAmount: number) => Promise<void> | void;
  onRefreshFarms?: () => void;
}

export default function AvoraRewardsModal({
  isOpen,
  onClose,
  userCoin,
  userPoints,
  farmLevel,
  rewardsCatalog = [],
  onRedeemReward,
  onExchangePoints,
  onRefreshFarms,
}: AvoraRewardsModalProps) {
  const [activeTab, setActiveTab] = useState<'VOUCHERS' | 'EXCHANGE' | 'MY_WALLET'>('VOUCHERS');
  const [selectedTermsVoucher, setSelectedTermsVoucher] = useState<VoucherDetail | null>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Exchange state from Database (Source of Truth)
  const [exchangeCoins, setExchangeCoins] = useState<number>(100);
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeConfig, setExchangeConfig] = useState<{
    farmCoins: number;
    avoraPoints: number;
    coinPerPoint: number;
    minCoins: number;
    maxCoinsPerTransaction: number;
    dailyLimitCoins: number;
    exchangedTodayCoins: number;
    availableExchangeCoins: number;
    isEnabled: boolean;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // My vouchers state
  const [myVouchers, setMyVouchers] = useState<any[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === 'MY_WALLET') {
      fetchMyVouchers();
    }
    if (isOpen && activeTab === 'EXCHANGE') {
      fetchExchangeConfig();
    }
  }, [isOpen, activeTab]);

  const fetchExchangeConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await fetch('/api/farm/exchange/config', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setExchangeConfig(json.data);
          if (exchangeCoins < (json.data.minCoins || 100)) {
            setExchangeCoins(json.data.minCoins || 100);
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch exchange config:', e);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchMyVouchers = async () => {
    try {
      setLoadingVouchers(true);
      const res = await fetch('/api/farm/rewards/my-vouchers', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setMyVouchers(json.data || []);
      }
    } catch (e) {
      console.warn('Could not fetch user vouchers:', e);
    } finally {
      setLoadingVouchers(false);
    }
  };

  if (!isOpen) return null;

  const handleOpenTerms = (item: any) => {
    farmSound.playClick();
    setSelectedTermsVoucher({
      code: item.voucher?.code || item.code,
      title: item.title,
      description: item.description,
      discountType: item.voucher?.discountType,
      discountValue: item.voucher?.discountValue,
      maxDiscount: item.voucher?.maxDiscount,
      minOrderValue: item.voucher?.minOrderValue,
      startDate: item.voucher?.startDate,
      endDate: item.voucher?.endDate,
      applicableScope: item.voucher?.applicableScope,
      costFarmCoin: item.costFarmCoin,
      costLoyaltyPoints: item.costLoyaltyPoints,
    });
    setIsTermsOpen(true);
  };

  const handleRedeem = async (item: any) => {
    farmSound.playReward();
    await onRedeemReward(item.code);
    if (onRefreshFarms) onRefreshFarms();
  };

  const handleExchange = async () => {
    const coinRate = exchangeConfig?.coinPerPoint || 5;
    const minCoins = exchangeConfig?.minCoins || 100;
    const maxCoins = exchangeConfig?.maxCoinsPerTransaction || 50000;
    const currentCoinBalance = exchangeConfig?.farmCoins ?? userCoin;

    if (exchangeCoins < minCoins) {
      toast.error(`Số Xu tối thiểu mỗi lần đổi là ${minCoins.toLocaleString('vi-VN')} Xu!`);
      return;
    }
    if (exchangeCoins > maxCoins) {
      toast.error(`Số Xu tối đa mỗi lần đổi là ${maxCoins.toLocaleString('vi-VN')} Xu!`);
      return;
    }
    if (currentCoinBalance < exchangeCoins) {
      toast.error('Số Xu trong nông trại không đủ để quy đổi!');
      return;
    }
    if (exchangeConfig && exchangeCoins > exchangeConfig.availableExchangeCoins) {
      toast.error(
        `Vượt quá hạn mức đổi hôm nay (Còn lại: ${exchangeConfig.availableExchangeCoins.toLocaleString('vi-VN')} Xu)!`,
      );
      return;
    }

    try {
      setIsExchanging(true);
      farmSound.playReward();
      const res = await fetch('/api/farm/exchange/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amountCoin: exchangeCoins }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        toast.success(json.data.message || 'Quy đổi Điểm AVORA thành công!');
        setExchangeConfig((prev) =>
          prev
            ? {
                ...prev,
                farmCoins: json.data.farmCoins,
                avoraPoints: json.data.avoraPoints,
                exchangedTodayCoins: json.data.exchangedTodayCoins,
                availableExchangeCoins: json.data.availableExchangeCoins,
              }
            : null,
        );
        if (onRefreshFarms) onRefreshFarms();
      } else {
        toast.error(json.message || json.error?.message || 'Không thể quy đổi điểm');
      }
    } catch (e) {
      toast.error('Lỗi khi kết nối hệ thống quy đổi AVORA');
    } finally {
      setIsExchanging(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã: ${code}`);
    farmSound.playClick();
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Tỷ lệ quy đổi động từ Database
  const coinPerPoint = exchangeConfig?.coinPerPoint || 5;
  const estimatedPoints = Math.floor(exchangeCoins / coinPerPoint);

  return (
    <>
      <div
        className="fixed inset-0 z-[9995] flex flex-col w-screen h-screen bg-[#fffdfa] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3e210b] via-[#653a12] to-[#3e210b] px-2 sm:px-4 py-1.5 sm:py-2 text-white flex items-center justify-between border-b border-[#d4af37]/60 shrink-0 shadow-md gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <button
              onClick={onClose}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              ← Trở về
            </button>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-[#ffd54f] to-[#ff8f00] p-0.5 shadow-md flex items-center justify-center shrink-0">
              <div className="w-full h-full rounded-[6px] bg-[#2c1810] flex items-center justify-center text-amber-300 font-bold">
                <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-serif font-black text-[11px] sm:text-sm text-[#fff8e7] tracking-wider truncate">
                TRUNG TÂM ĐỔI THƯỞNG AVORA
              </h3>
            </div>
          </div>

          {/* Balances Display */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-black/40 rounded-full border border-amber-500/40 text-[10px] sm:text-[11px] font-mono whitespace-nowrap">
              <span className="flex items-center gap-1 text-amber-300 font-black">
                <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{userCoin.toLocaleString('vi-VN')} Xu</span>
                <span className="sm:hidden">{formatCompactNumber(userCoin)} Xu</span>
              </span>
              <span className="text-gray-400">|</span>
              <span className="flex items-center gap-0.5 text-emerald-300 font-black">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">{userPoints.toLocaleString('vi-VN')} Điểm</span>
                <span className="sm:hidden">{formatCompactNumber(userPoints)} Điểm</span>
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition cursor-pointer shrink-0 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-[#2a170a] border-b border-[#e0a93b]/30 shrink-0 px-2 sm:px-4 pt-1 gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('VOUCHERS')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-t-xl font-serif text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'VOUCHERS'
                ? 'bg-[#fffdfa] text-[#422006] shadow-md border-t-2 border-amber-500'
                : 'text-amber-200/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Voucher Nhà Hàng</span>
          </button>

          <button
            onClick={() => setActiveTab('EXCHANGE')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-t-xl font-serif text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'EXCHANGE'
                ? 'bg-[#fffdfa] text-[#422006] shadow-md border-t-2 border-amber-500'
                : 'text-amber-200/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Đổi Xu Sang Điểm</span>
          </button>

          <button
            onClick={() => setActiveTab('MY_WALLET')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-t-xl font-serif text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'MY_WALLET'
                ? 'bg-[#fffdfa] text-[#422006] shadow-md border-t-2 border-amber-500'
                : 'text-amber-200/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Ví Voucher Của Tôi</span>
          </button>
        </div>

        {/* Tab 1: VOUCHERS LIST */}
        {activeTab === 'VOUCHERS' && (
          <div className="p-2 sm:p-4 overflow-y-auto min-h-0 flex-1 bg-[#faf5eb] space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between bg-amber-100/70 border border-amber-300/60 rounded-xl px-2.5 py-1 sm:py-1.5 text-[11px] sm:text-xs text-[#5d4037]">
              <span className="flex items-center gap-1.5 font-bold truncate">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Voucher đổi thành công sẽ dùng được ngay tại quầy POS hoặc thanh toán Online!
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-gray-500 whitespace-nowrap shrink-0 ml-2">Cấp nông trại: Lv.{farmLevel}</span>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {rewardsCatalog.map((reward) => {
                  const hasEnoughCoins = userCoin >= reward.costFarmCoin;
                  const hasEnoughPoints = userPoints >= reward.costLoyaltyPoints;
                  const hasEnoughLevel = farmLevel >= reward.minFarmLevel;
                  const isStockAvailable = reward.stock === null || reward.stock > reward.redeemedCount;
                  const canRedeem = hasEnoughCoins && hasEnoughPoints && hasEnoughLevel && isStockAvailable;

                  return (
                    <div
                      key={reward.id}
                      className="p-3 sm:p-4 rounded-2xl bg-white border-2 border-[#e6dcce] hover:border-[#d4af37] shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group"
                    >
                      {/* Ticket Notch effect */}
                      <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#faf5eb] border border-[#e6dcce]" />
                      <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#faf5eb] border border-[#e6dcce]" />

                      <div>
                        {/* Top tags */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase tracking-wide flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {reward.category || 'VOUCHER'}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                            <span>Yêu cầu:</span>
                            <span className={hasEnoughLevel ? 'text-emerald-700' : 'text-rose-600'}>
                              Lv.{reward.minFarmLevel}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h4 className="font-serif font-black text-sm text-[#3e2723] group-hover:text-amber-800 transition-colors">
                          {reward.title}
                        </h4>
                        <p className="text-[11px] text-[#6d4c41] mt-1 line-clamp-2 leading-relaxed">
                          {reward.description || 'Ưu đãi đổi thưởng trực tiếp từ Nông Trại Thần Tiên AVORA.'}
                        </p>
                      </div>

                      {/* Bottom action bar */}
                      <div className="mt-3.5 pt-3 border-t border-dashed border-[#e6dcce] flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Chi phí đổi</span>
                          <div className="flex items-center gap-2 font-mono font-black text-xs">
                            {reward.costFarmCoin > 0 && (
                              <span className="flex items-center gap-1 text-amber-700">
                                <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                                {reward.costFarmCoin} Xu
                              </span>
                            )}
                            {reward.costLoyaltyPoints > 0 && (
                              <span className="flex items-center gap-0.5 text-emerald-700">
                                <Sparkles className="w-3 h-3 text-emerald-500" />
                                {reward.costLoyaltyPoints} Điểm
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenTerms(reward)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Xem điều kiện sử dụng"
                          >
                            <Info className="w-3.5 h-3.5 text-amber-700" />
                            <span>Điều kiện</span>
                          </button>

                          <button
                            onClick={() => handleRedeem(reward)}
                            disabled={!canRedeem}
                            className={`px-3 py-1.5 rounded-xl font-serif text-xs font-black shadow-xs transition-all flex items-center gap-1 ${
                              canRedeem
                                ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white cursor-pointer active:scale-95'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                            }`}
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>Đổi ngay</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: EXCHANGE COINS TO POINTS */}
          {activeTab === 'EXCHANGE' && (
            <div className="p-2.5 sm:p-4 overflow-y-auto min-h-0 flex-1 bg-[#faf5eb] flex flex-col justify-start max-w-xl mx-auto w-full space-y-2.5 sm:space-y-3">
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border-2 border-[#e0c598] shadow-xs text-center space-y-1.5">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 mx-auto flex items-center justify-center text-white shadow-xs">
                  <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <h3 className="font-serif font-black text-xs sm:text-sm text-[#422006]">
                  QUY ĐỔI XU NÔNG TRẠI SANG ĐIỂM AVORA
                </h3>
                <p className="text-[10.5px] sm:text-xs text-[#795548] leading-relaxed max-w-lg mx-auto">
                  Tỷ lệ quy đổi: <strong className="text-amber-800 font-bold">{coinPerPoint} Xu = 1 Điểm Loyalty AVORA</strong>.
                  Dùng để trừ tiền trực tiếp trên hóa đơn nhà hàng hoặc tích luỹ thăng hạng Bạc, Vàng, Kim Cương!
                </p>

                {/* Live Realtime Stats Bar */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1.5 border-t border-amber-100 text-[10px] sm:text-xs">
                  <div className="p-1.5 rounded-lg bg-amber-50/70 border border-amber-200/60">
                    <span className="text-[9px] text-stone-500 font-bold uppercase block">Số dư Xu</span>
                    <span className="font-mono font-black text-amber-800 text-xs sm:text-sm">
                      {formatCompactNumber(exchangeConfig?.farmCoins ?? userCoin)} Xu
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60">
                    <span className="text-[9px] text-stone-500 font-bold uppercase block">Điểm AVORA</span>
                    <span className="font-mono font-black text-emerald-800 text-xs sm:text-sm">
                      {formatCompactNumber(exchangeConfig?.avoraPoints ?? userPoints)} Điểm
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-stone-50 border border-stone-200">
                    <span className="text-[9px] text-stone-500 font-bold uppercase block truncate">Đổi hôm nay</span>
                    <span className="font-mono font-black text-stone-800 text-xs sm:text-sm">
                      {formatCompactNumber(exchangeConfig?.availableExchangeCoins ?? 0)} Xu
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Select Presets (Dynamically calculated based on coinPerPoint) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#5d4037] flex items-center justify-between">
                  <span>Chọn nhanh số Xu muốn đổi:</span>
                  <span className="font-mono text-amber-800">
                    Số dư: {(exchangeConfig?.farmCoins ?? userCoin).toLocaleString('vi-VN')} Xu
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[100, 200, 500, 1000].map((preset) => {
                    const dynamicGain = Math.floor(preset / coinPerPoint);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setExchangeCoins(preset)}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer text-center ${
                          exchangeCoins === preset
                            ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                            : 'bg-white text-[#5d4037] border-[#e0c598] hover:bg-amber-50'
                        }`}
                      >
                        <div>{preset.toLocaleString('vi-VN')} Xu</div>
                        <div className="text-[10px] opacity-80 mt-0.5">+{dynamicGain} Điểm</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Input */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#ebd8be] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Tùy chỉnh số Xu đổi:</span>
                  <button
                    type="button"
                    onClick={() => setExchangeCoins(exchangeConfig?.farmCoins ?? userCoin)}
                    className="text-[11px] font-bold text-amber-700 hover:underline cursor-pointer"
                  >
                    Đổi tối đa ({(exchangeConfig?.farmCoins ?? userCoin).toLocaleString('vi-VN')} Xu)
                  </button>
                </div>
                <input
                  type="number"
                  min={exchangeConfig?.minCoins || 100}
                  step={exchangeConfig?.coinPerPoint || 1}
                  value={exchangeCoins}
                  onChange={(e) => setExchangeCoins(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-[#faf5eb] border border-[#d7ccc8] font-mono text-base font-bold text-[#3e2723] focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Live Preview Result */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Bạn sẽ nhận được:</p>
                    <p className="font-serif font-black text-sm text-emerald-800">
                      +{estimatedPoints.toLocaleString('vi-VN')} Điểm AVORA Loyalty
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExchange}
                  disabled={
                    isExchanging ||
                    exchangeCoins <= 0 ||
                    (exchangeConfig?.farmCoins ?? userCoin) < exchangeCoins ||
                    (exchangeConfig ? exchangeCoins < exchangeConfig.minCoins : false)
                  }
                  className={`px-5 py-2.5 rounded-xl font-serif text-xs font-black shadow-md transition-all cursor-pointer ${
                    (exchangeConfig?.farmCoins ?? userCoin) >= exchangeCoins && exchangeCoins > 0
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white active:scale-95'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isExchanging ? 'Đang quy đổi...' : '⚡ Xác nhận Quy Đổi'}
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: MY VOUCHERS WALLET */}
          {activeTab === 'MY_WALLET' && (
            <div className="p-2 sm:p-4 overflow-y-auto min-h-0 flex-1 bg-[#faf5eb] space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between bg-amber-100/70 border border-amber-300/60 rounded-xl px-2.5 py-1 text-[11px] sm:text-xs text-[#5d4037]">
                <span className="font-bold flex items-center gap-1.5 truncate">
                  <Store className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  Xuất trình mã hoặc quét mã QR dưới đây khi thanh toán tại nhà hàng AVORA
                </span>
                <span className="font-mono text-[10px] sm:text-[11px] font-bold text-gray-600 whitespace-nowrap shrink-0 ml-2">
                  Tổng: {myVouchers.length} voucher
                </span>
              </div>

              {loadingVouchers ? (
                <div className="py-8 text-center text-xs font-bold text-gray-500">
                  Đang tải ví voucher của bạn...
                </div>
              ) : myVouchers.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-100 mx-auto flex items-center justify-center text-amber-700">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-600">Bạn chưa có voucher nào trong ví!</p>
                  <p className="text-[11px] text-gray-400">Hãy dùng Xu nông trại đổi các voucher hấp dẫn tại tab &quot;Voucher Nhà Hàng&quot;.</p>
                  <button
                    onClick={() => setActiveTab('VOUCHERS')}
                    className="px-3 py-1 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-xs hover:bg-amber-700 transition cursor-pointer"
                  >
                    Khám phá voucher ngay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3.5">
                  {myVouchers.map((v) => {
                    const isCopied = copiedCode === v.code;
                    return (
                      <div
                        key={v.id}
                        className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white border-2 border-[#e0c598] shadow-xs flex flex-col justify-between relative overflow-hidden"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wide ${
                                v.isUsed
                                  ? 'bg-gray-100 text-gray-500'
                                  : v.isExpired
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {v.isUsed ? 'Đã sử dụng' : v.isExpired ? 'Hết hạn' : 'Có hiệu lực'}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono">
                              HSD: {new Date(v.endDate).toLocaleDateString('vi-VN')}
                            </span>
                          </div>

                          <h4 className="font-serif font-black text-xs sm:text-sm text-[#422006] leading-tight">{v.title}</h4>
                          <p className="text-[10px] sm:text-[11px] text-[#795548] mt-0.5 line-clamp-1">{v.description}</p>
                        </div>

                        {/* Barcode & Code Ticket Box */}
                        <div className="mt-2 p-2 rounded-lg sm:rounded-xl bg-[#faf5eb] border border-[#ebd8be] flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="p-1 rounded-md bg-white border border-gray-300 text-gray-800 shrink-0">
                              <QrCode className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[8px] text-gray-400 font-bold uppercase leading-none">Mã ưu đãi</p>
                              <p className="font-mono font-black text-xs sm:text-sm text-rose-800 tracking-wider truncate">
                                {v.code}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenTerms(v)}
                              className="p-1 sm:p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition cursor-pointer"
                              title="Điều kiện sử dụng"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyCode(v.code)}
                              className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                              }`}
                            >
                              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      {/* Voucher Terms Sub-Modal */}
      <VoucherTermsModal
        voucher={selectedTermsVoucher}
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </>
  );
}
