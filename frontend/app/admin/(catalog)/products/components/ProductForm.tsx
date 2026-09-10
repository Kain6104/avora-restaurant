'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from 'react-hot-toast';
import {
  Save,
  ArrowLeft,
  Plus,
  Flame,
  Sparkles,
  Image as ImageIcon,
  Video,
  Store,
  ChefHat,
  Utensils,
  Tag,
  Trash2,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ShoppingBag,
  Gift,
  Printer,
  Upload,
  ExternalLink,
  Eye,
  Sliders,
  X,
  Copy,
  GripVertical,
} from 'lucide-react';
import ImageUploader from '@/app/admin/components/ImageUploader';
import { AdminCard, PageHeader, FormField, Modal } from '@/app/admin/components/ui';

interface OptionItemDraft {
  id?: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  available: boolean;
  maxQuantity: number;
  displayOrder: number;
}

interface OptionGroupDraft {
  id?: string;
  name: string;
  isRequired: boolean;
  multipleChoice: boolean;
  minSelect: number;
  maxSelect: number;
  displayOrder: number;
  items: OptionItemDraft[];
}

interface PrinterConfigDraft {
  type: 'KITCHEN' | 'BAR' | 'ITEM_LABEL' | 'RECEIPT' | 'TEMP_BILL';
  enabled: boolean;
  stationId: string;
  copies: number;
}

const ALL_SALES_CHANNELS = [
  {
    id: 'DINE_IN',
    name: 'Ăn tại bàn',
    desc: 'Phục vụ khách dùng bữa tại nhà hàng (POS bàn)',
    icon: '🍽️',
    color: 'border-emerald-200 bg-emerald-50/50 text-emerald-950',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'TAKEAWAY',
    name: 'Mang về (Takeout)',
    desc: 'Đóng gói mang đi, khách mua tại quầy mang về',
    icon: '🥡',
    color: 'border-amber-200 bg-amber-50/50 text-amber-950',
    badge: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'ONLINE_DELIVERY',
    name: 'Đặt Online (Web/App)',
    desc: 'Giao hàng tận nơi cho khách đặt qua Website hoặc App',
    icon: '🛵',
    color: 'border-blue-200 bg-blue-50/50 text-blue-950',
    badge: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'GRAB_FOOD',
    name: 'GrabFood',
    desc: 'Bán trên ứng dụng đối tác giao đồ ăn GrabFood',
    icon: '🟢',
    color: 'border-green-200 bg-green-50/50 text-green-950',
    badge: 'bg-green-100 text-green-800',
  },
  {
    id: 'SHOPEE_FOOD',
    name: 'ShopeeFood',
    desc: 'Bán trên ứng dụng đối tác giao đồ ăn ShopeeFood',
    icon: '🟠',
    color: 'border-orange-200 bg-orange-50/50 text-orange-950',
    badge: 'bg-orange-100 text-orange-800',
  },
  {
    id: 'QR_ORDER',
    name: 'QR Order tại bàn',
    desc: 'Khách tự quét mã QR tại bàn để gọi món trực tiếp',
    icon: '📱',
    color: 'border-purple-200 bg-purple-50/50 text-purple-950',
    badge: 'bg-purple-100 text-purple-800',
  },
];

const PRINTER_TYPES: {
  type: 'KITCHEN' | 'BAR' | 'ITEM_LABEL' | 'RECEIPT' | 'TEMP_BILL';
  name: string;
  desc: string;
  icon: string;
  role: 'PREPARATION' | 'LABEL' | 'EXPEDITOR';
}[] = [
  {
    type: 'KITCHEN',
    name: 'MÁY IN BẾP NÓNG & CHẾ BIẾN (KITCHEN)',
    desc: 'In phiếu gọi món cho Bếp chính: món nướng, lẩu, xào, chiên, món mặn',
    icon: '🍳',
    role: 'PREPARATION',
  },
  {
    type: 'BAR',
    name: 'MÁY IN QUẦY BAR & PHA CHẾ (BAR)',
    desc: 'In phiếu làm đồ uống cho Bar: trà, cafe, cocktail, sinh tố, tráng miệng',
    icon: '🍸',
    role: 'PREPARATION',
  },
  {
    type: 'ITEM_LABEL',
    name: 'MÁY IN TEM NHÃN (ITEM_LABEL / STICKER)',
    desc: 'In tem dán nắp ly, cốc trà sữa, hộp thức ăn mang đi có kèm mã QR & topping',
    icon: '🏷️',
    role: 'LABEL',
  },
  {
    type: 'RECEIPT',
    name: 'MÁY IN HÓA ĐƠN (RECEIPT)',
    desc: 'In hóa đơn thanh toán cho khách tại quầy thu ngân (POS)',
    icon: '🧾',
    role: 'EXPEDITOR',
  },
  {
    type: 'TEMP_BILL',
    name: 'MÁY IN PHIẾU TẠM TÍNH (TEMP_BILL)',
    desc: 'In phiếu kiểm đồ / tạm tính trước khi chốt đơn',
    icon: '📄',
    role: 'EXPEDITOR',
  },
];

interface ProductFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function ProductForm({ initialData, isEdit }: ProductFormProps) {
  const router = useRouter();
  const { role, selectedBranchId, availableBranches } = useAdmin();

