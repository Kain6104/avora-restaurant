'use client';

import React, { useState } from 'react';
import { Share2, Copy, Check, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface ShareModalProps {
  articleId: string;
  articleTitle: string;
  articleSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onShared?: () => void;
}

export default function ShareModal({
  articleId,
  articleTitle,
  articleSlug,
  isOpen,
  onClose,
  onShared,
}: ShareModalProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const getShareUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/news/${articleSlug}`;
    }
    return `https://avorarestaurant.com/news/${articleSlug}`;
  };

  const shareUrl = getShareUrl();

  const recordShareIntent = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/articles/${articleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventType: 'SHARE',
        }),
      }).catch(() => {});
      onShared?.();
    } catch {
      // Non-blocking
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    toast.success('Đã sao chép liên kết bài viết!');
    recordShareIntent();
    setTimeout(() => {
      setIsCopied(false);
    }, 3000);
  };

  const handleShareFacebook = () => {
    recordShareIntent();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=400'
    );
  };

  const handleShareZalo = () => {
    recordShareIntent();
    window.open(
      `https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`,
      '_blank',
      'width=600,height=400'
    );
  };

  const handleShareTelegram = () => {
    recordShareIntent();
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
        articleTitle
      )}`,
      '_blank',
      'width=600,height=400'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <Share2 size={20} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Chia sẻ bài viết</h3>
            <p className="text-xs text-slate-500">Lan tỏa tin tức hấp dẫn tới bạn bè & người thân</p>
          </div>
        </div>

        {/* Social Share Buttons */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            type="button"
            onClick={handleShareFacebook}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-100/70 border border-blue-100 transition-all text-blue-600 font-semibold text-xs cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm font-bold text-lg">
              f
            </div>
            <span>Facebook</span>
          </button>

          <button
            type="button"
            onClick={handleShareZalo}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-cyan-50/60 hover:bg-cyan-100/70 border border-cyan-100 transition-all text-cyan-700 font-semibold text-xs cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#0068FF] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm font-black text-sm">
              Z
            </div>
            <span>Zalo</span>
          </button>

          <button
            type="button"
            onClick={handleShareTelegram}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-sky-50/60 hover:bg-sky-100/70 border border-sky-100 transition-all text-sky-600 font-semibold text-xs cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#24A1DE] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
              <ExternalLink size={18} />
            </div>
            <span>Telegram</span>
          </button>
        </div>

        {/* Copy Link Input Bar */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Liên kết bài viết
          </label>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1.5 pl-3 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent border-none outline-none flex-1 text-xs text-slate-600 truncate pr-2 select-all"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-xs'
              }`}
            >
              {isCopied ? (
                <>
                  <Check size={13} strokeWidth={2.5} /> Đã sao chép
                </>
              ) : (
                <>
                  <Copy size={13} /> Sao chép
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
