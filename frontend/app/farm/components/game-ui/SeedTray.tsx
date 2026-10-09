'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sprout, Zap, Clock, Sparkles, X, ChevronRight, Gift, HelpCircle, Loader2 } from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import { farmEventBus } from '../../game/services/farmEventBus';
import PlantSprite from '../common/PlantSprite';

interface SeedTrayProps {
  isOpen: boolean;
  inventory: any[];
  plotIndex: number | null;
  validEmptyPlots?: number[];
  onPlant: (cropCode: string, targetPlotIndex?: number) => Promise<void>;
  onPlantMystery?: (targetPlotIndex: number, packCode: string) => Promise<void>;
  onClose: () => void;
  userEnergy: number;
  onOpenSeedInfo?: (crop: any) => void;
}

export default function SeedTray({
  isOpen,
  inventory,
  plotIndex,
  validEmptyPlots = [],
  onPlant,
  onPlantMystery,
  onClose,
  userEnergy,
  onOpenSeedInfo,
}: SeedTrayProps) {
  const [selectedCrop, setSelectedCrop] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag & Drop State
  const [draggingItem, setDraggingItem] = useState<any | null>(null);
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredPlotIndex, setHoveredPlotIndex] = useState<number | null>(null);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDragActive = useRef(false);

  if (!isOpen || plotIndex === null) return null;

  // Lọc lấy các loại hạt giống và Gói Hạt Giống Bí Ẩn có số lượng > 0
  const seedItems = inventory.filter(
    (item) =>
      (item.itemType === 'SEED' ||
        item.itemCode === 'MYSTERY_SEED_PACK' ||
        item.itemCode?.startsWith('SEED_PACK')) &&
      item.quantity > 0,
  );

  const handleQuickPlant = async (item: any) => {
    if (isSubmitting || userEnergy < 1 || plotIndex === null) return;
    setIsSubmitting(true);
    setSelectedCrop(item);
    farmSound.playPlant();
    try {
      const isMystery =
        item.itemCode === 'MYSTERY_SEED_PACK' ||
        item.itemCode?.startsWith('SEED_PACK');
      if (isMystery && onPlantMystery) {
        await onPlantMystery(plotIndex, item.itemCode);
      } else {
        await onPlant(item.itemCode, plotIndex);
      }
    } finally {
      setIsSubmitting(false);
      setSelectedCrop(null);
    }
  };

  // Pointer Down on Seed Card
  const handlePointerDown = (e: React.PointerEvent, item: any) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragActive.current = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartPos.current.x;
      const dy = moveEvent.clientY - dragStartPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 8 && !isDragActive.current) {
        isDragActive.current = true;
        setDraggingItem(item);
        farmSound.playTap();
        farmEventBus.emit('DRAG_PLANT_START', { validPlotIndexes: validEmptyPlots });
      }

      if (isDragActive.current) {
        setDragPointerPos({ x: moveEvent.clientX, y: moveEvent.clientY });

        // Tìm ô đất dưới con trỏ
        const scene = (window as any).__AVORA_FARM_SCENE;
        if (scene?.getPlotAtScreenPos) {
          const targetPlot = scene.getPlotAtScreenPos(moveEvent.clientX, moveEvent.clientY);
          setHoveredPlotIndex(targetPlot);
          if (targetPlot !== null) {
            const isValid = validEmptyPlots.includes(targetPlot);
            farmEventBus.emit('DRAG_PLANT_HOVER', { plotIndex: targetPlot, isValid });
          }
        }
      }
    };

    const onPointerUp = async (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (isDragActive.current) {
        isDragActive.current = false;
        farmEventBus.emit('DRAG_PLANT_END');

        const scene = (window as any).__AVORA_FARM_SCENE;
        const targetPlot = scene?.getPlotAtScreenPos
          ? scene.getPlotAtScreenPos(upEvent.clientX, upEvent.clientY)
          : null;

        setDraggingItem(null);
        setHoveredPlotIndex(null);

        if (targetPlot !== null && validEmptyPlots.includes(targetPlot) && !isSubmitting) {
          setIsSubmitting(true);
          farmSound.playPlant();
          try {
            const isMystery =
              item.itemCode === 'MYSTERY_SEED_PACK' || item.itemCode?.startsWith('SEED_PACK');
            if (isMystery && onPlantMystery) {
              await onPlantMystery(targetPlot, item.itemCode);
            } else {
              await onPlant(item.itemCode, targetPlot);
            }
            onClose();
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <>
      {/* Floating Dragged Item Element Follows Pointer */}
      {draggingItem && (
        <div
          className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-transform scale-110 shadow-2xl rounded-2xl bg-[#fffdfa]/95 border-2 border-[#d4af37] p-2 flex items-center gap-2 text-stone-800 animate-pulse"
          style={{ left: dragPointerPos.x, top: dragPointerPos.y }}
        >
          {draggingItem.itemCode === 'MYSTERY_SEED_PACK' ||
          draggingItem.itemCode?.startsWith('SEED_PACK') ? (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-xs">
              <Gift className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 relative flex items-center justify-center">
              <PlantSprite
                cropCode={draggingItem.itemCode.replace('_SEED', '')}
                stage={5}
                alt={draggingItem.itemName}
              />
            </div>
          )}
          <div className="flex flex-col pr-1">
            <span className="text-xs font-black text-[#3e2723]">{draggingItem.itemName}</span>
            <span className="text-[10px] text-emerald-700 font-bold">
              {hoveredPlotIndex !== null
                ? validEmptyPlots.includes(hoveredPlotIndex)
                  ? `Thả vào Ô #${hoveredPlotIndex + 1} để gieo`
                  : 'Ô đất này không thể gieo'
                : 'Kéo lên ô đất trống...'}
            </span>
          </div>
        </div>
      )}

      {/* Main Seed Tray Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex flex-col items-center pb-1.5 sm:pb-3 px-2 sm:px-6">
        <div
          className="pointer-events-auto w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-[#fffdfa]/96 backdrop-blur-xl border border-[#e0a93b]/80 shadow-[0_8px_30px_rgba(60,40,10,0.25)] p-2 sm:p-3.5 flex flex-col gap-1.5 sm:gap-2 animate-in slide-in-from-bottom-4 duration-200"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Tray */}
          <div className="flex items-center justify-between border-b border-[#e0a93b]/30 pb-1 sm:pb-1.5 px-1 text-[#3e2723]">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Sprout className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <span className="text-[11px] sm:text-xs font-extrabold font-serif">
                Khay Hạt Giống (Ô #{plotIndex + 1})
              </span>
              <span className="hidden sm:inline-flex text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-300 font-bold text-emerald-800">
                🌱 Chạm gieo ngay
              </span>
              <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 border border-amber-300 font-bold text-amber-800">
                ⚡ {userEnergy}/100
              </span>
            </div>

            <button
              onClick={() => {
                farmSound.playTap();
                setSelectedCrop(null);
                onClose();
              }}
              className="p-1 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Danh sách hạt giống (Game Item Cards) */}
          {seedItems.length === 0 ? (
            <div className="py-4 text-center text-xs text-stone-500 font-medium">
              Túi đồ của bạn đã hết hạt giống! Hãy ghé{' '}
              <span className="font-bold text-amber-700">Cửa Hàng</span> để mua thêm nhé.
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none"
              style={{ touchAction: 'pan-x' }}
            >
              {seedItems.map((item) => {
                const isSelected = selectedCrop?.id === item.id;
                const isMysteryPack =
                  item.itemCode === 'MYSTERY_SEED_PACK' ||
                  item.itemCode?.startsWith('SEED_PACK');
                const cropCode = item.itemCode.replace('_SEED', '');

                return (
                  <div
                    key={item.id}
                    onPointerDown={(e) => handlePointerDown(e, item)}
                    onClick={() => handleQuickPlant(item)}
                    className={`relative shrink-0 w-[72px] sm:w-26 p-1 sm:p-1.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex flex-col items-center text-center select-none active:scale-95 touch-none ${
                      isMysteryPack
                        ? isSelected
                          ? 'bg-gradient-to-b from-purple-100 to-pink-50 border-purple-500 shadow-[0_2px_12px_rgba(168,85,247,0.35)] scale-102 ring-1.5 ring-purple-400/50'
                          : 'bg-gradient-to-b from-purple-50/80 to-amber-50/50 border-purple-300/80 hover:border-purple-400'
                        : isSelected
                        ? 'bg-amber-50/90 border-[#d4af37] shadow-[0_2px_12px_rgba(212,175,55,0.35)] scale-102 ring-1.5 ring-amber-400/50'
                        : 'bg-[#faf7f2]/90 border-stone-200/90 hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    {/* Loading overlay when planting this seed */}
                    {isSubmitting && selectedCrop?.id === item.id && (
                      <div className="absolute inset-0 rounded-xl bg-white/75 backdrop-blur-xs flex items-center justify-center z-20">
                        <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                      </div>
                    )}

                    {/* Info Button for Seeds */}
                    {!isMysteryPack && onOpenSeedInfo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSeedInfo({ code: item.itemCode, name: item.itemName });
                        }}
                        className="absolute top-0.5 left-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-white/95 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center cursor-pointer shadow-xs text-[7px] sm:text-[8px] font-black"
                        title="Xem chi tiết thông số hạt giống"
                      >
                        !
                      </button>
                    )}

                    {/* Quantity Badge */}
                    <span
                      className={`absolute top-0.5 right-0.5 px-1 py-0.1 rounded-full text-white text-[7.5px] sm:text-[8.5px] font-black shadow-xs ${
                        isMysteryPack ? 'bg-purple-700' : 'bg-[#5d4037]'
                      }`}
                    >
                      x{item.quantity}
                    </span>

                    {/* Thumbnail */}
                    <div className="w-9 h-9 sm:w-11 sm:h-11 relative flex items-center justify-center my-0.5">
                      {isMysteryPack ? (
                        <div className="w-full h-full rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-amber-500 p-0.5 shadow-xs flex items-center justify-center text-white animate-pulse">
                          <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                      ) : (
                        <PlantSprite cropCode={cropCode} stage={5} alt={item.itemName} />
                      )}
                    </div>

                    {/* Name */}
                    <span className="text-[9px] sm:text-[10px] font-bold text-[#3e2723] truncate max-w-[66px] sm:max-w-[90px] leading-tight mt-0.5">
                      {isMysteryPack ? 'Hạt Bí Ẩn' : item.itemName}
                    </span>

                    {/* Quick indicator */}
                    <div className="flex items-center gap-0.5 mt-0.5 text-[7px] sm:text-[8px] text-[#795548] font-semibold">
                      {isMysteryPack ? (
                        <span className="text-purple-700 font-bold flex items-center gap-0.5">
                          <Sparkles className="w-2 h-2" /> Ngẫu nhiên
                        </span>
                      ) : (
                        <>
                          <Clock className="w-2 h-2 text-amber-600" />
                          <span>Chuẩn</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