  const [activeTab, setActiveTab] = useState<'basic' | 'channels' | 'options' | 'loyalty' | 'media' | 'printers' | 'branches'>('basic');
  const [categories, setCategories] = useState<any[]>([]);
  const [kitchenStations, setKitchenStations] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Modal thêm nhanh danh mục
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Form Data chính
  const [formData, setFormData] = useState({
    itemCode: '',
    name: '',
    description: '',
    post: '',
    price: 0,
    oldPrice: 0,
    discountedPrice: 0,
    flashSalePrice: 0,
    unit: 'phần',
    taxPercentage: 0,
    badge: '',
    imageUrl: '',
    videoUrl: '',
    secondaryImages: [] as string[],
    available: true,
    isBestSeller: false,
    isAiRecommended: false,
    spiciness: 0,
    targetAudience: 'Mọi lứa tuổi',
    salesChannels: ['DINE_IN', 'TAKEAWAY', 'ONLINE_DELIVERY', 'GRAB_FOOD', 'SHOPEE_FOOD', 'QR_ORDER'] as string[],
    isRedeemable: false,
    redemptionPoints: 0,
    redeemAllBranches: true,
    redeemableBranchIds: [] as string[],
    categoryId: '',
    branchIds: [] as string[],
  });

  // Quản lý Tùy chọn & Topping
  const [optionGroups, setOptionGroups] = useState<OptionGroupDraft[]>([]);

  // Quản lý Máy in (5 loại chuẩn)
  const [printersConfig, setPrintersConfig] = useState<Record<string, { enabled: boolean; stationId: string; copies: number }>>({
    KITCHEN: { enabled: false, stationId: '', copies: 1 },
    BAR: { enabled: false, stationId: '', copies: 1 },
    ITEM_LABEL: { enabled: false, stationId: '', copies: 1 },
    RECEIPT: { enabled: false, stationId: '', copies: 1 },
    TEMP_BILL: { enabled: false, stationId: '', copies: 1 },
  });

  // Tải danh mục & trạm in
  useEffect(() => {
    fetchCategories();
    loadKitchenStations();
  }, [selectedBranchId, availableBranches]);

