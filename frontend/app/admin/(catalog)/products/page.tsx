'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  Edit2,
  Power,
  PowerOff,
  Plus,
  Trash2,
  Store,
  ChefHat,
  RotateCw,
  FileSpreadsheet,
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileUp,
  Video,
  Images,
  Layers,
  Award,
  Printer,
  ShoppingBag,
  Globe,
  Play,
  Sparkles,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  Select,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Pagination,
  ConfirmDialog,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';

interface Product {
  id: string;
  itemCode: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  available: boolean;
  imageUrl?: string;
  secondaryImages?: string[] | null;
  videoUrl?: string | null;
  salesChannels?: string[] | null;
  allowPointExchange?: boolean;
  pointsRequired?: number | null;
  redeemAllBranches?: boolean;
  redeemableBranches?: { id: string; name: string; branchCode?: string }[];
  optionGroups?: {
    id: string;
    name: string;
    isRequired?: boolean;
    multipleChoice?: boolean;
    optionItems?: {
      id: string;
      name: string;
      priceAdjustment: number;
      isDefault: boolean;
      available: boolean;
    }[];
  }[];
  printRoutes?: {
    id: string;
    printType: string;
    routeRole?: string;
    copies?: number;
    isActive?: boolean;
    station?: { id: string; name: string } | null;
    branch?: { id: string; name: string } | null;
  }[];
  isRedeemable?: boolean;
  redemptionPoints?: number | null;
  oldPrice?: number | null;
  category?: { id?: string; name: string };
  categoryId?: string;
  branches: { id: string; name: string }[];
}

interface Meta {
  total: number;
  totalPages: number;
  page: number;
}

interface Category {
  id: string;
  name: string;
  _count?: {
    products: number;
  };
}

