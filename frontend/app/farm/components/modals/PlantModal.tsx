'use client';

import React from 'react';
import { X, Clock, Sparkles, Sprout, ShoppingBag } from 'lucide-react';

interface PlantModalProps {
  plotIndex: number;
  inventory: any[];
  onClose: () => void;
  onPlant: (cropCode: string) => void;
  onOpenShop: () => void;
}

export default function PlantModal({
  plotIndex,
  inventory,
  onClose,
  onPlant,
  onOpenShop,
}: PlantModalProps) {
  // Lọc các loại hạt giống có trong kho
  const seeds = inventory.filter((item) => item.itemType === 'SEED' && item.quantity > 0);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m} phút`;
    const h = Math.floor(m / 60);
    return `${h} giờ`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#fffdf7] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border-2 border-[#d4af37] flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4a2e18] via-[#2c1810] to-[#4a2e18] p-4 text-white flex items-center justify-between border-b-2 border-[#d4af37]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ffd54f] to-[#ff8f00] p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full rounded-[10px] bg-[#2c1810] flex items-center justify-center text-amber-400 font-bold">
                <Sprout className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-[#fff8e1]">Gieo Hạt Vào Ô #{plotIndex + 1}</h3>
              <p className="text-xs text-[#d7ccc8]">Chi phí: <strong className="text-amber-300">3⚡</strong> Năng lượng</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#5d4037]/80 hover:bg-[#8d6e63] text-[#fff8e1] border border-[#d4af37]/50 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#fffdf7]">
          {seeds.length === 0 ? (
            <div className="text-center py-10 px-4">
              <div className="w-16 h-16 rounded-full bg-[#f7eedf] border-2 border-[#d4af37]/50 text-amber-700 mx-auto flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h4 className="font-extrabold text-[#3e2723] text-base">Hết Hạt Giống Trong Kho!</h4>
              <p className="text-xs text-[#795548] mt-1 max-w-xs mx-auto">
                Bạn chưa có hạt giống nào. Hãy ghé Cửa hàng để mua hạt giống bằng Farm Coin nhé.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenShop();
                }}
                className="mt-4 px-5 py-2.5 bg-gradient-to-b from-[#ffca28] to-[#ff8f00] text-[#3e2723] font-black text-xs rounded-2xl shadow-md border border-[#ffd54f] hover:brightness-105 transition cursor-pointer"
              >
                Ghé Cửa Hàng Mua Hạt Giống
              </button>
            </div>
          ) : (
            seeds.map((seed) => (
              <div
                key={seed.id}
                className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-[#e5d4be] bg-[#faf5eb] hover:bg-white hover:border-[#d4af37] transition shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-amber-100 to-orange-100 text-[#5d4037] border border-amber-300 flex items-center justify-center text-xl font-black shrink-0">
                    🌱
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-[#3e2723] text-sm">{seed.itemName}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 bg-[#ebd9be] text-[#5d4037] font-black rounded-md">
                        x{seed.quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[#795548] text-xs mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Thời gian lớn nhanh
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onPlant(seed.cropCode)}
                  className="px-4 py-2 bg-gradient-to-b from-[#2e7d32] to-[#1b5e20] hover:brightness-110 text-white font-black text-xs rounded-xl shadow-xs border border-[#81c784] active:scale-95 transition cursor-pointer"
                >
                  Gieo Trồng
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
