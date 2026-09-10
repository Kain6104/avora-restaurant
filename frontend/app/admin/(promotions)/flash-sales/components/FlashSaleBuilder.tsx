'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAdmin } from '@/contexts/AdminContext';
import {
  Zap,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Store,
  Tag,
  ShoppingBag,
  Sliders,
  Eye,
  ShieldCheck,
  Save,
  Play,
  Pause,
  XCircle,
  Plus,
  Trash2,
  Search,
  Percent,
  Flame,
  ArrowRight,
  Smartphone,
  Monitor,
  Info,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Copy,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Check,
} from 'lucide-react';
import {
  FlashSaleCampaign,
  FlashSaleSlot,
  FlashSaleItem,
  FlashSaleCheckItem,
} from '@/types/flash-sale';

interface FlashSaleBuilderProps {
  initialCampaignId?: string;
  isEditMode?: boolean;
}

interface FormState {
  name: string;
  code: string;
  description: string;
  priority: number;
  isFeatured: boolean;
  applyOnline: boolean;
  applyPos: boolean;
  branchScope: 'ALL' | 'CUSTOM';
  selectedBranchIds: string[];
  startTime: string;
  endTime: string;
  teaserHoursBefore: number;
  slots: {
    id?: string;
    name: string;
    startTime: string;
    endTime: string;
  }[];
  items: {
    id?: string;
    productId: string;
    productName: string;
    productPrice: number;
    productImage?: string | null;
    categoryName?: string;
    slotIndex: number;
    flashSalePrice: number;
    stock: number;
    sold: number;
    maxQuantityPerUser: number;
    maxQuantityPerOrder: number;
  }[];
  maxQuantityPerOrder: number;
  maxQuantityPerUser: number;
  allowVouchers: boolean;
  allowFreeship: boolean;
  allowPoints: boolean;
  allowMembershipDiscount: boolean;
  bannerImageUrl: string;
  mobileBannerImageUrl: string;
}

const STEPS = [
  { step: 1, title: 'Thông tin' },
  { step: 2, title: 'Chi nhánh' },
  { step: 3, title: 'Khung giờ' },
  { step: 4, title: 'Chọn món' },
  { step: 5, title: 'Giá & Tồn' },
  { step: 6, title: 'Quy tắc' },
  { step: 7, title: 'Preview' },
  { step: 8, title: 'Xuất bản' },
];

