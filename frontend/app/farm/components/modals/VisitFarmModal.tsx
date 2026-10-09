'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Droplets,
  Hand,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Sparkles,
  Lock,
  Sprout,
  RefreshCw,
} from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import Image from 'next/image';
import PlantSprite from '../common/PlantSprite';
import toast from 'react-hot-toast';

interface VisitFarmModalProps {
  isOpen: boolean;
  friendUserId: string | null;
  onClose: () => void;
  onWaterFriend: (friendUserId: string, plotIndex: number) => Promise<any> | void;
  onGatherFriend: (friendUserId: string, plotIndex: number) => Promise<any> | void;
  onAddFriend?: (friendUserId: string) => Promise<void> | void;
  limits?: {
    strangerMax: number;
    strangerUsed: number;
    strangerRemaining: number;
    friendMax: number;
    friendUsed: number;
    friendRemaining: number;
  };
}

const CROP_STAGE_MAP: Record<string, string> = {
  JAPANESE_RICE: '/game/farm/crops/rice',
  STRAWBERRY: '/game/farm/crops/strawberry',
  GRAPE: '/game/farm/crops/grape',
  MATCHA: '/game/farm/crops/matcha',
  MATCHA_LEAF: '/game/farm/crops/matcha',
  SAKURA: '/game/farm/crops/sakura',
  SAKURA_PEARL: '/game/farm/crops/sakura',
  YUZU: '/game/farm/crops/yuzu',
};

