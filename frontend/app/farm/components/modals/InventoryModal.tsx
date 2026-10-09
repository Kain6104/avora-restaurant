'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Sprout,
  Search,
  AlertTriangle,
  Eye,
  Sparkles,
  Sliders,
  Check,
  Dna,
  Lock,
  Unlock,
  Minus,
  Plus,
  ArrowLeft,
  Zap,
  BookOpen,
} from 'lucide-react';
import { farmSound } from '../../game/services/FarmSoundManager';
import PlantSprite from '../common/PlantSprite';
import { AvoraCoinIcon } from '../common/AvoraCoinIcon';
import PlantDetailModal from './PlantDetailModal';

interface InventoryModalProps {
  inventory: any[];
  unseenCount?: number;
  onClose: () => void;
  onSellCrop: (itemCode: string, quantity: number) => Promise<void> | void;
  onQuickSell?: (items: Array<{ itemId: string; quantity: number }>) => Promise<void> | void;
  onToggleLock?: (itemId: string) => Promise<void> | void;
  onMarkSeen?: (itemIds?: string[]) => Promise<void> | void;
}

type TabType = 'CROP' | 'USEFUL' | 'SEED' | 'TOOL' | 'ALL';

export default function InventoryModal({
  inventory,
  unseenCount = 0,
  onClose,
  onSellCrop,
  onQuickSell,
  onToggleLock,
  onMarkSeen,
}: InventoryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('CROP');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Mode: Normal vs Quick Sell (Bán Nhanh)
  const [isQuickSellMode, setIsQuickSellMode] = useState(false);

  // Selected item IDs for multi-sell: Map of itemId -> quantity
  const [selectedItemMap, setSelectedItemMap] = useState<Map<string, number>>(new Map());

  // Single Item Sell Modal (Khi bấm vào bất kỳ nông sản nào ở chế độ bình thường)
  const [singleSellItem, setSingleSellItem] = useState<any | null>(null);
  const [singleSellQty, setSingleSellQty] = useState<number>(1);
  const [inspectDetailItem, setInspectDetailItem] = useState<any | null>(null);

  // Quick Sell Item Edit Modal (Khi bấm vào một món trong chế độ Bán Nhanh để chỉnh số lượng bán)
  const [quickAdjustItem, setQuickAdjustItem] = useState<any | null>(null);

  const [isSelling, setIsSelling] = useState(false);

  // 1. Tab Filtering (NÔNG SẢN ĐÃ HIỂN THỊ BÊN HỮU ÍCH THÌ KHÔNG HIỂN THỊ BÊN TAB CÂY TRỒNG NỮA)
  const filteredItems = useMemo(() => {
    return inventory.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.itemName?.toLowerCase().includes(q);
        const matchesCode = item.itemCode?.toLowerCase().includes(q);
        const matchesPurpose = item.upgradeInfo?.purpose?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesPurpose) return false;
      }

      if (activeTab === 'ALL') return true;

      // Tab 2: Hữu ích (Nguyên liệu nâng cấp nông trại)
      const isUseful = item.isUpgradeMaterial === true && Boolean(item.upgradeInfo);
      if (activeTab === 'USEFUL') {
        return isUseful;
      }

      // Tab 1: Cây trồng (Chỉ những nông sản KHÔNG nằm trong tab Hữu ích)
      if (activeTab === 'CROP') {
        const isCrop =
          item.itemType === 'CROP' ||
          item.itemType === 'MUTATION_CROP' ||
          item.itemType === 'PRODUCE';
        return isCrop && !isUseful;
      }

      // Tab 3: Hạt giống
      if (activeTab === 'SEED') {
        return (
          item.itemType === 'SEED' ||
          item.itemCode === 'MYSTERY_SEED_PACK' ||
          item.itemCode?.startsWith('SEED_PACK')
        );
      }

      // Tab 4: Dụng cụ & Phân bón
      if (activeTab === 'TOOL') {
        return (
          item.itemType === 'FERTILIZER' ||
          item.itemType === 'TOOL' ||
          item.itemType === 'DECORATION'
        );
      }

      return true;
    });
  }, [inventory, activeTab, searchQuery]);

  // Sellable items in current filtered list (canSell = true, quantity > 0, not locked)
  const sellableFilteredItems = useMemo(() => {
    return filteredItems.filter((item) => item.canSell && item.quantity > 0 && !item.isLocked);
  }, [filteredItems]);

  // Is "Select All" checked in Quick Sell mode?
  const isAllSelected = useMemo(() => {
    if (sellableFilteredItems.length === 0) return false;
    return sellableFilteredItems.every((item) => selectedItemMap.has(item.id));
  }, [sellableFilteredItems, selectedItemMap]);

  // Calculate Total Revenue from currently selected items in Quick Sell
  const totalQuickSellRevenue = useMemo(() => {
    let sum = 0;
    selectedItemMap.forEach((qty, itemId) => {
      const item = inventory.find((i) => i.id === itemId);
      if (item && item.sellPrice) {
        sum += item.sellPrice * qty;
      }
    });
    return sum;
  }, [selectedItemMap, inventory]);

  // Total count of selected items
  const selectedCount = selectedItemMap.size;

  // Handle clicking an item slot
  const handleItemClick = (item: any) => {
    farmSound.playTap();

    if (isQuickSellMode) {
      // Trong chế độ Bán Nhanh: Mở modal tùy chỉnh số lượng của món này hoặc bỏ chọn
      if (!item.canSell || item.quantity <= 0 || item.isLocked) {
        return;
      }
      setQuickAdjustItem(item);
    } else {
      // Chế độ Bình Thường: Bấm vào mở ngay modal BÁN RIÊNG NÔNG SẢN ĐÓ để tùy chỉnh số lượng bán
      setSingleSellItem(item);
      setSingleSellQty(item.quantity > 0 ? 1 : 0);
    }
  };

  // Kích hoạt chế độ Bán Nhanh (Tự động chọn tất cả nông sản bán được với số lượng đầy đủ)
  const handleEnableQuickSellMode = () => {
    farmSound.playTap();
    setIsQuickSellMode(true);
    const next = new Map<string, number>();
    sellableFilteredItems.forEach((item) => next.set(item.id, item.quantity));
    setSelectedItemMap(next);
  };

  // Thoát chế độ Bán Nhanh
  const handleExitQuickSellMode = () => {
    farmSound.playTap();
    setIsQuickSellMode(false);
    setSelectedItemMap(new Map());
  };

  // Toggle "Chọn tất cả" trong chế độ Bán Nhanh
  const handleToggleSelectAll = () => {
    farmSound.playTap();
    setSelectedItemMap((prev) => {
      const next = new Map(prev);
      if (isAllSelected) {
        sellableFilteredItems.forEach((item) => next.delete(item.id));
      } else {
        sellableFilteredItems.forEach((item) => next.set(item.id, item.quantity));
      }
      return next;
    });
  };

  // Thực hiện Bán Nhanh toàn bộ danh sách đã chọn
  const handleExecuteQuickSell = async () => {
    if (selectedItemMap.size === 0 || isSelling) return;

    const itemsToSell = Array.from(selectedItemMap.entries()).map(([itemId, quantity]) => ({
      itemId,
      quantity,
    }));

    setIsSelling(true);
    farmSound.playCoin();

    try {
      if (onQuickSell) {
        await onQuickSell(itemsToSell);
      } else {
        for (const req of itemsToSell) {
          const it = inventory.find((i) => i.id === req.itemId);
          if (it) await onSellCrop(it.itemCode, req.quantity);
        }
      }
      setSelectedItemMap(new Map());
      setIsQuickSellMode(false);
    } finally {
      setIsSelling(false);
    }
  };

  // Thực hiện Bán Đơn Lẻ (Single Item Sell)
  const handleExecuteSingleSell = async () => {
    if (!singleSellItem || isSelling || singleSellQty <= 0) return;

    setIsSelling(true);
    farmSound.playCoin();

    try {
      if (onQuickSell) {
        await onQuickSell([{ itemId: singleSellItem.id, quantity: singleSellQty }]);
      } else {
        await onSellCrop(singleSellItem.itemCode, singleSellQty);
      }
      setSingleSellItem(null);
    } finally {
      setIsSelling(false);
    }
  };

  // Has selected any upgrade materials?
  const hasSelectedUpgradeMaterials = useMemo(() => {
    for (const [itemId] of selectedItemMap) {
      const item = inventory.find((i) => i.id === itemId);
      if (item?.isUpgradeMaterial) return true;
    }
    return false;
  }, [selectedItemMap, inventory]);

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
      {/* Subtle Radiant Sunburst Decorative Background Watermark */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(244, 219, 150, 0.45) 0%, rgba(253, 246, 230, 0.2) 50%, rgba(245, 230, 205, 0.6) 100%)',
        }}
      />

      {/* Ornate Gold Filigree Corner Accents */}
      <div className="absolute top-2 left-2 w-8 h-8 pointer-events-none border-t-2 border-l-2 border-[#d4af37]/80 rounded-tl-xl" />
      <div className="absolute top-2 right-2 w-8 h-8 pointer-events-none border-t-2 border-r-2 border-[#d4af37]/80 rounded-tr-xl" />
      <div className="absolute bottom-2 left-2 w-8 h-8 pointer-events-none border-b-2 border-l-2 border-[#d4af37]/80 rounded-bl-xl" />
      <div className="absolute bottom-2 right-2 w-8 h-8 pointer-events-none border-b-2 border-r-2 border-[#d4af37]/80 rounded-br-xl" />

      {/* ========================================================= */}
      {/* 1. TOP HEADER: ORNATE CREST, TITLE & CONTROLS (REF: HÌNH 2)*/}
      {/* ========================================================= */}
      <header className="relative flex items-center justify-between px-3 sm:px-6 py-2 border-b-2 border-[#d4af37]/70 bg-gradient-to-b from-[#fffefc] to-[#f8efe0] shadow-xs shrink-0 z-10">
        {/* Left Tools: Return button & Search */}
        <div className="flex items-center gap-2">
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

          <button
            onClick={() => {
              farmSound.playTap();
              setIsSearchOpen(!isSearchOpen);
            }}
            className="p-1.5 rounded-xl bg-amber-100/70 hover:bg-amber-200/80 border border-[#d4af37]/50 text-[#854d0e] transition active:scale-95 cursor-pointer"
            title="Tìm kiếm vật phẩm"
          >
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {unseenCount > 0 && onMarkSeen && (
            <button
              onClick={() => {
                farmSound.playTap();
                onMarkSeen();
              }}
              className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-400/50 text-[10px] sm:text-xs font-bold text-amber-900 flex items-center gap-1 transition cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              <span className="hidden sm:inline">Xem ({unseenCount})</span>
            </button>
          )}
        </div>

        {/* Center: Winged Golden Emblem & Title: ✦·· Kho Nông Trại ❓ ··✦ */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1 text-[#b4801e]">
            <svg width="28" height="12" viewBox="0 0 40 20" fill="currentColor" className="opacity-90">
              <path d="M0,10 Q10,0 20,10 Q30,0 40,10 Q30,14 20,11 Q10,14 0,10 Z" fill="#d4af37" />
              <circle cx="20" cy="10" r="3.5" fill="#991b1b" />
              <circle cx="20" cy="10" r="1.5" fill="#fef08a" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#c89830] text-[10px] tracking-widest font-serif font-bold">✦··</span>
            <h2 className="font-extrabold text-base sm:text-lg text-[#5c3a10] font-serif tracking-wider">
              Kho Nông Trại & Túi Đồ
            </h2>
            <button
              onClick={() => farmSound.playTap()}
              className="w-4 h-4 rounded-full bg-[#f3d99e] hover:bg-[#eac47a] text-[#78350f] flex items-center justify-center text-[10px] font-bold cursor-pointer transition"
              title="Bấm vào nông sản bất kỳ để mở bảng bán và chọn số lượng. Bấm 'Bán Nhanh' để chọn hàng loạt."
            >
              ?
            </button>
            <span className="text-[#c89830] text-[10px] tracking-widest font-serif font-bold">··✦</span>
          </div>
        </div>

        {/* Right: Close Button */}
        <button
          onClick={() => {
            farmSound.playTap();
            onClose();
          }}
          className="w-8 h-8 rounded-full bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white border-2 border-[#fef08a] flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
          title="Đóng túi đồ"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>
      </header>

      {/* Collapsible Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-1.5 bg-[#f5e9d5] border-b border-[#e0c99f] flex items-center gap-2 z-10 animate-in slide-in-from-top-2 duration-150">
          <Search className="w-3.5 h-3.5 text-[#854d0e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên vật phẩm hoặc nguyên liệu..."
            className="flex-1 bg-white/90 border border-[#d4af37]/60 rounded-lg px-2.5 py-1 text-xs text-[#5c3a10] placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-stone-500 hover:text-stone-800 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MAIN BODY: VERTICAL RIBBON TABS (LEFT) + FULL GRID     */}
      {/* ========================================================= */}
      <div className="flex-1 flex overflow-hidden relative z-0">
        {/* LEFT: VERTICAL RIBBON TABS (KHỚP HÌNH 2) */}
        <aside className="w-20 sm:w-28 md:w-32 bg-gradient-to-b from-[#faf2e3] to-[#f4e6ce] border-r-2 border-[#e6d0a7] flex flex-col py-2 sm:py-3 gap-1.5 sm:gap-2 shrink-0 select-none">
          {[
            { id: 'CROP', label: 'Cây trồng', icon: '🌾' },
            { id: 'USEFUL', label: 'Hữu ích', icon: '⭐', badge: 'Nâng cấp' },
            { id: 'SEED', label: 'Hạt giống', icon: '🌱' },
            { id: 'TOOL', label: 'Dụng cụ', icon: '🧪' },
            { id: 'ALL', label: 'Tất cả', icon: '📦' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  farmSound.playTap();
                  setActiveTab(tab.id as TabType);
                }}
                className={`relative flex items-center justify-between px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#991b1b] via-[#be123c] to-[#e11d48] text-[#fff8e1] shadow-md border-y border-r-2 border-[#ffd54f] font-serif font-extrabold rounded-r-xl translate-x-0.5'
                    : 'text-[#6b471c] hover:bg-[#ede0c8]/80 hover:text-[#451a03] rounded-r-lg'
                }`}
              >
                <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                  <span className="text-xs sm:text-sm">{tab.icon}</span>
                  <span className="truncate">{tab.label}</span>
                </div>

                {/* Active Ribbon Pointer / Pip */}
                {isActive && (
                  <span className="text-[#fef08a] text-[9px] font-mono hidden sm:inline">❖</span>
                )}
              </button>
            );
          })}

          {/* Item Count Footnote */}
          <div className="mt-auto px-2 pt-2 border-t border-[#e2cca4] text-[9.5px] sm:text-[10.5px] text-[#854d0e] text-center font-medium">
            <span>{filteredItems.length} mục</span>
          </div>
        </aside>

        {/* RIGHT: DENSE SQUARE SLOTS GRID (SUPER MOBILE OPTIMIZED) */}
        <main className="flex-1 overflow-y-auto p-2.5 sm:p-4 bg-[#faf4e8] relative">
          {/* Active Tab Notice Banner */}
          {activeTab === 'USEFUL' ? (
            <div className="mb-2.5 p-2.5 rounded-xl bg-amber-100/90 border border-amber-300 text-[#78350f] text-[11px] sm:text-xs flex items-center gap-2 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Các nông sản dưới đây cần cho <strong>nâng cấp nông trại ở cấp tiếp theo</strong>. Bạn <strong>vẫn được phép bán tự do</strong> nếu muốn!
              </span>
            </div>
          ) : isQuickSellMode ? (
            <div className="mb-2.5 p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-950 text-[11px] sm:text-xs flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Đang ở <strong>Chế độ Bán Nhanh</strong>: Đã chọn các nông sản có thể bán. Chạm vào món bất kỳ để <strong>tùy chỉnh số lượng bán</strong> hoặc bỏ chọn!
                </span>
              </div>
              <button
                onClick={handleExitQuickSellMode}
                className="px-2.5 py-1 rounded-lg bg-white text-emerald-900 font-bold border border-emerald-300 text-xs hover:bg-emerald-50 cursor-pointer whitespace-nowrap"
              >
                Thoát Bán Nhanh
              </button>
            </div>
          ) : null}

          {filteredItems.length === 0 ? (
            <div className="py-20 text-center text-[#854d0e]/60 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
              <Package className="w-12 h-12 text-[#d4af37]/60 stroke-[1.5]" />
              <span>Không có vật phẩm nào trong mục này.</span>
            </div>
          ) : (
            /* DENSE ULTRA-COMPACT SQUARE SLOTS GRID */
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-2.5">
              {filteredItems.map((item) => {
                const isSelectedInQuickSell = isQuickSellMode && selectedItemMap.has(item.id);
                const selectedQty = selectedItemMap.get(item.id) || 0;
                const cropCode = item.itemCode?.replace('_SEED', '').toLowerCase();
                const isUpgradeItem = item.isUpgradeMaterial === true && Boolean(item.upgradeInfo);
                const isMutated = item.itemType === 'MUTATION_CROP';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`group relative aspect-square rounded-2xl p-1 sm:p-1.5 flex flex-col items-center justify-between transition-all duration-150 select-none cursor-pointer border-2 ${
                      isSelectedInQuickSell
                        ? 'bg-amber-100/95 border-[#eab308] ring-2 ring-amber-400 shadow-md scale-[1.02]'
                        : isUpgradeItem
                        ? 'bg-[#fffaf0] border-amber-400/80 hover:border-amber-500 hover:bg-[#fff7e6]'
                        : 'bg-white/90 border-[#dfca9f] hover:border-[#b8860b] hover:bg-white shadow-xs'
                    }`}
                  >
                    {/* Top Badges Row */}
                    <div className="w-full flex items-center justify-between leading-none pointer-events-none z-10">
                      {/* Top-Left: Upgrade Star / Target Level */}
                      {isUpgradeItem ? (
                        <span className="px-1 py-0.2 rounded bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[8px] sm:text-[8.5px] uppercase shadow-2xs">
                          Lv.{item.upgradeInfo.targetLevel}
                        </span>
                      ) : item.isLocked ? (
                        <span className="text-[10px] text-rose-500">🔒</span>
                      ) : (
                        <span />
                      )}

                      {/* Top-Right: DNA mutation badge or Category Leaf (Khớp Hình 2) */}
                      {isMutated ? (
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 text-white flex items-center justify-center shadow-xs">
                          <Dna className="w-2.5 h-2.5" />
                        </div>
                      ) : item.itemType === 'SEED' ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                          <Sprout className="w-2.5 h-2.5" />
                        </div>
                      ) : item.canSell ? (
                        <div className="w-4 h-4 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
                          <span className="text-[7px] font-black">🌾</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Center Plant Sprite / Icon */}
                    <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex items-center justify-center my-auto transition-transform group-hover:scale-105">
                      {item.itemType === 'SEED' ||
                      item.itemType === 'CROP' ||
                      item.itemType === 'MUTATION_CROP' ? (
                        <PlantSprite
                          cropCode={cropCode}
                          stage={5}
                          isMutated={isMutated}
                          alt={item.itemName}
                        />
                      ) : (
                        <Package className="w-8 h-8 sm:w-9 sm:h-9 text-amber-600" />
                      )}
                    </div>

                    {/* Bottom Row: Checkmark (Left) & Quantity Badge (Right) */}
                    <div className="w-full flex items-center justify-between leading-none pointer-events-none z-10">
                      {isSelectedInQuickSell ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-black shadow-xs">
                          ✓
                        </span>
                      ) : (
                        <span />
                      )}

                      {/* Quantity (Bold, clear numbers) */}
                      <span className="px-1.5 py-0.5 rounded-md bg-stone-900/80 text-white font-mono font-extrabold text-[9.5px] sm:text-[10.5px] tracking-tight shadow-xs">
                        {isSelectedInQuickSell && selectedQty < item.quantity
                          ? `${selectedQty}/${item.quantity}`
                          : item.quantity}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* 3. BOTTOM ACTION BAR: CHẾ ĐỘ BÁN NHANH VS THƯỜNG          */}
      {/* ========================================================= */}
      <footer className="px-3 sm:px-6 py-2.5 border-t-2 border-[#e6d0a7] bg-gradient-to-b from-[#fdfbf7] to-[#f4e9d7] flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 z-10">
        {isQuickSellMode ? (
          /* QUICK SELL ACTIVE CONTROLS (Khớp Hình 2: Chọn tất cả | Hủy bỏ | Bán | Tổng tiền) */
          <>
            <div className="flex items-center gap-2 self-start sm:self-center">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 cursor-pointer accent-[#b91c1c]"
                />
                <span className="text-xs sm:text-sm font-bold text-[#5c3a10] group-hover:text-[#991b1b] transition">
                  Chọn tất cả
                </span>
              </label>

              {hasSelectedUpgradeMaterials && (
                <span className="text-[10px] text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-300 font-medium">
                  ⭐ Có nguyên liệu nâng cấp
                </span>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4">
              {/* Total Revenue */}
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-serif">
                <span className="text-[#78350f] font-bold">Tổng doanh thu:</span>
                <div className="flex items-center gap-1.5 font-mono font-extrabold text-[#991b1b] text-sm sm:text-base">
                  <AvoraCoinIcon size="sm" className="w-4 h-4" />
                  <span>{totalQuickSellRevenue.toLocaleString('vi-VN')} Xu</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExitQuickSellMode}
                  className="px-3 sm:px-4 py-1.5 rounded-xl border-2 border-[#d4af37] bg-gradient-to-b from-[#fffbeb] to-[#fef3c7] hover:from-[#fef3c7] hover:to-[#fde68a] text-[#78350f] font-bold text-xs sm:text-sm shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  onClick={handleExecuteQuickSell}
                  disabled={selectedCount === 0 || isSelling}
                  className="px-5 sm:px-7 py-1.5 sm:py-2 rounded-xl border border-[#fbcfe8] bg-gradient-to-r from-[#9d174d] via-[#be185d] to-[#db2777] hover:brightness-110 text-white font-black text-xs sm:text-sm tracking-wider shadow-[0_0_15px_rgba(190,24,93,0.45)] transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                >
                  {isSelling ? (
                    <span className="animate-spin text-xs">⏳</span>
                  ) : (
                    <span>Bán ({selectedCount})</span>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* NORMAL MODE FOOTER: Hướng dẫn chạm để bán lẻ & Nút Bật Bán Nhanh */
          <>
            <div className="flex items-center gap-2 text-xs text-[#78350f]">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Chạm vào nông sản bất kỳ để <strong>bán lẻ và tùy chỉnh số lượng</strong>.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleEnableQuickSellMode}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-[#d4af37] to-amber-600 hover:brightness-105 text-[#2c1810] font-black text-xs sm:text-sm shadow-sm transition active:scale-95 cursor-pointer border border-[#ffd54f]"
              >
                <Zap className="w-3.5 h-3.5 fill-[#2c1810]" />
                <span>Bán Nhanh Hàng Loạt</span>
              </button>
            </div>
          </>
        )}
      </footer>

      {/* ========================================================= */}
      {/* 4. MODAL BÁN RIÊNG 1 NÔNG SẢN (KHI BẤM VÀO NÔNG SẢN ĐÓ)  */}
      {/* ========================================================= */}
      {singleSellItem && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setSingleSellItem(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl sm:rounded-3xl border-2 sm:border-[3px] border-[#d4af37] bg-[#fffdfa] p-3 sm:p-4 shadow-2xl flex flex-col gap-2 font-sans relative max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e6d0a7] pb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-serif font-black text-sm sm:text-base text-[#5c3a10] truncate">
                  Bán {singleSellItem.itemName}
                </span>
                {singleSellItem.isLocked && (
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                    Đang khóa 🔒
                  </span>
                )}
              </div>
              <button
                onClick={() => setSingleSellItem(null)}
                className="w-6 h-6 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Item artwork & info */}
            <div className="flex items-center gap-3 py-0.5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-[#d4af37]/60 bg-[#faf3e5] p-1 flex items-center justify-center shrink-0 shadow-inner">
                <PlantSprite
                  cropCode={singleSellItem.itemCode?.replace('_SEED', '').toLowerCase()}
                  stage={5}
                  isMutated={singleSellItem.itemType === 'MUTATION_CROP'}
                  alt={singleSellItem.itemName}
                />
              </div>
              <div className="flex flex-col text-[11px] sm:text-xs text-[#78350f] space-y-0.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>
                    Trong kho: <strong className="text-emerald-700 text-xs sm:text-sm font-mono font-bold">{singleSellItem.quantity}</strong> cái
                  </span>
                  <span>
                    Giá: <strong className="text-[#991b1b] font-mono font-extrabold">{singleSellItem.sellPrice || 10} Xu</strong>/cái
                  </span>
                </div>
                {singleSellItem.isUpgradeMaterial && (
                  <span className="inline-block text-[10px] text-amber-800 font-medium bg-amber-100 px-2 py-0.5 rounded-md mt-0.5 border border-amber-300 truncate max-w-fit">
                    ⭐ Cần cho nâng cấp nông trại Lv.{singleSellItem.upgradeInfo?.targetLevel}
                  </span>
                )}
              </div>
            </div>

            {/* Quantity Stepper & Quick Buttons */}
            {singleSellItem.canSell && !singleSellItem.isLocked ? (
              <div className="flex flex-col gap-2 pt-1.5 border-t border-[#f0e2ca]">
                {/* Horizontal row for Stepper and Quick Select */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#78350f] font-bold">
                    <span>SL:</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSingleSellQty((prev) => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 flex items-center justify-center text-xs font-bold active:scale-95 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-9 text-center font-mono font-black text-base text-[#991b1b]">
                        {singleSellQty}
                      </span>
                      <button
                        onClick={() => setSingleSellQty((prev) => Math.min(singleSellItem.quantity, prev + 1))}
                        className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 flex items-center justify-center text-xs font-bold active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Select Buttons: 1, 1/2, Hết */}
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-initial justify-end">
                    <button
                      onClick={() => setSingleSellQty(1)}
                      className="px-2.5 py-1 rounded-lg bg-[#f4e9d7] hover:bg-[#ebdcc4] text-[11px] font-bold text-[#78350f] cursor-pointer"
                    >
                      Bán 1
                    </button>
                    <button
                      onClick={() => setSingleSellQty(Math.max(1, Math.floor(singleSellItem.quantity / 2)))}
                      className="px-2.5 py-1 rounded-lg bg-[#f4e9d7] hover:bg-[#ebdcc4] text-[11px] font-bold text-[#78350f] cursor-pointer"
                    >
                      Bán 1/2
                    </button>
                    <button
                      onClick={() => setSingleSellQty(singleSellItem.quantity)}
                      className="px-2.5 py-1 rounded-lg bg-[#f4e9d7] hover:bg-[#ebdcc4] text-[11px] font-bold text-[#78350f] cursor-pointer"
                    >
                      Tất cả
                    </button>
                  </div>
                </div>

                {/* Total & Action Confirm Row */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#f0e2ca]">
                  <div className="flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                    <span className="text-[#78350f]">Tổng:</span>
                    <span className="font-mono font-black text-sm sm:text-base text-[#991b1b] flex items-center gap-1">
                      <AvoraCoinIcon size="sm" className="w-4 h-4" />
                      <span>{((singleSellItem.sellPrice || 10) * singleSellQty).toLocaleString('vi-VN')} Xu</span>
                    </span>
                  </div>

                  {/* Confirm Single Sell Button */}
                  <button
                    onClick={handleExecuteSingleSell}
                    disabled={isSelling || singleSellQty <= 0}
                    className="flex-1 max-w-[200px] py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-[#9d174d] via-[#be185d] to-[#db2777] hover:brightness-110 text-white font-black text-xs sm:text-sm tracking-wide shadow-sm transition active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    {isSelling ? (
                      <span className="animate-spin text-xs">⏳</span>
                    ) : (
                      <span>Xác nhận Bán ({singleSellQty})</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-stone-100 text-stone-600 text-xs text-center font-medium">
                {singleSellItem.isLocked
                  ? 'Vật phẩm này đang bị khóa. Hãy mở khóa nếu bạn muốn bán.'
                  : 'Vật phẩm này thuộc nhóm không thể bán.'}
              </div>
            )}

            {/* Lock / Unlock Toggle Action */}
            {onToggleLock && (
              <div className="pt-1.5 border-t border-[#f0e2ca] flex items-center justify-between text-[10px] sm:text-[11px]">
                <span className="text-stone-500">Khóa để chống bán nhầm</span>
                <button
                  onClick={() => {
                    onToggleLock(singleSellItem.id);
                    setSingleSellItem((prev: any) =>
                      prev ? { ...prev, isLocked: !prev.isLocked } : null,
                    );
                  }}
                  className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  {singleSellItem.isLocked ? (
                    <>
                      <Unlock className="w-3 h-3 text-emerald-600" />
                      <span>Mở khóa</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>Khóa vật phẩm</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* View Plant/Mutation Detail Card */}
            {(singleSellItem.itemType === 'CROP' || singleSellItem.itemType === 'MUTATION_CROP') && (
              <div className="pt-1.5 border-t border-[#f0e2ca]">
                <button
                  onClick={() => {
                    farmSound.playTap();
                    setInspectDetailItem(singleSellItem);
                  }}
                  className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 border border-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                  <span>Xem Chi Tiết Cây / Biến Thể ({singleSellItem.itemName})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL XEM CHI TIẾT CÂY TRỒNG / BIẾN THỂ ĐỘT BIẾN      */}
      {/* ========================================================= */}
      {inspectDetailItem && (
        <PlantDetailModal
          cropCode={inspectDetailItem.itemCode}
          mutationCode={inspectDetailItem.itemType === 'MUTATION_CROP' ? inspectDetailItem.itemCode : undefined}
          onClose={() => setInspectDetailItem(null)}
        />
      )}

      {/* ========================================================= */}
      {/* 6. MODAL TÙY CHỈNH SỐ LƯỢNG TRONG CHẾ ĐỘ BÁN NHANH        */}
      {/* ========================================================= */}
      {quickAdjustItem && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setQuickAdjustItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border-2 border-[#d4af37] bg-[#fffdfa] p-3 sm:p-4 shadow-2xl flex flex-col gap-2 font-sans relative max-h-[90dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#e6d0a7] pb-1.5">
              <span className="font-serif font-black text-xs sm:text-sm text-[#5c3a10] truncate">
                Chỉnh số lượng bán: {quickAdjustItem.itemName}
              </span>
              <button
                onClick={() => setQuickAdjustItem(null)}
                className="w-6 h-6 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center text-xs cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-[#78350f] font-bold pt-1">
              <span>Số lượng bán nhanh:</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const cur = selectedItemMap.get(quickAdjustItem.id) || 1;
                    if (cur > 1) {
                      setSelectedItemMap((prev) => new Map(prev).set(quickAdjustItem.id, cur - 1));
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-9 text-center font-mono font-black text-base text-[#991b1b]">
                  {selectedItemMap.get(quickAdjustItem.id) || quickAdjustItem.quantity}
                </span>
                <button
                  onClick={() => {
                    const cur = selectedItemMap.get(quickAdjustItem.id) || 1;
                    if (cur < quickAdjustItem.quantity) {
                      setSelectedItemMap((prev) => new Map(prev).set(quickAdjustItem.id, cur + 1));
                    }
                  }}
                  className="w-7 h-7 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => {
                  setSelectedItemMap((prev) => new Map(prev).set(quickAdjustItem.id, 1));
                }}
                className="flex-1 py-1 rounded-lg bg-[#f4e9d7] hover:bg-[#ebdcc4] text-[11px] font-bold text-[#78350f] cursor-pointer"
              >
                1
              </button>
              <button
                onClick={() => {
                  const half = Math.max(1, Math.floor(quickAdjustItem.quantity / 2));
                  setSelectedItemMap((prev) => new Map(prev).set(quickAdjustItem.id, half));
                }}
                className="flex-1 py-1 rounded-lg bg-[#f4e9d7] hover:bg-[#ebdcc4] text-[11px] font-bold text-[#78350f] cursor-pointer"
              >
                1/2
              </button>
              <button
                onClick={() => {
                  setSelectedItemMap((prev) =>
                    new Map(prev).set(quickAdjustItem.id, quickAdjustItem.quantity),
                  );
                }}
                className="flex-1 py-1 rounded-lg bg-[#f4e9d7] hover:bg-[#ebdcc4] text-[11px] font-bold text-[#78350f] cursor-pointer"
              >
                Hết
              </button>
              <button
                onClick={() => {
                  setSelectedItemMap((prev) => {
                    const next = new Map(prev);
                    next.delete(quickAdjustItem.id);
                    return next;
                  });
                  setQuickAdjustItem(null);
                }}
                className="flex-1 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-[11px] font-bold text-rose-800 cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>

            <button
              onClick={() => setQuickAdjustItem(null)}
              className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs shadow-xs hover:brightness-105 transition cursor-pointer mt-1"
            >
              Xác nhận
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
