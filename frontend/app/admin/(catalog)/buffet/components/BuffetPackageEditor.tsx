'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  FolderKanban,
  Gauge,
  Layers,
  ListChecks,
  Loader2,
  PackageCheck,
  Save,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface BuffetProductOption {
  id: string;
  itemCode?: string | null;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: { id?: string; name: string } | null;
  categoryId?: string | null;
  categoryName?: string | null;
}

interface BranchCategoryOption {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
}

interface SelectedItemConfig {
  maxQuantityPerRound: string;
  maxTotalQuantity: string;
  availableForQr: boolean;
  allowRetailPurchase: boolean;
}

interface BuffetPackageEditorProps {
  packageId?: string;
  initialBranchId?: string;
}

const DEFAULT_ITEM_CONFIG: SelectedItemConfig = {
  maxQuantityPerRound: '',
  maxTotalQuantity: '',
  availableForQr: true,
  allowRetailPurchase: true,
};

function parsePositiveIntOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

export default function BuffetPackageEditor({
  packageId,
  initialBranchId,
}: BuffetPackageEditorProps) {
  const router = useRouter();
  const isEditMode = Boolean(packageId);

  const [branches, setBranches] = useState<Array<{ id: string; name: string; branchCode?: string }>>([]);
  const [branchId, setBranchId] = useState<string>(initialBranchId || '');
  const [allProducts, setAllProducts] = useState<BuffetProductOption[]>([]);
  const [branchCategories, setBranchCategories] = useState<BranchCategoryOption[]>([]);

  const [isLoadingPackage, setIsLoadingPackage] = useState<boolean>(isEditMode);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Package fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [active, setActive] = useState<boolean>(true);
  const [isUnlimitedPerSubmission, setIsUnlimitedPerSubmission] = useState<boolean>(false);
  const [maxItemsPerSubmission, setMaxItemsPerSubmission] = useState<number>(10);

  // Tickets & Selected items map
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketProductIds, setTicketProductIds] = useState<string[]>([]);
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, SelectedItemConfig>>({});

  // Menu discovery & Quick category controls
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectionFilter, setSelectionFilter] = useState<'ALL' | 'SELECTED' | 'UNSELECTED' | 'LIMITED'>('ALL');
  const [bulkRoundLimit, setBulkRoundLimit] = useState<string>('');
  const [bulkTotalLimit, setBulkTotalLimit] = useState<string>('');

  // 1. Load branches
  useEffect(() => {
    let mounted = true;
    const loadBranches = async () => {
      try {
        let res = await fetch('/api/admin/branches', { credentials: 'include' });
        let json = await res.json();
        let list: Array<{ id: string; name: string; branchCode?: string }> = [];
        if (json?.success && Array.isArray(json.data)) {
          list = json.data;
        } else if (Array.isArray(json)) {
          list = json;
        } else {
          res = await fetch('/api/home/branches');
          json = await res.json();
          if (Array.isArray(json)) list = json;
        }
        if (!mounted) return;
        setBranches(list);
        if (!isEditMode && list.length > 0) {
          setBranchId((prev) => prev || initialBranchId || list[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách chi nhánh:', err);
      }
    };
    void loadBranches();
    return () => {
      mounted = false;
    };
  }, [isEditMode, initialBranchId]);

  // 2. Load package details in edit mode
  useEffect(() => {
    if (!packageId) return;
    let mounted = true;
    const loadPackage = async () => {
      setIsLoadingPackage(true);
      try {
        const res = await fetch(`/api/buffet/packages/${packageId}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(json?.message || 'Không tìm thấy gói Buffet');
        }
        if (!mounted) return;
        const pkg = json.data as {
          branchId: string;
          name?: string;
          description?: string;
          displayOrder?: number;
          active?: boolean;
          maxItemsPerSubmission?: number | null;
          tickets?: Array<{ productId: string }>;
          items?: Array<{
            productId: string;
            maxQuantityPerRound?: number | null;
            maxTotalQuantity?: number | null;
            availableForQr?: boolean;
            allowRetailPurchase?: boolean;
          }>;
        };
        setBranchId(pkg.branchId);
        setName(pkg.name || '');
        setDescription(pkg.description || '');
        setDisplayOrder(typeof pkg.displayOrder === 'number' ? pkg.displayOrder : 1);
        setActive(Boolean(pkg.active));
        const hasPkgLimit =
          typeof pkg.maxItemsPerSubmission === 'number' && pkg.maxItemsPerSubmission > 0;
        setIsUnlimitedPerSubmission(!hasPkgLimit);
        setMaxItemsPerSubmission(hasPkgLimit ? Number(pkg.maxItemsPerSubmission) : 10);
        setTicketProductIds(Array.isArray(pkg.tickets) ? pkg.tickets.map((t) => t.productId) : []);

        const nextMap: Record<string, SelectedItemConfig> = {};
        if (Array.isArray(pkg.items)) {
          pkg.items.forEach((it) => {
            nextMap[it.productId] = {
              maxQuantityPerRound:
                typeof it.maxQuantityPerRound === 'number' && it.maxQuantityPerRound > 0
                  ? String(it.maxQuantityPerRound)
                  : '',
              maxTotalQuantity:
                typeof it.maxTotalQuantity === 'number' && it.maxTotalQuantity > 0
                  ? String(it.maxTotalQuantity)
                  : '',
              availableForQr: it.availableForQr !== false,
              allowRetailPurchase: it.allowRetailPurchase !== false,
            };
          });
        }
        setSelectedItemsMap(nextMap);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Lỗi tải dữ liệu gói Buffet');
      } finally {
        if (mounted) setIsLoadingPackage(false);
      }
    };
    void loadPackage();
    return () => {
      mounted = false;
    };
  }, [packageId]);

  // 3. Load branch catalog products & categories
  const fetchProducts = useCallback(async (targetBranchId: string) => {
    if (!targetBranchId) return;
    setIsLoadingProducts(true);
    try {
      const res = await fetch(`/api/pos/products?branchId=${targetBranchId}`, {
        credentials: 'include',
      });
      const json = await res.json();
      const rawCategories: BranchCategoryOption[] = Array.isArray(json?.data?.categories)
        ? json.data.categories.filter((c: BranchCategoryOption) => c.id !== 'BUFFET')
        : [];
      setBranchCategories(rawCategories);
      const catById = new Map<string, string>(
        rawCategories.map((c) => [c.id, c.name]),
      );

      if (json?.success && Array.isArray(json.data?.products)) {
        const normalized = (json.data.products as BuffetProductOption[]).map((prod) => {
          const resolvedName =
            prod.category?.name ||
            prod.categoryName ||
            (prod.categoryId ? catById.get(prod.categoryId) : null) ||
            'Chưa phân loại';
          return {
            ...prod,
            categoryName: resolvedName,
            category: prod.category || (prod.categoryId ? { id: prod.categoryId, name: resolvedName } : { name: resolvedName }),
          };
        });
        setAllProducts(normalized);
      } else {
        setAllProducts([]);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách món:', err);
      toast.error('Không thể tải danh sách món của chi nhánh');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (!branchId) return;
    const timer = window.setTimeout(() => {
      void fetchProducts(branchId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [branchId, fetchProducts]);

  // Category summaries preserving branch category order
  const categoryStats = useMemo(() => {
    const orderIndex = new Map<string, number>();
    branchCategories.forEach((c, idx) => {
      if (!orderIndex.has(c.name)) {
        orderIndex.set(c.name, idx);
      }
    });

    const map = new Map<string, { name: string; total: number; selected: number; order: number }>();
    allProducts.forEach((p) => {
      const catName = p.categoryName || p.category?.name || 'Chưa phân loại';
      const entry = map.get(catName) || {
        name: catName,
        total: 0,
        selected: 0,
        order: orderIndex.has(catName) ? (orderIndex.get(catName) as number) : 9999,
      };
      entry.total += 1;
      if (selectedItemsMap[p.id]) {
        entry.selected += 1;
      }
      map.set(catName, entry);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [allProducts, selectedItemsMap, branchCategories]);

  // Ticket product candidates
  const ticketCandidates = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    const list = allProducts.filter((p) => {
      if (!q) return true;
      const catName = p.categoryName || p.category?.name || '';
      return (
        p.name.toLowerCase().includes(q) ||
        (p.itemCode || '').toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      const aSel = ticketProductIds.includes(a.id) ? 0 : 1;
      const bSel = ticketProductIds.includes(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [allProducts, ticketSearch, ticketProductIds]);

  // Filtered products for Buffet dishes section
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return allProducts.filter((p) => {
      const catName = p.categoryName || p.category?.name || 'Chưa phân loại';
      if (selectedCategory !== 'ALL' && catName !== selectedCategory) return false;
      const cfg = selectedItemsMap[p.id];
      const isSelected = Boolean(cfg);
      if (selectionFilter === 'SELECTED' && !isSelected) return false;
      if (selectionFilter === 'UNSELECTED' && isSelected) return false;
      if (
        selectionFilter === 'LIMITED' &&
        (!cfg || (!cfg.maxQuantityPerRound && !cfg.maxTotalQuantity))
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.itemCode || '').toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
  }, [allProducts, selectedCategory, selectionFilter, productSearch, selectedItemsMap]);

  // Grouped filtered products by Category name (sorted in admin category order)
  const groupedFilteredProducts = useMemo(() => {
    const orderIndex = new Map<string, number>();
    categoryStats.forEach((c, idx) => orderIndex.set(c.name, idx));

    const groups = new Map<string, BuffetProductOption[]>();
    filteredProducts.forEach((p) => {
      const catName = p.categoryName || p.category?.name || 'Chưa phân loại';
      const arr = groups.get(catName) || [];
      arr.push(p);
      groups.set(catName, arr);
    });

    return Array.from(groups.entries())
      .map(([categoryName, items]) => ({
        categoryName,
        items,
        order: orderIndex.has(categoryName) ? (orderIndex.get(categoryName) as number) : 9999,
      }))
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.categoryName.localeCompare(b.categoryName, 'vi');
      });
  }, [filteredProducts, categoryStats]);

  const handleToggleCategoryDishes = (catName: string, items: BuffetProductOption[]) => {
    if (items.length === 0) return;
    const allChecked = items.every((p) => Boolean(selectedItemsMap[p.id]));
    setSelectedItemsMap((prev) => {
      const next = { ...prev };
      if (allChecked) {
        items.forEach((p) => {
          delete next[p.id];
        });
      } else {
        items.forEach((p) => {
          if (!next[p.id]) {
            next[p.id] = { ...DEFAULT_ITEM_CONFIG };
          }
        });
      }
      return next;
    });
    toast.success(
      allChecked
        ? `Đã bỏ chọn ${items.length} món thuộc "${catName}"`
        : `Đã chọn ${items.length} món thuộc "${catName}"`,
    );
  };

  const selectedCount = Object.keys(selectedItemsMap).length;
  const limitedItemsCount = useMemo(
    () =>
      Object.values(selectedItemsMap).filter(
        (cfg) => Boolean(cfg.maxQuantityPerRound || cfg.maxTotalQuantity),
      ).length,
    [selectedItemsMap],
  );

  // Toggles
  const handleToggleTicket = (prodId: string) => {
    setTicketProductIds((prev) =>
      prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId],
    );
  };

  const handleToggleDish = (prodId: string) => {
    setSelectedItemsMap((prev) => {
      if (prev[prodId]) {
        const copy = { ...prev };
        delete copy[prodId];
        return copy;
      }
      return {
        ...prev,
        [prodId]: { ...DEFAULT_ITEM_CONFIG },
      };
    });
  };

  const handleUpdateDishConfig = (
    prodId: string,
    patch: Partial<SelectedItemConfig>,
  ) => {
    setSelectedItemsMap((prev) => {
      const current = prev[prodId] || { ...DEFAULT_ITEM_CONFIG };
      return {
        ...prev,
        [prodId]: { ...current, ...patch },
      };
    });
  };

  // Quick category actions
  const handleSelectFilteredCategory = () => {
    if (filteredProducts.length === 0) return;
    setSelectedItemsMap((prev) => {
      const next = { ...prev };
      filteredProducts.forEach((p) => {
        if (!next[p.id]) {
          next[p.id] = { ...DEFAULT_ITEM_CONFIG };
        }
      });
      return next;
    });
    toast.success(
      `Đã chọn nhanh ${filteredProducts.length} món${selectedCategory !== 'ALL' ? ` thuộc danh mục "${selectedCategory}"` : ''}`,
    );
  };

  const handleDeselectFilteredCategory = () => {
    if (filteredProducts.length === 0) return;
    const filteredIds = new Set(filteredProducts.map((p) => p.id));
    setSelectedItemsMap((prev) => {
      const next: Record<string, SelectedItemConfig> = {};
      Object.entries(prev).forEach(([id, cfg]) => {
        if (!filteredIds.has(id)) {
          next[id] = cfg;
        }
      });
      return next;
    });
    toast.success(`Đã bỏ chọn các món đang hiển thị`);
  };

  const handleApplyBulkLimitsToFiltered = () => {
    const parsedRound = parsePositiveIntOrNull(bulkRoundLimit);
    const parsedTotal = parsePositiveIntOrNull(bulkTotalLimit);

    if (
      parsedRound !== null &&
      parsedTotal !== null &&
      parsedRound > parsedTotal
    ) {
      toast.error('Giới hạn mỗi lần gọi không thể lớn hơn tổng giới hạn cả bữa');
      return;
    }

    if (filteredProducts.length === 0) {
      toast.error('Không có món nào trong bộ lọc hiện tại');
      return;
    }

    setSelectedItemsMap((prev) => {
      const next = { ...prev };
      let affected = 0;
      filteredProducts.forEach((p) => {
        if (next[p.id]) {
          next[p.id] = {
            ...next[p.id],
            maxQuantityPerRound: parsedRound ? String(parsedRound) : '',
            maxTotalQuantity: parsedTotal ? String(parsedTotal) : '',
          };
          affected += 1;
        }
      });

      if (affected === 0) {
        // Auto-select all filtered dishes and apply limits if none selected yet
        filteredProducts.forEach((p) => {
          next[p.id] = {
            ...DEFAULT_ITEM_CONFIG,
            maxQuantityPerRound: parsedRound ? String(parsedRound) : '',
            maxTotalQuantity: parsedTotal ? String(parsedTotal) : '',
          };
        });
      }
      return next;
    });

    const summary =
      !parsedRound && !parsedTotal
        ? 'Không giới hạn'
        : `${parsedRound ? `Tối đa ${parsedRound}/lần` : ''}${parsedRound && parsedTotal ? ' · ' : ''}${parsedTotal ? `Tổng tối đa ${parsedTotal}/bữa` : ''}`;
    toast.success(`Đã áp dụng giới hạn (${summary}) cho nhóm món đang lọc`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Vui lòng nhập tên gói Buffet');
      return;
    }
    if (!branchId) {
      toast.error('Vui lòng chọn chi nhánh áp dụng');
      return;
    }
    if (ticketProductIds.length === 0) {
      toast.error('Bắt buộc chọn ít nhất 1 Món đại diện / Vé Buffet');
      return;
    }
    if (
      !isUnlimitedPerSubmission &&
      (!Number.isInteger(maxItemsPerSubmission) || maxItemsPerSubmission < 1)
    ) {
      toast.error('Giới hạn món mỗi lần gửi phải là số nguyên dương lớn hơn 0');
      return;
    }

    // Validate per-dish limits consistency
    const selectedEntries = Object.entries(selectedItemsMap);
    for (const [productId, cfg] of selectedEntries) {
      const roundCap = parsePositiveIntOrNull(cfg.maxQuantityPerRound);
      const totalCap = parsePositiveIntOrNull(cfg.maxTotalQuantity);
      if (roundCap !== null && totalCap !== null && roundCap > totalCap) {
        const prod = allProducts.find((p) => p.id === productId);
        toast.error(
          `Món "${prod?.name || productId}": Giới hạn mỗi lần (${roundCap}) không được lớn hơn tổng tối đa (${totalCap})`,
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const orderedSelectedIds = allProducts
        .filter((p) => selectedItemsMap[p.id])
        .map((p) => p.id);
      // Include any selected IDs not yet in allProducts fallback
      selectedEntries.forEach(([id]) => {
        if (!orderedSelectedIds.includes(id)) orderedSelectedIds.push(id);
      });

      const payload = {
        branchId,
        name: name.trim(),
        description: description.trim() || undefined,
        displayOrder: Number(displayOrder) || 0,
        active,
        maxItemsPerSubmission: isUnlimitedPerSubmission
          ? null
          : Math.max(1, Math.floor(maxItemsPerSubmission)),
        ticketProductIds,
        items: orderedSelectedIds.map((productId, idx) => {
          const cfg = selectedItemsMap[productId] || DEFAULT_ITEM_CONFIG;
          return {
            productId,
            displayOrder: idx + 1,
            maxQuantityPerRound: parsePositiveIntOrNull(cfg.maxQuantityPerRound),
            maxTotalQuantity: parsePositiveIntOrNull(cfg.maxTotalQuantity),
            availableForQr: cfg.availableForQr,
            allowRetailPurchase: cfg.allowRetailPurchase,
          };
        }),
      };

      const url = isEditMode
        ? `/api/buffet/packages/${packageId}`
        : '/api/buffet/packages';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Không thể lưu cấu hình gói Buffet');
      }

      toast.success(
        isEditMode
          ? 'Cập nhật gói Buffet thành công'
          : 'Tạo gói Buffet mới thành công',
      );
      router.push('/admin/buffet');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu gói Buffet');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingPackage) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#da251d] mx-auto" />
          <p className="text-sm font-bold text-slate-600">
            Đang tải cấu hình gói Buffet...
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans text-slate-800 pb-28"
    >
      {/* Top Sticky Action Header */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <Link
            href="/admin/buffet"
            className="mt-0.5 w-10 h-10 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors shrink-0"
            title="Quay lại danh sách gói Buffet"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-[#da251d] text-xs font-extrabold uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Quản lý Gói Buffet · POS &amp; QR Order</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-0.5 tracking-tight">
              {isEditMode
                ? `Chỉnh sửa gói: ${name || 'Buffet'}`
                : 'Tạo Gói Buffet Mới'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Thiết lập vé đại diện, thực đơn 0đ theo danh mục và giới hạn từng món (tối đa mỗi lần gọi &amp; tổng cả bữa).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span>{selectedCount} món</span>
            <span className="text-slate-300">|</span>
            <Gauge className="w-4 h-4 text-amber-600" />
            <span>{limitedItemsCount} món có giới hạn</span>
          </div>

          <Link
            href="/admin/buffet"
            className="h-11 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 inline-flex items-center gap-1.5 transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Hủy</span>
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-6 rounded-2xl bg-[#da251d] hover:bg-[#b81b14] disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-2 shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSubmitting
                ? 'Đang lưu...'
                : isEditMode
                ? 'Lưu thay đổi'
                : 'Tạo Gói Buffet'}
            </span>
          </button>
        </div>
      </div>

      {/* Section 1 & 2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: General Package Configuration */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
            <div className="w-9 h-9 rounded-2xl bg-red-50 text-[#da251d] flex items-center justify-center">
              <SlidersHorizontal className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                1. Thông tin cơ bản &amp; Giới hạn lượt gửi
              </h2>
              <p className="text-[11px] text-slate-500">
                Cấu hình chi nhánh, trạng thái hiển thị và trần tổng số lượng mỗi lần khách bấm gửi bếp.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Chi nhánh áp dụng</span>
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setTicketProductIds([]);
                  setSelectedItemsMap({});
                }}
                disabled={isEditMode}
                className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#da251d] text-xs font-bold text-slate-800 outline-none disabled:opacity-65 cursor-pointer"
              >
                <option value="">-- Chọn chi nhánh --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                Tên gói Buffet *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Buffet Premium 599k"
                className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#da251d] text-xs font-bold text-slate-900 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                Thứ tự hiển thị
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#da251d] text-xs font-bold text-slate-900 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setActive((prev) => !prev)}
                className={`w-full h-11 px-4 rounded-2xl border text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <span>Trạng thái kích hoạt gói</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                  }`}
                >
                  {active ? 'Đang bật' : 'Tạm tắt'}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1.5 block">
              Mô tả gói Buffet
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn gọn các món nổi bật, thời gian phục vụ hoặc lưu ý áp dụng..."
              className="w-full p-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#da251d] text-xs font-medium text-slate-800 outline-none resize-none"
            />
          </div>

          {/* Max items per submission box */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-black text-amber-900">
                  Giới hạn tổng số món mỗi lần gửi bếp
                </span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUnlimitedPerSubmission}
                  onChange={(e) => setIsUnlimitedPerSubmission(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#da251d]"
                />
                <span>Không giới hạn</span>
              </label>
            </div>

            {!isUnlimitedPerSubmission ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Tối đa</span>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={maxItemsPerSubmission}
                    onChange={(e) => setMaxItemsPerSubmission(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 h-10 px-3 rounded-xl border border-amber-300 bg-white text-center font-mono text-sm font-black text-amber-900 outline-none focus:border-[#da251d]"
                  />
                  <span className="text-xs font-bold text-slate-700">món / lượt gửi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 15, 20].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMaxItemsPerSubmission(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        maxItemsPerSubmission === preset
                          ? 'bg-amber-600 border-amber-600 text-white'
                          : 'bg-white border-amber-200 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      {preset} món
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-amber-800 font-medium">
                Khách được gọi không giới hạn tổng số lượng trong một lượt gửi (vẫn áp dụng giới hạn riêng của từng món bên dưới nếu có).
              </p>
            )}
          </div>
        </div>

        {/* Right: Buffet Ticket Selector */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Ticket className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">
                  2. Vé đại diện tính tiền ({ticketProductIds.length}) *
                </h2>
                <p className="text-[11px] text-slate-500">
                  Khi POS chọn món vé này, bàn tự động kích hoạt chế độ Buffet 0đ.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              placeholder="Tìm tên vé hoặc mã SKU (VD: vé người lớn, trẻ em)..."
              className="w-full h-10 pl-9 pr-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-500 text-xs font-medium outline-none"
            />
          </div>

          {ticketProductIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ticketProductIds.map((pid) => {
                const prod = allProducts.find((p) => p.id === pid);
                return (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-800"
                  >
                    <span>{prod?.name || pid}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleTicket(pid)}
                      className="text-indigo-500 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
            {isLoadingProducts ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                Đang tải danh sách sản phẩm...
              </div>
            ) : ticketCandidates.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">
                Không tìm thấy sản phẩm phù hợp
              </div>
            ) : (
              ticketCandidates.map((prod) => {
                const checked = ticketProductIds.includes(prod.id);
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleToggleTicket(prod.id)}
                    className={`w-full px-3 py-2.5 rounded-2xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      checked
                        ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 ${
                          checked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {prod.itemCode ? `${prod.itemCode} · ` : ''}
                          {prod.categoryName || prod.category?.name || 'Món ăn'}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-indigo-700 shrink-0">
                      {Number(prod.price || 0).toLocaleString('vi-VN')}đ
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Dish Menu & Per-Dish Quantity Limits */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                3. Thực đơn món trong gói &amp; Giới hạn từng món ({selectedCount} món)
              </h2>
              <p className="text-xs text-slate-500">
                Tùy chọn nhanh theo danh mục, tìm kiếm theo tên/SKU và cài đặt giới hạn mỗi lần gọi hoặc tổng tối đa cả bữa cho từng món.
              </p>
            </div>
          </div>

          {/* Selection Status Filter Pills */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-2xl gap-1 self-start">
            {([
              { id: 'ALL', label: `Tất cả (${allProducts.length})` },
              { id: 'SELECTED', label: `Đã chọn (${selectedCount})` },
              { id: 'UNSELECTED', label: `Chưa chọn (${Math.max(0, allProducts.length - selectedCount)})` },
              { id: 'LIMITED', label: `Có giới hạn (${limitedItemsCount})` },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectionFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  selectionFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Category Chips */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 uppercase tracking-wider">
            <FolderKanban className="w-3.5 h-3.5 text-[#da251d]" />
            <span>Tùy chọn nhanh theo danh mục</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tất cả danh mục</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  selectedCategory === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {selectedCount}/{allProducts.length}
              </span>
            </button>

            {categoryStats.map((cat) => {
              const activeCat = selectedCategory === cat.name;
              const allCatSelected = cat.selected === cat.total && cat.total > 0;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 border transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeCat
                      ? 'bg-[#da251d] border-[#da251d] text-white shadow-xs shadow-red-500/20'
                      : allCatSelected
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      activeCat
                        ? 'bg-white/25 text-white'
                        : allCatSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.selected}/{cat.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search + Bulk Actions Toolbar */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-3.5">
          {/* Search input */}
          <div className="xl:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Tìm món ăn theo tên, mã SKU hoặc tên danh mục..."
              className="w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 bg-white focus:border-[#da251d] text-xs font-medium outline-none"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick select / deselect */}
          <div className="xl:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectFilteredCategory}
              className="flex-1 h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Chọn nhanh ({filteredProducts.length})</span>
            </button>
            <button
              type="button"
              onClick={handleDeselectFilteredCategory}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="Bỏ chọn các món đang lọc"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bỏ chọn</span>
            </button>
          </div>

          {/* Bulk limit apply */}
          <div className="xl:col-span-4 flex flex-wrap sm:flex-nowrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={bulkRoundLimit}
              onChange={(e) => setBulkRoundLimit(e.target.value)}
              placeholder="Tối đa/lần"
              className="w-full sm:w-24 h-10 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-center outline-none focus:border-[#da251d]"
              title="Số lượng tối đa mỗi lần gọi cho nhóm đang lọc"
            />
            <input
              type="number"
              min={1}
              value={bulkTotalLimit}
              onChange={(e) => setBulkTotalLimit(e.target.value)}
              placeholder="Tổng/bữa"
              className="w-full sm:w-24 h-10 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-center outline-none focus:border-[#da251d]"
              title="Tổng số lượng tối đa cộng dồn cả bữa cho nhóm đang lọc"
            />
            <button
              type="button"
              onClick={handleApplyBulkLimitsToFiltered}
              className="w-full sm:w-auto h-10 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Áp dụng giới hạn</span>
            </button>
          </div>
        </div>

        {/* Dishes Table */}
        <div className="overflow-x-auto border border-slate-200/90 rounded-2xl">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-12 text-center">Chọn</th>
                <th className="py-3 px-3">Món ăn / Danh mục</th>
                <th className="py-3 px-3 w-28 text-right">Giá niêm yết</th>
                <th className="py-3 px-3 w-36 text-center">Tối đa / lần gọi</th>
                <th className="py-3 px-3 w-40 text-center">Tổng tối đa / cả bữa</th>
                <th className="py-3 px-3 w-36 text-center">Kênh QR / Gọi lẻ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoadingProducts ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 font-bold">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#da251d]" />
                    Đang tải thực đơn chi nhánh...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-slate-600">Không tìm thấy món ăn phù hợp</p>
                    <p className="text-[11px] mt-0.5">Thử đổi danh mục hoặc xóa từ khóa tìm kiếm</p>
                  </td>
                </tr>
              ) : (
                groupedFilteredProducts.map((group) => {
                  const groupSelectedCount = group.items.filter((p) => Boolean(selectedItemsMap[p.id])).length;
                  const allGroupChecked =
                    group.items.length > 0 && groupSelectedCount === group.items.length;

                  return (
                    <React.Fragment key={group.categoryName}>
                      <tr className="bg-slate-100/85 border-y border-slate-200/90">
                        <td colSpan={6} className="py-2 px-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="w-4 h-4 text-[#da251d]" />
                              <span className="text-xs font-black uppercase tracking-wide text-slate-800">
                                {group.categoryName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 font-mono">
                                {groupSelectedCount}/{group.items.length} món
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryDishes(group.categoryName, group.items)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                                allGroupChecked
                                  ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {allGroupChecked ? 'Bỏ chọn cả danh mục' : 'Chọn cả danh mục'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {group.items.map((prod) => {
                        const cfg = selectedItemsMap[prod.id];
                        const isSelected = Boolean(cfg);
                        const isTicket = ticketProductIds.includes(prod.id);

                        return (
                          <tr
                            key={prod.id}
                            className={`transition-colors ${
                              isSelected ? 'bg-emerald-50/35' : 'bg-white hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleDish(prod.id)}
                                className={`w-6 h-6 rounded-lg border inline-flex items-center justify-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                    : 'bg-white border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                  {prod.imageUrl ? (
                                    <Image
                                      src={prod.imageUrl}
                                      alt={prod.name}
                                      width={44}
                                      height={44}
                                      unoptimized
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <UtensilsCrossed className="w-4 h-4 text-slate-300" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900">
                                      {prod.name}
                                    </span>
                                    {isTicket && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black">
                                        Vé Buffet
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 font-semibold text-slate-600">
                                      {prod.categoryName || prod.category?.name || 'Khác'}
                                    </span>
                                    {prod.itemCode && (
                                      <span className="font-mono text-slate-400">
                                        #{prod.itemCode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-600">
                              {Number(prod.price || 0).toLocaleString('vi-VN')}đ
                            </td>

                            <td className="py-3 px-3">
                              {isSelected ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    value={cfg.maxQuantityPerRound}
                                    onChange={(e) =>
                                      handleUpdateDishConfig(prod.id, {
                                        maxQuantityPerRound: e.target.value,
                                      })
                                    }
                                    placeholder="Không GH"
                                    className="w-24 h-9 px-2 rounded-xl border border-slate-200 bg-white focus:border-[#da251d] text-center font-mono text-xs font-bold text-slate-900 outline-none"
                                  />
                                </div>
                              ) : (
                                <span className="block text-center text-[11px] text-slate-300 font-medium">
                                  --
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {isSelected ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    value={cfg.maxTotalQuantity}
                                    onChange={(e) =>
                                      handleUpdateDishConfig(prod.id, {
                                        maxTotalQuantity: e.target.value,
                                      })
                                    }
                                    placeholder="Không GH"
                                    className="w-24 h-9 px-2 rounded-xl border border-slate-200 bg-white focus:border-[#da251d] text-center font-mono text-xs font-bold text-slate-900 outline-none"
                                  />
                                </div>
                              ) : (
                                <span className="block text-center text-[11px] text-slate-300 font-medium">
                                  --
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {isSelected ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateDishConfig(prod.id, {
                                        availableForQr: !cfg.availableForQr,
                                      })
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition-colors ${
                                      cfg.availableForQr
                                        ? 'bg-emerald-100 border-emerald-200 text-emerald-800'
                                        : 'bg-slate-100 border-slate-200 text-slate-400'
                                    }`}
                                  >
                                    QR: {cfg.availableForQr ? 'Bật' : 'Tắt'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateDishConfig(prod.id, {
                                        allowRetailPurchase: !cfg.allowRetailPurchase,
                                      })
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition-colors ${
                                      cfg.allowRetailPurchase
                                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                                        : 'bg-slate-100 border-slate-200 text-slate-400'
                                    }`}
                                  >
                                    Lẻ: {cfg.allowRetailPurchase ? 'Có' : 'Không'}
                                  </button>
                                </div>
                              ) : (
                                <span className="block text-center text-[11px] text-slate-300 font-medium">
                                  --
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
}
