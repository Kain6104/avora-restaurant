'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Clock,
  Check,
  Info,
  Package,
  ArrowRight,
  Sprout,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';

interface FarmMarketProps {
  shopCatalog: any;
  rewardsCatalog?: any;
  userCoin: number;
  userPoints?: number;
  userLevel?: number;
  inventory?: any[];
  targetItemCode?: string | null;
  isLoading?: boolean;
  onClose: () => void;
  onPurchaseSeed: (itemCode: string, quantity: number) => Promise<void> | void;
  onRedeemReward?: (rewardCode: string) => Promise<void> | void;
  onExchangeProduce?: (exchangeCode: string) => Promise<void> | void;
  onOpenSeedInfo?: (crop: any) => void;
}

const SEED_IMAGE_MAP: Record<string, string> = {
  JAPANESE_RICE: '/game/farm/crops/rice/stage_5.png',
  STRAWBERRY: '/game/farm/crops/strawberry/stage_5.png',
  GRAPE: '/game/farm/crops/grape/stage_5.png',
  MATCHA: '/game/farm/crops/matcha/stage_5.png',
  MATCHA_LEAF: '/game/farm/crops/matcha/stage_5.png',
  YUZU: '/game/farm/crops/yuzu/stage_5.png',
  PEACH: '/game/farm/crops/peach/stage_5.png',
  WASABI: '/game/farm/crops/wasabi/stage_5.png',
  SHISO: '/game/farm/crops/shiso/stage_5.png',
  CORN: '/game/farm/crops/corn/stage_5.png',
  SUNFLOWER: '/game/farm/crops/sunflower/stage_5.png',
  TOMATO: '/game/farm/crops/tomato/stage_5.png',
};

