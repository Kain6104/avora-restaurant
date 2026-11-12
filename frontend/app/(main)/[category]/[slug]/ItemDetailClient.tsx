"use client";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, Star, Heart, MapPin, Leaf, ChefHat, Timer, RotateCcw, Plus, Minus, ShoppingCart, Zap, Home, ArrowRight, ZoomIn, BookOpen, Play, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { useCart } from '../../../../context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductRatingBadge from '@/components/reviews/ProductRatingBadge';
import ProductReviewsSection from '@/components/reviews/ProductReviewsSection';
import ImageViewerModal from '@/components/product/ImageViewerModal';
import { getProductSoldCount, parseVideoEmbed } from '@/lib/utils/product-utils';

interface ItemDetailClientProps {
  product: any;
  relatedDishes: any[];
  relatedArticles?: any[];
}

export default function ItemDetailClient({ product, relatedDishes, relatedArticles = [] }: ItemDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentBranchId, flashSaleQuotas, cartItems, setBranchModalProduct, setIsBranchModalOpen, addToCart, updateQuantity, removeFromCart } = useCart();
  const { isFavorite, toggleFavorite } = useWishlist();
  const [activeTab, setActiveTab] = useState(() => {
    return (searchParams?.get('openReview') === '1' || searchParams?.get('tab') === 'reviews') ? 'reviews' : 'description';
  });
  const [localQuantity, setLocalQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(product?.imageUrl);
  const isWishlisted = isFavorite(product?.id);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const videoEmbed = useMemo(() => parseVideoEmbed(product?.videoUrl), [product?.videoUrl]);
  const hasVideo = videoEmbed.type !== 'none';
  const [mediaMode, setMediaMode] = useState<'video' | 'image'>(product?.videoUrl ? 'video' : 'image');

  useEffect(() => {
    if (product?.videoUrl) {
      setMediaMode('video');
    } else {
      setMediaMode('image');
    }
  }, [product?.videoUrl]);

  useEffect(() => {
    setIsMounted(true);
    if (product?.id === 'prod-ai-meal-architect' || product?.slug === 'ai-meal-architect') {
      router.replace('/menu');
      return;
    }
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    setIsLoggedIn(!!(token || user));
  }, [product, router]);

  useEffect(() => {
    if (searchParams?.get('openReview') === '1' || searchParams?.get('tab') === 'reviews') {
      setActiveTab('reviews');
      setTimeout(() => {
        document.getElementById('product-tabs-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, [searchParams]);

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

  const productCartItems = useMemo(() => {
    return cartItems?.filter((i: any) => i.productId === displayProduct.id) || [];
  }, [cartItems, displayProduct.id]);
  const inCartQuantity = useMemo(() => {
    return productCartItems.reduce((acc: number, curr: any) => acc + curr.quantity, 0);
  }, [productCartItems]);
  const cartItemToDecrease = productCartItems[productCartItems.length - 1];

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

  const allImages = useMemo(() => {
    const list: string[] = [];
    if (displayProduct.imageUrl) list.push(displayProduct.imageUrl);

    const rawSecondary = displayProduct.secondaryImages;
    let secondaryList: string[] = [];
    if (Array.isArray(rawSecondary)) {
      secondaryList = rawSecondary;
    } else if (typeof rawSecondary === 'string' && rawSecondary.trim()) {
      try {
        const parsed = JSON.parse(rawSecondary);
        if (Array.isArray(parsed)) secondaryList = parsed;
        else if (typeof parsed === 'string') secondaryList = [parsed];
      } catch {
        secondaryList = rawSecondary.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
    }

    secondaryList.forEach((url: string) => {
      if (url && typeof url === 'string' && url.trim() && !list.includes(url.trim())) {
        list.push(url.trim());
      }
    });

    return list.length > 0 ? list : [displayProduct.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'];
  }, [displayProduct.imageUrl, displayProduct.secondaryImages]);

  // Keep activeImage synced if product changes
  useEffect(() => {
    if (allImages.length > 0 && !allImages.includes(activeImage)) {
      setActiveImage(allImages[0]);
    }
  }, [allImages, activeImage]);

  const handleAddToCart = (): boolean => {
    if (!isAvailableHere) {
      setBranchModalProduct(displayProduct);
      setIsBranchModalOpen(true);
      toast.error('Món ăn không có sẵn tại chi nhánh hiện tại. Vui lòng đổi chi nhánh!');
      return false;
    }
    const priceAtSale = displayProduct.flashSalePrice || displayProduct.price;
    const cartItem = {
      id: displayProduct.id,
      productId: displayProduct.id,
      name: displayProduct.name,
      originalPriceAtSale: displayProduct.price,
      priceAtSale,
      quantity: inCartQuantity > 0 ? 1 : localQuantity,
      imageUrl: displayProduct.imageUrl,
      isFlashSaleItem: !!displayProduct.flashSalePrice,
      flashSaleId: displayProduct.flashSaleId,
      maxQuantityPerUser: displayProduct.maxQuantityPerUser,
      rawProduct: displayProduct
    };
    const added = addToCart(cartItem, currentBranchId || 'AVO-Q1');
    if (added && inCartQuantity === 0) {
      setLocalQuantity(1);
    }
    return added;
  };

  const handleBuyNow = () => {
    if (!isAvailableHere) {
      setBranchModalProduct(displayProduct);
      setIsBranchModalOpen(true);
      toast.error('Món ăn không có sẵn tại chi nhánh hiện tại. Vui lòng đổi chi nhánh!');
      return;
    }
    if (inCartQuantity === 0) {
      const added = handleAddToCart();
      if (added) {
        router.push('/checkout');
      }
    } else {
      router.push('/checkout');
    }
  };

  const handleQuickAdd = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    if (item.branches && item.branches.length > 0) {
      if (currentBranchId && !item.branches.some((b:any)=>b.id === currentBranchId)) {
        setBranchModalProduct(item);
        setIsBranchModalOpen(true);
        toast.error('Món ăn không có sẵn tại chi nhánh hiện tại. Vui lòng đổi chi nhánh!');
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
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 md:px-10 lg:px-12 pt-4 sm:pt-6">
        
        {/* 2. BREADCRUMB */}
        <nav className="flex flex-nowrap whitespace-nowrap overflow-x-auto hide-scrollbar items-center gap-2 text-[12px] text-slate-500 mb-6 sm:mb-8 font-medium">
          <Link href="/" className="hover:text-slate-800 transition-colors flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> Trang chủ</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <Link href="/menu" className="hover:text-slate-800 transition-colors">Thực đơn</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <Link href={`/${category?.slug || 'menu'}`} className="hover:text-slate-800 transition-colors uppercase">{category?.name || 'Danh mục'}</Link>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900 font-bold">{displayProduct.name}</span>
        </nav>

        {/* 3. PRODUCT HERO: 3 Columns (items-stretch on mobile for full width, items-start on lg desktop) */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 xl:gap-12 items-stretch lg:items-start mb-12 lg:mb-16">
          
          {/* LEFT: GALLERY (~42%) */}
          <div className="w-full lg:w-[42%] flex flex-col gap-3 shrink-0">
            {/* Top Media Switcher (Khi món có Video Review) */}
            {hasVideo && (
              <div className="flex items-center justify-between gap-2 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMediaMode('video')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      mediaMode === 'video'
                        ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Video Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode('image')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      mediaMode === 'image'
                        ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Bộ sưu tập ảnh ({allImages.length})</span>
                  </button>
                </div>

                {displayProduct.videoUrl && (
                  <a
                    href={displayProduct.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors px-2"
                    title="Mở video trong tab mới"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}

            {/* Main Media Box: Video or Image */}
            {mediaMode === 'video' && hasVideo ? (
              <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden flex items-center justify-center shadow-md border border-slate-200">
                {videoEmbed.type === 'youtube' ? (
                  <iframe
                    src={videoEmbed.embedUrl!}
                    title={`Video review ${displayProduct.name}`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : videoEmbed.type === 'tiktok' ? (
                  <iframe
                    src={videoEmbed.embedUrl!}
                    title={`TikTok review ${displayProduct.name}`}
                    className="w-full h-full border-0"
                    allow="fullscreen"
                    allowFullScreen
                  />
                ) : videoEmbed.type === 'direct' ? (
                  <video
                    src={videoEmbed.embedUrl!}
                    controls
                    playsInline
                    className="w-full h-full object-contain bg-black"
                  />
                ) : (
                  <iframe
                    src={videoEmbed.embedUrl!}
                    title={`Video review ${displayProduct.name}`}
                    className="w-full h-full border-0"
                    allowFullScreen
                  />
                )}

                {/* Floating Video Badge */}
                <div className="absolute top-3 left-3 bg-red-600/95 backdrop-blur-xs text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md flex items-center gap-1.5 pointer-events-none z-10">
                  <Play className="w-3 h-3 fill-white" />
                  <span>Video Review Món</span>
                </div>
              </div>
            ) : (
              <div className="relative aspect-[4/3] bg-[#FAF9F6] rounded-2xl overflow-hidden flex items-center justify-center group shadow-sm border border-slate-100">
                <img src={activeImage} alt={displayProduct.name} className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" />
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
                <div onClick={() => setIsZoomModalOpen(true)} className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm text-slate-800 text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 cursor-pointer hover:bg-white hover:text-red-600 transition-colors border border-slate-200/80">
                  <ZoomIn className="w-3.5 h-3.5 text-red-600" /> Xem phóng to
                </div>
                {allImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const curIdx = allImages.indexOf(activeImage);
                        const prevIdx = (curIdx - 1 + allImages.length) % allImages.length;
                        setActiveImage(allImages[prevIdx]);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 bg-white/95 hover:bg-white rounded-full flex items-center justify-center shadow-md border border-slate-100 transition-all cursor-pointer z-10"
                      title="Ảnh trước"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-700 rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const curIdx = allImages.indexOf(activeImage);
                        const nextIdx = (curIdx + 1) % allImages.length;
                        setActiveImage(allImages[nextIdx]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 bg-white/95 hover:bg-white rounded-full flex items-center justify-center shadow-md border border-slate-100 transition-all cursor-pointer z-10"
                      title="Ảnh tiếp theo"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-700" />
                    </button>
                  </>
                )}
              </div>
            )}
            
            {/* Thumbnails Strip */}
            {(hasVideo || allImages.length > 1) && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 hide-scrollbar">
                {/* Video Review Thumbnail Card */}
                {hasVideo && (
                  <button
                    type="button"
                    onClick={() => setMediaMode('video')}
                    className={`relative w-[68px] sm:w-[76px] aspect-square rounded-xl overflow-hidden flex-shrink-0 bg-slate-900 p-1 flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                      mediaMode === 'video'
                        ? 'border-2 border-red-600 shadow-md ring-2 ring-red-100'
                        : 'border border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                    }`}
                    title="Xem Video Review món ăn"
                  >
                    {videoEmbed.type === 'youtube' && videoEmbed.videoId ? (
                      <img
                        src={`https://img.youtube.com/vi/${videoEmbed.videoId}/hqdefault.jpg`}
                        alt="Video thumbnail"
                        className="absolute inset-0 w-full h-full object-cover opacity-60"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-slate-900 to-black" />
                    )}
                    <div className="relative z-10 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                    <span className="relative z-10 text-[9px] font-black text-white mt-1 drop-shadow-md tracking-tight uppercase">VIDEO</span>
                  </button>
                )}

                {/* Photos Thumbnails */}
                {allImages.map((thumb, idx) => (
                  <button 
                    key={idx} 
                    type="button"
                    onClick={() => {
                      setMediaMode('image');
                      setActiveImage(thumb);
                    }}
                    className={`relative w-[68px] sm:w-[76px] aspect-square rounded-xl overflow-hidden flex-shrink-0 bg-[#FAF9F6] p-1 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      mediaMode === 'image' && activeImage === thumb 
                        ? 'border-2 border-red-600 shadow-sm ring-2 ring-red-100' 
                        : 'border border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={thumb} alt={`Thumbnail ${idx}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CENTER: INFO (~33%) */}
          <div className="w-full flex-1 flex flex-col pt-1 sm:pt-2">
            
            <div className="flex items-center justify-between mb-3">
              <span className="bg-[#FFF8F3] text-red-600 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded">
                {category?.name || 'SUSHI'}
              </span>
              <button 
                onClick={() => toggleFavorite(displayProduct)}
                className={`p-2 rounded-full transition-all ${isWishlisted ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-red-500 hover:bg-slate-50'}`}
                title={isWishlisted ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
              >
                <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current text-red-500' : ''}`} />
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-slate-900 leading-tight mb-3 tracking-tight">
              {displayProduct.name}
            </h1>

            <div className="flex items-center gap-3 mb-5">
              <ProductRatingBadge avgRating={displayProduct.avgRating} ratingCount={displayProduct.ratingCount} size="md" />
              <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
              <span className="text-slate-500 text-xs">Đã bán {getProductSoldCount(displayProduct)}</span>
            </div>

            {displayProduct.description && (
              <div 
                className="text-slate-600 text-[13.5px] sm:text-[14px] leading-relaxed mb-6 [&_div]:!m-0 [&_p]:!m-0"
                dangerouslySetInnerHTML={{ __html: displayProduct.description }}
              />
            )}

            {/* TRUST FEATURES ROW */}
            <div className="flex items-center justify-between border-y border-slate-200 py-3.5 sm:py-4 mb-6">
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
            <div className="flex flex-col gap-2.5 text-xs sm:text-sm">
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

              {displayProduct.unit && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 border-dashed">
                  <span className="text-slate-500 font-bold">Đơn vị tính:</span>
                  <span className="text-slate-800 font-medium">{displayProduct.unit}</span>
                </div>
              )}

              {/* ĐỘ CAY (5 trái ớt, 5 mức 0-4, 0 là không cay) nằm dưới Đơn vị tính */}
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 border-dashed">
                <span className="text-slate-500 font-bold">Độ cay:</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const rawSpicy = Number(displayProduct.spiciness ?? displayProduct.spicyLevel ?? 0);
                      const spicyLevel = Math.min(4, Math.max(0, isNaN(rawSpicy) ? 0 : rawSpicy));
                      const isHot = i < spicyLevel;
                      return (
                        <span 
                          key={i} 
                          className={`text-sm select-none transition-transform duration-200 ${
                            isHot 
                              ? 'filter drop-shadow-sm scale-105' 
                              : 'grayscale opacity-25'
                          }`}
                          title={`Mức độ cay: ${spicyLevel}/4`}
                        >
                          🌶️
                        </span>
                      );
                    })}
                  </div>
                  {(() => {
                    const rawSpicy = Number(displayProduct.spiciness ?? displayProduct.spicyLevel ?? 0);
                    const spicyLevel = Math.min(4, Math.max(0, isNaN(rawSpicy) ? 0 : rawSpicy));
                    if (spicyLevel === 0) {
                      return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Không cay</span>;
                    }
                    if (spicyLevel === 1) {
                      return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Cay nhẹ (1/4)</span>;
                    }
                    if (spicyLevel === 2) {
                      return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">Cay vừa (2/4)</span>;
                    }
                    if (spicyLevel === 3) {
                      return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Cay nồng (3/4)</span>;
                    }
                    return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 animate-pulse">Siêu cay (4/4) 🔥</span>;
                  })()}
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT: PURCHASE CARD (~25%) */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-4 sm:p-6 xl:p-8 sticky top-24">
            
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
            <div className="flex items-baseline gap-2 mb-5 sm:mb-6">
              <span className="text-2xl sm:text-3xl font-serif font-bold text-red-600">{(displayProduct.flashSalePrice || displayProduct.price).toLocaleString('vi-VN')}₫</span>
              {(displayProduct.flashSalePrice ? true : !!displayProduct.oldPrice) && (
                <span className="text-sm text-slate-400 line-through">{displayProduct.price.toLocaleString('vi-VN')}₫</span>
              )}
            </div>

            {/* SYNCED CART QUANTITY STEPPER */}
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-slate-800 text-xs sm:text-sm font-bold">Số lượng</p>
              {inCartQuantity > 0 && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Trong giỏ: {inCartQuantity}
                </span>
              )}
            </div>

            {inCartQuantity > 0 ? (
              <div className="flex items-center w-full border-2 border-red-200 bg-red-50/50 rounded-xl overflow-hidden h-[44px] sm:h-[46px] mb-5 sm:mb-6 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (cartItemToDecrease) {
                      if (cartItemToDecrease.quantity > 1) {
                        updateQuantity(cartItemToDecrease.id, cartItemToDecrease.quantity - 1);
                      } else {
                        removeFromCart(cartItemToDecrease.id);
                      }
                    }
                  }}
                  className="w-12 h-full flex items-center justify-center text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                  title="Giảm bớt 1 món trong giỏ hàng"
                >
                  <Minus className="w-4 h-4 stroke-[2.5]" />
                </button>
                <span className="flex-1 text-center font-black text-red-600 text-base">{inCartQuantity}</span>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-12 h-full flex items-center justify-center text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer"
                  title="Tăng thêm 1 món vào giỏ hàng"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center w-full border border-slate-200 rounded-xl overflow-hidden bg-white h-[44px] sm:h-[46px] mb-5 sm:mb-6">
                <button onClick={() => setLocalQuantity(Math.max(1, localQuantity - 1))} className="w-12 h-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="flex-1 text-center font-bold text-slate-800 text-sm">{localQuantity}</span>
                <button onClick={() => setLocalQuantity(localQuantity + 1)} className="w-12 h-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:gap-3">
              {!isAvailableHere && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2 mb-1">
                  <div className="text-red-600 font-medium text-xs flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-red-600" />
                    <span>Món không có sẵn tại chi nhánh này.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBranchModalProduct(displayProduct);
                      setIsBranchModalOpen(true);
                    }}
                    className="text-xs font-bold text-red-700 hover:text-red-900 underline shrink-0 cursor-pointer"
                  >
                    Đổi chi nhánh
                  </button>
                </div>
              )}
              <button 
                onClick={handleAddToCart}
                className="w-full bg-red-600 hover:bg-red-700 text-white h-[46px] sm:h-[48px] rounded-xl font-bold text-[13px] sm:text-[14px] transition-colors flex items-center justify-center gap-2 shadow-sm shadow-red-600/20 active:scale-[0.99]"
              >
                <ShoppingCart className="w-4 h-4" />
                {inCartQuantity > 0 ? `Thêm tiếp vào giỏ (+1)` : 'Thêm vào giỏ hàng'}
              </button>
              <button 
                onClick={handleBuyNow}
                className="w-full bg-white border border-red-600 text-red-600 hover:bg-red-50 h-[46px] sm:h-[48px] rounded-xl font-bold text-[13px] sm:text-[14px] transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <Zap className="w-4 h-4" /> Đặt món ngay
              </button>
            </div>

            {/* MEMBER INFO */}
            {isMounted && !isLoggedIn && (
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
        <div id="product-tabs-section" className="flex flex-col lg:flex-row gap-8 xl:gap-12 items-start mb-16 relative">
          
          {/* TABS */}
          <div className={`w-full ${activeTab === 'reviews' ? 'lg:w-[62%]' : 'lg:w-[42%]'} transition-all duration-300 flex flex-col bg-white rounded-3xl border border-slate-100 overflow-hidden relative shadow-sm`}>
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
                  {tab === 'reviews' && `Đánh giá (${displayProduct.ratingCount || 0})`}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600"></div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8 relative z-10 min-h-[300px]">
              {activeTab === 'description' && (
                <div className="animate-in fade-in duration-300">
                  <div 
                    className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap [&_div]:!m-0 [&_p]:!m-0"
                    dangerouslySetInnerHTML={{ __html: displayProduct.description || "Chưa có giới thiệu cho món ăn này." }}
                  />
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
                  <ProductReviewsSection
                    productId={displayProduct.id}
                    productName={displayProduct.name}
                    initialOpenComposer={searchParams?.get('openReview') === '1'}
                  />
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
                  <Link href={`/${category?.slug || 'menu'}/${item.slug}`} className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-[#FAF9F6] flex items-center justify-center p-1.5">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
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
                      <Link href={`/${item.category?.slug || 'menu'}/${item.slug}`} className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3 bg-[#FAF9F6] flex items-center justify-center p-1.5">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
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

        {/* 5. BÀI VIẾT NHẮC ĐẾN MÓN ĂN (FULL 100% WIDTH PHÍA DƯỚI) */}
        {relatedArticles && relatedArticles.length > 0 && (
          <div className="w-full mb-16 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-3">
              <div>
                <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-[11px] uppercase font-bold tracking-wider border border-red-200/60 inline-flex items-center gap-1.5 mb-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Cẩm nang ẩm thực
                </span>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-slate-800">
                  Bài Viết Nhắc Đến Món Này
                </h2>
              </div>
              <Link href="/news" className="text-red-600 font-bold text-xs sm:text-sm hover:underline flex items-center gap-1 mb-1 shrink-0">
                Xem tất cả bài viết <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {relatedArticles.map((article: any) => {
                const thumb = article.thumbnailUrl || article.thumbnail || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500';
                return (
                  <Link
                    key={article.id}
                    href={`/news/${article.slug}`}
                    className="group bg-white border border-slate-200/80 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:border-red-200 transition-all duration-300 flex flex-col"
                  >
                    {/* Thumbnail */}
                    <div className="w-full aspect-[16/10] overflow-hidden bg-slate-100 relative">
                      <img
                        src={thumb}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {article.type && (
                        <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {article.type}
                        </div>
                      )}
                    </div>

                    {/* Article Info */}
                    <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 group-hover:text-red-600 transition-colors leading-snug mb-1.5">
                          {article.title}
                        </h4>
                        {article.excerpt && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {article.excerpt}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-3 pt-2.5 border-t border-slate-100">
                        <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('vi-VN') : 'Mới cập nhật'}</span>
                        <span className="text-red-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                          Đọc bài <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

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

      {/* 7. SUPER UPGRADED ZOOM VIEWER MODAL */}
      <ImageViewerModal
        isOpen={isZoomModalOpen}
        onClose={() => setIsZoomModalOpen(false)}
        images={allImages}
        initialIndex={Math.max(0, allImages.indexOf(activeImage))}
        productName={displayProduct.name}
      />

      <style dangerouslySetInnerHTML={{
        __html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
