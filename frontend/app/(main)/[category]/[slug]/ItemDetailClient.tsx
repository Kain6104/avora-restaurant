"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Star, Heart, MapPin, Leaf, ChefHat, Timer, RotateCcw, Plus, Minus, ShoppingCart, Zap, Home, ArrowRight } from 'lucide-react';
import { useCart } from '../../../../context/CartContext';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface ItemDetailClientProps {
  product: any;
  relatedDishes: any[];
}

const getSoldCount = (id: string) => {
  if (!id) return 150;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 500) + 100;
};

export default function ItemDetailClient({ product, relatedDishes }: ItemDetailClientProps) {
  const router = useRouter();
  const { currentBranchId, flashSaleQuotas, cartItems, setBranchModalProduct, addToCart } = useCart();
  const [activeTab, setActiveTab] = useState('description');
  const [localQuantity, setLocalQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(product?.imageUrl);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('token'));
  }, []);

  // Add to Recently Viewed
  useEffect(() => {
    if (product && product.id) {
      try {
        const stored = localStorage.getItem('recentlyViewed');
        let viewed = stored ? JSON.parse(stored) : [];
        // Remove self if exists to bring to front
        viewed = viewed.filter((item: any) => item.id !== product.id);
        // Add to front
        viewed.unshift(product);
        // Keep only last 8
        if (viewed.length > 8) viewed = viewed.slice(0, 8);
        
        localStorage.setItem('recentlyViewed', JSON.stringify(viewed));
        // Remove current product from display list
        setRecentlyViewed(viewed.filter((item: any) => item.id !== product.id));
      } catch (e) {
        console.error('Error with recently viewed:', e);
      }
    }
  }, [product]);

  const displayProduct = useMemo(() => {
    let dp = { ...product };
    if (dp.isFlashSaleItem || dp.flashSalePrice) {
      const quota = flashSaleQuotas[dp.id];
      if (quota !== undefined) {
        const cartQty = cartItems?.filter((c: any) => c.productId === dp.id && c.isFlashSaleItem).reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
        const remaining = quota - cartQty;
        if (remaining <= 0) {
          dp.flashSalePrice = null;
          dp.isFlashSaleItem = false;
          dp.flashSaleId = null;
          dp.maxQuantityPerUser = null;
        }
      }
    }
    return dp;
  }, [product, flashSaleQuotas, cartItems]);

  // Flash Sale Countdown Logic
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!displayProduct.flashSalePrice) return;
    
    // Set target to end of tomorrow for demo purposes to show days
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(23, 59, 59, 999);
    
    const interval = setInterval(() => {
      const now = new Date();
      const difference = target.getTime() - now.getTime();
      
      if (difference <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(interval);
      } else {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
        const m = Math.floor((difference / 1000 / 60) % 60).toString().padStart(2, '0');
        const s = Math.floor((difference / 1000) % 60).toString().padStart(2, '0');
        setTimeLeft(d > 0 ? `${d} ngày ${h}:${m}:${s}` : `${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [displayProduct.flashSalePrice]);

  const { category, optionGroups } = displayProduct;

  const isAvailableHere = useMemo(() => {
    if (!currentBranchId) return true;
    if (!displayProduct.branches || displayProduct.branches.length === 0) return true;
    return displayProduct.branches.some((b: any) => b.id === currentBranchId);
  }, [currentBranchId, displayProduct.branches]);

  const filteredRelatedDishes = useMemo(() => {
    return relatedDishes.filter(p => {
      if (!currentBranchId) return true;
      if (!p.branches || p.branches.length === 0) return true;
      return p.branches.some((b: any) => b.id === currentBranchId);
    }).slice(0, 5).map(p => {
      let dp = { ...p };
      if (dp.isFlashSaleItem || dp.flashSalePrice) {
        const quota = flashSaleQuotas[dp.id];
        if (quota !== undefined) {
          const cartQty = cartItems?.filter((c: any) => c.productId === dp.id && c.isFlashSaleItem).reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
          const remaining = quota - cartQty;
          if (remaining <= 0) {
            dp.flashSalePrice = null;
            dp.isFlashSaleItem = false;
          }
        }
      }
      return dp;
    });
  }, [relatedDishes, currentBranchId, flashSaleQuotas, cartItems]);

  const thumbnails = [
    displayProduct.imageUrl,
    displayProduct.imageUrl,
    displayProduct.imageUrl,
    displayProduct.imageUrl,
    displayProduct.imageUrl,
  ];

  const handleAddToCart = (): boolean => {
    if (!isAvailableHere) {
      setBranchModalProduct(displayProduct);
      return false;
    }
    const priceAtSale = displayProduct.flashSalePrice || displayProduct.price;
    const cartItem = {
      id: displayProduct.id,
      productId: displayProduct.id,
      name: displayProduct.name,
      originalPriceAtSale: displayProduct.price,
      priceAtSale,
      quantity: localQuantity,
      imageUrl: displayProduct.imageUrl,
      isFlashSaleItem: !!displayProduct.flashSalePrice,
      flashSaleId: displayProduct.flashSaleId,
      maxQuantityPerUser: displayProduct.maxQuantityPerUser,
      rawProduct: displayProduct
    };
    const added = addToCart(cartItem, currentBranchId || 'AVO-Q1');
    if (added) {
      setLocalQuantity(1);
    }
    return added;
  };

  const handleBuyNow = () => {
    if (!isAvailableHere) {
      setBranchModalProduct(displayProduct);
      return;
    }
    const added = handleAddToCart();
    if (added) {
      router.push('/checkout');
    }
  };

  const handleQuickAdd = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    if (item.branches && item.branches.length > 0) {
      if (currentBranchId && !item.branches.some((b:any)=>b.id === currentBranchId)) {
        setBranchModalProduct(item);
        return;
      }
    }
    const priceAtSale = item.flashSalePrice || item.price;
    const cartItem = {
      id: item.id,
      productId: item.id,
      name: item.name,
      originalPriceAtSale: item.price,
      priceAtSale,
      quantity: 1,
      imageUrl: item.imageUrl,
      isFlashSaleItem: !!item.flashSalePrice,
      flashSaleId: item.flashSaleId,
      rawProduct: item
    };
    addToCart(cartItem, currentBranchId || 'AVO-Q1');
  };

  return (
    <div className="bg-[#FAFAFA] min-h-screen text-slate-800 font-sans pb-20">
      
      {/* 1. CONTAINER */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-10 lg:px-12 pt-6">
        
        {/* 2. BREADCRUMB */}
        <nav className="flex flex-nowrap whitespace-nowrap overflow-x-auto hide-scrollbar items-center gap-2 text-[12px] text-slate-500 mb-8 font-medium">
          <Link href="/" className="hover:text-slate-800 transition-colors flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> Trang chủ</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <Link href="/menu" className="hover:text-slate-800 transition-colors">Thực đơn</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <Link href={`/${category?.slug || 'menu'}`} className="hover:text-slate-800 transition-colors uppercase">{category?.name || 'Danh mục'}</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900 font-bold">{displayProduct.name}</span>
        </nav>

        {/* 3. PRODUCT HERO: 3 Columns */}
        <div className="flex flex-col lg:flex-row gap-8 xl:gap-12 items-start mb-16">
          
          {/* LEFT: GALLERY (~42%) */}
          <div className="w-full lg:w-[42%] flex flex-col gap-4">
            {/* Main Image */}
            <div className="relative aspect-[4/3] bg-white rounded-2xl overflow-hidden flex items-center justify-center group shadow-sm border border-slate-100">
              <img src={activeImage} alt={displayProduct.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-700" />
              {displayProduct.flashSalePrice ? (
                <div className="absolute top-4 left-4 bg-yellow-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-white" />
                  Flash Sale
                </div>
              ) : displayProduct.isBestSeller && (
                <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                  Best Seller
                </div>
              )}
              <div onClick={() => setIsZoomModalOpen(true)} className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-slate-700 text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-white transition-colors border border-slate-200">
                <MapPin className="w-3 h-3" /> Xem phóng to
              </div>
              <button className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0">
                <ChevronRight className="w-4 h-4 rotate-180 text-slate-600" />
              </button>
              <button className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0">
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            
            {/* Thumbnails */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 hide-scrollbar">
              {thumbnails.map((thumb, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setActiveImage(thumb)}
                  className={`relative w-[80px] md:w-[95px] aspect-[4/3] rounded-lg overflow-hidden flex-shrink-0 bg-white transition-all duration-300 ${activeImage === thumb ? 'border-[1.5px] border-red-600 shadow-sm' : 'border border-slate-200 hover:border-slate-300'}`}
                >
                  <img src={thumb} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover mix-blend-multiply" />
                </button>
              ))}
            </div>
          </div>

          {/* CENTER: INFO (~33%) */}
          <div className="flex-1 flex flex-col pt-2">
            
            <div className="flex items-center justify-between mb-3">
              <span className="bg-[#FFF8F3] text-red-600 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">
                {category?.name || 'SUSHI'}
              </span>
              <button 
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={`transition-colors ${isWishlisted ? 'text-red-500' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            <h1 className="text-3xl lg:text-4xl font-serif font-bold text-slate-900 leading-tight mb-3 tracking-tight">
              {displayProduct.name}
            </h1>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(star => (
                  <Star key={star} className={`w-3.5 h-3.5 ${star === 5 ? 'fill-yellow-400 text-yellow-400 opacity-50' : 'fill-yellow-400 text-yellow-400'}`} />
                ))}
                <span className="text-slate-800 font-bold ml-1 text-sm">{displayProduct.avgRating > 0 ? displayProduct.avgRating.toFixed(1) : "5.0"}</span>
                <span className="text-slate-400 text-xs ml-1">({displayProduct.soldQuantity > 0 ? displayProduct.soldQuantity : 128} đánh giá)</span>
              </div>
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span className="text-slate-500 text-xs">Đã bán {displayProduct.soldQuantity > 0 ? displayProduct.soldQuantity : getSoldCount(displayProduct.id)}</span>
            </div>

            {displayProduct.description && (
              <p className="text-slate-600 text-[14px] leading-relaxed mb-6">
                {displayProduct.description}
              </p>
            )}

            {/* TRUST FEATURES ROW */}
            <div className="flex items-center justify-between border-y border-slate-200 py-4 mb-6">
              <div className="flex flex-col items-center justify-center text-center px-1 gap-1.5 flex-1">
                <Leaf className="w-4 h-4 text-slate-400 stroke-[1.5]" />
                <span className="text-[9px] text-slate-500 font-medium leading-tight">Nguyên liệu<br/>tươi mỗi ngày</span>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="flex flex-col items-center justify-center text-center px-1 gap-1.5 flex-1">
                <ChefHat className="w-4 h-4 text-slate-400 stroke-[1.5]" />
                <span className="text-[9px] text-slate-500 font-medium leading-tight">Chế biến bởi<br/>đầu bếp Nhật</span>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="flex flex-col items-center justify-center text-center px-1 gap-1.5 flex-1">
                <Timer className="w-4 h-4 text-slate-400 stroke-[1.5]" />
                <span className="text-[9px] text-slate-500 font-medium leading-tight">Giao hàng<br/>nhanh 30 phút</span>
              </div>
              <div className="w-px h-8 bg-slate-200"></div>
              <div className="flex flex-col items-center justify-center text-center px-1 gap-1.5 flex-1">
                <RotateCcw className="w-4 h-4 text-slate-400 stroke-[1.5]" />
                <span className="text-[9px] text-slate-500 font-medium leading-tight">Đổi trả<br/>dễ dàng</span>
              </div>
            </div>

            {/* ATTRIBUTES TABLE */}
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 border-dashed">
                <span className="text-slate-500 font-bold">Danh mục:</span>
                <span className="text-slate-800 font-medium">{category?.name || 'Chưa phân loại'}</span>
              </div>
              
              {displayProduct.targetAudience && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 border-dashed">
                  <span className="text-slate-500 font-bold">Phù hợp:</span>
                  <span className="text-slate-800 font-medium">{displayProduct.targetAudience}</span>
                </div>
              )}

              {displayProduct.spiciness > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 border-dashed">
                  <span className="text-slate-500 font-bold">Độ cay:</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className={i < displayProduct.spiciness ? "text-[#E55B32]" : "text-slate-300 grayscale opacity-30"}>🌶</span>
                    ))}
                  </div>
                </div>
              )}

              {displayProduct.unit && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 border-dashed">
                  <span className="text-slate-500 font-bold">Đơn vị tính:</span>
                  <span className="text-slate-800 font-medium">{displayProduct.unit}</span>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT: PURCHASE CARD (~25%) */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-6 xl:p-8 sticky top-24">
            
            {displayProduct.flashSalePrice && (
              <div className="w-full bg-[#FFF4ED] border border-red-600/30 rounded-xl p-3 mb-5 flex flex-col gap-1 items-center justify-center relative overflow-hidden">
                <div className="flex items-center gap-1.5 text-red-600 font-black text-sm uppercase tracking-wider">
                  <Zap className="w-4 h-4 fill-current" />
                  FLASH SALE
                </div>
                <div className="text-[#3E2723] font-bold text-lg font-mono flex items-center gap-2">
                  <span className="text-xs font-medium text-red-600 uppercase">Kết thúc sau:</span>
                  {timeLeft || "00:00:00"}
                </div>
              </div>
            )}

            <p className="text-slate-500 text-xs font-bold mb-1">Giá</p>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-3xl font-serif font-bold text-red-600">{(displayProduct.flashSalePrice || displayProduct.price).toLocaleString('vi-VN')}₫</span>
              {(displayProduct.flashSalePrice ? true : !!displayProduct.oldPrice) && (
                <span className="text-sm text-slate-400 line-through">{displayProduct.price.toLocaleString('vi-VN')}₫</span>
              )}
            </div>

            <p className="text-slate-800 text-sm font-bold mb-3">Số lượng</p>
            <div className="flex items-center w-full border border-slate-200 rounded-xl overflow-hidden bg-white h-[46px] mb-6">
              <button onClick={() => setLocalQuantity(Math.max(1, localQuantity - 1))} className="w-12 h-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
                <Minus className="w-4 h-4" />
              </button>
              <span className="flex-1 text-center font-bold text-slate-800 text-sm">{localQuantity}</span>
              <button onClick={() => setLocalQuantity(localQuantity + 1)} className="w-12 h-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {!isAvailableHere && (
                <div className="text-red-500 font-medium text-xs flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3.5 h-3.5" /> Món không có sẵn tại chi nhánh.
                </div>
              )}
              <button 
                onClick={handleAddToCart}
                className="w-full bg-red-600 hover:bg-red-700 text-white h-[48px] rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" /> Thêm vào giỏ hàng
              </button>
              <button 
                onClick={handleBuyNow}
                className="w-full bg-white border border-red-600 text-red-600 hover:bg-red-50 h-[48px] rounded-xl font-bold text-[14px] transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Đặt món ngay
              </button>
            </div>

            {/* MEMBER INFO */}
            {!isLoggedIn && (
              <div className="bg-[#FCF9F5] rounded-xl p-4 mt-6 border border-[#F2ECE4] flex gap-3">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-[#F2ECE4]">
                  <Star className="w-3 h-3 text-red-600 fill-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-slate-800 text-[11px] font-bold mb-1">Thành viên Avora Member</p>
                  <p className="text-slate-500 text-[10px] leading-relaxed">
                    Tích lũy điểm cho mỗi đơn hàng và nhận ưu đãi. <Link href="/login" className="text-red-600 hover:underline font-bold">Đăng nhập</Link> ngay.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 4. PRODUCT DETAILS & SIMILAR PRODUCTS */}
        <div className="flex flex-col lg:flex-row gap-8 xl:gap-12 items-start mb-16 relative">
          
          {/* TABS (Same width as Left Gallery) */}
          <div className="w-full lg:w-[42%] flex flex-col bg-white rounded-3xl border border-slate-100 overflow-hidden relative shadow-sm">
            {/* Japanese decorative background inside tabs */}
            <div className="absolute inset-x-0 bottom-0 h-48 bg-[url('https://www.transparenttextures.com/patterns/japanese-sayagata.png')] opacity-[0.03] pointer-events-none" />

            <div className="flex flex-nowrap whitespace-nowrap overflow-x-auto hide-scrollbar border-b border-slate-100 relative z-10 px-4">
              {['description', 'ingredients', 'reviews'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-[13px] font-bold transition-colors relative ${activeTab === tab ? 'text-red-600' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {tab === 'description' && 'Mô tả'}
                  {tab === 'ingredients' && 'Thành phần'}
                  {tab === 'reviews' && 'Đánh giá (128)'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600"></div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8 relative z-10 min-h-[300px]">
              {activeTab === 'description' && (
                <div className="animate-in fade-in duration-300">
                  <h3 className="text-base font-serif font-bold text-slate-800 mb-3">Giới thiệu món ăn</h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                    {displayProduct.description || "Chưa có giới thiệu cho món ăn này."}
                  </p>
                </div>
              )}
              {activeTab === 'ingredients' && (
                <div className="animate-in fade-in duration-300">
                  <h3 className="text-base font-serif font-bold text-slate-800 mb-4">Thành phần chi tiết</h3>
                  <div className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                    {displayProduct.post || "Đang cập nhật thành phần từ cơ sở dữ liệu."}
                  </div>
                </div>
              )}
              {activeTab === 'reviews' && (
                <div className="animate-in fade-in duration-300">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-3xl font-serif text-slate-800 font-bold">4.8</h3>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex">
                        {[1,2,3,4,5].map(star => <Star key={star} className={`w-3.5 h-3.5 ${star === 5 ? 'fill-yellow-400 text-yellow-400 opacity-50' : 'fill-yellow-400 text-yellow-400'}`} />)}
                      </div>
                      <span className="text-[11px] text-slate-500">Dựa trên 128 đánh giá</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="pb-4 border-b border-slate-100">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 text-[10px]">P</div>
                          <div>
                            <p className="text-[13px] font-bold text-slate-800 leading-none mb-1">Phát Trần</p>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(star => <Star key={star} className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />)}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] text-slate-400">2 ngày trước</span>
                      </div>
                      <p className="text-[13px] text-slate-600 mt-1.5">Cá hồi rất tươi, sốt béo ngậy. Ăn một lần là ghiền luôn.</p>
                    </div>
                    <button className="text-[#E55B32] font-bold text-[13px] w-full py-1.5 hover:bg-[#FFF8F3] rounded-lg transition-colors">Xem tất cả đánh giá</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SIMILAR PRODUCTS (Remaining width) */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-2">
              <div className="relative">
                <h2 className="text-xl font-serif font-bold text-slate-800 relative z-10 flex items-center gap-2">
                  <span className="bg-[#FFF8F3] text-red-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest">Gợi ý</span>
                  Món Tương Tự
                </h2>
              </div>
              <Link href={`/${category?.slug || 'menu'}`} className="text-red-600 font-bold text-[12px] hover:underline flex items-center gap-1 mb-1">Xem tất cả <ArrowRight className="w-3 h-3" /></Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRelatedDishes.slice(0,4).map((item: any) => (
                <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-2.5 flex flex-col group hover:-translate-y-1 hover:shadow-lg hover:border-slate-200 transition-all duration-300">
                  <Link href={`/${category?.slug || 'menu'}/${item.slug}`} className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3 bg-[#F7F5F0]">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                  </Link>
                  <Link href={`/${category?.slug || 'menu'}/${item.slug}`}>
                    <h4 className="font-bold text-slate-800 text-[12px] md:text-[13px] mb-1 leading-tight line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h4>
                  </Link>
                  <div className="flex items-center gap-1 mb-2 text-[9px] text-slate-500">
                    <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-slate-700">{item.avgRating > 0 ? item.avgRating.toFixed(1) : "4.7"}</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-slate-800">{(item.flashSalePrice || item.price).toLocaleString('vi-VN')}₫</span>
                    </div>
                    <button 
                      onClick={(e) => handleQuickAdd(e, item)}
                      className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-red-600 group-hover:border-red-600 group-hover:text-white transition-all shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {recentlyViewed.length > 0 && (
              <div className="mt-12 animate-in fade-in duration-500">
                <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-2">
                  <div className="relative">
                    <h2 className="text-xl font-serif font-bold text-slate-800 relative z-10 flex items-center gap-2">
                      Món Vừa Xem
                    </h2>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {recentlyViewed.slice(0, 4).map((item: any) => (
                    <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-2.5 flex flex-col group hover:-translate-y-1 hover:shadow-lg hover:border-slate-200 transition-all duration-300">
                      <Link href={`/${item.category?.slug || 'menu'}/${item.slug}`} className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3 bg-[#F7F5F0]">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                      </Link>
                      <Link href={`/${item.category?.slug || 'menu'}/${item.slug}`}>
                        <h4 className="font-bold text-slate-800 text-[12px] md:text-[13px] mb-1 leading-tight line-clamp-2 group-hover:text-red-600 transition-colors">{item.name}</h4>
                      </Link>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-slate-800">{(item.flashSalePrice || item.price).toLocaleString('vi-VN')}₫</span>
                        </div>
                        <button 
                          onClick={(e) => handleQuickAdd(e, item)}
                          className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 group-hover:bg-red-600 group-hover:border-red-600 group-hover:text-white transition-all shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 6. SERVICE INFORMATION */}
        <div className="bg-[#FBF7F2] rounded-2xl py-6 px-6 lg:px-12 flex flex-row flex-nowrap whitespace-nowrap overflow-x-auto hide-scrollbar justify-between items-center gap-6 divide-x divide-[#E8E0D5]">
          <div className="flex items-center justify-center gap-3 pr-4">
            <Leaf className="w-6 h-6 text-red-600 stroke-[1.5] shrink-0" />
            <div>
              <p className="font-bold text-slate-800 text-[12px]">Nguyên liệu thượng hạng</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Tươi ngon mỗi ngày</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 px-4">
            <ChefHat className="w-6 h-6 text-red-600 stroke-[1.5] shrink-0" />
            <div>
              <p className="font-bold text-slate-800 text-[12px]">Chế biến chuẩn Nhật</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Đầu bếp giàu kinh nghiệm</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 px-4">
            <Timer className="w-6 h-6 text-red-600 stroke-[1.5] shrink-0" />
            <div>
              <p className="font-bold text-slate-800 text-[12px]">Giao hàng 30 phút</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Nóng hổi tận tay</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 pl-4">
            <Heart className="w-6 h-6 text-red-600 stroke-[1.5] shrink-0" />
            <div>
              <p className="font-bold text-slate-800 text-[12px]">Hỗ trợ 24/7</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Luôn sẵn sàng phục vụ</p>
            </div>
          </div>
        </div>

      </div>

      {/* ZOOM MODAL */}
      {isZoomModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-sm flex items-center justify-center" onClick={() => setIsZoomModalOpen(false)}>
          <button className="absolute top-6 right-6 text-white bg-white/20 hover:bg-white/40 p-2 rounded-full transition-colors">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
          <img src={activeImage} alt={displayProduct.name} className="max-w-[95%] max-h-[95vh] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
