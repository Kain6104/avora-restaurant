"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, ArrowRight, Truck, Disc, ShieldCheck, CreditCard, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Banner {
  id: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
  altText: string | null;
  linkUrl: string | null;
  title?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  popup?: boolean;
  position?: string;
  bannerOrder?: number;
}

interface HeroBannerProps {
  slides: Banner[];
}

export default function HeroBanner({ slides }: HeroBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const lastClickRef = useRef<{ [bannerId: string]: number }>({});

  // Sinh hoặc lấy sessionId lưu trong sessionStorage để định danh phiên lướt web
  const getSessionId = useCallback(() => {
    if (typeof window === 'undefined') return '';
    let sid = sessionStorage.getItem('avora_user_session_id');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      sessionStorage.setItem('avora_user_session_id', sid);
    }
    return sid;
  }, []);

  // Lọc banner hợp lệ theo thời gian thực (tránh banner hết hạn hoặc chưa tới ngày)
  const validSlides = useMemo(() => {
    if (!slides || !Array.isArray(slides)) return [];
    const now = new Date();
    return slides.filter((slide) => {
      if (slide.startDate && new Date(slide.startDate) > now) return false;
      if (slide.endDate && new Date(slide.endDate) < now) return false;
      return true;
    });
  }, [slides]);

  const popupBanner = useMemo(() => validSlides.find((s) => s.popup || s.position === 'POPUP'), [validSlides]);
  const carouselSlides = useMemo(() => validSlides.filter((s) => !s.popup && s.position !== 'POPUP'), [validSlides]);

  // Quản lý popup hiển thị 1 lần / phiên
  useEffect(() => {
    if (popupBanner) {
      const closed = sessionStorage.getItem('closedPopup_' + popupBanner.id);
      if (!closed) {
        setShowPopup(true);
      }
    }
  }, [popupBanner]);

  const closePopup = () => {
    setShowPopup(false);
    if (popupBanner) {
      sessionStorage.setItem('closedPopup_' + popupBanner.id, 'true');
    }
  };

  /* ==========================================================================
     TRACKING TƯƠNG TÁC (VIEW & CLICK) CHỐNG SPAM / DEDUPLICATE
     ========================================================================== */

  const trackInteraction = useCallback(
    async (bannerId: string, type: 'VIEW' | 'CLICK') => {
      if (!bannerId || typeof window === 'undefined') return;

      const sessionId = getSessionId();

      // Deduplicate VIEW ở client: Mỗi banner chỉ ghi nhận VIEW 1 lần trong 10 phút trên trình duyệt
      if (type === 'VIEW') {
        const viewedKey = `banner_viewed_${bannerId}`;
        const lastViewedTime = sessionStorage.getItem(viewedKey);
        const now = Date.now();

        if (lastViewedTime && now - parseInt(lastViewedTime, 10) < 10 * 60 * 1000) {
          return; // Đã view trong 10 phút, không gửi request
        }

        sessionStorage.setItem(viewedKey, now.toString());
      }

      // Throttle CLICK ở client: Chống spam bấm liên tục trong 3 giây
      if (type === 'CLICK') {
        const now = Date.now();
        const lastClick = lastClickRef.current[bannerId] || 0;
        if (now - lastClick < 3000) {
          return;
        }
        lastClickRef.current[bannerId] = now;
      }

      try {
        await fetch('/api/banners/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            bannerId,
            type,
            sessionId,
          }),
        });
      } catch (err) {
        // Silent fail cho tracking, không ảnh hưởng trải nghiệm người dùng
        console.debug('[Tracking Error]', err);
      }
    },
    [getSessionId]
  );

  /* ==========================================================================
     INTERSECTION OBSERVER: CHỈ GHI NHẬN VIEW KHI BANNER THỰC SỰ LỌT VÀO MÀN HÌNH
     ========================================================================== */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.35);
        });
      },
      {
        threshold: [0, 0.35, 0.5, 1.0],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ghi nhận VIEW cho slide hiện tại khi banner thực sự nằm trong tầm mắt
  useEffect(() => {
    if (!isInViewport || !carouselSlides || carouselSlides.length === 0) return;
    const activeSlide = carouselSlides[currentSlide];
    if (activeSlide?.id) {
      trackInteraction(activeSlide.id, 'VIEW');
    }
  }, [isInViewport, currentSlide, carouselSlides, trackInteraction]);

  // Ghi nhận VIEW cho Popup khi xuất hiện trên màn hình
  useEffect(() => {
    if (showPopup && popupBanner?.id) {
      trackInteraction(popupBanner.id, 'VIEW');
    }
  }, [showPopup, popupBanner, trackInteraction]);

  // Tự động xoay Carousel mỗi 5 giây
  useEffect(() => {
    if (!carouselSlides || carouselSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselSlides]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);

  if (!slides || slides.length === 0 || carouselSlides.length === 0) {
    return <div className="w-full aspect-[21/7] bg-slate-100 animate-pulse"></div>;
  }

  return (
    <>
      <section ref={containerRef} className="bg-white overflow-hidden pb-6 lg:pb-24 pt-2 lg:pt-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col lg:flex-row items-center relative gap-4 lg:gap-0">
          {/* Left Column - Static Info */}
          <div className="w-full lg:w-[45%] relative z-0 flex flex-col items-center lg:items-start text-center lg:text-left pt-2 lg:pt-0">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-3 bg-red-50 px-3.5 py-1 rounded-full border border-red-100/80 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-red-600 fill-red-600" />{' '}
              <span className="text-xs lg:text-sm font-extrabold uppercase tracking-wide">TINH HOA ẨM THỰC NHẬT BẢN</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight mb-3 lg:mb-6 tracking-tight">
              TRẢI NGHIỆM VỊ NGON <br />
              <span className="text-red-600">CHUẨN NHẬT</span>
            </h1>

            <p className="text-slate-600 text-sm lg:text-lg mb-4 lg:mb-8 max-w-lg leading-relaxed hidden sm:block">
              Avora mang đến cho bạn những món ăn chuẩn vị Nhật với nguyên liệu tươi ngon nhất, chuẩn quy trình khắt khe từ Tokyo.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-4 lg:mb-10 w-full">
              <Link
                href="/menu"
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 lg:px-8 py-3 lg:py-3.5 rounded-full font-bold transition-all shadow-xl shadow-red-600/30 hover:-translate-y-1 text-sm lg:text-base cursor-pointer"
              >
                Đặt món ngay <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 bg-white text-red-600 rounded-full p-0.5" />
              </Link>
            </div>

            {/* Features */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3 w-full pt-2">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Giao hàng nhanh</p>
                  <p className="text-[10px] text-slate-500">30-45 phút</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Disc className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Nguyên liệu tươi</p>
                  <p className="text-[10px] text-slate-500">Nhập khẩu mỗi ngày</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Chuẩn vệ sinh ATTP</p>
                  <p className="text-[10px] text-slate-500">Chuẩn vị Nhật Bản</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-left">
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Thanh toán tiện lợi</p>
                  <p className="text-[10px] text-slate-500">Nhiều phương thức</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Dynamic Carousel */}
          <div className="w-full lg:w-[55%] h-[200px] sm:h-[350px] lg:h-[500px] relative z-0 mt-2 lg:mt-0">
            {/* Images */}
            <div className="absolute top-0 bottom-0 left-0 lg:left-8 right-0 lg:-right-32 rounded-3xl lg:rounded-l-[200px] lg:rounded-r-none overflow-hidden shadow-2xl group">
              {carouselSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${
                    index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {slide.linkUrl ? (
                    <Link
                      href={slide.linkUrl}
                      onClick={() => trackInteraction(slide.id, 'CLICK')}
                      className="block w-full h-full cursor-pointer relative"
                    >
                      <picture>
                        {slide.mobileImageUrl && (
                          <source media="(max-width: 640px)" srcSet={slide.mobileImageUrl} />
                        )}
                        <img
                          src={slide.imageUrl}
                          alt={slide.altText || slide.title || 'Banner Avora'}
                          className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700"
                        />
                      </picture>
                    </Link>
                  ) : (
                    <picture>
                      {slide.mobileImageUrl && (
                        <source media="(max-width: 640px)" srcSet={slide.mobileImageUrl} />
                      )}
                      <img
                        src={slide.imageUrl}
                        alt={slide.altText || slide.title || 'Banner Avora'}
                        className="w-full h-full object-cover object-center"
                      />
                    </picture>
                  )}
                </div>
              ))}

              {/* Carousel Controls */}
              {carouselSlides.length > 1 && (
                <div className="absolute right-4 lg:right-40 bottom-4 lg:bottom-1/2 lg:translate-y-1/2 z-20 flex lg:flex-col gap-3">
                  <button
                    onClick={prevSlide}
                    aria-label="Slide trước"
                    className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 lg:-translate-y-4 group-hover:translate-y-0 active:scale-95"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={nextSlide}
                    aria-label="Slide tiếp theo"
                    className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 lg:translate-y-4 group-hover:translate-y-0 active:scale-95"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>

            {/* Carousel Dots */}
            {carouselSlides.length > 1 && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                {carouselSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    aria-label={`Đi tới banner #${idx + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSlide ? 'w-6 bg-red-600 shadow-sm shadow-red-500/40' : 'w-2 bg-red-200 hover:bg-red-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Popup Banner Modal */}
      {showPopup && popupBanner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePopup}></div>
          <div className="relative bg-transparent rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-300 z-10">
            <button
              onClick={closePopup}
              aria-label="Đóng popup"
              className="absolute top-3 right-3 z-20 w-8 h-8 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center transition-colors shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
            {popupBanner.linkUrl ? (
              <Link
                href={popupBanner.linkUrl}
                onClick={() => {
                  trackInteraction(popupBanner.id, 'CLICK');
                  closePopup();
                }}
                className="block w-full"
              >
                <img
                  src={popupBanner.imageUrl}
                  alt={popupBanner.altText || popupBanner.title || 'Popup Khuyến Mãi'}
                  className="w-full h-auto object-cover rounded-2xl"
                />
              </Link>
            ) : (
              <img
                src={popupBanner.imageUrl}
                alt={popupBanner.altText || popupBanner.title || 'Popup Khuyến Mãi'}
                className="w-full h-auto object-cover rounded-2xl"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

