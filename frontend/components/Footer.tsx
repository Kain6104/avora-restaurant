"use client";

import React from 'react';
import { Send, Music2, ArrowUp, Gift } from 'lucide-react';
import { FaFacebook, FaInstagram, FaYoutube } from 'react-icons/fa';
import Link from 'next/link';

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-50 pt-0 pb-16 md:pb-0">
      {/* Red Newsletter Bar */}
      <div className="bg-red-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 md:py-10 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="text-white text-center md:text-left flex-1">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 flex items-center justify-center md:justify-start gap-2">
              <Gift className="w-4 h-4" /> ĐĂNG KÝ NHẬN TIN NGAY
            </p>
            <h3 className="text-2xl md:text-[28px] font-black mb-2 tracking-tight">Nhận ưu đãi đặc biệt dành riêng cho bạn!</h3>
            <p className="text-xs md:text-sm text-red-100">Cập nhật menu mới, khuyến mãi và ưu đãi hấp dẫn mỗi tuần.</p>
          </div>
          
          <div className="w-full md:w-auto flex-1 max-w-md relative z-20">
            <div className="bg-white rounded-full p-1.5 flex shadow-2xl">
              <input 
                type="email" 
                placeholder="Nhập email của bạn..." 
                className="flex-1 bg-transparent border-none outline-none px-4 text-slate-700 text-sm w-full"
              />
              <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-colors shrink-0">
                <Send className="w-4 h-4" /> Đăng ký
              </button>
            </div>
          </div>

          <div className="hidden lg:flex flex-1 justify-end relative h-full min-h-[100px]">
             {/* 3D Gift Box representation using shapes if no image is available, but for now we use an image */}
             <div className="absolute -top-16 -right-10 w-48 h-48 drop-shadow-2xl">
                <img src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400&q=80&fm=png&bg=transparent" alt="Gift" className="w-full h-full object-contain scale-150 translate-x-12 translate-y-12 mix-blend-screen opacity-0" />
                <div className="absolute inset-0 bg-red-500/20 rounded-xl blur-xl"></div>
                <Gift className="w-32 h-32 text-yellow-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-12 drop-shadow-2xl" />
             </div>
          </div>

        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 md:py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
        {/* Column 1: Info & Socials */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Link href="/">
            <img src="/avora_logo_ngang.png" alt="Avora Logo" className="h-10 w-auto" />
          </Link>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Avora mang đến những món ăn Nhật Bản chuẩn vị với nguyên liệu tươi ngon và trải nghiệm tuyệt vời.
          </p>
          <div className="flex gap-4">
            <a href="#" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-all"><FaFacebook className="w-4 h-4" /></a>
            <a href="#" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-all"><FaInstagram className="w-4 h-4" /></a>
            <a href="#" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-all"><Music2 className="w-4 h-4" /></a>
            <a href="#" className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-all"><FaYoutube className="w-4 h-4" /></a>
          </div>
        </div>

        {/* Column 2: Về Avora */}
        <div>
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Về Avora</h4>
          <ul className="space-y-4">
            <li><Link href="/news" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Giới thiệu & Câu chuyện</Link></li>
            <li><Link href="/news" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Tuyển dụng nhân tài</Link></li>
            <li><Link href="/news" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Tin tức & Sự kiện</Link></li>
            <li><Link href="/restaurants" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Liên hệ & Hỗ trợ</Link></li>
            <li><Link href="/restaurants" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Hệ thống nhà hàng AVORA</Link></li>
          </ul>
        </div>

        {/* Column 3: Hỗ trợ khách hàng */}
        <div>
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Hỗ trợ khách hàng</h4>
          <ul className="space-y-4">
            <li><Link href="/chatbot" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Trợ lý AI AvoBOT 24/7</Link></li>
            <li><Link href="/loyalty" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Đặc quyền hội viên VIP</Link></li>
            <li><Link href="/vouchers" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Kho voucher & Khuyến mãi</Link></li>
            <li><Link href="/menu" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Thực đơn & Đặt món</Link></li>
            <li><Link href="/booking" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Đặt bàn trực tuyến</Link></li>
          </ul>
        </div>

        {/* Column 4: Thanh toán (Logo Vector sắc nét, không bao giờ vỡ ảnh) */}
        <div>
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Thanh toán</h4>
          <div className="grid grid-cols-2 gap-2.5 max-w-[170px]">
            {/* Visa */}
            <div className="bg-white border border-slate-200/80 rounded-lg h-9 flex items-center justify-center p-1.5 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all" title="Thẻ Visa Quốc Tế">
              <svg viewBox="0 0 48 16" className="h-4.5 w-auto" fill="none">
                <path d="M18.8 1.2L12.5 15.2H8.3L5.1 3.5C4.9 2.7 4.7 2.4 4.1 2.1C3.1 1.6 1.5 1.1 0 0.8L0.1 0.4H7.1C8.0 0.4 8.8 1.0 9.0 2.0L10.7 10.7L14.9 0.4H18.8V1.2ZM35.3 10.6C35.3 6.6 29.7 6.3 29.7 4.5C29.7 3.9 30.3 3.3 31.5 3.1C32.1 3.0 33.7 3.0 35.4 3.8L36.0 0.9C35.2 0.6 33.9 0.3 32.3 0.3C28.4 0.3 25.6 2.3 25.6 5.3C25.6 7.5 27.6 8.7 29.1 9.4C30.6 10.2 31.2 10.7 31.1 11.3C31.1 12.3 29.9 12.7 28.8 12.7C26.8 12.7 25.6 12.2 24.7 11.7L24.0 14.7C24.9 15.1 26.6 15.5 28.3 15.5C32.4 15.5 35.3 13.5 35.3 10.6ZM45.6 15.2H49.2L46.1 0.4H42.7C41.9 0.4 41.3 0.8 41.0 1.6L35.0 15.2H39.2L40.0 13.0H45.2L45.6 15.2ZM41.2 9.9L43.3 3.9L44.5 9.9H41.2ZM24.6 0.4L21.3 15.2H17.3L20.6 0.4H24.6Z" fill="#1434CB"/>
              </svg>
            </div>

            {/* Mastercard */}
            <div className="bg-white border border-slate-200/80 rounded-lg h-9 flex items-center justify-center p-1.5 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all" title="Mastercard">
              <svg viewBox="0 0 32 20" className="h-5 w-auto">
                <circle cx="10" cy="10" r="10" fill="#EB001B"/>
                <circle cx="22" cy="10" r="10" fill="#F79E1B"/>
                <path d="M16 2.8a9.9 9.9 0 0 1 0 14.4A9.9 9.9 0 0 1 16 2.8z" fill="#FF5F00"/>
              </svg>
            </div>

            {/* MoMo */}
            <div className="bg-white border border-slate-200/80 rounded-lg h-9 flex items-center justify-center p-1.5 shadow-2xs hover:border-pink-400 hover:shadow-xs transition-all" title="Ví MoMo">
              <span className="font-black text-[#A50064] text-xs tracking-tighter flex items-center gap-0.5">
                <span className="w-4 h-4 rounded-full bg-[#A50064] text-white flex items-center justify-center text-[9px] font-black">M</span>
                <span>MoMo</span>
              </span>
            </div>

            {/* ZaloPay */}
            <div className="bg-white border border-slate-200/80 rounded-lg h-9 flex items-center justify-center p-1.5 shadow-2xs hover:border-blue-500 hover:shadow-xs transition-all" title="ZaloPay">
              <span className="font-extrabold text-[#0068FF] text-xs tracking-tight flex items-center">
                <span>Zalo</span>
                <span className="text-[#00B14F]">Pay</span>
              </span>
            </div>

            {/* VNPAY */}
            <div className="bg-white border border-slate-200/80 rounded-lg h-9 flex items-center justify-center p-1.5 shadow-2xs hover:border-red-400 hover:shadow-xs transition-all" title="VNPAY-QR">
              <span className="font-black text-xs tracking-tight flex items-center">
                <span className="text-[#005BAA]">VN</span>
                <span className="text-[#ED1C24]">PAY</span>
              </span>
            </div>

            {/* SePay / Chuyển khoản QR */}
            <div className="bg-white border border-slate-200/80 rounded-lg h-9 flex items-center justify-center p-1.5 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all" title="Chuyển khoản VietQR / SePay">
              <span className="font-extrabold text-xs tracking-tight text-emerald-600 flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">QR</span>
                <span>VietQR</span>
              </span>
            </div>
          </div>
        </div>

        {/* Column 5: Tải ứng dụng */}
        <div className="lg:col-span-1">
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Tải ứng dụng Avora</h4>
          <p className="text-xs text-slate-500 font-medium mb-4">Trải nghiệm đặt món nhanh hơn qua ứng dụng của chúng tôi.</p>
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl p-1.5 flex items-center justify-center shrink-0 shadow-2xs">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://avorafnb.com" 
                alt="QR Tải ứng dụng" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/news" className="h-8 px-3 rounded-lg bg-black text-white flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-2xs">
                <span className="text-[10px] font-bold leading-tight">App Store<br/><span className="text-[8px] text-slate-400 font-normal">iOS Download</span></span>
              </Link>
              <Link href="/news" className="h-8 px-3 rounded-lg bg-black text-white flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-2xs">
                <span className="text-[10px] font-bold leading-tight">Google Play<br/><span className="text-[8px] text-slate-400 font-normal">Android APK</span></span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-200 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[11px] font-medium text-slate-500">© 2026 Avora Restaurant, All rights reserved.</p>
          <div className="flex items-center gap-6 text-[11px] font-bold text-slate-600">
             <Link href="/news" className="hover:text-red-600 transition-colors">Điều khoản</Link>
             <Link href="/news" className="hover:text-red-600 transition-colors">Bảo mật</Link>
             <Link href="/menu" className="hover:text-red-600 transition-colors">Sơ đồ thực đơn</Link>
          </div>
          
          <button 
            onClick={scrollToTop}
            className="absolute -top-5 right-4 md:right-8 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 hover:-translate-y-1 transition-all cursor-pointer"
            title="Cuộn lên đầu trang"
          >
             <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
