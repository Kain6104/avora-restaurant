'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Eye,
  Share2,
  Bookmark,
  ChevronRight,
  Sparkles,
  Flame,
  ArrowLeft,
  Lock,
  Tag,
  Store,
  Check,
  Phone,
  MapPin,
  Utensils,
  MessageSquare,
  ThumbsUp,
  Heart,
  ChevronDown,
  ExternalLink,
  BookOpen,
  Award,
  List,
  Plus,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactionPicker from '@/components/article/ReactionPicker';
import CommentSection from '@/components/article/CommentSection';
import RelatedProducts from '@/components/article/RelatedProducts';
import RelatedVouchers from '@/components/article/RelatedVouchers';
import ShareModal from '@/components/article/ShareModal';
import ReactionIcon, { REACTION_CONFIG, ReactionType } from '@/components/article/ReactionIcons';
import { useCart } from '@/context/CartContext';

export interface ArticleDetailData {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  coverImage?: string | null;
  coverImageUrl?: string | null;
  thumbnailUrl?: string | null;
  type?: 'NEWS' | 'PROMOTION' | 'EVENT' | 'BRAND_STORY' | 'GUIDE' | 'MENU_UPDATE';
  articleType?: 'NEWS' | 'PROMOTION' | 'EVENT' | 'BRAND_STORY' | 'GUIDE' | 'MENU_UPDATE';
  visibility: 'PUBLIC' | 'AUTHENTICATED' | 'MEMBERS_ONLY' | 'PRIVATE';
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string | null;
  promotionStartAt?: string | null;
  promotionEndAt?: string | null;
  promotionLabel?: string | null;
  promotionTerms?: string | null;
  promotionStatus?: 'UPCOMING' | 'ONGOING' | 'ENDED' | null;
  viewCount: number;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  author?: {
    id: string;
    fullName?: string;
    avatar?: string;
    avatarUrl?: string;
    role?: string;
  } | null;
  branches?: {
    id?: string;
    name?: string;
    address?: string;
    phone?: string;
    branch?: {
      id: string;
      name: string;
      address?: string;
      phone?: string;
    };
  }[];
  membershipTiers?: {
    id?: string;
    name?: string;
    tier?: {
      id: string;
      name: string;
    };
  }[];
  products?: any[];
  vouchers?: any[];
  userReaction?: ReactionType | null;
  isFavorited?: boolean;
  isFavorite?: boolean;
  reactionBreakdown?: { type: ReactionType; count: number }[] | Record<string, number>;
  relatedArticles?: any[];
  isLocked?: boolean;
  lockMessage?: string | null;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; gradient: string; icon: any }
> = {
  PROMOTION: {
    label: 'Ưu đãi & Khuyến mãi',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    text: 'text-rose-700',
    gradient: 'from-rose-600 to-red-600',
    icon: Flame,
  },
  NEWS: {
    label: 'Tin tức & Sự kiện',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    text: 'text-blue-700',
    gradient: 'from-blue-600 to-indigo-600',
    icon: Sparkles,
  },
  EVENT: {
    label: 'Sự kiện đặc biệt',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    text: 'text-purple-700',
    gradient: 'from-purple-600 to-violet-600',
    icon: Sparkles,
  },
  BRAND_STORY: {
    label: 'Câu chuyện thương hiệu',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    text: 'text-amber-800',
    gradient: 'from-amber-600 to-yellow-600',
    icon: Award,
  },
  GUIDE: {
    label: 'Cẩm nang ẩm thực',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'text-emerald-700',
    gradient: 'from-emerald-600 to-teal-600',
    icon: BookOpen,
  },
  MENU_UPDATE: {
    label: 'Thực đơn & Món mới',
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    text: 'text-orange-700',
    gradient: 'from-orange-600 to-amber-600',
    icon: Tag,
  },
};

interface ArticleDetailClientProps {
  article: ArticleDetailData;
  currentUserId?: string | null;
  currentUserRole?: string | null;
}

