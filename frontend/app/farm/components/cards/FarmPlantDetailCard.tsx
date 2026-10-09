'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Trophy,
  Package,
  Store,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import PlantSprite from '../common/PlantSprite';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import { farmSound } from '../../game/services/FarmSoundManager';

export interface PlantDetailData {
  cropId: string;
  cropCode: string;
  cropName: string;
  mutationId?: string | null;
  mutationCode?: string | null;
  mutationName?: string | null;
  isMutation: boolean;
  rarity: string;
  description: string;
  imageUrl?: string | null;
  growDurationSeconds?: number;
  growDurationLabel?: string;
  effectiveSellPrice?: number;
  harvestCount?: number;
  inventoryQuantity?: number;
  isUnlocked: boolean;
  mutationChance?: number | null;
  unlockLevel?: number;
}

export interface FarmPlantDetailCardProps {
  data?: PlantDetailData;
  cropCode?: string;
  mutationCode?: string;
  mode?: 'ALBUM' | 'MODAL';
  userLevel?: number;
  onClose?: () => void;
  onNavigateToShop?: (seedCode: string) => void;
  className?: string;
}

const RARITY_LABELS: Record<string, { label: string; color: string; border: string; bg: string }> = {
  COMMON: { label: 'Phổ Thông', color: 'text-stone-700', border: 'border-stone-300', bg: 'bg-stone-100' },
  UNCOMMON: { label: 'Hiếm Nhẹ', color: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-50' },
  RARE: { label: 'Quý Hiếm', color: 'text-blue-700', border: 'border-blue-300', bg: 'bg-blue-50' },
  EPIC: { label: 'Sử Thi', color: 'text-purple-700', border: 'border-purple-300', bg: 'bg-purple-50' },
  LEGENDARY: { label: 'Huyền Thoại', color: 'text-amber-700', border: 'border-amber-400', bg: 'bg-amber-50' },
};

export default function FarmPlantDetailCard({
  data: propData,
  cropCode,
  mutationCode,
  mode = 'ALBUM',
  userLevel = 1,
  onClose,
  onNavigateToShop,
  className = '',
}: FarmPlantDetailCardProps) {
  const [detailData, setDetailData] = useState<PlantDetailData | null>(propData || null);
  const [isLoading, setIsLoading] = useState<boolean>(!propData && Boolean(cropCode));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cập nhật khi propData thay đổi
  useEffect(() => {
    if (propData) {
      setDetailData(propData);
      setIsLoading(false);
      setErrorMsg(null);
    }
  }, [propData]);

  // Nếu không có propData nhưng có cropCode -> Tải trực tiếp từ API backend
  useEffect(() => {
    if (propData || !cropCode) return;

    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const queryParams = new URLSearchParams({ cropCode });
        if (mutationCode) queryParams.set('mutationCode', mutationCode);

        const res = await fetch(`/api/farm/plant-detail?${queryParams.toString()}`, {
          credentials: 'include',
        });
        const json = await res.json();

        if (!isMounted) return;

        if (res.ok && json.success && json.data) {
          setDetailData(json.data);
        } else {
          setErrorMsg(json.message || 'Không thể tải thông tin chi tiết cây trồng');
        }
      } catch (err) {
        if (isMounted) setErrorMsg('Lỗi kết nối khi tải chi tiết cây trồng');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [cropCode, mutationCode, propData]);

  if (isLoading) {
    return (
      <div className="w-full max-w-none bg-[#fffdfa] rounded-2xl border-2 border-[#d4af37] p-8 flex flex-col items-center justify-center min-h-[300px] text-stone-600">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-3" />
        <span className="text-sm font-bold">Đang tải dữ liệu thực tế từ nông trại...</span>
      </div>
    );
  }

  if (errorMsg || !detailData) {
    return (
      <div className="w-full max-w-none bg-[#fffdfa] rounded-2xl border-2 border-rose-300 p-6 flex flex-col items-center justify-center text-rose-800">
        <ShieldAlert className="w-8 h-8 text-rose-500 mb-2" />
        <span className="text-sm font-bold">{errorMsg || 'Chưa có dữ liệu'}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        )}
      </div>
    );
  }

  const {
    cropName,
    cropCode: resolvedCropCode,
    isMutation,
    mutationName,
    mutationCode: resolvedMutationCode,
    rarity = 'COMMON',
    description,
    growDurationLabel,
    effectiveSellPrice,
    harvestCount,
    inventoryQuantity,
    isUnlocked,
    mutationChance,
    unlockLevel = 1,
  } = detailData;

  const rarityMeta = RARITY_LABELS[rarity] || RARITY_LABELS.COMMON;
  const displayName = isMutation
    ? isUnlocked
      ? mutationName || cropName
      : '??? Biến Thể Bí Ẩn'
    : cropName;

  const displayDescription = isUnlocked
    ? description || (isMutation ? 'Biến thể đột biến quý hiếm của nông trại AVORA.' : 'Cây trồng nông trại AVORA.')
    : isMutation
    ? `Biến thể đột biến bí ẩn của ${cropName}. Có cơ hội xuất hiện ngẫu nhiên khi gieo trồng và chăm sóc nông trại.`
    : `Mở khóa khi nông trại đạt Cấp ${unlockLevel}.`;

  const normalizedSpriteCode = resolvedCropCode?.replace('_SEED', '').toLowerCase();

  return (
    <div
      className={`w-full max-w-none bg-[#fffdfa] rounded-2xl sm:rounded-3xl border-2 border-[#d4af37] shadow-xl overflow-hidden flex flex-col text-[#3e2723] animate-in fade-in duration-200 ${className}`}
    >
      {/* 1. Header Bar: Tiên cảnh Á Đông với huy hiệu phân loại */}
      <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-gradient-to-r from-[#3e240c] via-[#654316] to-[#3e240c] text-white flex items-center justify-between border-b border-[#e0a93b]/60 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#ffd54f] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            {isMutation ? '✦ Biến Thể Đột Biến' : '✦ Cây Trồng Gốc'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${rarityMeta.bg} ${rarityMeta.color} ${rarityMeta.border}`}
          >
            {rarityMeta.label}
          </span>
          {isMutation && mutationChance !== undefined && mutationChance !== null && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900/60 text-purple-200 border border-purple-400/40">
              Tỷ lệ: {Math.round(mutationChance * 100)}%
            </span>
          )}
        </div>

        {onClose && (
          <button
            onClick={() => {
              farmSound.playTap();
              onClose();
            }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
            title="Đóng chi tiết"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* 2. Main Content Body: Bố cục rộng Full Width (Desktop 2 cột cân xứng, Mobile 1 cột dọc) */}
      <div className="p-4 sm:p-6 lg:p-7 flex flex-col lg:grid lg:grid-cols-12 gap-5 sm:gap-6 w-full">
        {/* CỘT TRÁI (Artwork Stage / Silhouette) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[240px] aspect-square rounded-2xl sm:rounded-3xl bg-gradient-to-b from-amber-100/70 via-orange-50/40 to-amber-100/60 border-2 border-[#e5d4be] flex items-center justify-center p-4 shadow-inner overflow-hidden">
            {/* Vầng hào quang nhẹ */}
            <div className="absolute inset-0 bg-radial from-amber-400/10 via-transparent to-transparent pointer-events-none" />

            {isUnlocked ? (
              <div className="w-full h-full relative flex items-center justify-center drop-shadow-md">
                <PlantSprite
                  cropCode={normalizedSpriteCode}
                  stage={5}
                  mutationCode={isMutation ? resolvedMutationCode || undefined : undefined}
                  isMutated={isMutation}
                  alt={displayName}
                />
              </div>
            ) : (
              <div className="w-full h-full rounded-2xl bg-gradient-to-br from-stone-800 to-stone-950 flex flex-col items-center justify-center text-white/50 relative shadow-inner">
                <span className="text-5xl font-black text-amber-500/40 select-none">?</span>
                <div className="absolute bottom-2 flex items-center gap-1 text-[11px] font-bold text-amber-400/70 bg-black/40 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Chưa mở khóa</span>
                </div>
              </div>
            )}
          </div>

          {/* Badge trạng thái sở hữu */}
          <div className="mt-3 flex items-center gap-2">
            {isUnlocked ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Đã mở khóa bách khoa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 text-stone-700 border border-stone-300 font-bold text-xs">
                <Lock className="w-3.5 h-3.5 text-stone-600" />
                Chưa mở khóa
              </span>
            )}
          </div>
        </div>

        {/* CỘT PHẢI (Thông tin, 4 Chỉ số Database thật, Nút Hành Động) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
          {/* Header Title & Mô Tả */}
          <div className="space-y-1">
            <h2 className="font-extrabold text-xl sm:text-2xl font-serif text-[#2d1b08] leading-tight">
              {displayName}
            </h2>

            {isMutation && (
              <p className="text-xs sm:text-sm text-amber-900 font-semibold flex items-center gap-1">
                <span>Cây gốc:</span>
                <strong className="text-[#3e2723] font-bold">{cropName}</strong>
              </p>
            )}

            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed pt-1">
              {displayDescription}
            </p>
          </div>

          {/* BẢNG 4 CHỈ SỐ DATABASE CHUẨN XÁC (Sinh trưởng - Giá bán - Đã thu hoạch - Trong kho) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full pt-2">
            {/* 1. Sinh Trưởng */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-[#faf5eb] border border-[#e5d4be] shadow-xs flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Sinh trưởng</span>
              </span>
              <span className="text-sm sm:text-base font-black text-stone-900 mt-1 truncate">
                {growDurationLabel ?? 'Chưa có dữ liệu'}
              </span>
            </div>

            {/* 2. Giá Bán */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-[#faf5eb] border border-[#e5d4be] shadow-xs flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold flex items-center gap-1">
                <AvoraCoinIcon size="xs" className="w-3.5 h-3.5 shrink-0" />
                <span>Giá bán</span>
              </span>
              <span className="text-sm sm:text-base font-black text-[#991b1b] mt-1 flex items-center gap-1 truncate">
                {effectiveSellPrice !== undefined && effectiveSellPrice !== null ? (
                  <>
                    <span>{effectiveSellPrice.toLocaleString('vi-VN')}</span>
                    <AvoraCoinIcon size="xs" className="w-3.5 h-3.5 shrink-0" />
                  </>
                ) : (
                  'Chưa có dữ liệu'
                )}
              </span>
            </div>

            {/* 3. Đã Thu Hoạch */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-[#faf5eb] border border-[#e5d4be] shadow-xs flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Đã thu</span>
              </span>
              <span className="text-sm sm:text-base font-black text-stone-900 mt-1 truncate">
                {harvestCount !== undefined && harvestCount !== null ? (
                  `${harvestCount} lần`
                ) : (
                  'Chưa có dữ liệu'
                )}
              </span>
            </div>

            {/* 4. Trong Kho */}
            <div className="p-2.5 sm:p-3 rounded-2xl bg-[#faf5eb] border border-[#e5d4be] shadow-xs flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Trong kho</span>
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-800 mt-1 truncate">
                {inventoryQuantity !== undefined && inventoryQuantity !== null ? (
                  `${inventoryQuantity} cái`
                ) : (
                  'Chưa có dữ liệu'
                )}
              </span>
            </div>
          </div>

          {/* VÙNG HÀNH ĐỘNG / ĐIỀU HƯỚNG CỬA HÀNG */}
          <div className="pt-2 w-full">
            {!isUnlocked ? (
              userLevel >= unlockLevel ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/90 border border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
                  <div className="flex flex-col text-center sm:text-left">
                    <span className="font-bold text-xs sm:text-sm text-amber-900">
                      Đã đạt cấp độ mở khóa (Cấp {userLevel})!
                    </span>
                    <span className="text-[11px] sm:text-xs text-amber-800">
                      Gieo trồng hạt giống <strong>{cropName}</strong> để khám phá nông sản này.
                    </span>
                  </div>

                  {onNavigateToShop && (
                    <button
                      onClick={() => {
                        farmSound.playTap();
                        onNavigateToShop(resolvedCropCode);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-900 font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                    >
                      <Store className="w-4 h-4" />
                      <span>MUA HẠT NGAY</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-100 border border-stone-300 flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                    <span className="text-xs sm:text-sm text-stone-700 font-bold">
                      Cần đạt Cấp độ {unlockLevel} để mở khóa gieo trồng (Hiện tại: Cấp {userLevel})
                    </span>
                  </div>
                </div>
              )
            ) : (
              onNavigateToShop && (
                <div className="flex justify-end w-full">
                  <button
                    onClick={() => {
                      farmSound.playTap();
                      onNavigateToShop(resolvedCropCode);
                    }}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-105 text-white font-black text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    <Store className="w-4 h-4" />
                    <span>MUA THÊM HẠT GIỐNG ({cropName})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
