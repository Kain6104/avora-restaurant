'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Save,
  ArrowLeft,
  Image as ImageIcon,
  Sparkles,
  Flame,
  Calendar,
  Clock,
  Lock,
  Store,
  Crown,
  Plus,
  Trash2,
  Tag,
  Ticket,
  Utensils,
  Search,
  Check,
  X,
  Eye,
  Globe,
  FileText,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface BranchItem {
  id: string;
  name: string;
}

interface TierItem {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  imageUrl?: string | null;
  category?: { name: string } | null;
}

interface VoucherOption {
  id: string;
  code: string;
  title?: string | null;
  discountType: string;
  discountValue: number;
  minOrderValue?: number | null;
  endDate?: string | null;
}

export interface ArticleFormValues {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  type: string;
  visibility: string;
  status: string;
  scheduledAt?: string;
  promotionStartAt?: string;
  promotionEndAt?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  branchIds?: string[];
  membershipTierIds?: string[];
  products?: {
    productId: string;
    displayOrder: number;
    highlightNote?: string;
    product?: ProductOption;
  }[];
  vouchers?: {
    voucherId: string;
    customNote?: string;
    voucher?: VoucherOption;
  }[];
}

interface ArticleEditorFormProps {
  initialValues?: Partial<ArticleFormValues>;
  articleId?: string;
  isEditMode?: boolean;
}

