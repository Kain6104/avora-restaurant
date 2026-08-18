"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, ArrowRight, BookOpen, Truck, Disc, ShieldCheck, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface Banner {
  id: string;
  imageUrl: string;
  altText: string | null;
  linkUrl: string | null;
  startDate?: string | null;
  endDate?: string | null;
  popup?: boolean;
}

interface HeroBannerProps {
  slides: Banner[];
}

export default function HeroBanner({ slides }: HeroBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  // Filter valid slides by date
  const validSlides = React.useMemo(() => {
    if (!slides) return [];
    const now = new Date();
    return slides.filter(slide => {
      if (slide.startDate && new Date(slide.startDate) > now) return false;
      if (slide.endDate && new Date(slide.endDate) < now) return false;
      return true;
    });
  }, [slides]);

  const popupBanner = React.useMemo(() => validSlides.find(s => s.popup), [validSlides]);
  const carouselSlides = validSlides.filter(s => !s.popup);

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

  useEffect(() => {
    if (!carouselSlides || carouselSlides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselSlides]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);

  if (!slides || slides.length === 0 || carouselSlides.length === 0) {
    return <div className="w-full aspect-[21/7] bg-slate-200 animate-pulse"></div>;
  }

  return (
    <>
      <section className="bg-white overflow-hidden pb-6 lg:pb-24 pt-2 lg:pt-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col lg:flex-row items-center relative gap-4 lg:gap-0">

          {/* Left Column - Static Info */}
          <div className="w-full lg:w-[45%] z-20 flex flex-col items-center lg:items-start text-center lg:text-left pt-2 lg:pt-0">
            <div className="flex items-center gap-2 text-red-600 font-bold mb-3 bg-red-50 px-3 py-1 rounded-full border border-red-100">
              🌸 <span className="text-xs lg:text-sm">TINH HOA ẨM THỰC NHẬT BẢN</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight mb-3 lg:mb-6">
              TRẢI NGHIỆM VỊ NGON <br />
              <span className="text-red-600">CHUẨN NHẬT</span>
            </h1>

            <p className="text-slate-600 text-sm lg:text-lg mb-4 lg:mb-8 max-w-lg leading-relaxed hidden sm:block">
              Avora mang đến cho bạn những món ăn chuẩn vị Nhật với nguyên liệu tươi ngon nhất.
            </p>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-4 lg:mb-10 w-full">
              <Link href="/menu" className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 lg:px-8 py-3 lg:py-3.5 rounded-full font-bold transition-all shadow-xl shadow-red-600/30 hover:-translate-y-1 text-sm lg:text-base">
                Đặt món ngay <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 bg-white text-red-600 rounded-full p-0.5" />
              </Link>
              <Link href="/menu" className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-200 px-6 lg:px-8 py-3 lg:py-3.5 rounded-full font-bold transition-all hover:-translate-y-1 text-sm lg:text-base">
                Xem thực đơn <BookOpen className="w-4 h-4 lg:w-5 lg:h-5 text-red-600" />
              </Link>
            </div>

            {/* Features - hidden on smallest screens to save space */}
            <div className="hidden sm:grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
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
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">Đảm bảo chất lượng</p>
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
          <div className="w-full lg:w-[55%] h-[200px] sm:h-[350px] lg:h-[500px] relative z-10 mt-2 lg:mt-0">
            {/* Images */}
            <div className="absolute top-0 bottom-0 left-0 lg:left-8 right-0 lg:-right-32 rounded-3xl lg:rounded-l-[200px] lg:rounded-r-none overflow-hidden shadow-2xl group">
              {carouselSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
                >
                  {slide.linkUrl ? (
                    <Link href={slide.linkUrl} className="block w-full h-full cursor-pointer">
                      <img src={slide.imageUrl} alt={slide.altText || 'Banner'} className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" />
                    </Link>
                  ) : (
                    <img src={slide.imageUrl} alt={slide.altText || 'Banner'} className="w-full h-full object-cover object-center" />
                  )}
                </div>
              ))}

              {/* Controls */}
              {carouselSlides.length > 1 && (
                <div className="absolute right-4 lg:right-40 bottom-4 lg:bottom-1/2 lg:translate-y-1/2 z-20 flex lg:flex-col gap-3">
                  <button onClick={prevSlide} className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 lg:-translate-y-4 group-hover:translate-y-0">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={nextSlide} className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 rounded-full flex items-center justify-center shadow-lg transition-all opacity-100 lg:opacity-0 group-hover:opacity-100 lg:translate-y-4 group-hover:translate-y-0">
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
                    className={`h-2 rounded-full transition-all ${idx === currentSlide ? 'w-6 bg-red-600' : 'w-2 bg-red-200 hover:bg-red-300'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Popup Banner */}
      {showPopup && popupBanner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closePopup}></div>
          <div className="relative bg-transparent rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-300 z-10">
            <button
              onClick={closePopup}
              className="absolute top-3 right-3 z-20 w-8 h-8 bg-black/50 hover:bg-black text-white rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {popupBanner.linkUrl ? (
              <Link href={popupBanner.linkUrl} onClick={closePopup} className="block w-full">
                <img src={popupBanner.imageUrl} alt={popupBanner.altText || 'Popup'} className="w-full h-auto object-cover" />
              </Link>
            ) : (
              <img src={popupBanner.imageUrl} alt={popupBanner.altText || 'Popup'} className="w-full h-auto object-cover" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