export default function FarmMarket({
  shopCatalog,
  userCoin = 0,
  userLevel = 1,
  inventory = [],
  targetItemCode,
  isLoading = false,
  onClose,
  onPurchaseSeed,
  onExchangeProduce,
  onOpenSeedInfo,
}: FarmMarketProps) {
  // 2 Primary Tabs: Cửa Hàng Xu vs Cửa Hàng Nông Sản
  const [mainTab, setMainTab] = useState<'COIN_SHOP' | 'PRODUCE_SHOP'>('COIN_SHOP');
  const [coinSubFilter, setCoinSubFilter] = useState<'ALL' | 'PACKS' | 'SEEDS' | 'FERTILIZERS'>('ALL');
  const [actionInProgressCode, setActionInProgressCode] = useState<string | null>(null);

  // Preview & Quantity Selection Dialogue
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [buyQuantity, setBuyQuantity] = useState<number>(1);

  const seeds = Array.isArray(shopCatalog?.seeds) ? shopCatalog.seeds : [];
  const fertilizers = Array.isArray(shopCatalog?.fertilizers) ? shopCatalog.fertilizers : [];
  const seedPacks = Array.isArray(shopCatalog?.seedPacks) ? shopCatalog.seedPacks : [];
  const produceExchanges = Array.isArray(shopCatalog?.produceExchanges) ? shopCatalog.produceExchanges : [];

  // Auto-focus target item if passed from Album / external trigger
  useEffect(() => {
    if (targetItemCode) {
      setMainTab('COIN_SHOP');
      setCoinSubFilter('SEEDS');
      const cleanTarget = targetItemCode.toUpperCase();
      const found = seeds.find(
        (s: any) =>
          s.code?.toUpperCase() === cleanTarget ||
          `${s.code}_SEED`?.toUpperCase() === cleanTarget ||
          s.code?.toUpperCase().replace('_SEED', '') === cleanTarget.replace('_SEED', ''),
      );
      if (found) {
        setPreviewItem({ ...found, itemCategory: 'SEED' });
        setBuyQuantity(1);
      }
    }
  }, [targetItemCode, seeds]);

  const handleOpenPreview = (item: any) => {
    farmSound.playTap();
    setPreviewItem(item);
    setBuyQuantity(1);
  };

  const handleConfirmBuy = async () => {
    if (!previewItem || actionInProgressCode) return;
    setActionInProgressCode(previewItem.code);
    farmSound.playCoin();
    try {
      await onPurchaseSeed(previewItem.code, buyQuantity);
      setPreviewItem(null);
    } finally {
      setActionInProgressCode(null);
    }
  };

  const handleExchange = async (exchangeCode: string) => {
    if (actionInProgressCode || !onExchangeProduce) return;
    setActionInProgressCode(exchangeCode);
    try {
      await onExchangeProduce(exchangeCode);
    } finally {
      setActionInProgressCode(null);
    }
  };

  // Filter items for Coin Shop
  const displayedCoinItems = [
    ...(coinSubFilter === 'ALL' || coinSubFilter === 'PACKS'
      ? seedPacks.map((p: any) => ({ ...p, itemCategory: 'PACK' }))
      : []),
    ...(coinSubFilter === 'ALL' || coinSubFilter === 'SEEDS'
      ? seeds.map((s: any) => ({ ...s, itemCategory: 'SEED' }))
      : []),
    ...(coinSubFilter === 'ALL' || coinSubFilter === 'FERTILIZERS'
      ? fertilizers.map((f: any) => ({ ...f, itemCategory: 'FERTILIZER' }))
      : []),
  ];

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

      {/* 1. TOP BAR: Title, Back Button, and Currency Indicator */}
      <header className="px-4 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-b from-[#fffefc] to-[#f8efe0] border-b-2 border-[#d4af37]/70 shadow-xs flex items-center justify-between shrink-0 text-[#5c3a10] relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                farmSound.playTap();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-100/80 hover:bg-amber-200 text-[#78350f] border border-[#d4af37]/60 text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-serif">Trở về Vườn</span>
            </button>

            <span className="text-[#d4af37]/60 hidden sm:inline">|</span>

            <h2 className="font-extrabold text-sm sm:text-base text-[#5c3a10] font-serif tracking-wide">
              CỬA HÀNG NÔNG NGHIỆP HOÀNG GIA
            </h2>
          </div>

          {/* User Currency Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 border border-[#d4af37]/60 shadow-inner">
              <AvoraCoinIcon size="sm" className="w-4 h-4" />
              <span className="font-mono font-black text-sm text-[#78350f]">
                {userCoin.toLocaleString('vi-VN')}
              </span>
            </div>

            <button
              onClick={() => {
                farmSound.playTap();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white border-2 border-[#fef08a] flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-xs"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </header>

      {/* 2. SUB-TABS: Cửa hàng xu nông trại vs Cửa hàng nông sản */}
      <div className="flex items-center justify-center gap-6 bg-[#faf2e3] border-b border-[#e6d0a7] px-4 py-2 shrink-0 relative z-10">
        <button
          onClick={() => {
            farmSound.playTap();
            setMainTab('COIN_SHOP');
          }}
          className={`relative py-1.5 px-4 font-serif text-sm sm:text-base font-bold transition-all cursor-pointer ${
            mainTab === 'COIN_SHOP'
              ? 'text-[#991b1b] font-black'
              : 'text-[#78350f] hover:text-[#451a03]'
          }`}
        >
          <span>✦ Cửa hàng xu nông trại ✦</span>
          {mainTab === 'COIN_SHOP' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#b91c1c] rounded-full" />
          )}
        </button>

        <span className="text-[#d4af37]/60">•</span>

        <button
          onClick={() => {
            farmSound.playTap();
            setMainTab('PRODUCE_SHOP');
          }}
          className={`relative py-1.5 px-4 font-serif text-sm sm:text-base font-bold transition-all cursor-pointer ${
            mainTab === 'PRODUCE_SHOP'
              ? 'text-[#991b1b] font-black'
              : 'text-[#78350f] hover:text-[#451a03]'
          }`}
        >
          <span>✦ Cửa hàng nông sản ✦</span>
          {mainTab === 'PRODUCE_SHOP' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#b91c1c] rounded-full" />
          )}
        </button>
      </div>

      {/* 3. BODY AREA: Showcase Banner & Grid List */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#faf4e8]">
        <div className="max-w-6xl mx-auto space-y-4">
          {mainTab === 'COIN_SHOP' ? (
            <>
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                {[
                  { id: 'ALL', label: 'Tất cả mặt hàng' },
                  { id: 'PACKS', label: '🎁 Gói hạt bí ẩn' },
                  { id: 'SEEDS', label: '🌱 Hạt giống' },
                  { id: 'FERTILIZERS', label: '⚡ Phân bón' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      farmSound.playTap();
                      setCoinSubFilter(tab.id as any);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      coinSubFilter === tab.id
                        ? 'bg-gradient-to-r from-[#e0a93b] to-[#c67d00] text-[#2c1810] font-black border-[#ffd54f] shadow-md'
                        : 'bg-[#f4e9d7] text-[#78350f] border-[#dfca9f] hover:bg-[#ebdcc4]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {displayedCoinItems.map((item) => {
                  const isPack = item.itemCategory === 'PACK';
                  const isSeed = item.itemCategory === 'SEED';
                  const isFert = item.itemCategory === 'FERTILIZER';

                  const price = item.price ?? item.seedPrice ?? 20;
                  const canAfford = userCoin >= price;
                  const isLevelLocked = isSeed && item.minFarmLevel && userLevel < item.minFarmLevel;

                  let iconUrl = isSeed
                    ? SEED_IMAGE_MAP[item.code] || '/game/farm/crops/rice/stage_5.png'
                    : '';
                  if (isFert) {
                    iconUrl =
                      item.code === 'FERTILIZER_MUTATION'
                        ? '/game/farm/items/fertilizer_mutation.png'
                        : '/game/farm/items/fertilizer_speed.png';
                  }

                  return (
                    <div
                      key={item.code}
                      onClick={() => !isLevelLocked && handleOpenPreview(item)}
                      className={`relative flex flex-col justify-between rounded-2xl bg-white border-2 p-3 transition-all cursor-pointer select-none group shadow-xs hover:scale-102 ${
                        isLevelLocked
                          ? 'border-[#e0cba0] bg-stone-100/70 opacity-70 cursor-not-allowed'
                          : 'border-[#dfca9f] hover:border-[#ffd54f]'
                      }`}
                    >
                      {/* Top Timer or Tag */}
                      <div className="flex items-center justify-between text-[10px] mb-2 text-stone-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>{item.timerTag || 'Vĩnh viễn'}</span>
                        </span>

                        {isSeed && onOpenSeedInfo && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSeedInfo(item);
                            }}
                            className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center text-[9px] font-bold"
                            title="Xem thông số hạt giống"
                          >
                            !
                          </button>
                        )}
                      </div>

                      {/* Artwork Box */}
                      <div className="w-full h-24 rounded-xl bg-amber-50/70 border border-amber-200/50 flex items-center justify-center p-2 mb-2 relative overflow-hidden">
                        {isPack ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg border border-purple-200">
                            <span className="text-3xl animate-pulse">🎁</span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-purple-800 mt-1">
                              Bí Ẩn
                            </span>
                          </div>
                        ) : (
                          <img
                            src={iconUrl}
                            alt={item.name}
                            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-200"
                            onError={(e: any) => {
                              e.currentTarget.src = '/game/farm/crops/rice/stage_5.png';
                            }}
                          />
                        )}

                        {isLevelLocked && (
                          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white text-[11px] font-black">
                            <span>Khóa</span>
                            <span className="text-amber-400">Lv.{item.minFarmLevel}</span>
                          </div>
                        )}
                      </div>

                      {/* Information */}
                      <div className="space-y-0.5">
                        <h4 className="font-serif font-black text-xs sm:text-sm text-[#4A2414] truncate">{item.name}</h4>
                        <p className="text-[11px] text-[#78350F] font-medium line-clamp-1">{item.description}</p>
                      </div>

                      {/* Purchase Button */}
                      <div className="mt-3">
                        <button
                          disabled={isLevelLocked || !canAfford}
                          className={`w-full py-1.5 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition shadow-xs ${
                            isLevelLocked
                              ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                              : canAfford
                              ? 'bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-900 active:scale-95'
                              : 'bg-stone-800 text-stone-400 cursor-not-allowed'
                          }`}
                        >
                          <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                          <span>{price.toLocaleString('vi-VN')} Xu</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Produce Exchange Section */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {produceExchanges.map((ex: any) => {
                const isProcessing = actionInProgressCode === ex.code;
                return (
                  <div
                    key={ex.code}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-white border-2 border-[#dfca9f] hover:border-[#d4af37] shadow-xs transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>{ex.timerTag || 'Vĩnh viễn'}</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">
                        {ex.limitText || 'Không giới hạn'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 p-2 shrink-0 flex items-center justify-center text-3xl">
                        🌾
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif font-black text-sm text-[#5c3a10] truncate">
                          {ex.name}
                        </h4>
                        <p className="text-[11px] text-stone-600 line-clamp-2 mt-0.5">
                          {ex.description}
                        </p>
                      </div>
                    </div>

                    {/* Exchange Button */}
                    <button
                      onClick={() => handleExchange(ex.code)}
                      disabled={isProcessing}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md disabled:opacity-50"
                    >
                      <span>🌾 ĐỔI ({ex.requiredCropQty}x {ex.requiredCropName})</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* 4. PREVIEW & BUY DIALOGUE MODAL                            */}
      {/* ========================================================= */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#fffdfa] border-2 sm:border-3 border-[#d4af37] shadow-2xl p-3 sm:p-4 flex flex-col text-[#3e2723] animate-in zoom-in-95 duration-200 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="w-full flex items-center justify-between pb-1.5 border-b border-stone-200 mb-2">
              <span className="font-serif font-extrabold text-xs sm:text-sm text-[#2d1b08] truncate">
                {previewItem.itemCategory === 'PACK' ? previewItem.name : `Mua ${previewItem.name}`}
              </span>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Side-by-side Artwork & Info */}
            <div className="flex items-center gap-3 py-1">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#faf5eb] border border-[#e5d4be] flex items-center justify-center p-1 shrink-0 shadow-inner">
                {previewItem.itemCategory === 'PACK' ? (
                  <span className="text-3xl sm:text-4xl">🎁</span>
                ) : (
                  <img
                    src={
                      SEED_IMAGE_MAP[previewItem.code] ||
                      '/game/farm/crops/rice/stage_5.png'
                    }
                    alt={previewItem.name}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col text-left space-y-0.5">
                <h3 className="font-extrabold text-xs sm:text-sm font-serif text-[#2d1b08] leading-tight truncate">
                  {previewItem.name}
                </h3>

                {/* Inventory Count Indicator */}
                {(() => {
                  const ownedCount =
                    inventory.find(
                      (i) =>
                        i.itemCode === previewItem.code ||
                        i.itemCode === `${previewItem.code}_SEED`,
                    )?.quantity || 0;
                  return (
                    <span className="text-[11px] text-stone-500 font-semibold">
                      Trong kho: <strong className="text-emerald-700">{ownedCount}</strong>
                    </span>
                  );
                })()}

                <p className="text-[10px] sm:text-[11px] text-stone-600 line-clamp-2 leading-tight">
                  {previewItem.description || 'Hạt giống chất lượng cao, sẵn sàng gieo trồng ngay.'}
                </p>
              </div>
            </div>

            {/* Stepper Quantity & Total Row */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 text-xs mt-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-stone-700 text-xs">SL:</span>
                <div className="flex items-center bg-stone-100 border border-stone-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setBuyQuantity((prev) => Math.max(1, prev - 1))}
                    className="w-7 h-7 flex items-center justify-center font-black hover:bg-stone-200 cursor-pointer text-xs"
                  >
                    –
                  </button>
                  <span className="w-8 text-center font-mono font-bold text-xs">
                    {buyQuantity}
                  </span>
                  <button
                    onClick={() => setBuyQuantity((prev) => prev + 1)}
                    className="w-7 h-7 flex items-center justify-center font-black hover:bg-stone-200 cursor-pointer text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total Price */}
              <div className="flex items-center gap-1 font-bold text-xs">
                <span className="text-stone-600">Tổng:</span>
                <span className="font-mono font-black text-sm text-amber-700 flex items-center gap-0.5">
                  <AvoraCoinIcon size="xs" className="w-3.5 h-3.5" />
                  {((previewItem.price ?? previewItem.seedPrice ?? 20) * buyQuantity).toLocaleString('vi-VN')} Xu
                </span>
              </div>
            </div>

            {/* Confirm Buy Button */}
            <button
              onClick={handleConfirmBuy}
              disabled={
                Boolean(actionInProgressCode) ||
                userCoin < (previewItem.price ?? previewItem.seedPrice ?? 20) * buyQuantity
              }
              className="w-full py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-900 font-black text-xs sm:text-sm shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 mt-2"
            >
              <Check className="w-4 h-4" />
              <span>{actionInProgressCode ? 'Đang mua...' : 'Xác nhận Mua'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
