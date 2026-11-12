"use client";

import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  ShoppingBag,
  LayoutGrid,
  ChefHat,
  CalendarCheck,
  QrCode,
  DollarSign,
  Utensils,
  ArrowRight,
} from 'lucide-react';
import { PosProduct, PosActiveTab } from './pos-types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  products: PosProduct[];
  onSelectProduct: (product: PosProduct) => void;
  onSelectTab: (tab: PosActiveTab) => void;
  isDarkMode?: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  onSelectTab,
  isDarkMode = false,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProducts = query.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.itemCode.toLowerCase().includes(query.toLowerCase()),
      ).slice(0, 8)
    : [];

  const navigationCommands = [
    { name: 'Mở màn hình Bán hàng (POS)', shortcut: 'F1', icon: ShoppingBag, tab: 'SALE' as PosActiveTab },
    { name: 'Mở Sơ đồ bàn chi nhánh', shortcut: 'F3', icon: LayoutGrid, tab: 'TABLES' as PosActiveTab },
    { name: 'Màn hình KDS Bếp & Quầy Bar', icon: ChefHat, tab: 'KDS' as PosActiveTab },
    { name: 'Danh sách khách Đặt bàn', icon: CalendarCheck, tab: 'RESERVATIONS' as PosActiveTab },
    { name: 'Yêu cầu gọi món QR Order', icon: QrCode, tab: 'QR_ORDERS' as PosActiveTab },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-100">
      <div className={`rounded-2xl shadow-2xl border max-w-xl w-full overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Search Bar */}
        <div className={`p-3.5 border-b flex items-center gap-3 ${
          isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'
        }`}>
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gõ tên món, mã món, hoặc lệnh điều hướng..."
            className={`w-full text-sm outline-none font-medium bg-transparent ${
              isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-gray-900 placeholder:text-gray-400'
            }`}
            autoFocus
          />
          <kbd className={`px-2 py-0.5 text-[10px] rounded border font-mono ${
            isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {/* Matched Products */}
          {filteredProducts.length > 0 && (
            <div>
              <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-slate-500' : 'text-gray-400'
              }`}>
                Món ăn tìm thấy ({filteredProducts.length})
              </div>
              {filteredProducts.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => {
                    onSelectProduct(prod);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors group ${
                    isDarkMode ? 'hover:bg-slate-800/80' : 'hover:bg-red-50/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Utensils className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className={`font-bold transition-colors ${
                        isDarkMode ? 'text-white group-hover:text-red-400' : 'text-gray-900 group-hover:text-[#da251d]'
                      }`}>
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">{prod.itemCode}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#da251d]">
                      {(prod.effectivePrice ?? prod.price ?? 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Navigation Commands */}
          <div>
            <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
              isDarkMode ? 'text-slate-500' : 'text-gray-400'
            }`}>
              Lệnh nhanh hệ thống
            </div>
            {navigationCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectTab(cmd.tab);
                    onClose();
                  }}
                  className={`w-full p-2.5 rounded-xl text-left text-xs flex items-center justify-between transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800/80 text-slate-300' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold">{cmd.name}</span>
                  </div>
                  {cmd.shortcut && (
                    <kbd className={`px-1.5 py-0.5 text-[10px] rounded border font-mono ${
                      isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