export default function VisitFarmModal({
  isOpen,
  friendUserId,
  onClose,
  onWaterFriend,
  onGatherFriend,
  onAddFriend,
  limits,
}: VisitFarmModalProps) {
  const [farmData, setFarmData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [addingFriend, setAddingFriend] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && friendUserId) {
      loadFriendFarm();
    }
  }, [isOpen, friendUserId]);

  const loadFriendFarm = async () => {
    if (!friendUserId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/farm/friends/${friendUserId}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setFarmData(json.data);
      } else {
        toast.error('Không thể tải dữ liệu trang trại của người chơi này');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi ghé thăm trang trại');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !friendUserId) return null;

  const handleWaterClick = async (plotIndex: number) => {
    try {
      setActionInProgress(plotIndex);
      farmSound.playWater();
      const res: any = await onWaterFriend(friendUserId, plotIndex);
      // Update local plot state to watered
      setFarmData((prev: any) => {
        if (!prev) return prev;
        const newPlots = prev.plots.map((p: any) => {
          if (p.plotIndex === plotIndex) {
            return { ...p, waterLevel: 100, needWater: false };
          }
          return p;
        });
        return { ...prev, plots: newPlots };
      });
      toast.success(res?.message || 'Đã tưới nước giúp bạn thành công (+15 Xu, +10 EXP)!');
    } catch (e: any) {
      toast.error(e?.message || 'Không thể tưới nước giúp');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleGatherClick = async (plotIndex: number) => {
    try {
      setActionInProgress(plotIndex);
      farmSound.playHarvest();
      const res: any = await onGatherFriend(friendUserId, plotIndex);
      // Update local plot state
      setFarmData((prev: any) => {
        if (!prev) return prev;
        const newPlots = prev.plots.map((p: any) => {
          if (p.plotIndex === plotIndex) {
            return { ...p, canGather: false };
          }
          return p;
        });
        return { ...prev, plots: newPlots };
      });
      toast.success(res?.message || 'Đã hái trộm thành công 1 nông sản!');
    } catch (e: any) {
      toast.error(e?.message || 'Không thể hái trộm cây này');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAddFriendClick = async () => {
    if (!onAddFriend || addingFriend) return;
    try {
      setAddingFriend(true);
      farmSound.playReward();
      await onAddFriend(friendUserId);
      setFarmData((prev: any) => (prev ? { ...prev, relation: 'PENDING_SENT' } : prev));
    } finally {
      setAddingFriend(false);
    }
  };

  const isFriend = farmData?.isFriend ?? false;
  const isPendingSent = farmData?.relation === 'PENDING_SENT';

  return (
    <div
      className="fixed inset-0 z-[9992] flex flex-col w-screen h-screen bg-[#fffdf7] text-stone-900 font-sans overflow-hidden animate-in fade-in duration-200 select-none"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#3e210b] via-[#653a12] to-[#3e210b] px-3 sm:px-6 py-2 sm:py-3 text-white flex items-center justify-between border-b border-[#d4af37]/60 shrink-0 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="px-2 sm:px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition cursor-pointer"
          >
            ← Trở về
          </button>
          {/* Avatar */}
          <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl overflow-hidden ring-2 ring-amber-400 bg-[#5d4037] shrink-0">
              {farmData?.user?.avatarUrl ? (
                <img
                  src={farmData.user.avatarUrl}
                  alt={farmData.user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-serif font-black text-amber-200">
                  {(farmData?.user?.fullName || 'U')[0]}
                </div>
              )}
              <div className="absolute bottom-0 right-0 px-1 py-0.2 rounded-tl bg-amber-600 text-white font-black text-[9px]">
                {farmData?.level || 1}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-black text-xs sm:text-base text-amber-100 tracking-wide">
                  {farmData?.user?.fullName || 'Đang tải nông trại...'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isFriend
                      ? 'bg-emerald-600 text-white border border-emerald-400'
                      : 'bg-amber-600 text-white border border-amber-400'
                  }`}
                >
                  {isFriend ? 'Bạn Bè' : 'Người Lạ'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-amber-300/80 flex items-center gap-2">
                <span>Cây thần Lv.{farmData?.treeLevel || 1}</span>
                {farmData?.user?.memberCode && (
                  <span className="font-mono text-gray-300">#{farmData.user.memberCode}</span>
                )}
              </p>
            </div>
          </div>

          {/* Steal limits & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Limit Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-amber-500/40 text-[11px] font-mono">
              <span className="text-gray-300">Lượt trộm {isFriend ? 'bạn bè' : 'người lạ'}:</span>
              <span className="text-emerald-300 font-bold">
                {isFriend
                  ? `${limits?.friendUsed ?? 0}/${limits?.friendMax ?? 10}`
                  : `${limits?.strangerUsed ?? 0}/${limits?.strangerMax ?? 3}`}
              </span>
            </div>

            {!isFriend && onAddFriend && (
              <button
                onClick={handleAddFriendClick}
                disabled={addingFriend || isPendingSent}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer ${
                  isPendingSent
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-default'
                    : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isPendingSent ? 'Chờ đồng ý' : 'Kết bạn'}</span>
              </button>
            )}

            <button
              onClick={loadFriendFarm}
              className="p-1.5 rounded-xl bg-black/30 hover:bg-black/50 text-white transition cursor-pointer"
              title="Làm mới trang trại"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto min-h-0 flex-1 bg-[#2c1d11] bg-[radial-gradient(#3e2717_1px,transparent_1px)] [background-size:16px_16px]">
          {loading ? (
            <div className="py-24 text-center text-amber-200 text-xs font-bold flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Đang mở cổng vào nông trại bạn bè...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Instructions Bar */}
              <div className="bg-[#422917]/90 border border-amber-500/40 rounded-2xl px-4 py-2 text-amber-200 text-xs flex items-center justify-between shadow-inner">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Bạn có thể <strong>tưới nước giúp</strong> để nhận Xu & EXP, hoặc{' '}
                    <strong>hái trộm nông sản đã chín</strong> (ngoài thời gian 15 phút bảo vệ)!
                  </span>
                </span>
              </div>

              {/* 5x5 Garden Plots Grid */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-3xl mx-auto">
                {farmData?.plots?.map((plot: any) => {
                  const isLocked = plot.status === 'LOCKED';
                  const isEmpty = plot.status === 'EMPTY';
                  const hasCrop = !!plot.cropInstance;
                  const isReady = plot.isReady;
                  const isProtected = plot.isProtected;
                  const canGather = plot.canGather;
                  const needWater = plot.needWater;
                  const isBusy = actionInProgress === plot.plotIndex;

                  const cropCode = plot.cropInstance?.crop?.code || 'JAPANESE_RICE';
                  const cropName = plot.cropInstance?.cropNameSnapshot || plot.cropInstance?.crop?.name;
                  const basePath = CROP_STAGE_MAP[cropCode] || '/game/farm/crops/rice';
                  const stageImg = `${basePath}/stage_${isReady ? 5 : 3}.png`;

                  return (
                    <div
                      key={plot.id || plot.plotIndex}
                      className={`relative aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-between p-1 sm:p-2 overflow-hidden ${
                        isLocked
                          ? 'bg-[#1e130a] border-[#3e2717] opacity-60'
                          : isEmpty
                          ? 'bg-[#4a2e18] border-[#653e20] shadow-inner'
                          : isReady
                          ? 'bg-gradient-to-b from-[#4a2e18] to-[#5a381e] border-amber-400 shadow-[0_0_12px_rgba(255,200,50,0.3)]'
                          : 'bg-[#4a2e18] border-[#7d4e28]'
                      }`}
                    >
                      {/* Plot Index Label */}
                      <span className="absolute top-1 left-1.5 text-[8px] font-mono text-amber-400/40">
                        #{plot.plotIndex + 1}
                      </span>

                      {/* Content inside plot */}
                      {isLocked ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-amber-600/60">
                          <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                      ) : isEmpty ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-amber-700/40">
                          <Sprout className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                      ) : (
                        <>
                          {/* Plant Sprite with Hover scale */}
                          <div className="relative w-8 h-8 sm:w-14 sm:h-14 my-auto flex items-center justify-center">
                            <PlantSprite
                              cropCode={cropCode}
                              stage={isReady ? 5 : 3}
                              isMutated={plot.cropInstance?.isMutated}
                              mutationCode={plot.cropInstance?.mutation?.code}
                              alt={cropName || 'Cây'}
                            />
                            {isReady && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                            )}
                          </div>

                          {/* Crop Name */}
                          <span className="text-[8px] sm:text-[10px] font-serif font-black text-amber-100 truncate max-w-full text-center">
                            {cropName}
                          </span>

                          {/* Status / Action buttons */}
                          <div className="w-full mt-0.5">
                            {canGather ? (
                              <button
                                onClick={() => handleGatherClick(plot.plotIndex)}
                                disabled={isBusy}
                                className="w-full py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-0.5 shadow-md animate-bounce cursor-pointer"
                              >
                                <Hand className="w-2.5 h-2.5" />
                                <span>Trộm</span>
                              </button>
                            ) : isProtected ? (
                              <div
                                className="w-full py-0.5 rounded-md bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[8px] sm:text-[9px] font-bold text-center flex items-center justify-center gap-0.5"
                                title="Đang trong thời gian bảo vệ của chủ trại"
                              >
                                <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                                <span>{Math.ceil(plot.protectionRemainingSec / 60)}p</span>
                              </div>
                            ) : needWater ? (
                              <button
                                onClick={() => handleWaterClick(plot.plotIndex)}
                                disabled={isBusy}
                                className="w-full py-0.5 sm:py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[9px] sm:text-[10px] flex items-center justify-center gap-0.5 shadow-xs cursor-pointer"
                              >
                                <Droplets className="w-2.5 h-2.5" />
                                <span>Tưới</span>
                              </button>
                            ) : isReady ? (
                              <div className="w-full py-0.5 rounded-md bg-black/40 text-gray-400 text-[8px] sm:text-[9px] text-center font-bold">
                                Đã trộm
                              </div>
                            ) : (
                              <div className="w-full flex items-center justify-center gap-1 text-[8px] sm:text-[9px] text-amber-300/70 font-mono">
                                <Droplets className="w-2 h-2 text-sky-400" />
                                <span>{plot.waterLevel}%</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
