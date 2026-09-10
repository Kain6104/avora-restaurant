'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { toast } from 'react-hot-toast';
import {
  Package,
  Sparkles,
  ChevronRight,
  Flame,
  Users,
  Plus,
  Minus,
  Check,
  ShoppingBag,
  Info,
  Search,
  X,
  UtensilsCrossed,
  ShieldCheck,
  Clock,
  ArrowRight,
  Gift,
  Crown,
  CreditCard,
  Zap,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ComboProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  description?: string;
  category?: { name: string };
}

interface ComboItem {
  id: string;
  productId: string;
  quantity: number;
  product: ComboProduct;
}

interface Combo {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  effectiveOriginalPrice?: number;
  savingsAmount?: number;
  discountPercent?: number;
  imageUrl?: string;
  isActive: boolean;
  usageLimit?: number;
  usedCount: number;
  totalItemsCount?: number;
  items: ComboItem[];
  branches?: any[];
}

export default function ComboPage() {
  const { addComboToCart, currentBranchId } = useCart();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [selectedCombo, setSelectedCombo] = useState<Combo | null>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalNote, setModalNote] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCombos = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/promotions/combos`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });

        if (res.ok) {
          const data = await res.json();
          setCombos(data);
        }
      } catch (err) {
        console.error('Error fetching combos:', err);
        toast.error('Không thể tải danh sách Combo ưu đãi');
      } finally {
        setLoading(false);
      }
    };

    fetchCombos();
  }, []);

  const tags = [
    { id: 'ALL', label: 'Tất cả Combo', icon: Package },
    { id: '2_PERSON', label: '2 Người', icon: Users },
    { id: 'FAMILY', label: 'Gia Đình (4-6 Người)', icon: Users },
    { id: 'HOTPOT_BBQ', label: 'Lẩu & Nướng', icon: Flame },
    { id: 'SASHIMI', label: 'Sashimi & Sushi', icon: UtensilsCrossed },
  ];

  const filteredCombos = useMemo(() => {
    return combos.filter((combo) => {
      const matchSearch =
        !searchQuery.trim() ||
        combo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (combo.description && combo.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        combo.items?.some((i) => i.product?.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (selectedTag === '2_PERSON') {
        return (
          combo.name.toLowerCase().includes('2 người') ||
          combo.name.toLowerCase().includes('couple') ||
          combo.name.toLowerCase().includes('đôi')
        );
      }
      if (selectedTag === 'FAMILY') {
        return (
          combo.name.toLowerCase().includes('gia đình') ||
          combo.name.toLowerCase().includes('4-6') ||
          combo.name.toLowerCase().includes('sum vầy')
        );
      }
      if (selectedTag === 'HOTPOT_BBQ') {
        return (
          combo.name.toLowerCase().includes('lẩu') ||
          combo.name.toLowerCase().includes('nướng') ||
          combo.name.toLowerCase().includes('bbq')
        );
      }
      if (selectedTag === 'SASHIMI') {
        return (
          combo.name.toLowerCase().includes('sashimi') ||
          combo.name.toLowerCase().includes('sushi') ||
          combo.name.toLowerCase().includes('hải sản')
        );
      }
      return true;
    });
  }, [combos, searchQuery, selectedTag]);

  const handleQuickAdd = (combo: Combo, e: React.MouseEvent) => {
    e.stopPropagation();
    setAddingId(combo.id);
    addComboToCart(combo, currentBranchId, 1);
    setTimeout(() => setAddingId(null), 600);
  };

  const handleOpenDetail = (combo: Combo) => {
    setSelectedCombo(combo);
    setModalQuantity(1);
    setModalNote('');
  };

  const handleConfirmModalAdd = () => {
    if (!selectedCombo) return;
    addComboToCart(selectedCombo, currentBranchId, modalQuantity, modalNote);
    setSelectedCombo(null);
  };

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-slate-800 pb-24 font-sans">
      {/* ── BREADCRUMB ── */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[#da251d] font-bold flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-500" />
              Thực Đơn Combo Tiết Kiệm
            </span>
          </div>

          <Link
            href="/cart"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#da251d]" />
            <span>Giỏ hàng</span>
          </Link>
        </div>
      </div>

      {/* ── HERO BANNER ── */}
      <div className="bg-gradient-to-r from-[#da251d] via-[#b91c1c] to-[#991b1b] text-white py-8 sm:py-12 px-3 sm:px-6 relative overflow-hidden shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-bold text-yellow-300">
              <Flame className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 animate-pulse" />
              <span>Tiết kiệm đến 35% so với gọi món lẻ</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Combo Tiệc Sum Vầy & Ưu Đãi Độc Quyền
            </h1>

            <p className="text-xs sm:text-sm text-red-100 font-medium leading-relaxed">
              Trọn vẹn hương vị tinh hoa ẩm thực Avora được thiết kế hoàn hảo cho từng dịp gặp gỡ, hẹn hò đôi lứa và tiệc gia đình ấm cúng.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-bold text-white/90">
              <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Chuẩn định lượng bếp trưởng
              </span>
              <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-amber-300" /> Giao nóng hổi 30-45 phút
              </span>
              <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-lg">
                <Crown className="w-3.5 h-3.5 text-yellow-300" /> Tích điểm VIP tự động
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6">
        {/* ── SEARCH & FILTER TABS ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm combo, món ăn kèm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {tags.map((tag: any) => {
              const Icon = tag.icon;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTag(tag.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedTag === tag.id
                      ? 'bg-[#da251d] text-white shadow-md shadow-red-600/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tag.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── COMBO GRID ── */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-[#da251d] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-slate-500">Đang chuẩn bị thực đơn Combo...</p>
          </div>
        ) : filteredCombos.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3 shadow-2xs">
            <Package className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy combo phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục khác nhé!
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag('ALL');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Xem tất cả Combo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
            {filteredCombos.map((combo) => {
              const savings = combo.savingsAmount || 0;
              const discountPct = combo.discountPercent || 0;
              const isAdding = addingId === combo.id;

              return (
                <div
                  key={combo.id}
                  onClick={() => handleOpenDetail(combo)}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-red-200 transition-all duration-300 overflow-hidden flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    {/* Image & Badges */}
                    <div className="relative h-52 sm:h-64 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={
                          combo.imageUrl ||
                          combo.items?.[0]?.product?.imageUrl ||
                          'https://images.unsplash.com/photo-1544025162-d76694265947?w=800'
                        }
                        alt={combo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                      {/* Savings tag */}
                      {savings > 0 && (
                        <div className="absolute top-3 left-3 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-md flex items-center gap-1 border border-white/20">
                          <Flame className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                          <span>
                            Tiết kiệm {new Intl.NumberFormat('vi-VN').format(savings)}đ (-{discountPct}%)
                          </span>
                        </div>
                      )}

                      {/* Items Count Badge */}
                      <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-xl border border-white/20 flex items-center gap-1">
                        <UtensilsCrossed className="w-3 h-3 text-yellow-300" />
                        <span>{combo.items?.length || 0} món</span>
                      </div>

                      {/* Bottom Image Info */}
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <h3 className="text-lg sm:text-xl font-black leading-tight drop-shadow-md group-hover:text-amber-300 transition-colors">
                          {combo.name}
                        </h3>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-4 sm:p-5 space-y-3.5">
                      {combo.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-normal">
                          {combo.description}
                        </p>
                      )}

                      {/* Included Items Pills */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Các món có trong Combo:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {combo.items?.map((item) => (
                            <div
                              key={item.id}
                              className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl text-xs"
                            >
                              <span className="w-4 h-4 rounded-full bg-red-100 text-[#da251d] text-[10px] font-black flex items-center justify-center shrink-0">
                                {item.quantity}
                              </span>
                              <span className="font-semibold text-slate-700 truncate max-w-[140px] sm:max-w-[180px]">
                                {item.product?.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-3 bg-slate-50/50">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Giá trọn gói Combo</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg sm:text-2xl font-black text-[#da251d] font-mono">
                          {new Intl.NumberFormat('vi-VN').format(combo.price)}đ
                        </span>
                        {combo.effectiveOriginalPrice && combo.effectiveOriginalPrice > combo.price && (
                          <span className="text-xs text-slate-400 line-through font-mono">
                            {new Intl.NumberFormat('vi-VN').format(combo.effectiveOriginalPrice)}đ
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(combo);
                        }}
                        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Chi tiết
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(combo, e)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                          isAdding
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#da251d] hover:bg-red-700 text-white shadow-md shadow-red-600/25'
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Đã thêm</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>Đặt Combo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── WHY CHOOSE COMBO INFO ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 pt-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Tiết Kiệm Tối Đa</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mức giá combo luôn được trợ giá tốt nhất, tiết kiệm từ 15% đến 35% so với tổng tiền gọi món lẻ.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Thực Đơn Cân Bằng</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Các set ăn được bếp trưởng tính toán kỹ lưỡng về định lượng và hương vị giữa món chính, khai vị và tráng miệng.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Chuẩn Bị Siêu Nhanh</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Quy trình bếp ưu tiên đóng gói nguyên set combo đồng bộ, giúp món ăn tới tay bạn luôn nóng hổi và đúng giờ.
            </p>
          </div>
        </div>
      </div>

      {/* ── MODAL CHI TIẾT COMBO & CHỌN SỐ LƯỢNG ── */}
      {selectedCombo && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCombo(null)}
          />

          <div
            className="relative z-10 w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-5 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200">
                  <img
                    src={
                      selectedCombo.imageUrl ||
                      selectedCombo.items?.[0]?.product?.imageUrl ||
                      'https://images.unsplash.com/photo-1544025162-d76694265947?w=400'
                    }
                    alt={selectedCombo.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-[#da251d] bg-red-50 px-2 py-0.5 rounded-md">
                      Combo Siêu Ưu Đãi
                    </span>
                    {selectedCombo.savingsAmount && selectedCombo.savingsAmount > 0 ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Tiết kiệm {new Intl.NumberFormat('vi-VN').format(selectedCombo.savingsAmount)}đ
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight mt-0.5">
                    {selectedCombo.name}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCombo(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
              {selectedCombo.description && (
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 text-xs text-slate-600 leading-relaxed">
                  {selectedCombo.description}
                </div>
              )}

              {/* List of included dishes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#da251d]" />
                  Danh sách {selectedCombo.items?.length || 0} món ăn trong Combo
                </h4>

                <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  {selectedCombo.items?.map((item) => (
                    <div key={item.id} className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/80">
                          <img
                            src={
                              item.product?.imageUrl ||
                              'https://images.unsplash.com/photo-1544025162-d76694265947?w=200'
                            }
                            alt={item.product?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.product?.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Giá bán lẻ:{' '}
                            <span className="font-mono">
                              {new Intl.NumberFormat('vi-VN').format(item.product?.price || 0)}đ
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="bg-red-50 text-[#da251d] font-black text-xs px-2.5 py-1 rounded-xl shrink-0 border border-red-100">
                        x{item.quantity}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Note Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Ghi chú cho bếp (Tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Không hành, nước lẩu ít cay, nhiều đá..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-red-500 transition-all"
                />
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Số lượng Combo:</span>
                <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setModalQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-black text-sm text-slate-900 w-6 text-center">
                    {modalQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalQuantity((q) => q + 1)}
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block">Tổng thanh toán:</span>
                <span className="text-lg sm:text-2xl font-black text-[#da251d] font-mono">
                  {new Intl.NumberFormat('vi-VN').format(selectedCombo.price * modalQuantity)}đ
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmModalAdd}
                className="flex-1 sm:flex-none px-6 py-3 bg-[#da251d] hover:bg-red-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Thêm vào giỏ hàng</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