export default function ArticleDetailClient({
  article,
  currentUserId,
  currentUserRole,
}: ArticleDetailClientProps) {
  const { addToCart, currentBranchId } = useCart();

  const [isFavorited, setIsFavorited] = useState<boolean>(
    article.isFavorited ?? article.isFavorite ?? false
  );
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [reactionCount, setReactionCount] = useState<number>(article.reactionCount || 0);
  const [userReaction, setUserReaction] = useState<ReactionType | null>(
    article.userReaction || null
  );
  const [breakdown, setBreakdown] = useState<any>(article.reactionBreakdown || {});
  const [readingProgress, setReadingProgress] = useState<number>(0);
  const [showStickyHeader, setShowStickyHeader] = useState<boolean>(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const [isMobileReactionPickerOpen, setIsMobileReactionPickerOpen] = useState<boolean>(false);

  const commentsRef = useRef<HTMLDivElement>(null);

  const coverImg =
    article.coverImageUrl ||
    article.coverImage ||
    article.thumbnailUrl ||
    'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=1200';

  const articleType = article.articleType || article.type || 'NEWS';
  const typeConfig = TYPE_CONFIG[articleType] || TYPE_CONFIG.NEWS;
  const TypeIcon = typeConfig.icon;

  // Normalized reaction breakdown
  const normalizedBreakdown = useMemo(() => {
    if (!breakdown) return [];
    if (Array.isArray(breakdown)) return breakdown;
    return Object.entries(breakdown).map(([key, count]) => ({
      type: key as ReactionType,
      count: Number(count) || 0,
    }));
  }, [breakdown]);

  // Client-side authentication sync for User's Active Reaction & Bookmark status
  useEffect(() => {
    const fetchFreshUserContext = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${baseUrl}/api/articles/${article.slug}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const clientData = json.data || json;
          if (clientData) {
            if (clientData.userReaction !== undefined) {
              setUserReaction(clientData.userReaction);
            }
            if (clientData.isFavorite !== undefined || clientData.isFavorited !== undefined) {
              setIsFavorited(clientData.isFavorite ?? clientData.isFavorited ?? false);
            }
            if (clientData.reactionCount !== undefined) {
              setReactionCount(clientData.reactionCount);
            }
            if (clientData.reactionBreakdown) {
              setBreakdown(clientData.reactionBreakdown);
            }
          }
        }
      } catch {
        // Non-blocking
      }
    };

    fetchFreshUserContext();
  }, [article.slug]);

  // Extract Table of Contents from HTML content
  const { tableOfContents, processedContent } = useMemo(() => {
    if (!article.content) return { tableOfContents: [], processedContent: '' };

    const headings: { id: string; text: string; level: number }[] = [];
    let count = 0;

    const modified = article.content.replace(/<(h[23])([^>]*)>(.*?)<\/\1>/gi, (match, tag, attrs, text) => {
      count++;
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      const id = `heading-${count}-${cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
      const level = parseInt(tag.replace('h', ''), 10);
      headings.push({ id, text: cleanText, level });
      return `<${tag} id="${id}" class="scroll-mt-24"${attrs}>${text}</${tag}>`;
    });

    return { tableOfContents: headings, processedContent: modified };
  }, [article.content]);

  // Track reading scroll progress & active heading
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
        setReadingProgress(progress);
      }
      setShowStickyHeader(window.scrollY > 300);

      // Active heading highlight
      if (tableOfContents.length > 0) {
        for (let i = tableOfContents.length - 1; i >= 0; i--) {
          const el = document.getElementById(tableOfContents[i].id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= 120) {
              setActiveHeadingId(tableOfContents[i].id);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [tableOfContents]);

  // View deduplication / throttle (call view API on mount)
  useEffect(() => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      fetch(`${baseUrl}/api/articles/${article.id}/view`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    } catch {
      // Non-blocking
    }
  }, [article.id]);

  const handleToggleFavorite = async () => {
    const previous = isFavorited;
    setIsFavorited(!previous);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${article.id}/favorite`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast('Vui lòng đăng nhập để lưu bài viết vào hồ sơ yêu thích!', {
            icon: '🔒',
            style: { borderRadius: '12px', background: '#333', color: '#fff' },
          });
        }
        setIsFavorited(previous);
        return;
      }

      const data = await res.json();
      const updated = data?.data?.isFavorited ?? !previous;
      setIsFavorited(updated);
      toast.success(updated ? 'Đã lưu bài viết vào mục yêu thích!' : 'Đã bỏ lưu bài viết');
    } catch {
      setIsFavorited(previous);
      toast.error('Lỗi khi lưu bài viết');
    }
  };

  const handleSelectMobileReaction = async (type: ReactionType) => {
    setIsMobileReactionPickerOpen(false);
    const previousReaction = userReaction;
    const previousCount = reactionCount;
    const isTogglingOff = previousReaction === type;
    const nextReaction = isTogglingOff ? null : type;
    const nextCount = isTogglingOff
      ? Math.max(0, previousCount - 1)
      : previousReaction
      ? previousCount
      : previousCount + 1;

    setUserReaction(nextReaction);
    setReactionCount(nextCount);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/articles/${article.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast('Vui lòng đăng nhập để thả cảm xúc cho bài viết!', {
            icon: '🔒',
            style: { borderRadius: '12px', background: '#333', color: '#fff' },
          });
        }
        setUserReaction(previousReaction);
        setReactionCount(previousCount);
        return;
      }

      const json = await res.json();
      const resPayload = json?.data || json;
      if (resPayload) {
        const returnedReaction = resPayload.userReaction !== undefined ? resPayload.userReaction : nextReaction;
        const returnedCount = resPayload.reactionCount !== undefined ? resPayload.reactionCount : nextCount;
        setUserReaction(returnedReaction);
        setReactionCount(returnedCount);
        if (resPayload.breakdown) {
          setBreakdown(resPayload.breakdown);
        }
      }
    } catch {
      setUserReaction(previousReaction);
      setReactionCount(previousCount);
    }
  };

  const handleMobileReactionToggle = () => {
    if (userReaction) {
      handleSelectMobileReaction(userReaction);
    } else {
      handleSelectMobileReaction('LOVE');
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt || article.title,
          url: shareUrl,
        });
        toast.success('Cảm ơn bạn đã chia sẻ bài viết!');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }
    setIsShareModalOpen(true);
  };

  const scrollToComments = () => {
    if (commentsRef.current) {
      commentsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Mới cập nhật';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const formatPromotionDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const readingTime = useMemo(() => {
    const textLength = article.content?.replace(/<[^>]*>/g, '').length || 1000;
    const minutes = Math.max(2, Math.ceil(textLength / 800));
    return `${minutes} phút đọc`;
  }, [article.content]);

  // Extract author display info
  const authorName = article.author?.fullName || 'Ban biên tập AVORA';
  const authorAvatar = article.author?.avatarUrl || article.author?.avatar;

  // Normalized branch list
  const branchesList = useMemo(() => {
    if (!article.branches || !Array.isArray(article.branches)) return [];
    return article.branches
      .map((b: any) => ({
        id: b.id || b.branch?.id,
        name: b.name || b.branch?.name,
        address: b.address || b.branch?.address,
        phone: b.phone || b.branch?.phone,
      }))
      .filter((b: any) => b.name);
  }, [article.branches]);

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans pb-36 md:pb-20 selection:bg-red-100 selection:text-red-900">
      {/* ── TOP READING PROGRESS BAR ── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-slate-200/50 backdrop-blur-xs">
        <div
          className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 transition-all duration-150 ease-out shadow-[0_0_8px_rgba(239,68,68,0.6)]"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* ── STICKY GLASSMORPHIC TOP HEADER ON SCROLL ── */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all duration-300 transform ${
          showStickyHeader ? 'translate-y-0 opacity-100 shadow-sm' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/news"
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-600 transition-colors shrink-0"
              title="Quay lại danh sách"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block truncate">
                {typeConfig.label}
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">
                {article.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-full transition-all ${
                isFavorited
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-500 hover:text-red-600 hover:bg-slate-100'
              }`}
              title={isFavorited ? 'Bỏ lưu' : 'Lưu bài viết'}
            >
              <Bookmark className={`w-4 h-4 ${isFavorited ? 'fill-red-600' : ''}`} />
            </button>
            <button
              onClick={handleNativeShare}
              className="p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Chia sẻ"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── BREADCRUMB & BACK ACTION ── */}
      <div className="bg-white border-b border-slate-200/80 py-3 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap custom-scrollbar">
            <Link href="/" className="hover:text-red-600 transition-colors font-medium">
              Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link href="/news" className="hover:text-red-600 transition-colors font-medium">
              Tin tức & Ưu đãi
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-900 font-semibold truncate max-w-[180px] sm:max-w-md">
              {article.title}
            </span>
          </nav>

          <Link
            href="/news"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 text-xs font-bold transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tất cả tin tức</span>
          </Link>
        </div>
      </div>

      {/* ── MAIN MAGAZINE CONTAINER (2-COL DESKTOP, 1-COL MOBILE) ── */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 sm:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* ════════ LEFT COLUMN: MAIN ARTICLE (8 cols on desktop) ════════ */}
          <div className="lg:col-span-8 min-w-0">
            {/* Header Magazine Section */}
            <header className="mb-6">
              {/* Top Badges Row */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs uppercase tracking-wider border shadow-xs ${typeConfig.bg}`}
                >
                  <TypeIcon className="w-3.5 h-3.5" />
                  {typeConfig.label}
                </span>

                {article.promotionStatus === 'ONGOING' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-red-600/30 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    Đang diễn ra
                  </span>
                )}
                {article.promotionStatus === 'UPCOMING' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-amber-500 text-white shadow-xs">
                    <Clock className="w-3.5 h-3.5" /> Sắp diễn ra
                  </span>
                )}
                {article.promotionStatus === 'ENDED' && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-200 text-slate-600">
                    Đã kết thúc
                  </span>
                )}

                {article.visibility === 'MEMBERS_ONLY' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs shadow-xs">
                    <Sparkles className="w-3.5 h-3.5" /> Dành riêng Hội viên VIP
                  </span>
                )}
              </div>

              {/* Article Main Headline */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight sm:leading-snug mb-4">
                {article.title}
              </h1>

              {/* Stylized Excerpt Box (Justified) */}
              {article.excerpt && (
                <div className="text-slate-700 text-sm sm:text-base md:text-lg font-medium leading-relaxed mb-5 italic border-l-4 border-red-600 pl-4 sm:pl-5 py-2 bg-gradient-to-r from-red-50/80 via-rose-50/40 to-transparent rounded-r-2xl [text-align:justify] [text-justify:inter-word]">
                  "{article.excerpt}"
                </div>
              )}

              {/* Author & Editorial Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3.5 py-3.5 border-y border-slate-200/90 text-xs sm:text-sm">
                {/* Author info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 text-white font-black flex items-center justify-center text-sm shadow-sm ring-2 ring-white overflow-hidden shrink-0">
                    {authorAvatar ? (
                      <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                    ) : (
                      authorName[0] || 'A'
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{authorName}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                        Tác giả
                      </span>
                    </div>
                    <div className="text-slate-400 text-xs flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {formatDate(article.publishedAt)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {readingTime}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Desktop Interaction Quick Buttons & Stats */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                    <span>{(article.viewCount || 0).toLocaleString()} lượt xem</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                        isFavorited
                          ? 'bg-red-600 text-white border-red-600 shadow-sm shadow-red-600/30'
                          : 'bg-white text-slate-700 hover:text-red-600 border-slate-200 hover:border-red-200 shadow-xs'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-white' : ''}`} />
                      <span>{isFavorited ? 'Đã lưu' : 'Lưu'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 shadow-xs transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Chia sẻ</span>
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {/* ── PROMOTION COUNTDOWN BANNER ── */}
            {articleType === 'PROMOTION' && (article.promotionStartAt || article.promotionEndAt) && (
              <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-xl shadow-red-600/20 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center gap-3.5 relative z-10">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner">
                    <Flame className="w-6 h-6 text-amber-300 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 bg-black/20 px-2 py-0.5 rounded-md">
                        {article.promotionLabel || 'ƯU ĐÃI ĐẶC BIỆT'}
                      </span>
                    </div>
                    <h4 className="font-black text-base text-white mt-1">
                      Thời gian áp dụng chương trình
                    </h4>
                    <p className="text-xs sm:text-sm text-red-100 font-medium mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span>
                        {article.promotionStartAt && `Từ ${formatPromotionDate(article.promotionStartAt)} `}
                        {article.promotionEndAt && `đến ${formatPromotionDate(article.promotionEndAt)}`}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="bg-white/25 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 shadow-sm border border-white/30 relative z-10">
                  {article.promotionStatus === 'ONGOING'
                    ? '🔥 Đang áp dụng'
                    : article.promotionStatus === 'UPCOMING'
                    ? '⏰ Sắp diễn ra'
                    : '⌛ Đã hết hạn'}
                </div>
              </div>
            )}

            {/* ── CINEMATIC COVER IMAGE ── */}
            {coverImg && (
              <div className="mb-6 rounded-3xl overflow-hidden shadow-md border border-slate-200/80 bg-slate-100 aspect-[16/9] relative group">
                <img
                  src={coverImg}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-50" />
              </div>
            )}

            {/* ── MAIN ARTICLE CONTENT CARD (TEXT JUSTIFIED) ── */}
            <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 shadow-xs border border-slate-200/90 mb-8">
              {article.isLocked ? (
                <div className="my-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-amber-600/10 border-2 border-amber-300/80 shadow-lg shadow-amber-500/5 text-center relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-yellow-300/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/30">
                    <Lock className="w-8 h-8 stroke-[2.5]" />
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-xs uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Đặc Quyền Hội Viên AVORA
                  </span>

                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
                    Nội Dung Dành Riêng Cho Thành Viên
                  </h3>

                  <p className="text-sm sm:text-base text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
                    {article.lockMessage ||
                      'Bài viết này chỉ dành riêng cho hội viên của AVORA Restaurant. Vui lòng đăng nhập hoặc thăng hạng thành viên để trải nghiệm toàn bộ ưu đãi đặc quyền!'}
                  </p>

                  {article.membershipTiers && article.membershipTiers.length > 0 && (
                    <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-2 p-2 rounded-2xl bg-white/80 border border-amber-200 text-xs">
                      <span className="font-bold text-slate-700">Hạng thẻ áp dụng:</span>
                      {article.membershipTiers.map((t: any, idx: number) => (
                        <span
                          key={t.id || idx}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-2xs"
                        >
                          {t.name || t.tier?.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                      href={`/login?redirectURL=/news/${article.slug}`}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-sm shadow-md shadow-red-600/20 transition-all text-center"
                    >
                      Đăng nhập ngay
                    </Link>
                    <Link
                      href="/loyalty"
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm transition-all text-center"
                    >
                      Khám phá quyền lợi hội viên
                    </Link>
                  </div>
                </div>
              ) : (
                <div
                  className="prose prose-slate prose-red prose-base sm:prose-lg max-w-none text-slate-700 leading-relaxed
                    [text-align:justify] [text-justify:inter-word]
                    prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900 
                    prose-h2:text-xl sm:prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pt-2
                    prose-h3:text-lg sm:prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
                    prose-p:my-4 prose-p:leading-relaxed
                    prose-img:rounded-2xl prose-img:shadow-md prose-img:my-6
                    prose-a:text-red-600 prose-a:font-bold hover:prose-a:underline
                    prose-strong:text-slate-900 prose-strong:font-black
                    prose-ul:my-4 prose-li:my-1.5"
                  dangerouslySetInnerHTML={{ __html: processedContent }}
                />
              )}

              {/* Promotion Terms Note if any */}
              {article.promotionTerms && (
                <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs sm:text-sm text-amber-900 [text-align:justify] [text-justify:inter-word]">
                  <strong className="block font-black mb-1 flex items-center gap-1.5 text-amber-800">
                    <Sparkles className="w-4 h-4" /> Điều khoản & Điều kiện áp dụng:
                  </strong>
                  <p className="leading-relaxed whitespace-pre-line text-amber-900/90">
                    {article.promotionTerms}
                  </p>
                </div>
              )}

              {/* ── EMBEDDED VOUCHERS SHOWCASE ── */}
              {article.vouchers && article.vouchers.length > 0 && (
                <RelatedVouchers articleId={article.id} vouchers={article.vouchers} />
              )}

              {/* ── EMBEDDED PRODUCTS / DISHES SHOWCASE ── */}
              {article.products && article.products.length > 0 && (
                <RelatedProducts articleId={article.id} products={article.products} />
              )}

              {/* ── ARTICLE REACTION & ENGAGEMENT BAR ── */}
              <div className="mt-10 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <ReactionPicker
                  articleId={article.id}
                  initialReactionCount={reactionCount}
                  initialUserReaction={userReaction}
                  initialBreakdown={normalizedBreakdown}
                  onReactionChange={(newReaction, newCount) => {
                    setUserReaction(newReaction);
                    setReactionCount(newCount);
                  }}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs ${
                      isFavorited
                        ? 'bg-red-600 text-white shadow-red-600/30'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isFavorited ? 'fill-white' : ''}`} />
                    <span>{isFavorited ? 'Đã lưu' : 'Lưu bài viết'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shadow-xs"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Chia sẻ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── COMMENT SECTION ── */}
            <div ref={commentsRef} className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/90 mb-10">
              <CommentSection
                articleId={article.id}
                initialCommentCount={article.commentCount}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
              />
            </div>

            {/* ── RELATED ARTICLES GRID ── */}
            {article.relatedArticles && article.relatedArticles.length > 0 && (
              <section className="my-8">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-red-600" />
                    <h3 className="text-xl font-black text-slate-900">Bài viết cùng chủ đề</h3>
                  </div>
                  <Link
                    href="/news"
                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                  >
                    <span>Xem tất cả</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {article.relatedArticles.map((rel: any) => (
                    <Link
                      key={rel.id}
                      href={`/news/${rel.slug}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-red-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                    >
                      <div className="aspect-[16/10] bg-slate-100 overflow-hidden relative">
                        <img
                          src={
                            rel.coverImage ||
                            rel.thumbnailUrl ||
                            'https://images.unsplash.com/photo-1544025162-d76694265947?w=400'
                          }
                          alt={rel.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
                        <span className="absolute bottom-2.5 left-2.5 text-[9px] font-bold text-white bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-full">
                          {rel.articleType || 'Tin tức'}
                        </span>
                      </div>
                      <div className="p-3.5 flex flex-col flex-1">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                          {rel.title}
                        </h4>
                        <div className="mt-auto pt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formatDate(rel.publishedAt)}
                          </span>
                          <span className="flex items-center gap-1 text-slate-500 font-semibold">
                            <Eye className="w-3 h-3" /> {(rel.viewCount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ════════ RIGHT COLUMN: DESKTOP STICKY SIDEBAR (4 cols on desktop) ════════ */}
          <aside className="hidden lg:block lg:col-span-4 space-y-6 sticky top-20">
            {/* 1. Table of Contents Widget */}
            {tableOfContents.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-black text-slate-900 text-sm">
                  <List className="w-4 h-4 text-red-600" />
                  <span>Mục lục bài viết</span>
                </div>
                <nav className="mt-3 space-y-1.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar text-xs">
                  {tableOfContents.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block py-1.5 px-2.5 rounded-lg transition-all line-clamp-1 ${
                        h.level === 3 ? 'pl-5 text-slate-500' : 'font-medium text-slate-700'
                      } ${
                        activeHeadingId === h.id
                          ? 'bg-red-50 text-red-600 font-bold border-l-2 border-red-600'
                          : 'hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* 2. Quick Linked Dishes Sidebar Widget */}
            {article.products && article.products.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                    <Utensils className="w-4 h-4 text-red-600" />
                    <span>Món ngon trong bài</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {article.products.length} món
                  </span>
                </div>

                <div className="mt-3 space-y-3">
                  {article.products.slice(0, 3).map(({ product }: any) => {
                    const img =
                      product.image ||
                      product.imageUrl ||
                      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200';
                    return (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={img} alt={product.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-slate-900 truncate">{product.name}</h5>
                            <p className="text-red-600 font-extrabold text-xs mt-0.5">
                              {Number(product.price).toLocaleString('vi-VN')}đ
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            addToCart(
                              {
                                id: product.id,
                                name: product.name,
                                price: product.price,
                                image: img,
                                quantity: 1,
                              } as any,
                              currentBranchId || ''
                            );
                            toast.success(`Đã thêm ${product.name} vào giỏ!`);
                          }}
                          className="p-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-all shadow-2xs shrink-0"
                          title="Thêm vào giỏ hàng"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Branch Booking & Hotline Sidebar Card */}
            {branchesList.length > 0 && (
              <div className="bg-gradient-to-br from-slate-900 to-zinc-900 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-wider mb-2">
                  <Store className="w-3 h-3" /> Chi nhánh áp dụng
                </div>
                <h4 className="font-black text-sm text-white">Thưởng thức tại AVORA</h4>
                <div className="mt-2.5 space-y-1.5 text-xs text-slate-300">
                  {branchesList.map((branch: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">
                        <strong className="text-white">{branch.name}</strong>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                  <Link
                    href="/booking"
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl text-center transition-colors shadow-md"
                  >
                    Đặt bàn ngay
                  </Link>
                  <a
                    href="tel:9000000"
                    className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors shrink-0"
                    title="Gọi Hotline"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* 4. Trending Articles in Sidebar */}
            {article.relatedArticles && article.relatedArticles.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-black text-slate-900 text-sm">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                  <span>Tin tức nổi bật</span>
                </div>
                <div className="mt-3 space-y-3">
                  {article.relatedArticles.slice(0, 3).map((rel: any, idx: number) => (
                    <Link
                      key={rel.id}
                      href={`/news/${rel.slug}`}
                      className="flex items-start gap-3 group"
                    >
                      <span className="w-5 h-5 rounded-md bg-slate-100 group-hover:bg-red-600 group-hover:text-white font-black text-xs text-slate-500 flex items-center justify-center shrink-0 transition-colors">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-xs text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                          {rel.title}
                        </h5>
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5" /> {(rel.viewCount || 0).toLocaleString()} lượt xem
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* ── MOBILE STICKY FLOATING ENGAGEMENT DOCK ── */}
      <div className="md:hidden fixed bottom-[74px] sm:bottom-[78px] left-3 right-3 sm:left-4 sm:right-4 z-40 bg-slate-900/95 text-white backdrop-blur-xl rounded-2xl p-2 px-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] border border-white/10 flex items-center justify-between gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
        {/* Floating Mobile Reaction Picker Popover */}
        {isMobileReactionPickerOpen && (
          <div className="absolute bottom-full left-0 mb-3 z-50 flex items-center gap-1.5 p-1.5 bg-slate-900/95 backdrop-blur-md rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.4)] border border-white/15 animate-in fade-in zoom-in-95 duration-150">
            {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((type) => {
              const isSelected = userReaction === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSelectMobileReaction(type)}
                  className={`p-1.5 rounded-full hover:bg-white/10 active:scale-125 transition-all duration-150 ${
                    isSelected ? 'bg-white/20 scale-110' : ''
                  }`}
                  title={REACTION_CONFIG[type].label}
                >
                  <ReactionIcon type={type} size={28} />
                </button>
              );
            })}
          </div>
        )}

        {/* Reaction quick trigger & popover toggle */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleMobileReactionToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all ${
              userReaction
                ? 'bg-white/15 text-white'
                : 'text-slate-300 hover:bg-white/10'
            }`}
          >
            {userReaction ? (
              <ReactionIcon type={userReaction} size={18} />
            ) : (
              <Heart className="w-4 h-4 text-slate-300" />
            )}
            <span>{reactionCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileReactionPickerOpen(!isMobileReactionPickerOpen)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            title="Chọn cảm xúc khác"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isMobileReactionPickerOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Comment quick button */}
        <button
          type="button"
          onClick={scrollToComments}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold hover:bg-white/10 active:scale-95 transition-all text-slate-200"
        >
          <MessageSquare className="w-4 h-4 text-slate-300" />
          <span>{article.commentCount || 0}</span>
        </button>

        {/* Bookmark quick button */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          className={`p-2 rounded-xl text-xs font-bold hover:bg-white/10 active:scale-95 transition-all ${
            isFavorited ? 'text-red-400' : 'text-slate-300'
          }`}
          title={isFavorited ? 'Đã lưu' : 'Lưu'}
        >
          <Bookmark className={`w-4 h-4 ${isFavorited ? 'fill-red-400' : ''}`} />
        </button>

        {/* Share quick button */}
        <button
          type="button"
          onClick={handleNativeShare}
          className="p-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10 active:scale-95 transition-all"
          title="Chia sẻ"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* CTA Direct Order / Booking */}
        <Link
          href={articleType === 'PROMOTION' ? '/booking' : '/news'}
          className="ml-1 px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-md active:scale-95 transition-all shrink-0 flex items-center gap-1"
        >
          <Utensils className="w-3.5 h-3.5" />
          <span>{articleType === 'PROMOTION' ? 'Đặt bàn' : 'Xem thêm'}</span>
        </Link>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        articleId={article.id}
        articleTitle={article.title}
        articleSlug={article.slug}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