function generateSlug(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeStr(text?: string | null) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function buildAutoSeo(
  titleVal: string,
  excerptVal: string,
  contentHtml: string,
  typeVal: string
) {
  const cleanTitle = titleVal.trim();
  const autoMetaTitle = cleanTitle ? `${cleanTitle} | AVORA Restaurant` : '';

  let autoMetaDesc = excerptVal.trim();
  if (!autoMetaDesc && contentHtml) {
    autoMetaDesc = contentHtml
      .replace(/<[^>]*>?/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  }
  if (!autoMetaDesc && cleanTitle) {
    autoMetaDesc = `${cleanTitle} - Khám phá tin tức, ưu đãi và trải nghiệm ẩm thực tinh hoa tại AVORA Restaurant.`;
  }

  const defaultTypeTags: Record<string, string[]> = {
    PROMOTION: ['khuyen-mai', 'uu-dai', 'am-thuc', 'avora-restaurant', 'voucher-giam-gia'],
    NEWS: ['tin-tuc', 'su-kien', 'avora-restaurant', 'am-thuc-cao-cap'],
    EVENT: ['su-kien', 'event', 'avora-restaurant', 'tiec-nha-hang'],
    BRAND_STORY: ['cau-chuyen-thuong-hieu', 'avora-restaurant', 'am-thuc', 'phong-cach-song'],
    GUIDE: ['cam-nang-am-thuc', 'huong-dan', 'meo-hay', 'avora-restaurant'],
    MENU_UPDATE: ['thuc-don-moi', 'mon-ngon', 'avora-restaurant', 'mon-moi-ra-mat'],
  };

  const baseTags = defaultTypeTags[typeVal] || ['avora-restaurant', 'am-thuc'];
  const slugKeywords = cleanTitle
    ? generateSlug(cleanTitle)
        .split('-')
        .filter((w) => w.length > 2)
        .slice(0, 3)
    : [];

  const combinedTags = Array.from(new Set([...baseTags, ...slugKeywords]));
  const autoTags = combinedTags.join(', ');

  return {
    metaTitle: autoMetaTitle,
    metaDescription: autoMetaDesc,
    tags: autoTags,
  };
}

export default function ArticleEditorForm({
  initialValues,
  articleId,
  isEditMode = false,
}: ArticleEditorFormProps) {
  const router = useRouter();
  const { availableBranches } = useAdmin();
  const { locale } = useLanguage();
  const isEn = locale === 'en';

  // Core Form State
  const [title, setTitle] = useState(initialValues?.title || '');
  const [slug, setSlug] = useState(initialValues?.slug || '');
  const [isSlugAuto, setIsSlugAuto] = useState(!isEditMode);
  const [excerpt, setExcerpt] = useState(initialValues?.excerpt || '');
  const [content, setContent] = useState(initialValues?.content || '');
  const [coverImage, setCoverImage] = useState(initialValues?.coverImage || '');
  const [type, setType] = useState(initialValues?.type || 'NEWS');
  const [visibility, setVisibility] = useState(initialValues?.visibility || 'PUBLIC');
  const [status, setStatus] = useState(initialValues?.status || 'PUBLISHED');
  const [scheduledAt, setScheduledAt] = useState(
    initialValues?.scheduledAt ? initialValues.scheduledAt.slice(0, 16) : ''
  );
  const [promotionStartAt, setPromotionStartAt] = useState(
    initialValues?.promotionStartAt ? initialValues.promotionStartAt.slice(0, 16) : ''
  );
  const [promotionEndAt, setPromotionEndAt] = useState(
    initialValues?.promotionEndAt ? initialValues.promotionEndAt.slice(0, 16) : ''
  );

  // SEO & Auto-fill State
  const [metaTitle, setMetaTitle] = useState(initialValues?.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(initialValues?.metaDescription || '');
  const [tagInput, setTagInput] = useState(
    Array.isArray(initialValues?.tags) ? initialValues.tags.join(', ') : ''
  );
  const [isSeoAuto, setIsSeoAuto] = useState(!isEditMode || !initialValues?.metaTitle);

  // Targeting & Relations
  const [branches, setBranches] = useState<BranchItem[]>(
    availableBranches && availableBranches.length > 0 ? availableBranches : []
  );
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    initialValues?.branchIds || []
  );
  const [membershipTiers, setMembershipTiers] = useState<TierItem[]>([]);
  const [selectedTierIds, setSelectedTierIds] = useState<string[]>(
    initialValues?.membershipTierIds || []
  );

  // Linked Products & Vouchers
  const [linkedProducts, setLinkedProducts] = useState<
    { productId: string; displayOrder: number; highlightNote?: string; product?: ProductOption }[]
  >(initialValues?.products || []);
  const [linkedVouchers, setLinkedVouchers] = useState<
    { voucherId: string; customNote?: string; voucher?: VoucherOption }[]
  >(initialValues?.vouchers || []);

  // Modals for Products & Vouchers
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherOptions, setVoucherOptions] = useState<VoucherOption[]>([]);
  const [voucherSearch, setVoucherSearch] = useState('');
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Fetch branches and membership tiers
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // 1. Fetch Branches from /api/admin/branches
    fetch(`${baseUrl}/api/admin/branches`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (items.length > 0) {
          setBranches(items);
        } else if (availableBranches && availableBranches.length > 0) {
          setBranches(availableBranches);
        }
      })
      .catch(() => {
        if (availableBranches && availableBranches.length > 0) {
          setBranches(availableBranches);
        }
      });

    // 2. Fetch Membership Tiers from /api/admin/membership-tiers
    fetch(`${baseUrl}/api/admin/membership-tiers?limit=100`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (items.length > 0) {
          setMembershipTiers(items);
        }
      })
      .catch(() => {});
  }, [availableBranches]);

  // Sync availableBranches if loaded later
  useEffect(() => {
    if (availableBranches && availableBranches.length > 0 && branches.length === 0) {
      setBranches(availableBranches);
    }
  }, [availableBranches, branches.length]);

  // Handle Title Change with Auto-Slug and Auto-SEO
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isSlugAuto) {
      setSlug(generateSlug(val));
    }
    if (isSeoAuto) {
      const seo = buildAutoSeo(val, excerpt, content, type);
      setMetaTitle(seo.metaTitle);
      if (!metaDescription || isSeoAuto) {
        setMetaDescription(seo.metaDescription);
      }
      setTagInput(seo.tags);
    }
  };

  // Handle Excerpt Change with Auto-SEO
  const handleExcerptChange = (val: string) => {
    setExcerpt(val);
    if (isSeoAuto) {
      const seo = buildAutoSeo(title, val, content, type);
      if (seo.metaDescription) {
        setMetaDescription(seo.metaDescription);
      }
    }
  };

  // Handle Type Change with Auto-SEO Tags
  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (isSeoAuto) {
      const seo = buildAutoSeo(title, excerpt, content, newType);
      setTagInput(seo.tags);
    }
  };

  // Manual trigger for 1-click SEO & Tags generation
  const handleTriggerAutoSeo = () => {
    if (!title.trim()) {
      toast.error(
        isEn
          ? 'Please enter article title before generating SEO'
          : 'Vui lòng nhập tiêu đề bài viết trước khi tạo SEO'
      );
      return;
    }
    const seo = buildAutoSeo(title, excerpt, content, type);
    setMetaTitle(seo.metaTitle);
    setMetaDescription(seo.metaDescription);
    setTagInput(seo.tags);
    setIsSeoAuto(true);
    toast.success(
      isEn
        ? 'Auto-optimized SEO & Tags successfully!'
        : 'Đã tự động tối ưu SEO & Tags thành công!'
    );
  };

  // Open Product Search Modal
  const handleOpenProductModal = async () => {
    setIsProductModalOpen(true);
    setIsLoadingProducts(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      let items: any[] = [];

      // 1. Try /api/admin/products
      try {
        const res = await fetch(`${baseUrl}/api/admin/products?limit=100`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          items = json?.data?.products || json?.products || json?.data || [];
        }
      } catch {}

      // 2. If empty, try public /api/products/search
      if (!items || items.length === 0) {
        try {
          const res = await fetch(`${baseUrl}/api/products/search?limit=100`, { credentials: 'include' });
          if (res.ok) {
            const json = await res.json();
            items = json?.products || json?.data?.products || json?.data || [];
          }
        } catch {}
      }

      if (Array.isArray(items)) {
        setProductOptions(items);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      toast.error(isEn ? 'Error loading dishes' : 'Lỗi khi tải danh sách món ăn');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Open Voucher Search Modal
  const handleOpenVoucherModal = async () => {
    setIsVoucherModalOpen(true);
    setIsLoadingVouchers(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      let items: any[] = [];

      // 1. Try /api/admin/promotions/vouchers
      try {
        const res = await fetch(`${baseUrl}/api/admin/promotions/vouchers?limit=100`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          items = json?.data?.vouchers || json?.vouchers || json?.data || [];
        }
      } catch {}

      // 2. If empty, try public /api/promotions/vouchers
      if (!items || items.length === 0) {
        try {
          const res = await fetch(`${baseUrl}/api/promotions/vouchers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({}),
          });
          if (res.ok) {
            const json = await res.json();
            items = json?.data?.vouchers || json?.vouchers || json?.data || (Array.isArray(json) ? json : []);
          }
        } catch {}
      }

      if (Array.isArray(items)) {
        setVoucherOptions(items);
      }
    } catch (err) {
      console.error('Error fetching vouchers:', err);
      toast.error(isEn ? 'Error loading vouchers' : 'Lỗi khi tải danh sách voucher');
    } finally {
      setIsLoadingVouchers(false);
    }
  };

  const handleToggleProduct = (prod: ProductOption) => {
    const exists = linkedProducts.some((p) => p.productId === prod.id);
    if (exists) {
      setLinkedProducts(linkedProducts.filter((p) => p.productId !== prod.id));
    } else {
      setLinkedProducts([
        ...linkedProducts,
        {
          productId: prod.id,
          displayOrder: linkedProducts.length,
          highlightNote: '',
          product: prod,
        },
      ]);
    }
  };

  const handleToggleVoucher = (v: VoucherOption) => {
    const exists = linkedVouchers.some((item) => item.voucherId === v.id);
    if (exists) {
      setLinkedVouchers(linkedVouchers.filter((item) => item.voucherId !== v.id));
    } else {
      setLinkedVouchers([
        ...linkedVouchers,
        {
          voucherId: v.id,
          customNote: '',
          voucher: v,
        },
      ]);
    }
  };

  const handleSubmit = async (overrideStatus?: string) => {
    if (!title.trim()) {
      toast.error(isEn ? 'Please enter article title' : 'Vui lòng nhập tiêu đề bài viết');
      return;
    }
    if (!content.trim()) {
      toast.error(isEn ? 'Please enter article content' : 'Vui lòng nhập nội dung bài viết');
      return;
    }

    const currentFinalStatus = overrideStatus || status;

    if (currentFinalStatus === 'SCHEDULED' && !scheduledAt) {
      toast.error(
        isEn
          ? 'Please select scheduled publishing time (scheduledAt)'
          : 'Vui lòng chọn thời gian lên lịch xuất bản (scheduledAt)'
      );
      return;
    }

    if (type === 'PROMOTION' && promotionStartAt && promotionEndAt) {
      if (new Date(promotionStartAt) >= new Date(promotionEndAt)) {
        toast.error(
          isEn
            ? 'Promotion start time must be before end time'
            : 'Thời gian bắt đầu khuyến mãi phải trước thời gian kết thúc'
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const payload: any = {
        title: title.trim(),
        slug: slug.trim() || generateSlug(title),
        excerpt: excerpt.trim() || undefined,
        content: content.trim(),
        coverImage: coverImage.trim() || undefined,
        coverImageUrl: coverImage.trim() || undefined,
        type,
        articleType: type,
        visibility,
        status: currentFinalStatus,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        promotionStartAt: promotionStartAt ? new Date(promotionStartAt).toISOString() : undefined,
        promotionEndAt: promotionEndAt ? new Date(promotionEndAt).toISOString() : undefined,
        metaTitle: metaTitle.trim() || undefined,
        seoTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        seoDescription: metaDescription.trim() || undefined,
        tags: tagInput
          ? tagInput
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        branchIds: selectedBranchIds,
        membershipTierIds: selectedTierIds,
        productIds: linkedProducts.map((p) => p.productId),
        products: linkedProducts.map((p, idx) => ({
          productId: p.productId,
          displayOrder: idx,
          highlightNote: p.highlightNote || undefined,
        })),
        voucherIds: linkedVouchers.map((v) => v.voucherId),
        vouchers: linkedVouchers.map((v) => ({
          voucherId: v.voucherId,
          customNote: v.customNote || undefined,
        })),
      };

      const url = isEditMode
        ? `${baseUrl}/api/admin/articles/${articleId}`
        : `${baseUrl}/api/admin/articles`;
      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData?.error?.message || errData?.message || (isEn ? 'An error occurred' : 'Có lỗi xảy ra'));
        return;
      }

      toast.success(
        isEditMode
          ? (isEn ? 'Article updated successfully!' : 'Đã cập nhật bài viết!')
          : (isEn ? 'Article created successfully!' : 'Tạo bài viết thành công!')
      );
      router.push('/admin/articles');
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(isEn ? 'Error saving article' : 'Lỗi khi lưu bài viết');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/articles"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {isEditMode
                ? (isEn ? 'Edit Article' : 'Chỉnh Sửa Bài Viết')
                : (isEn ? 'Create New Article / News' : 'Tạo Bài Viết / Tin Tức Mới')}
            </h1>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'Fill in complete content, images, and configure audience visibility'
                : 'Điền đầy đủ nội dung, hình ảnh và thiết lập đối tượng hiển thị'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSubmit('DRAFT')}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isEn ? 'Save Draft' : 'Lưu bản nháp'}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            <span>
              {isSaving
                ? (isEn ? 'Saving...' : 'Đang lưu...')
                : isEditMode
                ? (isEn ? 'Update' : 'Cập nhật')
                : (isEn ? 'Publish / Save' : 'Xuất bản / Lưu')}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── LEFT COLUMN (Main Content) ── */}
        <div className="lg:col-span-8 space-y-6">
          {/* Title & Slug */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {isEn ? 'Article Title' : 'Tiêu đề bài viết'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder={
                  isEn
                    ? 'e.g. Summer Feast - 30% Off Entire AVORA Menu'
                    : 'VD: Đại Tiệc Mùa Hè - Ưu Đãi Giảm 30% Toàn Menu AVORA'
                }
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full px-4 py-3 text-base font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isEn ? 'URL Slug' : 'Đường dẫn (Slug URL)'} <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsSlugAuto(!isSlugAuto)}
                  className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                >
                  {isSlugAuto
                    ? (isEn ? 'Auto generate' : 'Tự động tạo')
                    : (isEn ? 'Manual edit' : 'Tự chỉnh sửa')}
                </button>
              </div>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                <span className="text-slate-400 font-mono">/news/</span>
                <input
                  type="text"
                  value={slug}
                  readOnly={isSlugAuto}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="dai-tiec-mua-he-giam-30"
                  className="w-full bg-transparent border-none outline-none font-mono text-slate-800 ml-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {isEn ? 'Excerpt / Summary' : 'Mô tả tóm tắt (Excerpt)'}
              </label>
              <textarea
                rows={2}
                placeholder={
                  isEn
                    ? 'Brief summary of the article for preview cards and SEO...'
                    : 'Tóm tắt ngắn gọn nội dung bài viết để hiển thị trên thẻ xem trước và SEO...'
                }
                value={excerpt}
                onChange={(e) => handleExcerptChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Rich Content Editor */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isEn ? 'Article Content (HTML / Rich Text)' : 'Nội dung bài viết (HTML / Rich Text)'} <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {isEn ? 'Backend automatically sanitizes against XSS' : 'Hệ thống backend tự động sanitize chống XSS'}
              </span>
            </div>

            {/* Content Textarea */}
            <textarea
              rows={14}
              placeholder={
                isEn
                  ? 'Enter article content (supports HTML tags like <h2>, <p>, <strong>, <ul>, <img>, <blockquote>...)'
                  : 'Nhập nội dung bài viết (hỗ trợ định dạng HTML như <h2>, <p>, <strong>, <ul>, <img>, <blockquote>...)'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-4 py-3 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white leading-relaxed"
            />
          </div>

          {/* Linked Products & Vouchers Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-5">
            {/* Products Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Utensils size={18} className="text-red-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {isEn ? 'Related Dishes' : 'Món ăn liên quan'} ({linkedProducts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleOpenProductModal}
                className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100/80 transition-colors cursor-pointer"
              >
                <Plus size={14} /> {isEn ? 'Select dish' : 'Chọn món ăn'}
              </button>
            </div>

            {linkedProducts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {isEn ? 'No dishes linked to this article yet.' : 'Chưa gắn món ăn nào vào bài viết này.'}
              </p>
            ) : (
              <div className="space-y-2">
                {linkedProducts.map((p, idx) => (
                  <div
                    key={p.productId}
                    className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800 truncate">
                        {p.product?.name || (isEn ? `Dish ID: ${p.productId}` : `Món ID: ${p.productId}`)}
                      </span>
                      <input
                        type="text"
                        placeholder={isEn ? 'Note (e.g. Best seller)' : 'Ghi chú (VD: Món bán chạy)'}
                        value={p.highlightNote || ''}
                        onChange={(e) => {
                          const updated = [...linkedProducts];
                          updated[idx].highlightNote = e.target.value;
                          setLinkedProducts(updated);
                        }}
                        className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg w-40"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLinkedProducts(linkedProducts.filter((item) => item.productId !== p.productId))
                      }
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Vouchers Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Ticket size={18} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {isEn ? 'Linked Voucher Codes' : 'Mã Voucher liên kết'} ({linkedVouchers.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleOpenVoucherModal}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 transition-colors cursor-pointer"
              >
                <Plus size={14} /> {isEn ? 'Select voucher' : 'Chọn voucher'}
              </button>
            </div>

            {linkedVouchers.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                {isEn ? 'No vouchers linked to this article yet.' : 'Chưa gắn voucher nào vào bài viết này.'}
              </p>
            ) : (
              <div className="space-y-2">
                {linkedVouchers.map((v) => (
                  <div
                    key={v.voucherId}
                    className="flex items-center justify-between gap-3 p-2.5 bg-amber-50/50 rounded-xl border border-dashed border-amber-200 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono font-bold text-red-600 bg-white px-2 py-0.5 rounded border border-red-200">
                        {v.voucher?.code || v.voucherId}
                      </span>
                      {v.voucher && (
                        <span className="text-[11px] text-slate-600 truncate">
                          {v.voucher.discountType === 'PERCENTAGE'
                            ? (isEn ? `Discount ${v.voucher.discountValue}%` : `Giảm ${v.voucher.discountValue}%`)
                            : (isEn
                                ? `Discount ${v.voucher.discountValue?.toLocaleString('vi-VN')} VND`
                                : `Giảm ${v.voucher.discountValue?.toLocaleString('vi-VN')} đ`)}
                        </span>
                      )}
                      <input
                        type="text"
                        placeholder={isEn ? 'Terms & conditions note...' : 'Ghi chú điều kiện áp dụng...'}
                        value={v.customNote || ''}
                        onChange={(e) => {
                          const updated = [...linkedVouchers];
                          const target = updated.find((item) => item.voucherId === v.voucherId);
                          if (target) target.customNote = e.target.value;
                          setLinkedVouchers(updated);
                        }}
                        className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-lg w-44"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setLinkedVouchers(linkedVouchers.filter((item) => item.voucherId !== v.voucherId))
                      }
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (Settings & Targeting) ── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status & Type */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isEn ? 'Publishing Settings' : 'Thiết lập xuất bản'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isEn ? 'Article Status' : 'Trạng thái bài viết'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-semibold"
              >
                <option value="PUBLISHED">{isEn ? 'Published (PUBLISHED)' : 'Đã xuất bản (PUBLISHED)'}</option>
                <option value="SCHEDULED">{isEn ? 'Scheduled (SCHEDULED)' : 'Hẹn giờ xuất bản (SCHEDULED)'}</option>
                <option value="DRAFT">{isEn ? 'Draft (DRAFT)' : 'Bản nháp (DRAFT)'}</option>
                <option value="ARCHIVED">{isEn ? 'Archived (ARCHIVED)' : 'Lưu trữ (ARCHIVED)'}</option>
              </select>
            </div>

            {status === 'SCHEDULED' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isEn ? 'Scheduled Publishing Time' : 'Thời gian xuất bản tự động'}
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isEn ? 'Article Type' : 'Loại bài viết'}
              </label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-semibold"
              >
                <option value="NEWS">{isEn ? 'News & Announcements (NEWS)' : 'Tin tức (NEWS)'}</option>
                <option value="PROMOTION">{isEn ? 'Promotions & Offers (PROMOTION)' : 'Khuyến mãi & Ưu đãi (PROMOTION)'}</option>
                <option value="EVENT">{isEn ? 'Event (EVENT)' : 'Sự kiện (EVENT)'}</option>
                <option value="BRAND_STORY">{isEn ? 'Brand Story (BRAND_STORY)' : 'Câu chuyện thương hiệu (BRAND_STORY)'}</option>
                <option value="GUIDE">{isEn ? 'Culinary Guide (GUIDE)' : 'Cẩm nang ẩm thực (GUIDE)'}</option>
                <option value="MENU_UPDATE">{isEn ? 'New Menu (MENU_UPDATE)' : 'Món mới (MENU_UPDATE)'}</option>
              </select>
            </div>

            {/* Promotion duration fields */}
            {type === 'PROMOTION' && (
              <div className="space-y-3 pt-3 border-t border-slate-100 bg-red-50/50 p-3 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                  <Flame size={14} /> {isEn ? 'Promotion Duration' : 'Thời gian chạy khuyến mãi'}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isEn ? 'Promotion Starts' : 'Bắt đầu khuyến mãi'}
                  </label>
                  <input
                    type="datetime-local"
                    value={promotionStartAt}
                    onChange={(e) => setPromotionStartAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {isEn ? 'Promotion Ends' : 'Kết thúc khuyến mãi'}
                  </label>
                  <input
                    type="datetime-local"
                    value={promotionEndAt}
                    onChange={(e) => setPromotionEndAt(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cover Image */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon size={14} className="text-red-600" /> {isEn ? 'Cover Image' : 'Ảnh bìa (Cover Image)'}
            </h3>

            <div>
              <input
                type="text"
                placeholder={isEn ? 'https://... (Article image URL)' : 'https://... (URL ảnh bài viết)'}
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>

            {coverImage && (
              <div className="aspect-16/9 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img src={coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Targeting (Branches & Tiers) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isEn ? 'Audience & Branches' : 'Đối tượng & Chi nhánh'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isEn ? 'Access Permission (Visibility)' : 'Quyền truy cập (Visibility)'}
              </label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 font-semibold"
              >
                <option value="PUBLIC">{isEn ? 'Public to all (PUBLIC)' : 'Công khai tất cả (PUBLIC)'}</option>
                <option value="AUTHENTICATED">{isEn ? 'Logged-in users only (AUTHENTICATED)' : 'Chỉ khách đã đăng nhập (AUTHENTICATED)'}</option>
                <option value="MEMBERS_ONLY">{isEn ? 'Members Only (MEMBERS_ONLY)' : 'Dành riêng cho Hội viên (MEMBERS_ONLY)'}</option>
                <option value="PRIVATE">{isEn ? 'Internal / Admin (PRIVATE)' : 'Nội bộ / Admin (PRIVATE)'}</option>
              </select>
            </div>

            {/* Target Branches */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Store size={13} /> {isEn ? 'Applicable Branches' : 'Áp dụng chi nhánh'} ({branches.length})
                </label>
                {branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBranchIds.length === branches.length) {
                        setSelectedBranchIds([]);
                      } else {
                        setSelectedBranchIds(branches.map((b) => b.id));
                      }
                    }}
                    className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                  >
                    {selectedBranchIds.length === branches.length
                      ? (isEn ? 'Deselect all' : 'Bỏ chọn tất cả')
                      : (isEn ? 'Select all' : 'Chọn tất cả')}
                  </button>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-400 pb-1 italic">
                  {isEn ? 'Unselected = Applies to all branches' : 'Không chọn gì = Áp dụng tất cả các chi nhánh'}
                </div>
                {branches.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2 text-center">
                    {isEn ? 'Loading branch list...' : 'Đang tải danh sách chi nhánh...'}
                  </div>
                ) : (
                  branches.map((b) => {
                    const isChecked = selectedBranchIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className="flex items-center gap-2 text-xs text-slate-800 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedBranchIds(selectedBranchIds.filter((id) => id !== b.id));
                            } else {
                              setSelectedBranchIds([...selectedBranchIds, b.id]);
                            }
                          }}
                          className="rounded text-red-600 focus:ring-red-500"
                        />
                        <span className="font-medium">{b.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Target Membership Tiers */}
            {visibility === 'MEMBERS_ONLY' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Crown size={13} className="text-amber-500" /> {isEn ? 'Membership Tier' : 'Hạng thẻ thành viên'}
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-400 pb-1 italic">
                    {isEn ? 'Unselected = All membership tiers' : 'Không chọn gì = Tất cả các hạng hội viên'}
                  </div>
                  {membershipTiers.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-2 text-center">
                      {isEn ? 'Loading membership tiers...' : 'Đang tải danh sách hạng thẻ...'}
                    </div>
                  ) : (
                    membershipTiers.map((t) => {
                      const isChecked = selectedTierIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className="flex items-center gap-2 text-xs text-slate-800 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedTierIds(selectedTierIds.filter((id) => id !== t.id));
                              } else {
                                setSelectedTierIds([...selectedTierIds, t.id]);
                              }
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-medium">{t.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SEO & Meta */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={14} className="text-blue-600" /> {isEn ? 'SEO & Tags Optimization' : 'Tối ưu SEO & Tags'}
              </h3>
              <button
                type="button"
                onClick={handleTriggerAutoSeo}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title={isEn ? 'Auto generate SEO Meta & Tags from title, summary and type' : 'Tự động tạo SEO Meta & Tags theo tiêu đề, tóm tắt và loại bài'}
              >
                <Sparkles size={12} /> {isEn ? 'Auto-fill SEO' : 'Tự động điền SEO'}
              </button>
            </div>

            <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isSeoAuto}
                onChange={(e) => setIsSeoAuto(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500"
              />
              <span>{isEn ? 'Auto sync SEO when changing title & type' : 'Tự động đồng bộ SEO khi sửa tiêu đề & loại bài'}</span>
            </label>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Meta Title (SEO)
                </label>
                <span className="text-[10px] text-slate-400">
                  {metaTitle.length} {isEn ? 'chars (recommended ≤ 60)' : 'ký tự (khuyến nghị ≤ 60)'}
                </span>
              </div>
              <input
                type="text"
                placeholder={isEn ? 'Title displayed on Google search results...' : 'Tiêu đề hiển thị trên Google...'}
                value={metaTitle}
                onChange={(e) => {
                  setMetaTitle(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Meta Description (SEO)
                </label>
                <span className="text-[10px] text-slate-400">
                  {metaDescription.length} {isEn ? 'chars (recommended ≤ 160)' : 'ký tự (khuyến nghị ≤ 160)'}
                </span>
              </div>
              <textarea
                rows={2}
                placeholder={
                  isEn
                    ? 'Summary displayed on Google search results...'
                    : 'Mô tả tóm tắt hiển thị trên kết quả tìm kiếm Google...'
                }
                value={metaDescription}
                onChange={(e) => {
                  setMetaDescription(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isEn ? 'Tags (Separated by commas)' : 'Tags (Cách nhau bằng dấu phẩy)'}
              </label>
              <input
                type="text"
                placeholder="khuyen-mai, mon-ngon, voucher, avora-restaurant"
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL CHỌN MÓN ĂN ── */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {isEn ? 'Select Dishes to Link to Article' : 'Chọn món ăn gắn vào bài viết'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-3 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  isEn
                    ? 'Search dish by name or category (e.g. fried rice, sushi...)'
                    : 'Tìm món theo tên hoặc danh mục (VD: cơm chiên, sushi...)'
                }
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
              {isLoadingProducts ? (
                <div className="py-16 text-center text-slate-400 text-xs font-medium animate-pulse">
                  {isEn ? 'Loading dishes from system...' : 'Đang tải danh sách món ăn từ hệ thống...'}
                </div>
              ) : (() => {
                const query = normalizeStr(productSearch);
                const filtered = productOptions.filter((p) => {
                  if (!query) return true;
                  const nameMatch = normalizeStr(p.name).includes(query);
                  const catMatch = normalizeStr(p.category?.name).includes(query);
                  return nameMatch || catMatch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      {isEn
                        ? `No dishes found matching "${productSearch}"`
                        : `Không tìm thấy món ăn nào phù hợp với "${productSearch}"`}
                    </div>
                  );
                }

                return filtered.map((prod) => {
                  const isSelected = linkedProducts.some((p) => p.productId === prod.id);
                  const img = prod.imageUrl || prod.image || '/food-placeholder.png';
                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleToggleProduct(prod)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-red-50/90 border-red-300 shadow-2xs'
                          : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60">
                          <img
                            src={img}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate">{prod.name}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-red-600 font-extrabold">
                              {prod.price?.toLocaleString('vi-VN')} {isEn ? 'VND' : 'đ'}
                            </span>
                            {prod.category?.name && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                {prod.category.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-red-600 text-white shadow-xs' : 'border border-slate-300'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={2.5} />}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {isEn ? 'Selected:' : 'Đã chọn:'} <strong className="text-red-600 font-bold">{linkedProducts.length}</strong> {isEn ? 'dishes' : 'món'}
              </span>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {isEn ? 'Done' : 'Xong'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CHỌN VOUCHER ── */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {isEn ? 'Select Vouchers to Link to Article' : 'Chọn Voucher gắn vào bài viết'}
              </h3>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-3 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  isEn
                    ? 'Search code or voucher title (e.g. WELCOME50, VIPGOLD...)'
                    : 'Tìm mã hoặc tiêu đề voucher (VD: WELCOME50, VIPGOLD...)'
                }
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 focus:bg-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[220px]">
              {isLoadingVouchers ? (
                <div className="py-16 text-center text-slate-400 text-xs font-medium animate-pulse">
                  {isEn ? 'Loading vouchers from system...' : 'Đang tải danh sách voucher từ hệ thống...'}
                </div>
              ) : (() => {
                const query = normalizeStr(voucherSearch);
                const filtered = voucherOptions.filter((v) => {
                  if (!query) return true;
                  const codeMatch = normalizeStr(v.code).includes(query);
                  const titleMatch = normalizeStr(v.title).includes(query);
                  return codeMatch || titleMatch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      {isEn
                        ? `No vouchers found matching "${voucherSearch}"`
                        : `Không tìm thấy voucher nào phù hợp với "${voucherSearch}"`}
                    </div>
                  );
                }

                return filtered.map((v) => {
                  const isSelected = linkedVouchers.some((item) => item.voucherId === v.id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => handleToggleVoucher(v)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-50/90 border-amber-300 shadow-2xs'
                          : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                            {v.code}
                          </span>
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            {v.discountType === 'PERCENTAGE'
                              ? (isEn ? `Discount ${v.discountValue}%` : `Giảm ${v.discountValue}%`)
                              : (isEn
                                  ? `Discount ${v.discountValue?.toLocaleString('vi-VN')} VND`
                                  : `Giảm ${v.discountValue?.toLocaleString('vi-VN')} đ`)}
                          </span>
                        </div>
                        {v.title && (
                          <p className="text-xs text-slate-700 font-medium truncate mt-1">{v.title}</p>
                        )}
                        {v.minOrderValue ? (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {isEn ? 'Min order:' : 'Đơn tối thiểu:'} {v.minOrderValue.toLocaleString('vi-VN')} {isEn ? 'VND' : 'đ'}
                          </span>
                        ) : null}
                      </div>

                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-amber-600 text-white shadow-xs' : 'border border-slate-300'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={2.5} />}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {isEn ? 'Selected:' : 'Đã chọn:'} <strong className="text-amber-700 font-bold">{linkedVouchers.length}</strong> {isEn ? 'vouchers' : 'voucher'}
              </span>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                {isEn ? 'Done' : 'Xong'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