export default function AdminProductsPage() {
  const { selectedBranchId, role, can } = useAdmin();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);

  // Dialog State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Permissions
  const canExport = role === 'ADMIN' || can('products.export');
  const canImport = role === 'ADMIN' || can('products.import');
  const canCreate = role === 'ADMIN' || can('products.create');

  // Export / Import states
  const [exporting, setExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'UPSERT' | 'REPLACE'>('UPSERT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/categories', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams: Record<string, any> = {
        page,
        limit: 12,
      };

      if (selectedBranchId && selectedBranchId !== 'ALL') {
        queryParams.branchId = selectedBranchId;
      }
      if (search) queryParams.search = search;
      if (categoryId) queryParams.categoryId = categoryId;
      if (status) queryParams.status = status;
      if (channel) queryParams.channel = channel;

      const url = buildApiUrl('/api/admin/products', queryParams);
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        if (json.meta) setMeta(json.meta);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, search, categoryId, status, channel, page]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleAvailability = async (productId: string) => {
    if (role !== 'MANAGER') {
      toast.error('Chỉ Quản lý chi nhánh mới có quyền bật/tắt món tại chi nhánh.');
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${productId}/toggle-branch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Cập nhật trạng thái thành công');
        fetchProducts();
      } else {
        toast.error('Lỗi khi cập nhật trạng thái');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${deleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa món ăn thành công');
        setDeleteId(null);
        fetchProducts();
      } else {
        toast.error('Không thể xóa món ăn');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!canExport) {
      toast.error('Bạn không có quyền xuất dữ liệu món ăn!');
      return;
    }
    setExporting(true);
    try {
      const res = await fetch('/api/admin/products/export/excel', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 403) {
          toast.error('Bạn không có quyền thực hiện thao tác này!');
        } else {
          toast.error('Không thể xuất dữ liệu món ăn');
        }
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_Menu_Full_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Xuất file Excel món ăn thành công!');
    } catch (e) {
      toast.error('Lỗi kết nối khi tải file Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/admin/products/export/template', {
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Không thể tải file mẫu');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_Menu_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Đã tải xuống file mẫu Excel!');
    } catch (e) {
      toast.error('Lỗi khi tải file mẫu');
    }
  };

  const handleExecuteImport = async () => {
    if (!canImport) {
      toast.error('Bạn không có quyền nhập dữ liệu món ăn!');
      return;
    }
    if (!selectedFile) {
      toast.error('Vui lòng chọn một file Excel (.xlsx) để tải lên!');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`/api/admin/products/import/excel?mode=${importMode}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setImportResult(json.data);
        toast.success(json.message || 'Nhập dữ liệu thành công!');
        fetchProducts();
      } else {
        toast.error(json.message || json.error?.message || 'Có lỗi xảy ra khi nhập dữ liệu');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi tải file lên máy chủ');
    } finally {
      setImporting(false);
    }
  };

  const resetImportModal = () => {
    setSelectedFile(null);
    setImportResult(null);
    setIsImportModalOpen(false);
  };

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const CHANNEL_MAP: Record<string, { label: string; short: string; bg: string; text: string; border: string }> = {
    DINE_IN: { label: 'Ăn tại bàn', short: 'Bàn', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    TAKEAWAY: { label: 'Mang về', short: 'Mang về', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    ONLINE_DELIVERY: { label: 'Khách đặt Online', short: 'Online', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    GRAB_FOOD: { label: 'GrabFood', short: 'Grab', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    SHOPEE_FOOD: { label: 'ShopeeFood', short: 'Shopee', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    QR_ORDER: { label: 'QR Order', short: 'QR', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  };

  const PRINTER_MAP: Record<string, { label: string; color: string }> = {
    KITCHEN: { label: 'Bếp nóng', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    KITCHEN_TICKET: { label: 'Bếp nóng', color: 'bg-amber-50 text-amber-800 border-amber-200' },
    BAR: { label: 'Quầy Bar', color: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
    RECEIPT: { label: 'Hóa đơn', color: 'bg-slate-50 text-slate-700 border-slate-200' },
    TEMP_BILL: { label: 'Tạm tính', color: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
    ITEM_LABEL: { label: 'Tem ly', color: 'bg-rose-50 text-rose-800 border-rose-200' },
  };

  const columns = [
    {
      key: 'product',
      header: t('table.dishName', 'Tên món ăn & Media'),
      render: (product: Product) => (
        <div className="flex items-start gap-3">
          <div className="relative w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center group">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <ChefHat size={22} className="text-slate-400" />
            )}
            {/* Media Badges */}
            <div className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5">
              {product.videoUrl && (
                <span className="w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs" title="Có video review">
                  <Play size={7} className="fill-white translate-x-[0.5px]" />
                </span>
              )}
              {Array.isArray(product.secondaryImages) && product.secondaryImages.length > 0 && (
                <span className="h-3.5 px-1 rounded-full bg-slate-900/80 text-white text-[8px] font-bold flex items-center justify-center shadow-xs" title={`${product.secondaryImages.length} ảnh phụ`}>
                  +{product.secondaryImages.length}
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-xs sm:text-sm text-slate-900 truncate hover:text-red-600 transition-colors">
              {product.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                #{product.itemCode || product.id.slice(0, 6).toUpperCase()}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                {product.category?.name || 'Chưa phân loại'}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: t('table.price', 'Giá bán'),
      align: 'right' as const,
      render: (product: Product) => (
        <div className="text-right">
          <p className="font-black text-xs sm:text-sm text-red-600">
            {formatMoney(product.price)}
          </p>
          {product.originalPrice && product.originalPrice > product.price && (
            <p className="text-[10px] text-slate-400 line-through">
              {formatMoney(product.originalPrice)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'channels',
      header: 'Kênh bán hàng',
      render: (product: Product) => {
        const channels = Array.isArray(product.salesChannels) && product.salesChannels.length > 0
          ? product.salesChannels
          : ['DINE_IN', 'TAKEAWAY', 'ONLINE_DELIVERY', 'GRAB_FOOD', 'SHOPEE_FOOD', 'QR_ORDER'];
        const isAll = channels.length === 6;

        if (isAll) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Globe size={11} />
              <span>Toàn bộ 6 kênh</span>
            </span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1 max-w-[170px]">
            {channels.map((ch) => {
              const meta = CHANNEL_MAP[ch] || { short: ch, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
              return (
                <span
                  key={ch}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${meta.bg} ${meta.text} ${meta.border}`}
                >
                  {meta.short}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'optionsLoyalty',
      header: 'Topping & Điểm thưởng',
      render: (product: Product) => {
        const groupsCount = product.optionGroups?.length || 0;
        const totalItems = (product.optionGroups || []).reduce(
          (acc, g) => acc + (g.optionItems?.length || 0),
          0
        );

        return (
          <div className="space-y-1">
            {groupsCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                <Layers size={11} />
                <span>{groupsCount} nhóm ({totalItems} món)</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Không topping</span>
            )}

            {(product.allowPointExchange || product.isRedeemable) ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/80">
                <Award size={11} className="text-amber-600" />
                <span>{((product.pointsRequired ?? product.redemptionPoints) || 0).toLocaleString('vi-VN')} điểm</span>
                <span className="text-[9px] text-slate-500 font-normal">
                  ({product.redeemAllBranches ? 'Mọi CN' : `${product.redeemableBranches?.length || 0} CN`})
                </span>
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'printers',
      header: 'Loại máy in gửi đến',
      render: (product: Product) => {
        const routes = product.printRoutes || [];
        if (routes.length === 0) {
          return (
            <span className="text-[10px] text-slate-400 italic">
              Theo danh mục
            </span>
          );
        }

        const uniqueTypes = Array.from(new Set(routes.map((r) => r.printType)));

        return (
          <div className="flex flex-wrap gap-1 max-w-[160px]">
            {uniqueTypes.map((type) => {
              const meta = PRINTER_MAP[type] || { label: type, color: 'bg-slate-50 text-slate-700 border-slate-200' };
              return (
                <span
                  key={type}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${meta.color}`}
                >
                  <Printer size={9} />
                  <span>{meta.label}</span>
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'availability',
      header: t('table.status', 'Trạng thái'),
      align: 'center' as const,
      render: (product: Product) => {
        if (selectedBranchId === 'ALL' || !selectedBranchId) {
          return (
            <div className="flex flex-wrap gap-1 max-w-[180px] justify-center">
              {product.branches?.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">Toàn bộ chi nhánh</span>
              ) : (
                product.branches?.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100"
                  >
                    <Store size={10} />
                    <span>{b.name}</span>
                  </span>
                ))
              )}
            </div>
          );
        }

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleAvailability(product.id);
            }}
            disabled={role !== 'MANAGER'}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
              product.available
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            {product.available ? <Power size={13} /> : <PowerOff size={13} />}
            <span>{product.available ? 'Đang bán' : 'Tạm ngưng'}</span>
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: t('table.action', 'Thao tác'),
      align: 'right' as const,
      render: (product: Product) => (
        <div className="flex items-center justify-end gap-1">
          {role === 'ADMIN' && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/admin/products/${product.id}/edit`);
                }}
                aria-label={t('common.edit', 'Chỉnh sửa món ăn')}
                className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Sửa món & tùy chọn"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(product.id);
                }}
                aria-label={t('common.delete', 'Xóa món ăn')}
                className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Xóa món ăn"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('products.title', 'Quản lý Món ăn')}
        subtitle={t('products.subtitle', 'Danh sách món ăn, máy in chế biến, kênh bán hàng, tùy chọn topping và cơ chế đổi điểm')}
        breadcrumbs={[
          { label: t('nav.sales', 'Bán hàng') },
          { label: t('nav.products', 'Món ăn') },
        ]}
        badge={
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            {t('common.total', 'Tổng')} {meta.total} {t('common.results', 'món')}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={fetchProducts}
              aria-label={t('common.refresh', 'Làm mới')}
              className="flex items-center gap-1 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Làm mới')}</span>
            </button>

            {canExport && (
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting}
                className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {exporting ? (
                  <RotateCw size={14} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
              </button>
            )}

            {canImport && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setImportResult(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Upload size={14} />
                <span>Nhập Excel</span>
              </button>
            )}

            {canCreate && (
              <button
                type="button"
                onClick={() => router.push('/admin/products/create')}
                className="flex items-center gap-1.5 min-h-[38px] px-3 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>{t('common.add', 'Thêm món mới')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Mini Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-4 shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ChefHat size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Tổng số món ăn</p>
            <p className="text-sm sm:text-base md:text-lg font-black text-slate-900">{meta.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-4 shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Đang mở bán</p>
            <p className="text-sm sm:text-base md:text-lg font-black text-emerald-600">
              {products.filter((p) => p.available).length}{' '}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-400">/ {products.length}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-4 shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Globe size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Bán Online</p>
            <p className="text-sm sm:text-base md:text-lg font-black text-blue-600">
              {products.filter((p) => !p.salesChannels || p.salesChannels.includes('ONLINE_DELIVERY')).length}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-400"> món</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-2.5 sm:p-4 shadow-2xs flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">Đổi điểm</p>
            <p className="text-sm sm:text-base md:text-lg font-black text-amber-600">
              {products.filter((p) => p.allowPointExchange || p.isRedeemable).length}
              <span className="text-[10px] sm:text-[11px] font-normal text-slate-400"> món</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        actions={
          (search || categoryId || status || channel) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryId('');
                setStatus('');
                setChannel('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              {t('common.clearFilter', 'Xóa bộ lọc')}
            </button>
          )
        }
      >
        <div className="w-full sm:w-64">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder={t('common.search', 'Tìm kiếm tên món, mã món...')}
          />
        </div>

        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-red-500 shadow-2xs"
        >
          <option value="">{t('common.all', 'Tất cả danh mục')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c._count?.products || 0})
            </option>
          ))}
        </select>

        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-red-500 shadow-2xs"
        >
          <option value="">Tất cả kênh bán hàng (6 kênh)</option>
          <option value="DINE_IN">🍽️ Ăn tại bàn (Dine-in)</option>
          <option value="TAKEAWAY">🛍️ Mang về (Takeaway)</option>
          <option value="ONLINE_DELIVERY">🌐 Khách đặt Online</option>
          <option value="GRAB_FOOD">🛵 GrabFood</option>
          <option value="SHOPEE_FOOD">🥡 ShopeeFood</option>
          <option value="QR_ORDER">📱 QR Order tại bàn</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-red-500 shadow-2xs"
        >
          <option value="">{t('common.all', 'Tất cả trạng thái')}</option>
          <option value="available">{t('common.active', 'Đang bán')}</option>
          <option value="unavailable">{t('common.inactive', 'Tạm ngưng')}</option>
        </select>
      </FilterBar>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={products}
        keyExtractor={(p) => p.id}
        loading={loading}
        onRowClick={(p) => {
          if (role === 'ADMIN') router.push(`/admin/products/${p.id}/edit`);
        }}
        emptyTitle={t('common.noData', 'Không tìm thấy món ăn nào')}
        emptyDescription="Thử tìm kiếm với từ khóa khác hoặc xóa bớt bộ lọc."
        mobileCardRender={(product) => {
          const channels = Array.isArray(product.salesChannels) && product.salesChannels.length > 0
            ? product.salesChannels
            : ['DINE_IN', 'TAKEAWAY', 'ONLINE_DELIVERY', 'GRAB_FOOD', 'SHOPEE_FOOD', 'QR_ORDER'];

          return (
            <MobileDataCard
              title={product.name}
              subtitle={`#${product.itemCode || product.id.slice(0, 6)}`}
              badge={
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {product.category?.name || 'Món ăn'}
                </span>
              }
              details={[
                {
                  label: t('table.price', 'Giá bán'),
                  value: (
                    <div>
                      <strong className="text-red-600">{formatMoney(product.price)}</strong>
                      {(product.oldPrice || product.originalPrice) && (product.oldPrice || product.originalPrice)! > product.price && (
                        <span className="ml-1 text-[10px] text-slate-400 line-through">
                          {formatMoney(product.oldPrice || product.originalPrice!)}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  label: 'Kênh bán',
                  value: channels.length === 6 ? 'Toàn bộ 6 kênh' : `${channels.length} kênh`,
                },
                {
                  label: 'Topping & Điểm',
                  value: (
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-medium text-slate-700">
                        {product.optionGroups?.length || 0} nhóm tùy chọn
                      </p>
                      {(product.allowPointExchange || product.isRedeemable) && (
                        <p className="text-[10px] font-bold text-amber-600">
                          ⭐ {((product.pointsRequired ?? product.redemptionPoints) || 0).toLocaleString('vi-VN')} điểm
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  label: t('table.status', 'Trạng thái'),
                  value: product.available ? 'Đang bán' : 'Tạm ngưng',
                },
              ]}
              actions={
                role === 'ADMIN' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/products/${product.id}/edit`)}
                      className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
                    >
                      <Edit2 size={13} />
                      <span>{t('common.edit', 'Sửa')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(product.id)}
                      className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : undefined
              }
            />
          );
        }}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        pageSize={12}
        onPageChange={setPage}
        itemName={t('nav.products', 'món ăn')}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.delete', 'Xóa món ăn')}
        message="Bạn có chắc chắn muốn xóa món ăn này khỏi thực đơn? Hành động này không thể hoàn tác."
        confirmText={t('common.delete', 'Xác nhận xóa')}
        cancelText={t('common.cancel', 'Hủy')}
        variant="danger"
        loading={deleting}
      />

      {/* Modal Nhập Dữ Liệu Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-1.5 sm:p-4 overflow-y-auto">
          <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-xl w-full p-3.5 sm:p-6 my-4 sm:my-8 space-y-3 sm:space-y-4 max-h-[96vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-3.5">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Nhập dữ liệu Món ăn từ Excel</h3>
                  <p className="text-[10px] sm:text-xs text-slate-500">Cập nhật hoặc thêm mới danh mục, món, tùy chọn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetImportModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template download link & Quick Tips */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <HelpCircle size={16} className="text-blue-600 shrink-0" />
                  <span>Chưa có file mẫu chuẩn hoặc cần tham khảo quy tắc?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold shadow-2xs transition-colors shrink-0"
                >
                  <Download size={13} />
                  <span>Tải file mẫu (.xlsx)</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                💡 <strong>Mẹo:</strong> Bạn có thể cấu hình nhanh <strong>MÁY IN BẾP & CHẾ BIẾN KITCHEN</strong> và <strong>TEM_LABEL (IN TEM NHÃN)</strong> trực tiếp tại Sheet 1. Các cột logic (Trạng thái bán, Bán chạy, AI Gợi ý, Cho phép đổi điểm, In tem...) sử dụng <strong>TRUE</strong> hoặc <strong>FALSE</strong> để chỉnh sửa hàng loạt cực nhanh.
              </div>
            </div>

            {/* If import result is available, show results summary */}
            {importResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Xử lý nhập file hoàn tất!</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Món mới</span>
                      <span className="text-lg font-black text-emerald-700">{importResult.createdCount}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Cập nhật</span>
                      <span className="text-lg font-black text-blue-700">{importResult.updatedCount}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Nhóm Topping</span>
                      <span className="text-lg font-black text-purple-700">{importResult.optionGroupsSynced}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Trạm in Bếp/Bar</span>
                      <span className="text-lg font-black text-amber-700">{importResult.printRoutesSynced}</span>
                    </div>
                  </div>

                  {importResult.deactivatedCount > 0 && (
                    <p className="text-xs text-amber-700 italic">
                      * Đã tạm ngưng bán {importResult.deactivatedCount} món cũ do chọn chế độ ghi đè toàn bộ.
                    </p>
                  )}
                </div>

                {/* Warnings / Errors */}
                {importResult.warnings?.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 max-h-32 overflow-y-auto space-y-1">
                    <span className="font-bold flex items-center gap-1"><AlertCircle size={14} /> Cảnh báo ({importResult.warnings.length}):</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {importResult.warnings.map((w: string, idx: number) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importResult.errors?.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 max-h-32 overflow-y-auto space-y-1">
                    <span className="font-bold flex items-center gap-1"><AlertCircle size={14} /> Lỗi bỏ qua ({importResult.errors.length}):</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {importResult.errors.map((err: any, idx: number) => (
                        <li key={idx}>Dòng {err.row}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={resetImportModal}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    Đóng & Xem danh sách món ăn
                  </button>
                </div>
              </div>
            ) : (
              /* Upload Form */
              <div className="space-y-4">
                {/* File Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Chọn tệp Excel món ăn (.xlsx)
                  </label>
                  <label className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    selectedFile ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300 hover:border-red-400 bg-slate-50/50'
                  }`}>
                    <FileUp size={32} className={selectedFile ? 'text-emerald-600' : 'text-slate-400 mb-2'} />
                    {selectedFile ? (
                      <div className="text-center mt-2">
                        <span className="font-bold text-xs text-emerald-800 block truncate max-w-sm">{selectedFile.name}</span>
                        <span className="text-[11px] text-emerald-600">
                          {(selectedFile.size / 1024).toFixed(1)} KB - Nhấp để chọn lại
                        </span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="font-bold text-xs text-slate-700 block">Kéo thả tệp hoặc bấm vào đây để chọn</span>
                        <span className="text-[11px] text-slate-400">Hỗ trợ định dạng .xlsx, .xls (Tối đa 15MB)</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                      onChange={(e) => {
                        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Import Mode Selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Chế độ nhập dữ liệu</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                      importMode === 'UPSERT'
                        ? 'border-red-500 bg-red-50/40 text-red-950 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        value="UPSERT"
                        checked={importMode === 'UPSERT'}
                        onChange={() => setImportMode('UPSERT')}
                        className="mt-0.5 text-red-600"
                      />
                      <div className="text-xs">
                        <span className="font-bold block">Cập nhật & Thêm mới (UPSERT)</span>
                        <span className="text-[11px] text-slate-500">
                          Khuyên dùng. Cập nhật món trùng mã, thêm mới các món chưa có, giữ nguyên món khác.
                        </span>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                      importMode === 'REPLACE'
                        ? 'border-amber-500 bg-amber-50/40 text-amber-950 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        value="REPLACE"
                        checked={importMode === 'REPLACE'}
                        onChange={() => setImportMode('REPLACE')}
                        className="mt-0.5 text-amber-600"
                      />
                      <div className="text-xs">
                        <span className="font-bold block">Ghi đè & Tắt món cũ (REPLACE)</span>
                        <span className="text-[11px] text-slate-500">
                          Chuyển sang "Tạm ngưng bán" cho các món không nằm trong file tải lên.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={resetImportModal}
                    disabled={importing}
                    className="min-h-[40px] px-3.5 sm:px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={!selectedFile || importing}
                    className="min-h-[40px] flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {importing ? (
                      <>
                        <RotateCw size={14} className="animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        <span>Bắt đầu nhập dữ liệu</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