export default function FlashSaleBuilder({
  initialCampaignId,
  isEditMode = false,
}: FlashSaleBuilderProps) {
  const router = useRouter();
  const { allBranches } = useAdmin();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Available catalog products for picker
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string }[]>([]);

  // Bulk Edit state for Step 5
  const [bulkDiscountPercent, setBulkDiscountPercent] = useState<number>(20);
  const [bulkStock, setBulkStock] = useState<number>(30);
  const [bulkLimitPerUser, setBulkLimitPerUser] = useState<number>(2);

  // Preview device state in Step 7
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');

  // Validation results in Step 8
  const [validationChecks, setValidationChecks] = useState<FlashSaleCheckItem[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Step 3: Realtime Conflict Check
  const [step3Conflict, setStep3Conflict] = useState<{
    checking: boolean;
    hasConflict: boolean;
    message?: string;
    errors: string[];
  }>({ checking: false, hasConflict: false, errors: [] });

  // Step 4: Slot tab & Recommendations
  const [selectedSlotForItems, setSelectedSlotForItems] = useState<number | 'ALL'>('ALL');
  const [quickFilterType, setQuickFilterType] = useState<'ALL' | 'BESTSELLER' | 'SLOW' | 'LOW_REVENUE'>('ALL');
  const [recommendations, setRecommendations] = useState<{
    bestsellers: any[];
    slowSellers: any[];
    lowRevenue: any[];
    metrics: Record<string, { soldQuantity: number; revenue: number }>;
  } | null>(null);

  // Step 5: Slot filter for pricing table
  const [step5SlotFilter, setStep5SlotFilter] = useState<number | 'ALL'>('ALL');

  // Form State
  const [formData, setFormData] = useState<FormState>(() => {
    const start = new Date();
    start.setHours(start.getHours() + 2, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 6);

    const slot1Start = new Date(start);
    const slot1End = new Date(start);
    slot1End.setHours(slot1End.getHours() + 2);

    const slot2Start = new Date(slot1End);
    const slot2End = new Date(end);

    const toInputString = (d: Date) => d.toISOString().slice(0, 16);

    return {
      name: '',
      code: `FS-${Date.now().toString().slice(-6)}`,
      description: '',
      priority: 0,
      isFeatured: true,
      applyOnline: true,
      applyPos: true,
      branchScope: 'ALL',
      selectedBranchIds: [],
      startTime: toInputString(start),
      endTime: toInputString(end),
      teaserHoursBefore: 4,
      slots: [
        {
          name: 'Khung Giờ Vàng 1',
          startTime: toInputString(slot1Start),
          endTime: toInputString(slot1End),
        },
        {
          name: 'Khung Giờ Vàng 2',
          startTime: toInputString(slot2Start),
          endTime: toInputString(slot2End),
        },
      ],
      items: [],
      maxQuantityPerOrder: 5,
      maxQuantityPerUser: 2,
      allowVouchers: false,
      allowFreeship: true,
      allowPoints: false,
      allowMembershipDiscount: false,
      bannerImageUrl: '',
      mobileBannerImageUrl: '',
    };
  });

  // Fetch catalog products and categories
  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setIsLoadingProducts(true);

        // 1. Fetch categories from metadata
        try {
          const res = await fetch('/api/admin/reports/products/metadata/filters', {
            credentials: 'include',
          });
          if (res.ok) {
            const json = await res.json();
            if (json.data?.categories && json.data.categories.length > 0) {
              setCategoriesList(json.data.categories);
            }
          }
        } catch (e) {
          console.warn('Could not load categories from report filters:', e);
        }

        // 2. Fetch products
        let prods: any[] = [];
        let cats: any[] = [];

        try {
          const pRes = await fetch('/api/products/search?limit=300', {
            credentials: 'include',
          });
          if (pRes.ok) {
            const pJson = await pRes.json();
            if (pJson.products && Array.isArray(pJson.products)) {
              prods = pJson.products;
            }
            if (pJson.categories && Array.isArray(pJson.categories)) {
              cats = pJson.categories;
            }
          }
        } catch (e) {
          console.warn('Could not search products from /api/products/search:', e);
        }

        if (prods.length === 0) {
          try {
            const pAdminRes = await fetch('/api/admin/products?limit=300', {
              credentials: 'include',
            });
            if (pAdminRes.ok) {
              const pAdminJson = await pAdminRes.json();
              prods = pAdminJson.data || [];
            }
          } catch (e) {
            console.warn('Could not fetch admin products:', e);
          }
        }

        // Merge categories from API and directly from loaded products
        const catMap = new Map<string, { id: string; name: string }>();
        cats.forEach((c: any) => {
          if (c.id && c.name) catMap.set(c.id, { id: c.id, name: c.name });
        });
        prods.forEach((p: any) => {
          if (p.category?.id && p.category?.name) {
            catMap.set(p.category.id, { id: p.category.id, name: p.category.name });
          } else if (p.categoryId && p.categoryName) {
            catMap.set(p.categoryId, { id: p.categoryId, name: p.categoryName });
          }
        });

        setCatalogProducts(prods);
        if (catMap.size > 0) {
          setCategoriesList((prev) => {
            const merged = new Map(catMap);
            prev.forEach((c) => merged.set(c.id, c));
            return Array.from(merged.values());
          });
        }
      } catch (e) {
        console.error('Error fetching catalog products:', e);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadCatalog();
  }, []);

  // Fetch product recommendations for Step 4
  useEffect(() => {
    fetch('/api/admin/flash-sales/recommendations/products', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.data) {
          setRecommendations(res.data);
        }
      })
      .catch((err) => console.warn('Could not load recommendations:', err));
  }, []);

  // If in Edit Mode, fetch existing campaign data
  useEffect(() => {
    if (!initialCampaignId) return;

    const fetchCampaign = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/flash-sales/${initialCampaignId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const camp: FlashSaleCampaign = json.data;

            const toInputString = (dStr: string) =>
              dStr ? new Date(dStr).toISOString().slice(0, 16) : '';

            // Map slots
            const mappedSlots = (camp.slots || []).map((s) => ({
              id: s.id,
              name: s.name,
              startTime: toInputString(s.startTime),
              endTime: toInputString(s.endTime),
            }));

            // Map items
            const mappedItems = (camp.items || []).map((it) => {
              const slotIdx = mappedSlots.findIndex((s) => s.id === it.flashSaleSlotId);
              return {
                id: it.id,
                productId: it.productId,
                productName: it.product?.name || 'Sản phẩm',
                productPrice: it.product?.price || 0,
                productImage: it.product?.imageUrl || null,
                categoryName: it.product?.category?.name,
                slotIndex: slotIdx >= 0 ? slotIdx : 0,
                flashSalePrice: it.flashSalePrice,
                stock: it.stock,
                sold: it.sold || 0,
                maxQuantityPerUser: it.maxQuantityPerUser || 2,
                maxQuantityPerOrder: it.maxQuantityPerOrder || 5,
              };
            });

            setFormData({
              name: camp.name,
              code: camp.code,
              description: camp.description || '',
              priority: camp.priority || 0,
              isFeatured: camp.isFeatured,
              applyOnline: camp.applyOnline ?? true,
              applyPos: camp.applyPos ?? true,
              branchScope:
                camp.branches && camp.branches.length > 0 ? 'CUSTOM' : 'ALL',
              selectedBranchIds: (camp.branches || []).map((b) => b.id),
              startTime: toInputString(camp.startTime),
              endTime: toInputString(camp.endTime),
              teaserHoursBefore: 4,
              slots: mappedSlots.length > 0 ? mappedSlots : formData.slots,
              items: mappedItems,
              maxQuantityPerOrder: camp.maxQuantityPerOrder || 5,
              maxQuantityPerUser: camp.maxQuantityPerUser || 2,
              allowVouchers: camp.allowVouchers ?? false,
              allowFreeship: camp.allowFreeship ?? true,
              allowPoints: camp.allowPoints ?? false,
              allowMembershipDiscount: camp.allowMembershipDiscount ?? false,
              bannerImageUrl: camp.bannerImageUrl || '',
              mobileBannerImageUrl: camp.mobileBannerImageUrl || '',
            });
          }
        }
      } catch (err) {
        console.error('Error loading campaign to edit:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [initialCampaignId]);

  // Handle Form Change
  const updateForm = (key: keyof FormState, val: any) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  // Run validation engine against backend
  const runValidationCheck = useCallback(async () => {
    try {
      setIsValidating(true);
      const res = await fetch('/api/admin/flash-sales/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          branchIds:
            formData.branchScope === 'CUSTOM' ? formData.selectedBranchIds : [],
          slots: formData.slots.map((s, idx) => ({
            name: s.name,
            startTime: new Date(s.startTime).toISOString(),
            endTime: new Date(s.endTime).toISOString(),
            sortOrder: idx,
          })),
          items: formData.items.map((it) => ({
            productId: it.productId,
            flashSalePrice: it.flashSalePrice,
            stock: it.stock,
            maxQuantityPerUser: it.maxQuantityPerUser,
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setValidationChecks(json.data.checks || []);
        }
      }
    } catch (e) {
      console.error('Validation check error:', e);
    } finally {
      setIsValidating(false);
    }
  }, [formData]);

  // Run validation automatically when reaching Step 8
  useEffect(() => {
    if (currentStep === 8) {
      runValidationCheck();
    }
  }, [currentStep, runValidationCheck]);

  // Save Campaign (Draft or Publish)
  const handleSave = async (shouldPublish = false) => {
    try {
      setSaving(true);

      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description,
        status: shouldPublish ? 'SCHEDULED' : 'DRAFT',
        priority: Number(formData.priority) || 0,
        isFeatured: formData.isFeatured,
        applyOnline: formData.applyOnline,
        applyPos: formData.applyPos,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        branchIds:
          formData.branchScope === 'CUSTOM' ? formData.selectedBranchIds : [],
        maxQuantityPerOrder: Number(formData.maxQuantityPerOrder) || null,
        maxQuantityPerUser: Number(formData.maxQuantityPerUser) || null,
        allowVouchers: formData.allowVouchers,
        allowFreeship: formData.allowFreeship,
        allowPoints: formData.allowPoints,
        allowMembershipDiscount: formData.allowMembershipDiscount,
        bannerImageUrl: formData.bannerImageUrl || null,
        mobileBannerImageUrl: formData.mobileBannerImageUrl || null,
        slots: formData.slots.map((s, sIdx) => {
          let slotItems = formData.items.filter((it) => it.slotIndex === sIdx);
          // Fallback an toàn: nếu slot này chưa có món riêng nhưng có món ở slot 0 hoặc món chung
          if (slotItems.length === 0 && formData.items.length > 0) {
            const slot0Items = formData.items.filter((it) => it.slotIndex === 0);
            if (slot0Items.length > 0) {
              slotItems = slot0Items.map((it) => ({ ...it, slotIndex: sIdx }));
            }
          }
          return {
            id: s.id,
            name: s.name,
            startTime: new Date(s.startTime).toISOString(),
            endTime: new Date(s.endTime).toISOString(),
            sortOrder: sIdx,
            items: slotItems.map((it, iIdx) => ({
              id: it.id,
              productId: it.productId,
              flashSalePrice: Number(it.flashSalePrice),
              stock: Number(it.stock),
              maxQuantityPerUser: Number(it.maxQuantityPerUser) || 2,
              maxQuantityPerOrder: Number(it.maxQuantityPerOrder) || 5,
              sortOrder: iIdx,
            })),
          };
        }),
      };

      const url = isEditMode
        ? `/api/admin/flash-sales/${initialCampaignId}`
        : `/api/admin/flash-sales`;
      const method = isEditMode ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resJson = await res.json();
      if (res.ok && resJson.success) {
        setIsDirty(false);
        const createdId = resJson.data?.id || initialCampaignId;
        router.push(`/admin/flash-sales/${createdId}`);
      } else {
        alert(resJson?.error?.message || 'Có lỗi xảy ra khi lưu chiến dịch.');
      }
    } catch (e) {
      console.error('Error saving campaign:', e);
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setSaving(false);
    }
  };

  // Helper formats
  const formatInputDateTime = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Preset 1: Chia đều N khung giờ trong ngày
  const applyEqualSlotsPreset = (numSlots: number) => {
    const baseDate = formData.startTime ? new Date(formData.startTime) : new Date();
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const d = baseDate.getDate();

    const newStart = new Date(y, m, d, 0, 0, 0);
    const newEnd = new Date(y, m, d, 23, 59, 0);

    const generatedSlots: any[] = [];
    const totalMinutes = 24 * 60; // 1440 mins
    const slotMinutes = Math.floor(totalMinutes / numSlots);

    for (let i = 0; i < numSlots; i++) {
      const sStart = new Date(newStart.getTime() + i * slotMinutes * 60 * 1000);
      let sEnd: Date;
      if (i === numSlots - 1) {
        sEnd = new Date(newEnd);
      } else {
        sEnd = new Date(newStart.getTime() + ((i + 1) * slotMinutes * 60 * 1000) - 60 * 1000); // end at :59
      }

      const sHourStr = `${String(sStart.getHours()).padStart(2, '0')}:${String(sStart.getMinutes()).padStart(2, '0')}`;
      const eHourStr = `${String(sEnd.getHours()).padStart(2, '0')}:${String(sEnd.getMinutes()).padStart(2, '0')}`;

      generatedSlots.push({
        name: `Khung ${i + 1} (${sHourStr} - ${eHourStr})`,
        startTime: formatInputDateTime(sStart),
        endTime: formatInputDateTime(sEnd),
      });
    }

    setFormData((prev) => ({
      ...prev,
      startTime: formatInputDateTime(newStart),
      endTime: formatInputDateTime(newEnd),
      slots: generatedSlots,
    }));
    setIsDirty(true);
  };

  // Preset 2: Khung giờ vàng thông minh (Shopee-style)
  const applySmartGoldenHoursPreset = () => {
    const baseDate = formData.startTime ? new Date(formData.startTime) : new Date();
    const y = baseDate.getFullYear();
    const m = baseDate.getMonth();
    const d = baseDate.getDate();

    const newStart = new Date(y, m, d, 0, 0, 0);
    const newEnd = new Date(y, m, d, 23, 59, 0);

    const goldenHours = [
      { name: 'Khung 1 (00:00 - 01:00) Deal Nửa Đêm', sH: 0, sM: 0, eH: 1, eM: 0 },
      { name: 'Khung 2 (09:00 - 11:59) Trưa Sớm Công Sở', sH: 9, sM: 0, eH: 11, eM: 59 },
      { name: 'Khung 3 (12:00 - 14:59) Đại Tiệc Trưa Vàng', sH: 12, sM: 0, eH: 14, eM: 59 },
      { name: 'Khung 4 (21:00 - 23:59) Flash Sale Đêm Khuya', sH: 21, sM: 0, eH: 23, eM: 59 },
    ];

    const generatedSlots = goldenHours.map((g) => ({
      name: g.name,
      startTime: formatInputDateTime(new Date(y, m, d, g.sH, g.sM, 0)),
      endTime: formatInputDateTime(new Date(y, m, d, g.eH, g.eM, 0)),
    }));

    setFormData((prev) => ({
      ...prev,
      startTime: formatInputDateTime(newStart),
      endTime: formatInputDateTime(newEnd),
      slots: generatedSlots,
    }));
    setIsDirty(true);
  };

  // Realtime Conflict Check for Step 3
  const checkCollisionsRealtime = useCallback(async () => {
    if (!formData.startTime || !formData.endTime || formData.slots.length === 0) return;

    // 1. Kiểm tra overlap giữa các slots nội bộ
    const localErrors: string[] = [];
    const campaignStart = new Date(formData.startTime);
    const campaignEnd = new Date(formData.endTime);

    if (isNaN(campaignStart.getTime()) || isNaN(campaignEnd.getTime())) {
      setStep3Conflict({ checking: false, hasConflict: true, message: 'Thời gian chiến dịch không hợp lệ.', errors: ['Thời gian chiến dịch không hợp lệ.'] });
      return;
    }
    if (campaignStart >= campaignEnd) {
      setStep3Conflict({ checking: false, hasConflict: true, message: 'Thời gian bắt đầu chiến dịch phải trước thời gian kết thúc.', errors: ['Thời gian bắt đầu chiến dịch phải trước thời gian kết thúc.'] });
      return;
    }

    const parsedSlots = formData.slots.map((s, idx) => ({
      ...s,
      sStart: new Date(s.startTime),
      sEnd: new Date(s.endTime),
      idx,
    }));

    for (const s of parsedSlots) {
      if (isNaN(s.sStart.getTime()) || isNaN(s.sEnd.getTime()) || s.sStart >= s.sEnd) {
        localErrors.push(`Khung "${s.name || `Khung ${s.idx + 1}`}" có thời gian không hợp lệ (Bắt đầu phải trước Kết thúc).`);
      } else if (s.sStart < campaignStart || s.sEnd > campaignEnd) {
        localErrors.push(`Khung "${s.name}" nằm ngoài thời gian diễn ra chiến dịch.`);
      }
    }

    const validSlots = parsedSlots.filter((s) => !isNaN(s.sStart.getTime()) && !isNaN(s.sEnd.getTime()) && s.sStart < s.sEnd);
    validSlots.sort((a, b) => a.sStart.getTime() - b.sStart.getTime());
    for (let i = 0; i < validSlots.length - 1; i++) {
      if (validSlots[i + 1].sStart < validSlots[i].sEnd) {
        localErrors.push(`Trùng lặp: "${validSlots[i].name}" trùng thời gian với "${validSlots[i + 1].name}".`);
      }
    }

    if (localErrors.length > 0) {
      setStep3Conflict({
        checking: false,
        hasConflict: true,
        message: localErrors[0],
        errors: localErrors,
      });
      return;
    }

    // 2. Gọi backend kiểm tra trùng lịch với database
    try {
      setStep3Conflict((prev) => ({ ...prev, checking: true }));
      const res = await fetch('/api/admin/flash-sales/check-collisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignId: initialCampaignId,
          startTime: new Date(formData.startTime).toISOString(),
          endTime: new Date(formData.endTime).toISOString(),
          branchIds: formData.branchScope === 'CUSTOM' ? formData.selectedBranchIds : [],
          slots: formData.slots.map((s) => ({
            name: s.name,
            startTime: new Date(s.startTime).toISOString(),
            endTime: new Date(s.endTime).toISOString(),
          })),
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setStep3Conflict({
            checking: false,
            hasConflict: json.data.hasConflict,
            message: json.data.message,
            errors: json.data.errors || [],
          });
          return;
        }
      }
      setStep3Conflict({ checking: false, hasConflict: false, errors: [] });
    } catch (e) {
      console.error('Collision check error:', e);
      setStep3Conflict({ checking: false, hasConflict: false, errors: [] });
    }
  }, [formData.startTime, formData.endTime, formData.slots, formData.branchScope, formData.selectedBranchIds, initialCampaignId]);

  useEffect(() => {
    if (currentStep === 3) {
      const timer = setTimeout(() => {
        checkCollisionsRealtime();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, formData.startTime, formData.endTime, formData.slots, checkCollisionsRealtime]);

  // Áp dụng danh sách món sang TẤT CẢ khung giờ
  const applyDishesToAllSlots = () => {
    if (formData.items.length === 0) {
      alert('Vui lòng chọn ít nhất 1 món ăn trước khi áp dụng cho tất cả khung giờ.');
      return;
    }

    const uniqueProductsMap = new Map<string, typeof formData.items[0]>();
    for (const it of formData.items) {
      if (!uniqueProductsMap.has(it.productId)) {
        uniqueProductsMap.set(it.productId, it);
      }
    }
    const uniqueItems = Array.from(uniqueProductsMap.values());

    const newItems: typeof formData.items = [];
    formData.slots.forEach((_, sIdx) => {
      uniqueItems.forEach((it) => {
        newItems.push({
          ...it,
          id: undefined,
          slotIndex: sIdx,
        });
      });
    });

    setFormData((prev) => ({
      ...prev,
      items: newItems,
    }));
    setIsDirty(true);
    alert(`Đã áp dụng thành công ${uniqueItems.length} món vào tất cả ${formData.slots.length} khung giờ!`);
  };

  // Sao chép món từ slot nguồn sang slot hiện tại
  const copyDishesFromSlot = (sourceSlotIdx: number, targetSlotIdx: number) => {
    const sourceItems = formData.items.filter((it) => it.slotIndex === sourceSlotIdx);
    if (sourceItems.length === 0) {
      alert(`Khung giờ nguồn (Khung ${sourceSlotIdx + 1}) chưa có món nào.`);
      return;
    }

    const otherItems = formData.items.filter((it) => it.slotIndex !== targetSlotIdx);
    const copiedItems = sourceItems.map((it) => ({
      ...it,
      id: undefined,
      slotIndex: targetSlotIdx,
    }));

    setFormData((prev) => ({
      ...prev,
      items: [...otherItems, ...copiedItems],
    }));
    setIsDirty(true);
    alert(`Đã sao chép ${copiedItems.length} món từ Khung ${sourceSlotIdx + 1} sang Khung ${targetSlotIdx + 1}!`);
  };

  // Chọn nhanh món theo nhóm hiệu suất
  const quickSelectProducts = (type: 'BESTSELLER' | 'SLOW' | 'LOW_REVENUE' | 'FILTERED') => {
    let prodsToSelect: any[] = [];
    if (type === 'BESTSELLER') {
      prodsToSelect = recommendations?.bestsellers?.slice(0, 10) || [];
    } else if (type === 'SLOW') {
      prodsToSelect = recommendations?.slowSellers?.slice(0, 15) || [];
    } else if (type === 'LOW_REVENUE') {
      prodsToSelect = recommendations?.lowRevenue?.slice(0, 15) || [];
    } else if (type === 'FILTERED') {
      prodsToSelect = filteredCatalog;
    }

    if (prodsToSelect.length === 0) {
      alert('Không tìm thấy món ăn phù hợp trong danh mục này.');
      return;
    }

    const targetSlotIndices = selectedSlotForItems === 'ALL'
      ? formData.slots.map((_, i) => i)
      : [selectedSlotForItems];

    const currentItems = [...formData.items];

    for (const prod of prodsToSelect) {
      for (const sIdx of targetSlotIndices) {
        const exists = currentItems.some((it) => it.productId === prod.id && it.slotIndex === sIdx);
        if (!exists) {
          const defDiscount = Math.round(prod.price * 0.8);
          currentItems.push({
            productId: prod.id,
            productName: prod.name,
            productPrice: prod.price,
            productImage: prod.imageUrl,
            categoryName: prod.category?.name || prod.categoryName,
            slotIndex: sIdx,
            flashSalePrice: defDiscount,
            stock: 20,
            sold: 0,
            maxQuantityPerUser: 2,
            maxQuantityPerOrder: 5,
          });
        }
      }
    }

    updateForm('items', currentItems);
  };

  // Đồng bộ giá và kho của 1 slot sang tất cả các slot
  const syncPriceAndStockToAllSlots = (sourceSlotIdx: number) => {
    const sourceMap = new Map<string, typeof formData.items[0]>();
    formData.items.filter((it) => it.slotIndex === sourceSlotIdx).forEach((it) => {
      sourceMap.set(it.productId, it);
    });

    const updatedItems = formData.items.map((it) => {
      if (sourceMap.has(it.productId)) {
        const src = sourceMap.get(it.productId)!;
        return {
          ...it,
          flashSalePrice: src.flashSalePrice,
          stock: src.stock,
          maxQuantityPerUser: src.maxQuantityPerUser,
          maxQuantityPerOrder: src.maxQuantityPerOrder,
        };
      }
      return it;
    });

    updateForm('items', updatedItems);
    alert('Đã đồng bộ giá và tồn kho sang tất cả các khung giờ!');
  };

  // Bulk Edit Handler
  const applyBulkEdit = () => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (step5SlotFilter !== 'ALL' && it.slotIndex !== step5SlotFilter) {
          return it;
        }
        const discountedPrice = Math.round(
          (it.productPrice * (100 - bulkDiscountPercent)) / 100,
        );
        return {
          ...it,
          flashSalePrice: discountedPrice,
          stock: bulkStock,
          maxQuantityPerUser: bulkLimitPerUser,
        };
      }),
    }));
    setIsDirty(true);
  };

  // Sets of recommended product IDs for fast lookup
  const bestsellerIds = useMemo(
    () => new Set(recommendations?.bestsellers?.map((p) => p.id) || []),
    [recommendations],
  );
  const slowSellerIds = useMemo(
    () => new Set(recommendations?.slowSellers?.map((p) => p.id) || []),
    [recommendations],
  );
  const lowRevenueIds = useMemo(
    () => new Set(recommendations?.lowRevenue?.map((p) => p.id) || []),
    [recommendations],
  );

  // Filter products for Picker
  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((p) => {
      // Quick filter
      if (quickFilterType === 'BESTSELLER' && !bestsellerIds.has(p.id)) return false;
      if (quickFilterType === 'SLOW' && !slowSellerIds.has(p.id)) return false;
      if (quickFilterType === 'LOW_REVENUE' && !lowRevenueIds.has(p.id)) return false;

      if (selectedCategoryFilter !== 'ALL') {
        const catIdMatch =
          p.categoryId === selectedCategoryFilter || p.category?.id === selectedCategoryFilter;
        const catNameMatch =
          p.category?.name?.toLowerCase() === selectedCategoryFilter.toLowerCase();
        if (!catIdMatch && !catNameMatch) {
          return false;
        }
      }
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase().trim();
        const nameMatch = p.name?.toLowerCase().includes(q);
        const codeMatch =
          p.itemCode?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
        const catMatch = p.category?.name?.toLowerCase().includes(q);
        return Boolean(nameMatch || codeMatch || catMatch);
      }
      return true;
    });
  }, [
    catalogProducts,
    quickFilterType,
    bestsellerIds,
    slowSellerIds,
    lowRevenueIds,
    selectedCategoryFilter,
    productSearch,
  ]);

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Zap className="w-10 h-10 text-[#da251d] animate-bounce mx-auto mb-3" />
          <p className="font-bold text-slate-700">Đang tải Flash Sale Builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-20">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/flash-sales"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Link href="/admin/flash-sales" className="hover:underline">
                    Flash Sale
                  </Link>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-800 font-semibold">
                    {isEditMode ? 'Chỉnh sửa chiến dịch' : 'Tạo mới chiến dịch'}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#da251d] fill-[#da251d]" />
                  {formData.name || 'Chiến dịch Flash Sale mới'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {isDirty && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  Có thay đổi chưa lưu
                </span>
              )}
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu nháp</span>
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#da251d] hover:bg-red-700 text-xs font-bold text-white transition shadow-sm shadow-red-600/25 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{saving ? 'Đang lưu...' : 'Xuất bản'}</span>
              </button>
            </div>
          </div>

          {/* ── STEPPER TABS ── */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between overflow-x-auto gap-2">
            {STEPS.map((s) => {
              const isPassed = currentStep > s.step;
              const isCurrent = currentStep === s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step)}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    isCurrent
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : isPassed
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isCurrent
                        ? 'bg-white text-[#da251d]'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isPassed ? '✓' : s.step}
                  </span>
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        {/* ── BƯỚC 1: THÔNG TIN CHƯƠNG TRÌNH ── */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bước 1: Thông tin cơ bản chiến dịch</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Thiết lập tên chương trình, mã tham chiếu, thứ tự ưu tiên và hiển thị nổi bật
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tên chiến dịch Flash Sale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: AVORA Siêu Sale 9.9 Giờ Vàng"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-red-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mã chương trình (Code) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="FS-99SALE"
                  value={formData.code}
                  onChange={(e) => updateForm('code', e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-red-500 focus:bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mô tả chiến dịch
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả quyền lợi hoặc nội dung ngắn gọn cho khách hàng..."
                  value={formData.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-red-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Độ ưu tiên (Priority)
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => updateForm('priority', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-red-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Số càng cao sẽ được ưu tiên hiển thị trước khi có nhiều chiến dịch
                </span>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onChange={(e) => updateForm('isFeatured', e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="isFeatured" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Đánh dấu là Chiến dịch Nổi bật (Featured Hot)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── BƯỚC 2: CHI NHÁNH & ĐỐI TƯỢNG ── */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bước 2: Chi nhánh & Kênh áp dụng</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Xác định phạm vi áp dụng Flash Sale để chống xung đột chi nhánh
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-700">Phạm vi chi nhánh</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => updateForm('branchScope', 'ALL')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                    formData.branchScope === 'ALL'
                      ? 'border-[#da251d] bg-red-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Store className="w-5 h-5 text-[#da251d] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900">
                      Toàn bộ hệ thống chi nhánh
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Áp dụng đồng bộ tất cả chi nhánh Avora hiện tại và tương lai
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => updateForm('branchScope', 'CUSTOM')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                    formData.branchScope === 'CUSTOM'
                      ? 'border-[#da251d] bg-red-50/40'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Store className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-900">
                      Chọn chi nhánh cụ thể
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Chỉ chạy tại các chi nhánh được chọn (Flash Sale độc lập từng chi nhánh)
                    </p>
                  </div>
                </div>
              </div>

              {formData.branchScope === 'CUSTOM' && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Chọn các chi nhánh tham gia:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allBranches.map((b) => {
                      const isSelected = formData.selectedBranchIds.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            const next = isSelected
                              ? formData.selectedBranchIds.filter((id) => id !== b.id)
                              : [...formData.selectedBranchIds, b.id];
                            updateForm('selectedBranchIds', next);
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'border-red-500 bg-red-50 text-red-900 font-bold'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{b.name}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#da251d]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Channels */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Kênh áp dụng:
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.applyOnline}
                      onChange={(e) => updateForm('applyOnline', e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <span>Website & App Đặt món Online</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.applyPos}
                      onChange={(e) => updateForm('applyPos', e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <span>POS Tại Bàn & Thu Ngân Nhà Hàng</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BƯỚC 3: THIẾT LẬP KHUNG GIỜ (SHOPEE-STYLE MULTI-SLOTS) ── */}
        {currentStep === 3 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bước 3: Thiết lập chiến dịch & Khung giờ Shopee-style
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Một chiến dịch có thể chứa nhiều Flash Sale Slot với bộ sản phẩm và khung giờ riêng biệt
              </p>
            </div>

            {/* Campaign time window */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thời gian bắt đầu chiến dịch <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => updateForm('startTime', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thời gian kết thúc chiến dịch <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => updateForm('endTime', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hiển thị teaser &quot;Sắp Flash Sale&quot; trước bao nhiêu giờ?
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={formData.teaserHoursBefore}
                    onChange={(e) => updateForm('teaserHoursBefore', Number(e.target.value))}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                  />
                  <span className="text-xs text-slate-500">
                    giờ trước khi bắt đầu (khách sẽ thấy giá sắp bán và countdown nhưng chưa mua được)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Presets Section */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Mẫu thiết lập khung giờ nhanh (Shopee-style Presets):
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Bấm để tự động chia ngày chiến dịch thành các ca giờ liền kề chuẩn xác hoặc khung giờ vàng có lượng khách đông nhất:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applyEqualSlotsPreset(2)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer shadow-2xs"
                >
                  ⚡ Chia đều 2 khung (12h/khung)
                </button>
                <button
                  type="button"
                  onClick={() => applyEqualSlotsPreset(3)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer shadow-2xs"
                  title="00:00 -> 07:59, 08:00 -> 15:59, 16:00 -> 23:59"
                >
                  ⚡ Chia đều 3 khung (00:00 - 08:00 - 16:00)
                </button>
                <button
                  type="button"
                  onClick={() => applyEqualSlotsPreset(4)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer shadow-2xs"
                >
                  ⚡ Chia đều 4 khung (6h/khung)
                </button>
                <button
                  type="button"
                  onClick={() => applyEqualSlotsPreset(6)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-bold hover:bg-amber-100 hover:border-amber-400 transition cursor-pointer shadow-2xs"
                >
                  ⚡ Chia đều 6 khung (4h/khung)
                </button>
                <button
                  type="button"
                  onClick={applySmartGoldenHoursPreset}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-black hover:opacity-95 transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>⭐ Khung Giờ Vàng Thông Minh (Shopee-style)</span>
                </button>
              </div>
            </div>

            {/* Multi-Slots Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Danh sách khung giờ (Slots):
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const newSlotIndex = formData.slots.length + 1;
                    const lastSlot = formData.slots[formData.slots.length - 1];
                    let nextStart = formData.startTime;
                    let nextEnd = formData.endTime;
                    if (lastSlot) {
                      nextStart = lastSlot.endTime;
                      const d = new Date(nextStart);
                      d.setHours(d.getHours() + 2);
                      nextEnd = d.toISOString().slice(0, 16);
                    }

                    updateForm('slots', [
                      ...formData.slots,
                      {
                        name: `Khung Giờ Vàng ${newSlotIndex}`,
                        startTime: nextStart,
                        endTime: nextEnd,
                      },
                    ]);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-[#da251d] text-xs font-bold hover:bg-red-100 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Thêm khung giờ</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {formData.slots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={slot.name}
                        onChange={(e) => {
                          const copy = [...formData.slots];
                          copy[idx].name = e.target.value;
                          updateForm('slots', copy);
                        }}
                        className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 w-48"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-400">Từ:</span>
                        <input
                          type="datetime-local"
                          value={slot.startTime}
                          onChange={(e) => {
                            const copy = [...formData.slots];
                            copy[idx].startTime = e.target.value;
                            updateForm('slots', copy);
                          }}
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-400">Đến:</span>
                        <input
                          type="datetime-local"
                          value={slot.endTime}
                          onChange={(e) => {
                            const copy = [...formData.slots];
                            copy[idx].endTime = e.target.value;
                            updateForm('slots', copy);
                          }}
                          className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
                        />
                      </div>

                      {formData.slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const copy = formData.slots.filter((_, i) => i !== idx);
                            updateForm('slots', copy);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                          title="Xóa slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Realtime Conflict Check Status Banner */}
            <div className="pt-2">
              {step3Conflict.checking ? (
                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-xs flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                  <span className="font-semibold">Đang kiểm tra trùng lặp khung giờ và lịch các chiến dịch khác...</span>
                </div>
              ) : step3Conflict.hasConflict ? (
                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Phát hiện xung đột khung giờ hoặc trùng lịch chiến dịch:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-700 font-medium">
                    {step3Conflict.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-rose-600 italic">
                    Vui lòng điều chỉnh lại thời gian bắt đầu / kết thúc để tránh chồng lấn khung giờ trước khi tiếp tục.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Lịch khung giờ hợp lệ, không có trùng lặp khung giờ hoặc xung đột với chiến dịch khác trong hệ thống.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── BƯỚC 4: CHỌN SẢN PHẨM (PRODUCT PICKER) ── */}
        {currentStep === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bước 4: Chọn món tham gia Flash Sale</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn món cho từng khung giờ riêng biệt, hoặc áp dụng đồng thời cho tất cả các khung giờ
              </p>
            </div>

            {/* Slot Switcher / Scope Bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Đang chọn món cho:
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Chọn khung giờ để chỉ định món, hoặc chọn &apos;Tất cả khung giờ&apos; để áp dụng chung.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyDishesToAllSlots}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    title="Sao chép toàn bộ món đã chọn vào tất cả các khung giờ"
                  >
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>Áp dụng món cho TẤT CẢ khung giờ</span>
                  </button>
                </div>
              </div>

              {/* Slot Tabs */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedSlotForItems('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    selectedSlotForItems === 'ALL'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ Tất cả khung giờ (Áp dụng chung)</span>
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${selectedSlotForItems === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {formData.items.length} món
                  </span>
                </button>

                {formData.slots.map((s, sIdx) => {
                  const slotItemsCount = formData.items.filter((it) => it.slotIndex === sIdx).length;
                  const isSelected = selectedSlotForItems === sIdx;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setSelectedSlotForItems(sIdx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>Khung {sIdx + 1}: {s.name.length > 18 ? s.name.slice(0, 18) + '...' : s.name}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {slotItemsCount} món
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Copy slot option if a specific slot is selected */}
              {typeof selectedSlotForItems === 'number' && formData.slots.length > 1 && (
                <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                  <span className="font-medium">Hoặc sao chép nhanh món từ khung giờ khác:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value !== '') {
                        copyDishesFromSlot(Number(e.target.value), selectedSlotForItems);
                        e.target.value = '';
                      }
                    }}
                    defaultValue=""
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="" disabled>-- Chọn khung giờ nguồn để sao chép --</option>
                    {formData.slots.map((s, idx) => {
                      if (idx === selectedSlotForItems) return null;
                      const count = formData.items.filter((it) => it.slotIndex === idx).length;
                      return (
                        <option key={idx} value={idx}>
                          Khung {idx + 1}: {s.name} ({count} món)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Performance Selection & Filter Bar */}
            <div className="space-y-2.5 p-3.5 bg-red-50/40 border border-red-100 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-red-600" />
                  <span>Chọn nhanh theo hiệu suất bán hàng (AI Smart Select):</span>
                </div>
                {/* 1-click select buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => quickSelectProducts('BESTSELLER')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>+ Chọn Top 10 Bestseller</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSelectProducts('SLOW')}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <TrendingDown className="w-3 h-3" />
                    <span>+ Chọn 15 món bán chậm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => quickSelectProducts('LOW_REVENUE')}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Percent className="w-3 h-3" />
                    <span>+ Chọn 15 món doanh thu thấp</span>
                  </button>
                  {filteredCatalog.length > 0 && (
                    <button
                      type="button"
                      onClick={() => quickSelectProducts('FILTERED')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold transition cursor-pointer"
                    >
                      + Chọn tất cả món đang lọc ({filteredCatalog.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-100/80">
                <span className="text-xs font-semibold text-slate-600">Lọc món:</span>
                <button
                  type="button"
                  onClick={() => setQuickFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    quickFilterType === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tất cả món ({catalogProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilterType('BESTSELLER')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    quickFilterType === 'BESTSELLER'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                  }`}
                >
                  <span>🔥 Bán chạy / Bestseller</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${quickFilterType === 'BESTSELLER' ? 'bg-white/20' : 'bg-emerald-100'}`}>
                    {recommendations?.bestsellers?.length || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilterType('SLOW')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    quickFilterType === 'SLOW'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white border border-amber-300 text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <span>🐢 Bán chậm / Tồn đọng</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${quickFilterType === 'SLOW' ? 'bg-white/20' : 'bg-amber-100'}`}>
                    {recommendations?.slowSellers?.length || 0}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilterType('LOW_REVENUE')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    quickFilterType === 'LOW_REVENUE'
                      ? 'bg-rose-600 text-white'
                      : 'bg-white border border-rose-300 text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <span>📉 Doanh thu thấp</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${quickFilterType === 'LOW_REVENUE' ? 'bg-white/20' : 'bg-rose-100'}`}>
                    {recommendations?.lowRevenue?.length || 0}
                  </span>
                </button>
              </div>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm theo tên món, SKU..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-red-500 focus:bg-white"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full sm:w-56 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:ring-2 focus:ring-red-500"
              >
                <option value="ALL">Tất cả danh mục</option>
                {categoriesList.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary info */}
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
              <div>
                Tìm thấy:{' '}
                <span className="font-bold text-slate-800">{filteredCatalog.length}</span>{' '}
                món ăn
              </div>
              <div>
                {selectedSlotForItems === 'ALL' ? (
                  <span>Tổng số món được gán: <span className="font-bold text-[#da251d]">{formData.items.length}</span> món</span>
                ) : (
                  <span>
                    Số món ở Khung {Number(selectedSlotForItems) + 1}:{' '}
                    <span className="font-bold text-[#da251d]">
                      {formData.items.filter((it) => it.slotIndex === selectedSlotForItems).length}
                    </span>{' '}
                    món (Tổng: {formData.items.length})
                  </span>
                )}
              </div>
            </div>

            {/* Product Picker Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-100 bg-white">
              {isLoadingProducts ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#da251d]" />
                  <p className="text-xs font-semibold text-slate-600">
                    Đang tải danh sách món ăn từ thực đơn...
                  </p>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">
                    Không tìm thấy món ăn nào phù hợp
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Thử tìm kiếm với từ khóa khác hoặc chọn lại danh mục.
                  </p>
                  {(productSearch || selectedCategoryFilter !== 'ALL' || quickFilterType !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        setSelectedCategoryFilter('ALL');
                        setQuickFilterType('ALL');
                      }}
                      className="mt-3 px-3.5 py-1.5 text-xs font-bold text-[#da251d] bg-red-50 hover:bg-red-100 rounded-lg transition"
                    >
                      Xóa toàn bộ bộ lọc
                    </button>
                  )}
                </div>
              ) : (
                filteredCatalog.map((prod) => {
                  const isSelectedInAll = formData.slots.length > 0 && formData.slots.every((_, sIdx) =>
                    formData.items.some((it) => it.productId === prod.id && it.slotIndex === sIdx)
                  );
                  const isSelectedInAny = formData.items.some((it) => it.productId === prod.id);
                  const isSelectedInCurrentSlot =
                    typeof selectedSlotForItems === 'number' &&
                    formData.items.some(
                      (it) => it.productId === prod.id && it.slotIndex === selectedSlotForItems
                    );

                  const isBestseller = bestsellerIds.has(prod.id);
                  const isSlow = slowSellerIds.has(prod.id);
                  const isLowRev = lowRevenueIds.has(prod.id);
                  const prodMetric = recommendations?.metrics?.[prod.id];

                  const handleToggleProduct = () => {
                    if (selectedSlotForItems === 'ALL') {
                      if (isSelectedInAll) {
                        // Remove from all slots
                        updateForm(
                          'items',
                          formData.items.filter((it) => it.productId !== prod.id)
                        );
                      } else {
                        // Add to all slots where not present
                        const defDiscount = Math.round(prod.price * 0.8);
                        const newItems = [...formData.items];
                        formData.slots.forEach((_, sIdx) => {
                          if (!newItems.some((it) => it.productId === prod.id && it.slotIndex === sIdx)) {
                            newItems.push({
                              productId: prod.id,
                              productName: prod.name,
                              productPrice: prod.price,
                              productImage: prod.imageUrl,
                              categoryName: prod.category?.name,
                              slotIndex: sIdx,
                              flashSalePrice: defDiscount,
                              stock: 20,
                              sold: 0,
                              maxQuantityPerUser: 2,
                              maxQuantityPerOrder: 5,
                            });
                          }
                        });
                        updateForm('items', newItems);
                      }
                    } else {
                      // Specific slot toggle
                      const targetSlot = selectedSlotForItems as number;
                      if (isSelectedInCurrentSlot) {
                        updateForm(
                          'items',
                          formData.items.filter(
                            (it) => !(it.productId === prod.id && it.slotIndex === targetSlot)
                          )
                        );
                      } else {
                        const defDiscount = Math.round(prod.price * 0.8);
                        updateForm('items', [
                          ...formData.items,
                          {
                            productId: prod.id,
                            productName: prod.name,
                            productPrice: prod.price,
                            productImage: prod.imageUrl,
                            categoryName: prod.category?.name,
                            slotIndex: targetSlot,
                            flashSalePrice: defDiscount,
                            stock: 20,
                            sold: 0,
                            maxQuantityPerUser: 2,
                            maxQuantityPerOrder: 5,
                          },
                        ]);
                      }
                    }
                  };

                  const isRowHighlighted =
                    selectedSlotForItems === 'ALL' ? isSelectedInAll : isSelectedInCurrentSlot;

                  return (
                    <div
                      key={prod.id}
                      onClick={handleToggleProduct}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                        isRowHighlighted
                          ? 'bg-red-50/60 hover:bg-red-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden relative shrink-0 border border-slate-200">
                          {prod.imageUrl ? (
                            <Image
                              src={prod.imageUrl}
                              alt={prod.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <ShoppingBag className="w-5 h-5 text-slate-400 m-auto mt-3" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {prod.name}
                            </span>
                            {/* AI Performance Badges */}
                            {isBestseller && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">
                                🔥 Bestseller ({prodMetric?.soldQuantity || 0} đã bán)
                              </span>
                            )}
                            {isSlow && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
                                🐢 Bán chậm ({prodMetric?.soldQuantity || 0} đã bán)
                              </span>
                            )}
                            {isLowRev && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                                📉 Doanh thu thấp
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{prod.category?.name || 'Món ăn'}</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              {formatCurrency(prod.price)}
                            </span>
                            {selectedSlotForItems === 'ALL' && isSelectedInAny && !isSelectedInAll && (
                              <span className="text-amber-600 font-medium">
                                (Đã có trong {formData.items.filter((it) => it.productId === prod.id).length}/{formData.slots.length} khung)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedSlotForItems === 'ALL' ? (
                          isSelectedInAll ? (
                            <span className="px-3 py-1 rounded-full bg-[#da251d] text-white text-xs font-bold flex items-center gap-1 shadow-2xs">
                              <Check className="w-3.5 h-3.5" />
                              <span>✓ Có trong tất cả khung</span>
                            </span>
                          ) : isSelectedInAny ? (
                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold hover:bg-amber-200">
                              + Bổ sung tất cả khung
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                              + Chọn cho tất cả
                            </span>
                          )
                        ) : isSelectedInCurrentSlot ? (
                          <span className="px-3 py-1 rounded-full bg-[#da251d] text-white text-xs font-bold flex items-center gap-1 shadow-2xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>✓ Đã chọn khung này</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                            + Thêm vào khung
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── BƯỚC 5: GIÁ & TỒN KHO (BULK EDIT & PRODUCT LIST) ── */}
        {currentStep === 5 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bước 5: Giá Flash Sale & Tồn kho riêng</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Áp dụng giảm giá hàng loạt hoặc tùy chỉnh giá, số lượng bán và giới hạn mua cho từng khung giờ
              </p>
            </div>

            {/* Slot Filter Tabs for Step 5 */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Xem theo khung giờ:</span>
                <button
                  type="button"
                  onClick={() => setStep5SlotFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    step5SlotFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({formData.items.length} món)
                </button>
                {formData.slots.map((s, sIdx) => {
                  const count = formData.items.filter((it) => it.slotIndex === sIdx).length;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setStep5SlotFilter(sIdx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        step5SlotFilter === sIdx
                          ? 'bg-[#da251d] text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      Khung {sIdx + 1} ({count} món)
                    </button>
                  );
                })}
              </div>

              {typeof step5SlotFilter === 'number' && formData.slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => syncPriceAndStockToAllSlots(step5SlotFilter)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 text-[#da251d] hover:bg-red-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Sao chép giá và số lượng tồn kho của khung giờ này sang tất cả các khung giờ khác"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Đồng bộ Giá & Tồn kho khung này sang TẤT CẢ khung</span>
                </button>
              )}
            </div>

            {/* Bulk Edit Panel */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Giảm %:</span>
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={bulkDiscountPercent}
                    onChange={(e) => setBulkDiscountPercent(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Flash Stock:</span>
                  <input
                    type="number"
                    min={1}
                    value={bulkStock}
                    onChange={(e) => setBulkStock(Number(e.target.value))}
                    className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Giới hạn/khách:</span>
                  <input
                    type="number"
                    min={1}
                    value={bulkLimitPerUser}
                    onChange={(e) => setBulkLimitPerUser(Number(e.target.value))}
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={applyBulkEdit}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Áp dụng cho {step5SlotFilter === 'ALL' ? `tất cả (${formData.items.length} món)` : `Khung ${Number(step5SlotFilter) + 1}`}
              </button>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Sản phẩm</th>
                    <th className="py-2.5 px-3">Khung giờ (Slot)</th>
                    <th className="py-2.5 px-3 text-right">Giá gốc</th>
                    <th className="py-2.5 px-3 text-right">Giá Flash Sale</th>
                    <th className="py-2.5 px-3 text-center">% Giảm</th>
                    <th className="py-2.5 px-3 text-right">Flash Stock</th>
                    <th className="py-2.5 px-3 text-right">Giới hạn/khách</th>
                    <th className="py-2.5 px-3 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items
                    .map((it, originalIdx) => ({ ...it, originalIdx }))
                    .filter((it) => step5SlotFilter === 'ALL' || it.slotIndex === step5SlotFilter)
                    .map((it) => {
                      const discountAmt = it.productPrice - it.flashSalePrice;
                      const discountPct =
                        it.productPrice > 0
                          ? Math.round((discountAmt / it.productPrice) * 100)
                          : 0;

                      return (
                        <tr key={`${it.productId}-${it.slotIndex}-${it.originalIdx}`} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{it.productName}</div>
                            <div className="text-[10px] text-slate-400">{it.categoryName}</div>
                          </td>

                          <td className="py-3 px-3">
                            <select
                              value={it.slotIndex}
                              onChange={(e) => {
                                const copy = [...formData.items];
                                copy[it.originalIdx].slotIndex = Number(e.target.value);
                                updateForm('items', copy);
                              }}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                            >
                              {formData.slots.map((s, sIdx) => (
                                <option key={sIdx} value={sIdx}>
                                  Khung {sIdx + 1}: {s.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3 px-3 text-right text-slate-500 font-medium">
                            {formatCurrency(it.productPrice)}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              value={it.flashSalePrice}
                              onChange={(e) => {
                                const copy = [...formData.items];
                                copy[it.originalIdx].flashSalePrice = Number(e.target.value);
                                updateForm('items', copy);
                              }}
                              className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-right text-[#da251d]"
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#da251d] font-black text-[11px]">
                              -{discountPct}%
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min={1}
                              value={it.stock}
                              onChange={(e) => {
                                const copy = [...formData.items];
                                copy[it.originalIdx].stock = Number(e.target.value);
                                updateForm('items', copy);
                              }}
                              className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-right"
                            />
                          </td>

                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              min={1}
                              value={it.maxQuantityPerUser}
                              onChange={(e) => {
                                const copy = [...formData.items];
                                copy[it.originalIdx].maxQuantityPerUser = Number(e.target.value);
                                updateForm('items', copy);
                              }}
                              className="w-14 px-2 py-1 border border-slate-200 rounded-lg text-xs font-bold text-right"
                            />
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const copy = formData.items.filter((_, i) => i !== it.originalIdx);
                                updateForm('items', copy);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BƯỚC 6: QUY TẮC MUA & KẾT HỢP KHUYẾN MÃI ── */}
        {currentStep === 6 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bước 6: Quy tắc mua & Kết hợp ưu đãi</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm soát giới hạn mua và cho phép hoặc cấm cộng dồn với Voucher, Freeship, Điểm thành viên
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Số lượng tối đa mỗi đơn hàng
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.maxQuantityPerOrder}
                  onChange={(e) => updateForm('maxQuantityPerOrder', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Số lượng tối đa mỗi khách hàng (toàn chương trình)
                </label>
                <input
                  type="number"
                  min={1}
                  value={formData.maxQuantityPerUser}
                  onChange={(e) => updateForm('maxQuantityPerUser', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                Quy tắc cộng dồn ưu đãi (Pricing Engine Stacking Rules):
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">Cho phép dùng Voucher giảm giá</span>
                  <input
                    type="checkbox"
                    checked={formData.allowVouchers}
                    onChange={(e) => updateForm('allowVouchers', e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                </label>

                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">Cho phép miễn phí vận chuyển (Freeship)</span>
                  <input
                    type="checkbox"
                    checked={formData.allowFreeship}
                    onChange={(e) => updateForm('allowFreeship', e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                </label>

                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">Cho phép tích/tiêu điểm thưởng</span>
                  <input
                    type="checkbox"
                    checked={formData.allowPoints}
                    onChange={(e) => updateForm('allowPoints', e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                </label>

                <label className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">Cho phép chiết khấu hạng thành viên VIP</span>
                  <input
                    type="checkbox"
                    checked={formData.allowMembershipDiscount}
                    onChange={(e) => updateForm('allowMembershipDiscount', e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── BƯỚC 7: MARKETING & PREVIEW ── */}
        {currentStep === 7 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Bước 7: Marketing & Trực quan Preview</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Xem trước giao diện Product Card và khung giờ hiển thị trên thiết bị của khách hàng
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    previewDevice === 'mobile'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                    previewDevice === 'desktop'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
              </div>
            </div>

            {/* Banners input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL Banner máy tính (Desktop)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.bannerImageUrl}
                  onChange={(e) => updateForm('bannerImageUrl', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL Banner di động (Mobile)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.mobileBannerImageUrl}
                  onChange={(e) => updateForm('mobileBannerImageUrl', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Live Preview Box */}
            <div className="p-6 bg-slate-100 rounded-2xl flex items-center justify-center">
              <div
                className={`bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden transition-all ${
                  previewDevice === 'mobile' ? 'w-80' : 'w-full max-w-xl'
                }`}
              >
                {/* Header preview */}
                <div className="bg-gradient-to-r from-[#da251d] to-red-700 p-3 text-white flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider">
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300 animate-pulse" />
                    <span>FLASH SALE GIỜ VÀNG</span>
                  </div>
                  <div className="text-[10px] bg-black/20 px-2 py-0.5 rounded font-mono font-bold">
                    01:59:45
                  </div>
                </div>

                {/* Slots preview */}
                <div className="bg-slate-50 p-2 flex items-center gap-2 overflow-x-auto border-b border-slate-100">
                  {formData.slots.map((s, idx) => (
                    <div
                      key={idx}
                      className={`px-3 py-1 rounded-lg text-center shrink-0 text-[11px] font-bold ${
                        idx === 0
                          ? 'bg-[#da251d] text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      <div>{s.name}</div>
                      <div className="text-[9px] opacity-80 font-normal">
                        {idx === 0 ? 'Đang diễn ra' : 'Sắp diễn ra'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Product Card preview */}
                <div className="p-4 space-y-3">
                  {formData.items.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Chưa có món nào được chọn</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                        Hãy chọn món tại Bước 4 và thiết lập giá ở Bước 5 để xem trước Product Card thực tế.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="mt-3 px-3 py-1.5 text-xs font-bold text-[#da251d] bg-red-50 hover:bg-red-100 rounded-lg transition inline-flex items-center gap-1"
                      >
                        Quay lại chọn món
                      </button>
                    </div>
                  ) : (
                    formData.items.slice(0, 3).map((item, idx) => {
                      const discountAmt = item.productPrice - item.flashSalePrice;
                      const pct =
                        item.productPrice > 0
                          ? Math.round((discountAmt / item.productPrice) * 100)
                          : 0;

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition"
                        >
                          <div className="w-14 h-14 rounded-lg bg-slate-100 relative overflow-hidden shrink-0">
                            {item.productImage ? (
                              <Image
                                src={item.productImage}
                                alt={item.productName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <ShoppingBag className="w-6 h-6 text-slate-400 m-auto mt-4" />
                            )}
                            <span className="absolute top-0 right-0 bg-[#da251d] text-white text-[9px] font-black px-1 rounded-bl">
                              -{pct}%
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-slate-900 truncate">
                              {item.productName}
                            </div>
                            <div className="flex items-baseline gap-2 mt-0.5">
                              <span className="text-xs font-black text-[#da251d]">
                                {formatCurrency(item.flashSalePrice)}
                              </span>
                              <span className="text-[10px] text-slate-400 line-through">
                                {formatCurrency(item.productPrice)}
                              </span>
                            </div>
                            <div className="mt-1.5 w-full bg-red-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-[#da251d] h-full rounded-full w-2/5" />
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5 font-medium">
                              Đã bán 8 / {item.stock} phần
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BƯỚC 8: FLASH SALE VALIDATION ENGINE CHECKLIST ── */}
        {currentStep === 8 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bước 8: Kiểm tra & Xuất bản chiến dịch
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Flash Sale Validation Engine kiểm tra 8 tiêu chí nghiêm ngặt để đảm bảo chiến dịch an toàn và không bị xung đột
              </p>
            </div>

            {isValidating ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                <Zap className="w-8 h-8 text-[#da251d] animate-spin mx-auto mb-2" />
                <span>Flash Sale Validation Engine đang rà soát dữ liệu...</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {validationChecks.map((chk, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition ${
                      chk.passed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/60 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {chk.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold">{chk.title}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">{chk.message}</div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        chk.passed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {chk.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Lưu lại bản nháp (DRAFT)
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving || validationChecks.some((c) => !c.passed)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition flex items-center gap-2 shadow-sm ${
                  validationChecks.some((c) => !c.passed)
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-[#da251d] hover:bg-red-700 shadow-red-600/25 cursor-pointer'
                }`}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{saving ? 'Đang xuất bản...' : 'Xuất bản Flash Sale ngay'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEPPER NAVIGATION BOTTOM ── */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              currentStep === 1
                ? 'opacity-40 cursor-not-allowed text-slate-400'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          {currentStep < 8 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(8, prev + 1))}
              className="px-5 py-2 rounded-xl bg-[#da251d] hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-red-600/25 cursor-pointer"
            >
              <span>Tiếp tục</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
