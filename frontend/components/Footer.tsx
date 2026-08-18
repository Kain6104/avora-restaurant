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
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Giới thiệu</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Tuyển dụng</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Tin tức</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Liên hệ</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Hệ thống nhà hàng</Link></li>
          </ul>
        </div>

        {/* Column 3: Hỗ trợ khách hàng */}
        <div>
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Hỗ trợ khách hàng</h4>
          <ul className="space-y-4">
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Trung tâm trợ giúp</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Chính sách đổi trả</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Chính sách giao hàng</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Điều khoản sử dụng</Link></li>
            <li><Link href="#" className="text-xs text-slate-600 font-medium hover:text-red-600 transition-colors">Chính sách bảo mật</Link></li>
          </ul>
        </div>

        {/* Column 4: Thanh toán */}
        <div>
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Thanh toán</h4>
          <div className="grid grid-cols-2 gap-3 max-w-[160px]">
             <div className="bg-white border border-slate-200 rounded-md h-8 flex items-center justify-center p-1"><img src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_Logo.png" alt="Visa" className="h-4 object-contain opacity-70 grayscale" /></div>
             <div className="bg-white border border-slate-200 rounded-md h-8 flex items-center justify-center p-1"><img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5 object-contain opacity-70 grayscale" /></div>
             <div className="bg-white border border-slate-200 rounded-md h-8 flex items-center justify-center p-1"><img src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" alt="Momo" className="h-5 object-contain opacity-70 grayscale" /></div>
             <div className="bg-white border border-slate-200 rounded-md h-8 flex items-center justify-center p-1"><img src="https://upload.wikimedia.org/wikipedia/vi/a/a2/ZaloPay_logo.png" alt="ZaloPay" className="h-4 object-contain opacity-70 grayscale" /></div>
             <div className="bg-white border border-slate-200 rounded-md h-8 flex items-center justify-center p-1"><img src="https://vnpay.vn/s1/statics.vnpay.vn/2023/9/06ncktiwd6dc1694418189687.png" alt="VNPay" className="h-4 object-contain opacity-70 grayscale" /></div>
          </div>
        </div>

        {/* Column 5: Tải ứng dụng */}
        <div className="lg:col-span-1">
          <h4 className="text-slate-900 font-black mb-6 uppercase text-sm">Tải ứng dụng Avora</h4>
          <p className="text-xs text-slate-500 font-medium mb-4">Trải nghiệm đặt món nhanh hơn qua ứng dụng của chúng tôi.</p>
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 bg-white border border-slate-200 rounded-xl p-1 flex items-center justify-center shrink-0">
               <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg" alt="QR" className="w-full h-full opacity-80" />
            </div>
            <div className="flex flex-col gap-2">
               <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" className="h-8" />
               <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" className="h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-200 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[11px] font-medium text-slate-500">© 2026 Avora Restaurant, All rights reserved.</p>
          <div className="flex items-center gap-6 text-[11px] font-bold text-slate-600">
             <Link href="#" className="hover:text-red-600 transition-colors">Điều khoản</Link>
             <Link href="#" className="hover:text-red-600 transition-colors">Bảo mật</Link>
             <Link href="#" className="hover:text-red-600 transition-colors">Sơ đồ trang web</Link>
          </div>
          
          <button 
            onClick={scrollToTop}
            className="absolute -top-5 right-4 md:right-8 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 hover:-translate-y-1 transition-all"
          >
             <ArrowUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