  // Nạp dữ liệu ban đầu
  useEffect(() => {
    if (initialData) {
      const initChannels = Array.isArray(initialData.salesChannels) && initialData.salesChannels.length > 0
        ? initialData.salesChannels
        : ['DINE_IN', 'TAKEAWAY', 'ONLINE_DELIVERY', 'GRAB_FOOD', 'SHOPEE_FOOD', 'QR_ORDER'];

      const initSecondary = Array.isArray(initialData.secondaryImages)
        ? initialData.secondaryImages
        : [];

      const initRedeemBranchIds = Array.isArray(initialData.redeemableBranches)
        ? initialData.redeemableBranches.map((b: any) => b.id)
        : [];

      setFormData({
        itemCode: initialData.itemCode || '',
        name: initialData.name || '',
        description: initialData.description || '',
        post: initialData.post || '',
        price: initialData.price || 0,
        oldPrice: initialData.oldPrice || 0,
        discountedPrice: initialData.discountedPrice || 0,
        flashSalePrice: initialData.flashSalePrice || 0,
        unit: initialData.unit || 'phần',
        taxPercentage: initialData.taxPercentage ?? 0,
        badge: initialData.badge || '',
        imageUrl: initialData.imageUrl || '',
        videoUrl: initialData.videoUrl || '',
        secondaryImages: initSecondary,
        available: initialData.available !== false,
        isBestSeller: Boolean(initialData.isBestSeller),
        isAiRecommended: Boolean(initialData.isAiRecommended),
        spiciness: initialData.spiciness || 0,
        targetAudience: initialData.targetAudience || 'Mọi lứa tuổi',
        salesChannels: initChannels,
        isRedeemable: Boolean(initialData.isRedeemable),
        redemptionPoints: initialData.redemptionPoints || 0,
        redeemAllBranches: initialData.redeemAllBranches !== false,
        redeemableBranchIds: initRedeemBranchIds,
        categoryId: initialData.categoryId || '',
        branchIds: initialData.branches ? initialData.branches.map((b: any) => b.id) : [],
      });

      // Nạp Option Groups
      if (Array.isArray(initialData.optionGroups) && initialData.optionGroups.length > 0) {
        setOptionGroups(
          initialData.optionGroups.map((g: any, gIdx: number) => ({
            id: g.id,
            name: g.name || '',
            isRequired: Boolean(g.isRequired),
            multipleChoice: Boolean(g.multipleChoice),
            minSelect: Number(g.minSelect || 0),
            maxSelect: Number(g.maxSelect || 1),
            displayOrder: g.displayOrder ?? gIdx,
            items: (g.optionItems || []).map((item: any, iIdx: number) => ({
              id: item.id,
              name: item.name || '',
              priceAdjustment: Number(item.priceAdjustment || 0),
              isDefault: Boolean(item.isDefault),
              available: item.available !== false,
              maxQuantity: Number(item.maxQuantity || 1),
              displayOrder: item.displayOrder ?? iIdx,
            })),
          }))
        );
      }

      // Nạp Print Routes
      if (Array.isArray(initialData.printRoutes) && initialData.printRoutes.length > 0) {
        const newCfg: Record<string, { enabled: boolean; stationId: string; copies: number }> = {
          KITCHEN: { enabled: false, stationId: '', copies: 1 },
          BAR: { enabled: false, stationId: '', copies: 1 },
          ITEM_LABEL: { enabled: false, stationId: '', copies: 1 },
          RECEIPT: { enabled: false, stationId: '', copies: 1 },
          TEMP_BILL: { enabled: false, stationId: '', copies: 1 },
        };

        initialData.printRoutes.forEach((r: any) => {
          let pType = r.printType;
          if (pType === 'KITCHEN_TICKET') pType = 'KITCHEN';
          if (newCfg[pType]) {
            newCfg[pType] = {
              enabled: r.isActive !== false,
              stationId: r.stationId || '',
              copies: r.copies || 1,
            };
          }
        });
        setPrintersConfig((prev) => ({ ...prev, ...newCfg }));
      }
    } else {
      // Mặc định chọn tất cả chi nhánh nếu tạo mới
      if (role === 'ADMIN') {
        setFormData((prev) => ({
          ...prev,
          branchIds: availableBranches.map((b) => b.id),
          redeemableBranchIds: availableBranches.map((b) => b.id),
        }));
      } else if (selectedBranchId && selectedBranchId !== 'ALL') {
        setFormData((prev) => ({
          ...prev,
          branchIds: [selectedBranchId],
          redeemableBranchIds: [selectedBranchId],
        }));
      }
    }
  }, [initialData, role, selectedBranchId, availableBranches]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories?limit=100', { credentials: 'include' });
      const data = await res.json();
      setCategories(data.data || []);
      if (!initialData && data.data && data.data.length > 0) {
        setFormData((prev) => ({ ...prev, categoryId: data.data[0].id }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadKitchenStations = async () => {
    try {
      const branchId = selectedBranchId !== 'ALL' ? selectedBranchId : availableBranches[0]?.id;
      if (!branchId) return;
      const res = await fetch(`/api/print-routing/stations?branchId=${branchId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setKitchenStations(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trích xuất ID video Youtube để nhúng iframe
  const youtubeVideoId = useMemo(() => {
    if (!formData.videoUrl) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = formData.videoUrl.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }, [formData.videoUrl]);

  // Thêm nhanh danh mục mới
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Thêm danh mục thành công');
        setIsCategoryModalOpen(false);
        setNewCategoryName('');
        await fetchCategories();
      } else {
        toast.error('Lỗi khi thêm danh mục');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  // Tải lên nhiều ảnh phụ cùng lúc
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    toast.loading(`Đang tải lên ${files.length} ảnh phụ...`, { id: 'gallery-upload' });

    const uploadedUrls: string[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = new FormData();
        data.append('file', file);

        const res = await fetch('/api/admin/upload?folder=products', {
          method: 'POST',
          body: data,
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          if (json.url) uploadedUrls.push(json.url);
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          secondaryImages: [...prev.secondaryImages, ...uploadedUrls],
        }));
        toast.success(`Đã tải lên thành công ${uploadedUrls.length} ảnh!`, { id: 'gallery-upload' });
      } else {
        toast.error('Không thể tải ảnh lên. Vui lòng thử lại!', { id: 'gallery-upload' });
      }
    } catch {
      toast.error('Lỗi kết nối khi tải ảnh', { id: 'gallery-upload' });
    } finally {
      setUploadingGallery(false);
      e.target.value = '';
    }
  };

  const removeSecondaryImage = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      secondaryImages: prev.secondaryImages.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  // Toggle kênh bán hàng
  const toggleSalesChannel = (channelId: string) => {
    setFormData((prev) => {
      const exists = prev.salesChannels.includes(channelId);
      return {
        ...prev,
        salesChannels: exists
          ? prev.salesChannels.filter((c) => c !== channelId)
          : [...prev.salesChannels, channelId],
      };
    });
  };

  const selectAllSalesChannels = () => {
    setFormData((prev) => ({
      ...prev,
      salesChannels: ALL_SALES_CHANNELS.map((c) => c.id),
    }));
  };

  const clearAllSalesChannels = () => {
    setFormData((prev) => ({ ...prev, salesChannels: [] }));
  };

  // Xử lý Option Groups
  const addOptionGroup = () => {
    setOptionGroups((prev) => [
      ...prev,
      {
        name: `Nhóm tùy chọn ${prev.length + 1}`,
        isRequired: false,
        multipleChoice: false,
        minSelect: 0,
        maxSelect: 1,
        displayOrder: prev.length,
        items: [
          {
            name: 'Lựa chọn tiêu chuẩn',
            priceAdjustment: 0,
            isDefault: true,
            available: true,
            maxQuantity: 1,
            displayOrder: 0,
          },
        ],
      },
    ]);
  };

  const removeOptionGroup = (gIdx: number) => {
    setOptionGroups((prev) => prev.filter((_, idx) => idx !== gIdx));
  };

  const updateOptionGroup = (gIdx: number, patch: Partial<OptionGroupDraft>) => {
    setOptionGroups((prev) => {
      const next = [...prev];
      next[gIdx] = { ...next[gIdx], ...patch };
      return next;
    });
  };

  const addOptionItem = (gIdx: number) => {
    setOptionGroups((prev) => {
      const next = [...prev];
      const group = next[gIdx];
      group.items = [
        ...group.items,
        {
          name: '',
          priceAdjustment: 0,
          isDefault: false,
          available: true,
          maxQuantity: 1,
          displayOrder: group.items.length,
        },
      ];
      return next;
    });
  };

  const removeOptionItem = (gIdx: number, iIdx: number) => {
    setOptionGroups((prev) => {
      const next = [...prev];
      next[gIdx].items = next[gIdx].items.filter((_, idx) => idx !== iIdx);
      return next;
    });
  };

  const updateOptionItem = (gIdx: number, iIdx: number, patch: Partial<OptionItemDraft>) => {
    setOptionGroups((prev) => {
      const next = [...prev];
      next[gIdx].items[iIdx] = { ...next[gIdx].items[iIdx], ...patch };
      return next;
    });
  };

  // Gửi Form lưu Món ăn
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên món ăn!');
      setActiveTab('basic');
      return;
    }

    if (Number(formData.price) <= 0) {
      toast.error('Vui lòng nhập giá bán hợp lệ lớn hơn 0!');
      setActiveTab('basic');
      return;
    }

    if (role === 'ADMIN' && formData.branchIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 chi nhánh phục vụ món này!');
      setActiveTab('branches');
      return;
    }

    setSubmitting(true);
    try {
      // Chuẩn bị danh sách định tuyến in
      const defaultBranchId =
        selectedBranchId !== 'ALL'
          ? selectedBranchId
          : formData.branchIds[0] || availableBranches[0]?.id;

      const printerRoutesToSubmit: any[] = [];
      Object.entries(printersConfig).forEach(([typeKey, cfg]) => {
        if (!cfg.enabled) return;

        // Tìm trạm phù hợp
        let targetStation = kitchenStations.find((s) => s.id === cfg.stationId);
        if (!targetStation) {
          if (typeKey === 'BAR') {
            targetStation = kitchenStations.find((s) => s.code === 'BAR' || s.name?.toLowerCase().includes('bar'));
          } else if (typeKey === 'KITCHEN') {
            targetStation = kitchenStations.find((s) => s.code === 'HOT_KITCHEN' || s.name?.toLowerCase().includes('bếp'));
          } else {
            targetStation = kitchenStations[0];
          }
        }

        if (!targetStation) {
          toast.error('Vui lòng cấu hình ít nhất một trạm in cho loại máy in đã bật');
          setSubmitting(false);
          return;
        }

        if (targetStation && defaultBranchId) {
          const matchedRole = PRINTER_TYPES.find((p) => p.type === typeKey)?.role || 'PREPARATION';
          printerRoutesToSubmit.push({
            branchId: defaultBranchId,
            stationId: targetStation.id,
            routeRole: matchedRole,
            printType: typeKey,
            copies: Number(cfg.copies || 1),
            isActive: true,
          });
        }
      });

      const submitData = {
        itemCode: formData.itemCode.trim(),
        name: formData.name.trim(),
        description: formData.description || null,
        post: formData.post || null,
        price: Number(formData.price),
        oldPrice: formData.oldPrice ? Number(formData.oldPrice) : null,
        discountedPrice: formData.discountedPrice ? Number(formData.discountedPrice) : null,
        flashSalePrice: formData.flashSalePrice ? Number(formData.flashSalePrice) : null,
        unit: formData.unit,
        taxPercentage: Number(formData.taxPercentage || 0),
        badge: formData.badge || null,
        imageUrl: formData.imageUrl || null,
        videoUrl: formData.videoUrl ? formData.videoUrl.trim() : null,
        secondaryImages: formData.secondaryImages,
        available: formData.available,
        isBestSeller: formData.isBestSeller,
        isAiRecommended: formData.isAiRecommended,
        spiciness: Number(formData.spiciness || 0),
        targetAudience: formData.targetAudience,
        salesChannels: formData.salesChannels,
        isRedeemable: formData.isRedeemable,
        redemptionPoints: formData.isRedeemable && formData.redemptionPoints ? Number(formData.redemptionPoints) : null,
        redeemAllBranches: formData.redeemAllBranches,
        redeemableBranchIds: formData.redeemAllBranches ? [] : formData.redeemableBranchIds,
        categoryId: formData.categoryId,
        branchIds: formData.branchIds,
        optionGroups,
        printerRoutes: printerRoutesToSubmit,
      };

      const url = isEdit ? `/api/admin/products/${initialData.id}` : `/api/admin/products`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật món ăn thành công!' : 'Tạo mới món ăn thành công!');
        router.push('/admin/products');
      } else {
        const err = await res.json();
        toast.error(err.message || 'Lỗi khi lưu món ăn!');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs sticky top-2 z-20 backdrop-blur-md bg-white/90">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {isEdit ? `Chỉnh sửa: ${formData.name || 'Món ăn'}` : 'Thêm Món Ăn Mới'}
              </h1>
              {formData.badge && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 uppercase">
                  {formData.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Quản lý thực đơn chuẩn đa kênh, định tuyến máy in, tùy chọn topping và tích điểm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm shadow-red-500/20 transition-all disabled:opacity-60"
          >
            <Save size={16} />
            <span>{submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Hoàn tất & Tạo món'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60 scrollbar-none">
        {[
          { id: 'basic', label: 'Thông tin cơ bản', icon: Utensils },
          { id: 'channels', label: 'Kênh bán hàng', icon: ShoppingBag, count: formData.salesChannels.length },
          { id: 'options', label: 'Tùy chọn & Topping', icon: Layers, count: optionGroups.length },
          { id: 'loyalty', label: 'Tích điểm & Đổi quà', icon: Gift },
          { id: 'media', label: 'Video & Ảnh phụ', icon: Video, count: formData.secondaryImages.length + (formData.videoUrl ? 1 : 0) },
          { id: 'printers', label: 'Trạm in & Máy in', icon: Printer },
          { id: 'branches', label: 'Chi nhánh phục vụ', icon: Store, count: formData.branchIds.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-red-600' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                  isActive ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: THÔNG TIN CƠ BẢN & GIÁ BÁN */}
        {/* ========================================================= */}
        {activeTab === 'basic' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <AdminCard title="Thông tin cơ bản" subtitle="Tên, mã định danh, danh mục và mô tả sản phẩm">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <FormField label="Tên món ăn" required>
                        <input
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full h-10 px-3.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-semibold text-slate-900"
                          placeholder="VD: Cơm Chiên Cá Hồi Nauy"
                        />
                      </FormField>
                    </div>
                    <div>
                      <FormField label="Mã món (Item Code)" hint="Để trống sẽ tự sinh">
                        <input
                          value={formData.itemCode}
                          onChange={(e) => setFormData({ ...formData, itemCode: e.target.value.toUpperCase() })}
                          className="w-full h-10 px-3.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 font-mono uppercase"
                          placeholder="VD: MON-001"
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700">Danh mục món (*)</label>
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                          <Plus size={12} />
                          <span>Thêm danh mục</span>
                        </button>
                      </div>
                      <select
                        value={formData.categoryId}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full h-10 px-3 text-xs font-semibold bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <FormField label="Đơn vị tính">
                        <input
                          value={formData.unit}
                          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                          className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                          placeholder="phần, ly, tô..."
                        />
                      </FormField>
                      <FormField label="Thuế VAT (%)">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.taxPercentage}
                          onChange={(e) => setFormData({ ...formData, taxPercentage: Number(e.target.value) })}
                          className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                          placeholder="0, 8, 10"
                        />
                      </FormField>
                    </div>
                  </div>

                  <FormField label="Mô tả ngắn">
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 leading-relaxed"
                      placeholder="Mô tả tóm tắt hương vị, nguyên liệu chính để khách hàng dễ dàng lựa chọn..."
                    />
                  </FormField>

                  <FormField label="Bài viết chi tiết / Câu chuyện món ăn (Post content)">
                    <textarea
                      rows={5}
                      value={formData.post}
                      onChange={(e) => setFormData({ ...formData, post: e.target.value })}
                      className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 font-mono"
                      placeholder="Nội dung giới thiệu chi tiết, công thức, nguồn gốc nguyên liệu cao cấp..."
                    />
                  </FormField>
                </div>
              </AdminCard>

              {/* Thiết lập Giá bán */}
              <AdminCard title="Giá bán & Khuyến mãi" subtitle="Cấu hình mức giá chuẩn và chương trình giảm giá">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField label="Giá bán chính thức (VNĐ)" required>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="w-full h-11 px-3.5 pr-10 text-base font-black text-red-600 bg-red-50/20 border border-red-200 rounded-xl outline-none focus:border-red-500"
                        placeholder="0"
                      />
                      <span className="absolute right-3.5 top-3 text-xs font-bold text-red-500">đ</span>
                    </div>
                  </FormField>

                  <FormField label="Giá gốc gạch ngang (Old Price)">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={formData.oldPrice || ''}
                        onChange={(e) => setFormData({ ...formData, oldPrice: Number(e.target.value) })}
                        className="w-full h-11 px-3.5 pr-10 text-sm font-bold text-slate-500 bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="Để trống nếu không có"
                      />
                      <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">đ</span>
                    </div>
                  </FormField>

                  <FormField label="Giá khuyến mãi (Discounted)">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={formData.discountedPrice || ''}
                        onChange={(e) => setFormData({ ...formData, discountedPrice: Number(e.target.value) })}
                        className="w-full h-11 px-3.5 pr-10 text-sm font-bold text-emerald-600 bg-emerald-50/20 border border-emerald-200 rounded-xl outline-none"
                        placeholder="Để trống nếu không có"
                      />
                      <span className="absolute right-3.5 top-3 text-xs font-bold text-emerald-500">đ</span>
                    </div>
                  </FormField>
                </div>
              </AdminCard>
            </div>

            {/* Cột phải: Trạng thái, Thuộc tính, Huy hiệu */}
            <div className="space-y-6">
              <AdminCard title="Trạng thái & Đặc tính">
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Trạng thái kinh doanh</div>
                      <div className="text-[11px] text-slate-500">Bật/tắt hiển thị món trên thực đơn</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.available}
                      onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                      className="w-5 h-5 text-emerald-600 rounded"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-orange-100 bg-orange-50/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isBestSeller}
                        onChange={(e) => setFormData({ ...formData, isBestSeller: e.target.checked })}
                        className="w-4 h-4 text-orange-600 rounded"
                      />
                      <div className="text-xs font-bold text-orange-900 flex items-center gap-1">
                        <Flame size={14} className="text-orange-500" />
                        <span>Bán chạy</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-blue-100 bg-blue-50/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isAiRecommended}
                        onChange={(e) => setFormData({ ...formData, isAiRecommended: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="text-xs font-bold text-blue-900 flex items-center gap-1">
                        <Sparkles size={14} className="text-blue-500" />
                        <span>AI Gợi ý</span>
                      </div>
                    </label>
                  </div>

                  <FormField label="Huy hiệu nổi bật (Badge)">
                    <input
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value.toUpperCase() })}
                      className="w-full h-9 px-3 text-xs font-bold uppercase bg-white border border-slate-200 rounded-xl outline-none"
                      placeholder="VD: BEST SELLER, MÓN MỚI, CHEF CHOICE"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Độ cay (0 - 3)">
                      <select
                        value={formData.spiciness}
                        onChange={(e) => setFormData({ ...formData, spiciness: Number(e.target.value) })}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                      >
                        <option value="0">0 - Không cay</option>
                        <option value="1">1 - Cay nhẹ 🌶️</option>
                        <option value="2">2 - Cay vừa 🌶️🌶️</option>
                        <option value="3">3 - Cay nồng 🌶️🌶️🌶️</option>
                      </select>
                    </FormField>

                    <FormField label="Đối tượng phục vụ">
                      <input
                        value={formData.targetAudience}
                        onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="Mọi lứa tuổi, Giới trẻ..."
                      />
                    </FormField>
                  </div>
                </div>
              </AdminCard>

              {/* Ảnh đại diện chính */}
              <AdminCard title="Ảnh đại diện chính" subtitle="Hình ảnh đại diện xuất hiện đầu tiên trên menu">
                <ImageUploader
                  folder="products"
                  imageUrl={formData.imageUrl}
                  onUploadSuccess={(url) => setFormData({ ...formData, imageUrl: url })}
                />
              </AdminCard>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: KÊNH BÁN HÀNG (SALES CHANNELS) */}
        {/* ========================================================= */}
        {activeTab === 'channels' && (
          <AdminCard
            title="Kênh Phân Phối & Bán Hàng"
            subtitle="Chủ động phân bổ món ăn theo từng kênh kinh doanh chuyên biệt (Ăn tại bàn, Mang về, Đặt online, Đối tác Grab/Shopee, QR bàn)"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-slate-500 font-medium">
                  Đã chọn: <strong className="text-red-600">{formData.salesChannels.length} / {ALL_SALES_CHANNELS.length}</strong> kênh bán
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllSalesChannels}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={clearAllSalesChannels}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-lg transition-colors"
                  >
                    Bỏ chọn hết
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ALL_SALES_CHANNELS.map((ch) => {
                  const isSelected = formData.salesChannels.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      onClick={() => toggleSalesChannel(ch.id)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative select-none ${
                        isSelected
                          ? `${ch.color} shadow-xs scale-[1.01]`
                          : 'border-slate-200 bg-white hover:border-slate-300 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{ch.icon}</span>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{ch.name}</div>
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">{ch.id}</span>
                          </div>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-red-600 text-white' : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{ch.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </AdminCard>
        )}

        {/* ========================================================= */}
        {/* TAB 3: QUẢN LÝ TÙY CHỌN & TOPPING (INLINE BUILDER) */}
        {/* ========================================================= */}
        {activeTab === 'options' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Nhóm Tùy Chọn & Topping của Món</h3>
                <p className="text-xs text-slate-500">
                  Thiết lập các nhóm tùy chọn (Size, Mức đường, Đá, Topping thêm...) khách hàng có thể chọn khi đặt món
                </p>
              </div>
              <button
                type="button"
                onClick={addOptionGroup}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
              >
                <Plus size={15} />
                <span>Thêm nhóm tùy chọn mới</span>
              </button>
            </div>

            {optionGroups.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700 mb-1">Món ăn này chưa có nhóm tùy chọn nào</h4>
                <p className="text-xs text-slate-400 mb-4">
                  Thêm các nhóm như "Chọn Size", "Lượng cơm", "Mức đường", "Topping thêm" để tăng giá trị đơn hàng
                </p>
                <button
                  type="button"
                  onClick={addOptionGroup}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  + Thêm nhóm đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {optionGroups.map((group, gIdx) => (
                  <div key={gIdx} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    {/* Group Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs font-bold">
                          {gIdx + 1}
                        </span>
                        <input
                          value={group.name}
                          onChange={(e) => updateOptionGroup(gIdx, { name: e.target.value })}
                          className="text-sm font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-red-500 outline-none pb-0.5 max-w-sm"
                          placeholder="Tên nhóm (VD: Chọn Size, Mức đường, Topping)..."
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={group.isRequired}
                            onChange={(e) => updateOptionGroup(gIdx, { isRequired: e.target.checked })}
                            className="w-4 h-4 text-red-600 rounded"
                          />
                          <span>Bắt buộc chọn</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={group.multipleChoice}
                            onChange={(e) => updateOptionGroup(gIdx, { multipleChoice: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>Chọn nhiều</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => removeOptionGroup(gIdx)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-2"
                          title="Xóa nhóm này"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Group Settings Min / Max */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Chọn tối thiểu (Min)</label>
                        <input
                          type="number"
                          min="0"
                          value={group.minSelect}
                          onChange={(e) => updateOptionGroup(gIdx, { minSelect: Number(e.target.value) })}
                          className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Chọn tối đa (Max)</label>
                        <input
                          type="number"
                          min="1"
                          value={group.maxSelect}
                          onChange={(e) => updateOptionGroup(gIdx, { maxSelect: Number(e.target.value) })}
                          className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Thứ tự nhóm</label>
                        <input
                          type="number"
                          value={group.displayOrder}
                          onChange={(e) => updateOptionGroup(gIdx, { displayOrder: Number(e.target.value) })}
                          className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-lg"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => addOptionItem(gIdx)}
                          className="w-full h-8 flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Plus size={13} />
                          <span>Thêm lựa chọn con</span>
                        </button>
                      </div>
                    </div>

                    {/* Items Table / List */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-3 text-[11px] font-bold text-slate-400 uppercase">
                        <div className="col-span-5 sm:col-span-4">Tên lựa chọn con (*)</div>
                        <div className="col-span-3 sm:col-span-3">Giá cộng thêm (VNĐ)</div>
                        <div className="col-span-2 sm:col-span-2 text-center">Mặc định</div>
                        <div className="col-span-2 sm:col-span-2 text-center">Còn hàng</div>
                        <div className="col-span-1 text-center">Xóa</div>
                      </div>

                      {group.items.map((item, iIdx) => (
                        <div key={iIdx} className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50/60 border border-slate-100">
                          <div className="col-span-5 sm:col-span-4">
                            <input
                              required
                              value={item.name}
                              onChange={(e) => updateOptionItem(gIdx, iIdx, { name: e.target.value })}
                              className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-semibold"
                              placeholder="VD: Size L, 50% Đường, Trân châu..."
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-3">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={item.priceAdjustment}
                              onChange={(e) => updateOptionItem(gIdx, iIdx, { priceAdjustment: Number(e.target.value) })}
                              className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-lg font-bold text-red-600"
                              placeholder="+0đ"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-2 flex justify-center">
                            <input
                              type="checkbox"
                              checked={item.isDefault}
                              onChange={(e) => updateOptionItem(gIdx, iIdx, { isDefault: e.target.checked })}
                              className="w-4 h-4 text-emerald-600 rounded"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-2 flex justify-center">
                            <input
                              type="checkbox"
                              checked={item.available}
                              onChange={(e) => updateOptionItem(gIdx, iIdx, { available: e.target.checked })}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button
                              type="button"
                              onClick={() => removeOptionItem(gIdx, iIdx)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TÍCH ĐIỂM & ĐỔI QUÀ (LOYALTY SYSTEM) */}
        {/* ========================================================= */}
        {activeTab === 'loyalty' && (
          <AdminCard
            title="Cơ Chế Tích Điểm & Chi Nhánh Đổi Điểm"
            subtitle="Cho phép khách hàng sử dụng điểm tích lũy để đổi lấy món ăn này và chỉ định các chi nhánh được phép áp dụng"
          >
            <div className="space-y-6">
              <label className="flex items-center justify-between p-4 rounded-2xl border border-amber-200 bg-amber-50/40 cursor-pointer">
                <div>
                  <div className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <Gift className="text-amber-600" size={18} />
                    <span>Cho phép đổi món bằng điểm thưởng (Redeem with Points)</span>
                  </div>
                  <div className="text-xs text-amber-800/80 mt-0.5">
                    Khi bật, món này sẽ xuất hiện trong danh mục "Đổi Thưởng" tại Web/App và màn hình POS tại quầy
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isRedeemable}
                  onChange={(e) => setFormData({ ...formData, isRedeemable: e.target.checked })}
                  className="w-5 h-5 text-amber-600 rounded"
                />
              </label>

              {formData.isRedeemable && (
                <div className="space-y-5 p-5 bg-white rounded-2xl border border-slate-200">
                  <div className="max-w-xs">
                    <FormField label="Số điểm thưởng cần để đổi món (*)" required>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.redemptionPoints || ''}
                          onChange={(e) => setFormData({ ...formData, redemptionPoints: Number(e.target.value) })}
                          className="w-full h-10 px-3.5 pr-14 text-sm font-black text-amber-700 bg-amber-50/20 border border-amber-200 rounded-xl outline-none focus:border-amber-500"
                          placeholder="VD: 150"
                        />
                        <span className="absolute right-3.5 top-2.5 text-xs font-bold text-amber-600">điểm</span>
                      </div>
                    </FormField>
                  </div>

                  {/* Chi nhánh cho phép đổi */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-800">
                      Chi nhánh áp dụng cơ chế đổi điểm:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors ${
                        formData.redeemAllBranches ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="redeemBranchesRadio"
                          checked={formData.redeemAllBranches}
                          onChange={() => setFormData({ ...formData, redeemAllBranches: true })}
                          className="text-amber-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800">Áp dụng tại TẤT CẢ chi nhánh</div>
                          <div className="text-[11px] text-slate-500">Khách có thể đổi món này ở bất kỳ chi nhánh nào</div>
                        </div>
                      </label>

                      <label className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors ${
                        !formData.redeemAllBranches ? 'border-amber-500 bg-amber-50/30' : 'border-slate-200'
                      }`}>
                        <input
                          type="radio"
                          name="redeemBranchesRadio"
                          checked={!formData.redeemAllBranches}
                          onChange={() => setFormData({ ...formData, redeemAllBranches: false })}
                          className="text-amber-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-800">Chỉ định chi nhánh cụ thể</div>
                          <div className="text-[11px] text-slate-500">Chỉ cho phép đổi điểm tại các cơ sở được chọn dưới đây</div>
                        </div>
                      </label>
                    </div>

                    {!formData.redeemAllBranches && (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Chọn các chi nhánh được phép đổi điểm:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {availableBranches.map((branch) => {
                            const isChecked = formData.redeemableBranchIds.includes(branch.id);
                            return (
                              <label
                                key={branch.id}
                                className={`p-2.5 rounded-lg border text-xs font-medium cursor-pointer flex items-center gap-2 ${
                                  isChecked ? 'bg-white border-amber-400 font-bold text-amber-900 shadow-2xs' : 'border-slate-200 text-slate-600'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      redeemableBranchIds: e.target.checked
                                        ? [...prev.redeemableBranchIds, branch.id]
                                        : prev.redeemableBranchIds.filter((id) => id !== branch.id),
                                    }));
                                  }}
                                  className="w-4 h-4 text-amber-600 rounded"
                                />
                                <span className="truncate">{branch.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AdminCard>
        )}

        {/* ========================================================= */}
        {/* TAB 5: VIDEO & THƯ VIỆN ẢNH PHỤ (MEDIA STUDIO) */}
        {/* ========================================================= */}
        {activeTab === 'media' && (
          <div className="space-y-6">
            {/* Link Video Review */}
            <AdminCard title="Link Video Review món ăn" subtitle="Nhúng video trải nghiệm, review TikTok, YouTube Shorts, Reels...">
              <div className="space-y-4">
                <FormField label="URL Video Review (Tùy chọn)" hint="Hỗ trợ liên kết YouTube, TikTok, Facebook Reels...">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                      className="w-full h-10 px-3.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500"
                      placeholder="https://www.youtube.com/watch?v=... hoặc https://www.tiktok.com/@avora/video/..."
                    />
                    {formData.videoUrl && (
                      <a
                        href={formData.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <ExternalLink size={14} />
                        <span>Mở</span>
                      </a>
                    )}
                  </div>
                </FormField>

                {/* Preview Video nếu là YouTube */}
                {youtubeVideoId ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye size={14} className="text-red-600" />
                      <span>Xem trước video YouTube:</span>
                    </span>
                    <div className="aspect-video max-w-md rounded-xl overflow-hidden shadow-xs border border-slate-200">
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                        title="Video review"
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                ) : formData.videoUrl ? (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
                    <span>Đã nhận diện liên kết video review. Khách hàng sẽ thấy nút "Xem Video Review" trên thực đơn.</span>
                  </div>
                ) : null}
              </div>
            </AdminCard>

            {/* Thư viện Ảnh phụ (Multi-image upload) */}
            <AdminCard title="Thư viện Ảnh phụ (Gallery)" subtitle="Đăng tải thêm nhiều góc chụp, topping, hình ảnh thực tế của món ăn">
              <div className="space-y-4">
                {/* Upload Box */}
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-red-400 bg-slate-50/50 transition-colors text-center">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <label className="cursor-pointer">
                    <span className="inline-block px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors mb-1">
                      {uploadingGallery ? 'Đang tải ảnh...' : 'Chọn nhiều ảnh từ máy tính'}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={uploadingGallery}
                      onChange={handleMultipleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400 mt-1">
                    💡 <strong>Mẹo:</strong> Giữ phím <strong>Ctrl</strong> (hoặc <strong>Cmd</strong> trên Mac) để chọn nhiều ảnh cùng lúc.
                  </p>
                </div>

                {/* Danh sách ảnh phụ đã tải */}
                {formData.secondaryImages.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                      <span>Danh sách ảnh phụ ({formData.secondaryImages.length} ảnh):</span>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, secondaryImages: [] }))}
                        className="text-red-600 hover:underline text-[11px]"
                      >
                        Xóa tất cả
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {formData.secondaryImages.map((imgUrl, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 shadow-2xs">
                          <img src={imgUrl} alt={`Ảnh phụ ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSecondaryImage(idx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Xóa ảnh này"
                          >
                            <X size={12} />
                          </button>
                          <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AdminCard>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: TRẠM IN & LOẠI MÁY IN GỬI ĐẾN (PRINTER ROUTING) */}
        {/* ========================================================= */}
        {activeTab === 'printers' && (
          <AdminCard
            title="Định Tuyến & Loại Máy In Món Gửi Đến"
            subtitle="Thiết lập lệnh in tự động gửi món ăn tới đúng máy in chuyên biệt (Bếp, Bar, Tem nhãn, Hóa đơn) khi tạo đơn hàng"
          >
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Hệ thống hỗ trợ 5 loại máy in: <strong>KITCHEN</strong> (Bếp), <strong>BAR</strong> (Pha chế),{' '}
                  <strong>ITEM_LABEL</strong> (In tem dán ly), <strong>RECEIPT</strong> (Hóa đơn thu ngân) và{' '}
                  <strong>TEMP_BILL</strong> (Tạm tính). Khi bật, hệ thống sẽ tự động in phiếu khi order có món này.
                </span>
              </div>

              <div className="space-y-3">
                {PRINTER_TYPES.map((pt) => {
                  const cfg = printersConfig[pt.type] || { enabled: false, stationId: '', copies: 1 };
                  return (
                    <div
                      key={pt.type}
                      className={`p-4 rounded-2xl border transition-all ${
                        cfg.enabled
                          ? 'border-red-400 bg-red-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-0.5">{pt.icon}</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                              <span>{pt.name}</span>
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-black bg-slate-100 text-slate-700">
                                {pt.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{pt.desc}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end sm:self-center">
                          {cfg.enabled && (
                            <div className="flex items-center gap-2">
                              {kitchenStations.length > 0 && (
                                <select
                                  value={cfg.stationId}
                                  onChange={(e) => {
                                    const stId = e.target.value;
                                    setPrintersConfig((prev) => ({
                                      ...prev,
                                      [pt.type]: { ...prev[pt.type], stationId: stId },
                                    }));
                                  }}
                                  className="h-8 px-2 text-[11px] font-semibold bg-white border border-slate-200 rounded-lg outline-none"
                                >
                                  <option value="">Trạm mặc định</option>
                                  {kitchenStations.map((st) => (
                                    <option key={st.id} value={st.id}>
                                      {st.name} ({st.code})
                                    </option>
                                  ))}
                                </select>
                              )}

                              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                                <span className="text-[11px] text-slate-400">Số liên:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="5"
                                  value={cfg.copies}
                                  onChange={(e) => {
                                    const c = Math.max(1, Number(e.target.value));
                                    setPrintersConfig((prev) => ({
                                      ...prev,
                                      [pt.type]: { ...prev[pt.type], copies: c },
                                    }));
                                  }}
                                  className="w-12 h-8 px-2 text-center text-xs font-bold bg-white border border-slate-200 rounded-lg"
                                />
                              </div>
                            </div>
                          )}

                          <input
                            type="checkbox"
                            checked={cfg.enabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPrintersConfig((prev) => ({
                                ...prev,
                                [pt.type]: { ...prev[pt.type], enabled: checked },
                              }));
                            }}
                            className="w-5 h-5 text-red-600 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AdminCard>
        )}

        {/* ========================================================= */}
        {/* TAB 7: CHI NHÁNH PHỤC VỤ (BRANCHES) */}
        {/* ========================================================= */}
        {activeTab === 'branches' && (
          <AdminCard
            title="Chi Nhánh Phân Phối Món Ăn"
            subtitle="Chọn các cơ sở nhà hàng mở bán món này trong thực đơn"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs text-slate-500 font-medium">
                  Đã áp dụng: <strong className="text-red-600">{formData.branchIds.length} / {availableBranches.length}</strong> chi nhánh
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, branchIds: availableBranches.map((b) => b.id) }))}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, branchIds: [] }))}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold rounded-lg transition-colors"
                  >
                    Bỏ chọn hết
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {availableBranches.map((b) => {
                  const isChecked = formData.branchIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors ${
                        isChecked
                          ? 'border-red-400 bg-red-50/20 text-slate-900 shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Store size={18} className={isChecked ? 'text-red-600' : 'text-slate-400'} />
                        <div>
                          <div className="text-xs font-bold">{b.name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{b.branchCode || 'BRANCH'}</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setFormData((prev) => ({
                            ...prev,
                            branchIds: e.target.checked
                              ? [...prev.branchIds, b.id]
                              : prev.branchIds.filter((id) => id !== b.id),
                          }));
                        }}
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </AdminCard>
        )}
      </form>

      {/* Modal Thêm nhanh danh mục */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Thêm danh mục mới"
        maxWidth="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreateCategory}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 shadow-sm"
            >
              Thêm danh mục
            </button>
          </>
        }
      >
        <FormField label="Tên danh mục" required>
          <input
            required
            autoFocus
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            placeholder="VD: Món Nóng, Đồ Uống..."
          />
        </FormField>
      </Modal>
    </div>
  );
}
