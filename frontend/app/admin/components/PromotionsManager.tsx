'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  Ticket,
  Zap,
  Gift,
  Crown,
  Clock,
  Store,
  RotateCw,
} from 'lucide-react';
import ImageUploader from '@/app/admin/components/ImageUploader';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  Select,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Modal,
  ConfirmDialog,
  FormField,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';
import { toast } from 'react-hot-toast';

interface PromotionsManagerProps {
  activeTab: 'vouchers' | 'flash-sales' | 'combos';
}

export default function PromotionsManager({ activeTab }: PromotionsManagerProps) {
  const { role, selectedBranchId, availableBranches } = useAdmin();
  const { t, locale } = useLanguage();

  const [vouchers, setVouchers] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<any[]>([]);
  const [allPaymentMethods, setAllPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTierId, setFilterTierId] = useState('ALL');

  // Delete state
  const [deleteUrl, setDeleteUrl] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Voucher Form Modal
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [voucherData, setVoucherData] = useState({
    code: '',
    title: '',
    discountType: 'FIXED_AMOUNT',
    discountValue: 0,
    startDate: '',
    endDate: '',
    minOrderValue: 0,
    usageLimit: 0,
    imageUrl: '',
    branchIds: [] as string[],
    membershipTierIds: [] as string[],
    appliesToAllPaymentMethods: true,
    paymentMethodIds: [] as string[],
    isActive: true,
  });

  // Flash Sale Form Modal
  const [isFlashSaleModalOpen, setIsFlashSaleModalOpen] = useState(false);
  const [editingFlashSale, setEditingFlashSale] = useState<any>(null);
  const [fsData, setFsData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    status: 'DRAFT',
    imageUrl: '',
    branchIds: [] as string[],
    membershipTierIds: [] as string[],
    applyOnline: true,
    applyPos: true,
    isActive: true,
    items: [] as any[],
  });
  const [productSearchFS, setProductSearchFS] = useState('');
  const [productResultsFS, setProductResultsFS] = useState<any[]>([]);

  // Combo Form Modal
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<any>(null);
  const [comboData, setComboData] = useState({
    name: '',
    description: '',
    price: 0,
    originalPrice: 0,
    startDate: '',
    endDate: '',
    usageLimit: 0,
    imageUrl: '',
    branchIds: [] as string[],
    membershipTierIds: [] as string[],
    isActive: true,
    items: [] as any[],
  });
  const [productSearchCombo, setProductSearchCombo] = useState('');
  const [productResultsCombo, setProductResultsCombo] = useState<any[]>([]);
  const [comboDiscountType, setComboDiscountType] = useState<'NONE' | 'FIXED' | 'PERCENTAGE'>('NONE');
  const [comboDiscountValue, setComboDiscountValue] = useState(0);

  const fetchMembershipTiers = async () => {
    try {
      const res = await fetch('/api/admin/membership-tiers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMembershipTiers(data.data.filter((t: any) => t.isActive));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'vouchers') endpoint = '/api/admin/promotions/vouchers';
      else if (activeTab === 'flash-sales') endpoint = '/api/admin/promotions/flash-sales';
      else if (activeTab === 'combos') endpoint = '/api/admin/promotions/combos';

      const url = buildApiUrl(endpoint, {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        search,
        membershipTierId: filterTierId !== 'ALL' ? filterTierId : undefined,
      });

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (activeTab === 'vouchers') setVouchers(data.data || []);
        else if (activeTab === 'flash-sales') setFlashSales(data.data || []);
        else if (activeTab === 'combos') setCombos(data.data || []);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedBranchId, search, filterTierId]);

  useEffect(() => {
    fetchMembershipTiers();
    fetchData();

    async function loadPaymentMethods() {
      try {
        const res = await fetch('/api/payment-methods/admin/all', { credentials: 'include' });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAllPaymentMethods(json.data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadPaymentMethods();
  }, [fetchData]);

  // Search Products for Flash Sale
  const handleSearchProductsFS = async (term: string) => {
    setProductSearchFS(term);
    if (!term || term.length < 2) {
      setProductResultsFS([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(term)}&limit=8`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProductResultsFS(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Search Products for Combo
  const handleSearchProductsCombo = async (term: string) => {
    setProductSearchCombo(term);
    if (!term || term.length < 2) {
      setProductResultsCombo([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(term)}&limit=8`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setProductResultsCombo(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleActive = async (type: string, id: string, nextState: boolean) => {
    try {
      const res = await fetch(`/api/admin/promotions/${type}/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(t('common.saveChanges', 'Cập nhật trạng thái thành công'));
        fetchData();
      } else {
        toast.error('Lỗi khi cập nhật trạng thái');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const confirmDeleteAction = async () => {
    if (!deleteUrl) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(deleteUrl, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(t('common.delete', 'Đã xóa thành công'));
        setDeleteUrl(null);
        fetchData();
      } else {
        toast.error('Không thể xóa dữ liệu');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const submitForm = async (
    url: string,
    method: string,
    bodyData: any,
    onSuccess: () => void,
    typeText: string
  ) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(
          method === 'POST' ? `Tạo mới ${typeText} thành công` : `Cập nhật ${typeText} thành công`
        );
        onSuccess();
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Lỗi khi lưu thông tin');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  // Open Handlers
  const openVoucherModal = (item?: any) => {
    if (item) {
      setEditingVoucher(item);
      setVoucherData({
        code: item.code || '',
        title: item.title || '',
        discountType: item.discountType || 'FIXED_AMOUNT',
        discountValue: item.discountValue || 0,
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
        minOrderValue: item.minOrderValue || 0,
        usageLimit: item.usageLimit || 0,
        imageUrl: item.imageUrl || '',
        branchIds: item.branches ? item.branches.map((b: any) => b.id) : [],
        membershipTierIds: item.membershipTiers ? item.membershipTiers.map((t: any) => t.id) : [],
        appliesToAllPaymentMethods: item.appliesToAllPaymentMethods ?? true,
        paymentMethodIds: item.voucherPaymentMethods
          ? item.voucherPaymentMethods.map((vpm: any) => vpm.paymentMethodId)
          : [],
        isActive: item.isActive ?? true,
      });
    } else {
      setEditingVoucher(null);
      setVoucherData({
        code: '',
        title: '',
        discountType: 'FIXED_AMOUNT',
        discountValue: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        minOrderValue: 0,
        usageLimit: 0,
        imageUrl: '',
        branchIds: [],
        membershipTierIds: [],
        appliesToAllPaymentMethods: true,
        paymentMethodIds: [],
        isActive: true,
      });
    }
    setIsVoucherModalOpen(true);
  };

  const openFlashSaleModal = (item?: any) => {
    if (item) {
      setEditingFlashSale(item);
      setFsData({
        name: item.name || '',
        startTime: item.startTime ? item.startTime.substring(0, 16) : '',
        endTime: item.endTime ? item.endTime.substring(0, 16) : '',
        status: item.status || 'DRAFT',
        imageUrl: item.imageUrl || '',
        branchIds: item.branches ? item.branches.map((b: any) => b.id) : [],
        membershipTierIds: item.membershipTiers ? item.membershipTiers.map((t: any) => t.id) : [],
        applyOnline: item.applyOnline ?? true,
        applyPos: item.applyPos ?? true,
        isActive: item.isActive ?? true,
        items: item.items
          ? item.items.map((i: any) => ({
              productId: i.productId,
              product: i.product,
              flashSalePrice: i.flashSalePrice,
              stock: i.stock,
              maxQuantityPerUser: i.maxQuantityPerUser || 1,
            }))
          : [],
      });
    } else {
      setEditingFlashSale(null);
      const now = new Date();
      const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setFsData({
        name: '',
        startTime: now.toISOString().substring(0, 16),
        endTime: end.toISOString().substring(0, 16),
        status: 'DRAFT',
        imageUrl: '',
        branchIds: [],
        membershipTierIds: [],
        applyOnline: true,
        applyPos: true,
        isActive: true,
        items: [],
      });
    }
    setIsFlashSaleModalOpen(true);
  };

  const openComboModal = (item?: any) => {
    if (item) {
      setEditingCombo(item);
      setComboData({
        name: item.name || '',
        description: item.description || '',
        price: item.price || 0,
        originalPrice: item.originalPrice || 0,
        startDate: item.startDate ? item.startDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
        usageLimit: item.usageLimit || 0,
        imageUrl: item.imageUrl || '',
        branchIds: item.branches ? item.branches.map((b: any) => b.id) : [],
        membershipTierIds: item.membershipTiers ? item.membershipTiers.map((t: any) => t.id) : [],
        isActive: item.isActive ?? true,
        items: item.items
          ? item.items.map((i: any) => ({
              productId: i.productId,
              product: i.product,
              quantity: i.quantity,
            }))
          : [],
      });
    } else {
      setEditingCombo(null);
      setComboData({
        name: '',
        description: '',
        price: 0,
        originalPrice: 0,
        startDate: '',
        endDate: '',
        usageLimit: 0,
        imageUrl: '',
        branchIds: [],
        membershipTierIds: [],
        isActive: true,
        items: [],
      });
    }
    setComboDiscountType('NONE');
    setComboDiscountValue(0);
    setIsComboModalOpen(true);
  };

  const pageTitle =
    activeTab === 'vouchers'
      ? t('promotions.vouchersTitle', 'Quản lý Vouchers')
      : activeTab === 'flash-sales'
      ? t('promotions.flashSalesTitle', 'Quản lý Flash Sale')
      : t('promotions.combosTitle', 'Quản lý Combo món');

  const pageSubtitle =
    activeTab === 'vouchers'
      ? t('promotions.vouchersSubtitle', 'Cấu hình mã giảm giá, giới hạn đơn hàng và phân quyền hạng thành viên')
      : activeTab === 'flash-sales'
      ? t('promotions.flashSalesSubtitle', 'Khung giờ giảm giá sốc, giới hạn kho và số lượng theo thành viên')
      : t('promotions.combosSubtitle', 'Gói combo món ăn ưu đãi, tối ưu giá trị đơn hàng trung bình');

  const BranchSelectorPills = ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (val: string[]) => void;
  }) => {
    if (role !== 'ADMIN') return null;
    const isGlobal = !value || value.length === 0;

    const handleToggle = (id: string) => {
      if (id === '') {
        onChange([]);
      } else {
        const current = value || [];
        if (current.includes(id)) onChange(current.filter((v) => v !== id));
        else onChange([...current, id]);
      }
    };

    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700">
          {t('promotions.branchApply', 'Áp dụng cho Chi nhánh')}
        </label>
        <div className="flex flex-wrap gap-2">
          <label
            className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              isGlobal
                ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={isGlobal}
              onChange={() => handleToggle('')}
            />
            <Store size={13} />
            <span>{t('common.allBranches', 'Toàn hệ thống')}</span>
          </label>
          {availableBranches.map((b) => (
            <label
              key={b.id}
              className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                (value || []).includes(b.id)
                  ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={(value || []).includes(b.id)}
                onChange={() => handleToggle(b.id)}
              />
              <Store size={13} />
              <span>{b.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const MembershipTierSelectorPills = ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (val: string[]) => void;
  }) => {
    const isAll = !value || value.length === 0;

    const handleToggle = (id: string) => {
      if (id === '') {
        onChange([]);
      } else {
        const current = value || [];
        if (current.includes(id)) onChange(current.filter((v) => v !== id));
        else onChange([...current, id]);
      }
    };

    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-700">
          {t('promotions.tierApply', 'Hạng thành viên áp dụng')}
        </label>
        <div className="flex flex-wrap gap-2">
          <label
            className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              isAll
                ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
          >
            <input
              type="checkbox"
              className="hidden"
              checked={isAll}
              onChange={() => handleToggle('')}
            />
            <Crown size={13} />
            <span>{t('common.allTiers', 'Tất cả các hạng')}</span>
          </label>
          {membershipTiers.map((t) => (
            <label
              key={t.id}
              className={`cursor-pointer px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                (value || []).includes(t.id)
                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={(value || []).includes(t.id)}
                onChange={() => handleToggle(t.id)}
              />
              <Crown size={13} />
              <span>{t.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        breadcrumbs={[
          { label: t('nav.marketing', 'Marketing') },
          { label: pageTitle },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              aria-label={t('common.refresh', 'Làm mới')}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Làm mới')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'vouchers') openVoucherModal();
                else if (activeTab === 'flash-sales') openFlashSaleModal();
                else openComboModal();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus size={15} />
              <span>{t('common.create', 'Tạo mới')}</span>
            </button>
          </div>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        actions={
          (search || filterTierId !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterTierId('ALL');
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              {t('common.clearFilter', 'Xóa lọc')}
            </button>
          )
        }
      >
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('promotions.searchPlaceholder', 'Tìm kiếm chương trình...')}
          />
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={filterTierId}
            onChange={(e) => setFilterTierId(e.target.value)}
            options={[
              { value: 'ALL', label: t('promotions.allTiers', 'Tất cả hạng thành viên') },
              ...membershipTiers.map((t) => ({ value: t.id, label: `Hạng: ${t.name}` })),
            ]}
          />
        </div>
      </FilterBar>

      {/* Content Rendering Based on Active Tab */}
      {activeTab === 'vouchers' && (
        <DataTable
          data={vouchers}
          keyExtractor={(v) => v.id}
          loading={loading}
          onRowClick={(v) => openVoucherModal(v)}
          emptyTitle={t('common.noData', 'Chưa có voucher nào')}
          emptyDescription="Tạo mã voucher đầu tiên để bắt đầu thu hút khách hàng."
          columns={[
            {
              key: 'code',
              header: t('promotions.voucherCode', 'Mã Voucher'),
              render: (v) => (
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-red-50 text-red-600">
                    <Ticket size={16} />
                  </div>
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">{v.code}</span>
                    <p className="text-xs text-slate-400 truncate max-w-[180px]">{v.title}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'discount',
              header: t('promotions.discount', 'Mức giảm giá'),
              render: (v) => (
                <div>
                  <span className={`font-black text-sm ${v.discountType === 'FREE_SHIP' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {v.discountType === 'PERCENTAGE'
                      ? `Giảm ${v.discountValue}%`
                      : v.discountType === 'FREE_SHIP'
                      ? v.discountValue > 0
                        ? `Freeship tối đa ${formatMoney(v.discountValue)}`
                        : 'Miễn phí giao hàng 100%'
                      : `Giảm ${formatMoney(v.discountValue)}`}
                  </span>
                  {v.minOrderValue > 0 && (
                    <p className="text-[11px] text-slate-400">
                      Đơn tối thiểu: {formatMoney(v.minOrderValue)}
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: 'period',
              header: t('promotions.durationBranches', 'Thời gian & Chi nhánh'),
              render: (v) => (
                <div className="space-y-1">
                  <span className="text-xs text-slate-600 block">
                    {new Date(v.startDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')} -{' '}
                    {new Date(v.endDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {v.branches && v.branches.length > 0 ? (
                      v.branches.map((b: any) => (
                        <span
                          key={b.id}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700"
                        >
                          {b.name}
                        </span>
                      ))
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                        {t('common.allBranches', 'Toàn hệ thống')}
                      </span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'usage',
              header: t('promotions.usedLimit', 'Đã dùng / Giới hạn'),
              align: 'center',
              render: (v) => (
                <span className="font-bold text-xs text-slate-800">
                  {v.usedCount} {v.usageLimit ? `/ ${v.usageLimit}` : 'lượt'}
                </span>
              ),
            },
            {
              key: 'status',
              header: t('common.status', 'Trạng thái'),
              align: 'center',
              render: (v) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive('vouchers', v.id, !v.isActive);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    v.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {v.isActive ? <Power size={12} /> : <PowerOff size={12} />}
                  <span>{v.isActive ? t('common.running', 'Đang chạy') : t('common.paused', 'Tạm dừng')}</span>
                </button>
              ),
            },
            {
              key: 'actions',
              header: t('common.actions', 'Thao tác'),
              align: 'right',
              render: (v) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openVoucherModal(v);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteUrl(`/api/admin/promotions/vouchers/${v.id}`);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'flash-sales' && (
        <DataTable
          data={flashSales}
          keyExtractor={(fs) => fs.id}
          loading={loading}
          onRowClick={(fs) => openFlashSaleModal(fs)}
          emptyTitle={t('common.noData', 'Chưa có Flash Sale nào')}
          emptyDescription="Tạo khung giờ Flash Sale giảm giá sốc cho các món đặc sắc."
          columns={[
            {
              key: 'name',
              header: t('promotions.flashSaleCampaign', 'Chương trình Flash Sale'),
              render: (fs) => (
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <Zap size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{fs.name}</p>
                    <span className="text-xs text-slate-400">
                      {fs.items?.length || 0} {t('promotions.itemsApplied', 'món áp dụng')}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              key: 'time',
              header: t('promotions.eventDuration', 'Thời gian diễn ra'),
              render: (fs) => (
                <span className="text-xs text-slate-600 font-medium">
                  {new Date(fs.startTime).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')} -{' '}
                  {new Date(fs.endTime).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                </span>
              ),
            },
            {
              key: 'status',
              header: t('common.status', 'Trạng thái'),
              align: 'center',
              render: (fs) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive('flash-sales', fs.id, !fs.isActive);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    fs.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {fs.isActive ? <Power size={12} /> : <PowerOff size={12} />}
                  <span>{fs.isActive ? t('common.running', 'Đang chạy') : t('common.paused', 'Tạm dừng')}</span>
                </button>
              ),
            },
            {
              key: 'actions',
              header: t('common.actions', 'Thao tác'),
              align: 'right',
              render: (fs) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFlashSaleModal(fs);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteUrl(`/api/admin/promotions/flash-sales/${fs.id}`);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'combos' && (
        <DataTable
          data={combos}
          keyExtractor={(c) => c.id}
          loading={loading}
          onRowClick={(c) => openComboModal(c)}
          emptyTitle={t('common.noData', 'Chưa có combo món ăn nào')}
          emptyDescription="Tạo các combo món hấp dẫn để kích thích sức mua của khách hàng."
          columns={[
            {
              key: 'name',
              header: t('promotions.comboName', 'Tên Combo & Món'),
              render: (c) => (
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                    <Gift size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                    <span className="text-xs text-slate-400">
                      {c.items?.length || 0} {t('nav.products', 'món')}
                    </span>
                  </div>
                </div>
              ),
            },
            {
              key: 'price',
              header: t('promotions.priceSavings', 'Giá Combo'),
              align: 'right',
              render: (c) => (
                <span className="font-black text-red-600 text-sm">{formatMoney(c.price)}</span>
              ),
            },
            {
              key: 'status',
              header: t('common.status', 'Trạng thái'),
              align: 'center',
              render: (c) => (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleActive('combos', c.id, !c.isActive);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                    c.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {c.isActive ? <Power size={12} /> : <PowerOff size={12} />}
                  <span>{c.isActive ? t('common.active', 'Đang bán') : t('common.inactive', 'Tạm ngưng')}</span>
                </button>
              ),
            },
            {
              key: 'actions',
              header: t('common.actions', 'Thao tác'),
              align: 'right',
              render: (c) => (
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openComboModal(c);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteUrl(`/api/admin/promotions/combos/${c.id}`);
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {/* VOUCHER MODAL */}
      <Modal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        title={editingVoucher ? t('common.edit', 'Chỉnh sửa Voucher') : t('common.add', 'Tạo mới Voucher')}
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsVoucherModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t('common.cancel', 'Hủy')}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                const url = editingVoucher
                  ? `/api/admin/promotions/vouchers/${editingVoucher.id}`
                  : `/api/admin/promotions/vouchers`;
                submitForm(
                  url,
                  editingVoucher ? 'PATCH' : 'POST',
                  voucherData,
                  () => setIsVoucherModalOpen(false),
                  'Voucher'
                );
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              {t('common.saveChanges', 'Lưu Voucher')}
            </button>
          </>
        }
      >
        <div className="space-y-3.5">
          <BranchSelectorPills
            value={voucherData.branchIds}
            onChange={(v) => setVoucherData({ ...voucherData, branchIds: v })}
          />
          <MembershipTierSelectorPills
            value={voucherData.membershipTierIds}
            onChange={(v) => setVoucherData({ ...voucherData, membershipTierIds: v })}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mã Voucher (Code)" required>
              <input
                required
                value={voucherData.code}
                onChange={(e) =>
                  setVoucherData({ ...voucherData, code: e.target.value.toUpperCase() })
                }
                className="w-full h-10 px-3 font-mono font-bold uppercase border border-slate-200 rounded-xl outline-none"
                placeholder="VD: GIAM20K"
              />
            </FormField>
            <FormField label="Tiêu đề hiển thị" required>
              <input
                required
                value={voucherData.title}
                onChange={(e) => setVoucherData({ ...voucherData, title: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
                placeholder="VD: Giảm 20K đơn từ 100K"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Loại giảm giá">
              <select
                value={voucherData.discountType}
                onChange={(e) => setVoucherData({ ...voucherData, discountType: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
              >
                <option value="FIXED_AMOUNT">Giảm số tiền cố định (VNĐ)</option>
                <option value="PERCENTAGE">Giảm theo phần trăm (%)</option>
                <option value="FREE_SHIP">Miễn phí vận chuyển (FreeShip)</option>
              </select>
            </FormField>
            <FormField
              label={
                voucherData.discountType === 'FREE_SHIP'
                  ? 'Mức giảm phí ship (0 = 100%)'
                  : 'Giá trị giảm'
              }
              required
            >
              <input
                type="number"
                required
                value={voucherData.discountValue}
                onChange={(e) =>
                  setVoucherData({ ...voucherData, discountValue: Number(e.target.value) })
                }
                className={`w-full h-10 px-3 font-bold border border-slate-200 rounded-xl outline-none ${
                  voucherData.discountType === 'FREE_SHIP' ? 'text-emerald-600' : 'text-red-600'
                }`}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ngày bắt đầu" required>
              <input
                type="date"
                required
                value={voucherData.startDate}
                onChange={(e) => setVoucherData({ ...voucherData, startDate: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
            <FormField label="Ngày kết thúc" required>
              <input
                type="date"
                required
                value={voucherData.endDate}
                onChange={(e) => setVoucherData({ ...voucherData, endDate: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Giá trị đơn hàng tối thiểu" required>
              <input
                type="number"
                required
                value={voucherData.minOrderValue}
                onChange={(e) =>
                  setVoucherData({ ...voucherData, minOrderValue: Number(e.target.value) })
                }
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
            <FormField label="Giới hạn lượt dùng (0 = vô hạn)">
              <input
                type="number"
                value={voucherData.usageLimit}
                onChange={(e) =>
                  setVoucherData({ ...voucherData, usageLimit: Number(e.target.value) })
                }
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
                placeholder="0 = Không giới hạn"
              />
            </FormField>
          </div>

          {/* Phương thức thanh toán áp dụng */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <label className="block text-xs font-bold text-slate-800">
              Phương thức thanh toán áp dụng voucher
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="pmRestrictionRadio"
                  checked={voucherData.appliesToAllPaymentMethods}
                  onChange={() => setVoucherData({ ...voucherData, appliesToAllPaymentMethods: true })}
                  className="w-4 h-4 text-red-600"
                />
                <span>Áp dụng cho tất cả phương thức thanh toán</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="pmRestrictionRadio"
                  checked={!voucherData.appliesToAllPaymentMethods}
                  onChange={() => setVoucherData({ ...voucherData, appliesToAllPaymentMethods: false })}
                  className="w-4 h-4 text-red-600"
                />
                <span>Chỉ áp dụng cho các phương thức được chọn bên dưới:</span>
              </label>

              {!voucherData.appliesToAllPaymentMethods && (
                <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {allPaymentMethods.map((pm) => {
                    const isChecked = voucherData.paymentMethodIds.includes(pm.id);
                    return (
                      <label
                        key={pm.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-red-500 bg-red-50 text-red-900 font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVoucherData({
                                ...voucherData,
                                paymentMethodIds: [...voucherData.paymentMethodIds, pm.id],
                              });
                            } else {
                              setVoucherData({
                                ...voucherData,
                                paymentMethodIds: voucherData.paymentMethodIds.filter((id) => id !== pm.id),
                              });
                            }
                          }}
                          className="w-4 h-4 text-red-600 rounded"
                        />
                        <span>{pm.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* FLASH SALE MODAL */}
      <Modal
        isOpen={isFlashSaleModalOpen}
        onClose={() => setIsFlashSaleModalOpen(false)}
        title={editingFlashSale ? 'Chỉnh sửa Flash Sale' : 'Tạo mới Flash Sale'}
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFlashSaleModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!fsData.name || !fsData.startTime || !fsData.endTime) {
                  toast.error('Vui lòng nhập tên chương trình và thời gian diễn ra');
                  return;
                }
                if (fsData.items.length === 0) {
                  toast.error('Vui lòng thêm ít nhất 1 món ăn vào Flash Sale');
                  return;
                }
                const url = editingFlashSale
                  ? `/api/admin/promotions/flash-sales/${editingFlashSale.id}`
                  : `/api/admin/promotions/flash-sales`;
                submitForm(
                  url,
                  editingFlashSale ? 'PATCH' : 'POST',
                  fsData,
                  () => setIsFlashSaleModalOpen(false),
                  'Flash Sale'
                );
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              Lưu Flash Sale
            </button>
          </>
        }
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <BranchSelectorPills
            value={fsData.branchIds}
            onChange={(v) => setFsData({ ...fsData, branchIds: v })}
          />
          <MembershipTierSelectorPills
            value={fsData.membershipTierIds}
            onChange={(v) => setFsData({ ...fsData, membershipTierIds: v })}
          />

          <FormField label="Tên chương trình Flash Sale" required>
            <input
              required
              value={fsData.name}
              onChange={(e) => setFsData({ ...fsData, name: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none font-bold"
              placeholder="VD: Flash Sale Giờ Vàng 12h - 14h"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Thời gian bắt đầu" required>
              <input
                type="datetime-local"
                required
                value={fsData.startTime}
                onChange={(e) => setFsData({ ...fsData, startTime: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none font-medium"
              />
            </FormField>
            <FormField label="Thời gian kết thúc" required>
              <input
                type="datetime-local"
                required
                value={fsData.endTime}
                onChange={(e) => setFsData({ ...fsData, endTime: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none font-medium"
              />
            </FormField>
          </div>

          {/* Kênh bán hàng áp dụng */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Kênh bán hàng áp dụng Flash Sale
            </label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fsData.applyOnline}
                  onChange={(e) => setFsData({ ...fsData, applyOnline: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <span>Áp dụng bán Online (Website / App)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fsData.applyPos}
                  onChange={(e) => setFsData({ ...fsData, applyPos: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <span>Áp dụng bán tại quầy POS</span>
              </label>
            </div>
          </div>

          {/* Search & Add Items to Flash Sale */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Danh sách món ăn Flash Sale ({fsData.items.length} món)
              </label>
            </div>

            {/* Product Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm món ăn theo tên để thêm vào Flash Sale..."
                value={productSearchFS}
                onChange={(e) => handleSearchProductsFS(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 font-medium"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />

              {productResultsFS.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {productResultsFS.map((prod) => {
                    const isAdded = fsData.items.some((i) => i.productId === prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => {
                          if (isAdded) return;
                          setFsData({
                            ...fsData,
                            items: [
                              ...fsData.items,
                              {
                                productId: prod.id,
                                product: prod,
                                flashSalePrice: Math.round((prod.basePrice || 0) * 0.7),
                                stock: 20,
                                maxQuantityPerUser: 2,
                              },
                            ],
                          });
                          setProductSearchFS('');
                          setProductResultsFS([]);
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isAdded ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'hover:bg-red-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={prod.imageUrl || '/placeholder.png'}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-slate-100"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{prod.name}</p>
                            <p className="text-[11px] text-slate-400 font-semibold">{formatMoney(prod.basePrice)}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-red-600">
                          {isAdded ? 'Đã thêm' : '+ Thêm'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Added Items List */}
            {fsData.items.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">
                Chưa có món nào. Hãy tìm kiếm ở ô trên để thêm món vào chương trình.
              </p>
            ) : (
              <div className="space-y-2.5">
                {fsData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={item.product?.imageUrl || '/placeholder.png'}
                          alt=""
                          className="w-8 h-8 rounded-lg object-cover bg-slate-100"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{item.product?.name || 'Món ăn'}</p>
                          <p className="text-[11px] text-slate-400">
                            Giá gốc: <strong className="line-through">{formatMoney(item.product?.basePrice)}</strong>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFsData({
                            ...fsData,
                            items: fsData.items.filter((_, i) => i !== idx),
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Giá Flash Sale (VNĐ)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={item.flashSalePrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...fsData.items];
                            updated[idx] = { ...updated[idx], flashSalePrice: val };
                            setFsData({ ...fsData, items: updated });
                          }}
                          className="w-full h-8 px-2 text-xs font-black text-red-600 border border-slate-200 rounded-lg outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Số lượng bán
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={item.stock || item.stockQuantity || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...fsData.items];
                            updated[idx] = { ...updated[idx], stock: val, stockQuantity: val };
                            setFsData({ ...fsData, items: updated });
                          }}
                          className="w-full h-8 px-2 text-xs font-bold text-slate-800 border border-slate-200 rounded-lg outline-none focus:border-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                          Tối đa / khách (0 = vô hạn)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={item.maxQuantityPerUser !== undefined ? item.maxQuantityPerUser : (item.userLimit || 0)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = [...fsData.items];
                            updated[idx] = { ...updated[idx], maxQuantityPerUser: val, userLimit: val };
                            setFsData({ ...fsData, items: updated });
                          }}
                          className="w-full h-8 px-2 text-xs font-bold text-slate-800 border border-slate-200 rounded-lg outline-none focus:border-red-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* COMBO MODAL */}
      <Modal
        isOpen={isComboModalOpen}
        onClose={() => setIsComboModalOpen(false)}
        title={editingCombo ? 'Chỉnh sửa Combo' : 'Tạo mới Combo món'}
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsComboModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!comboData.name) {
                  toast.error('Vui lòng nhập tên Combo');
                  return;
                }
                if (comboData.items.length === 0) {
                  toast.error('Vui lòng thêm ít nhất 1 món vào Combo');
                  return;
                }
                const url = editingCombo
                  ? `/api/admin/promotions/combos/${editingCombo.id}`
                  : `/api/admin/promotions/combos`;
                submitForm(
                  url,
                  editingCombo ? 'PATCH' : 'POST',
                  comboData,
                  () => setIsComboModalOpen(false),
                  'Combo'
                );
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              Lưu Combo
            </button>
          </>
        }
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <BranchSelectorPills
            value={comboData.branchIds}
            onChange={(v) => setComboData({ ...comboData, branchIds: v })}
          />
          <MembershipTierSelectorPills
            value={comboData.membershipTierIds}
            onChange={(v) => setComboData({ ...comboData, membershipTierIds: v })}
          />

          <FormField label="Tên gói Combo" required>
            <input
              required
              value={comboData.name}
              onChange={(e) => setComboData({ ...comboData, name: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none font-bold"
              placeholder="VD: Combo Gia Đình 4 Người Siêu Tiết Kiệm"
            />
          </FormField>

          <FormField label="Mô tả Combo">
            <textarea
              rows={2}
              value={comboData.description}
              onChange={(e) => setComboData({ ...comboData, description: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-xl outline-none text-xs"
              placeholder="Mô tả chi tiết các món trong gói combo..."
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Giá bán Combo (VNĐ)" required>
              <input
                type="number"
                min={0}
                required
                value={comboData.price}
                onChange={(e) => setComboData({ ...comboData, price: Number(e.target.value) })}
                className="w-full h-10 px-3 font-black text-red-600 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
            <FormField label="Giá gốc (VNĐ)">
              <input
                type="number"
                min={0}
                value={comboData.originalPrice}
                onChange={(e) => setComboData({ ...comboData, originalPrice: Number(e.target.value) })}
                className="w-full h-10 px-3 font-bold text-slate-400 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ngày bắt đầu">
              <input
                type="date"
                value={comboData.startDate}
                onChange={(e) => setComboData({ ...comboData, startDate: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
            <FormField label="Ngày kết thúc">
              <input
                type="date"
                value={comboData.endDate}
                onChange={(e) => setComboData({ ...comboData, endDate: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-xl outline-none"
              />
            </FormField>
          </div>

          {/* Search & Add Items to Combo */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              Danh sách món ăn trong Combo ({comboData.items.length} món)
            </label>

            {/* Product Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm món ăn theo tên để thêm vào Combo..."
                value={productSearchCombo}
                onChange={(e) => handleSearchProductsCombo(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 font-medium"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />

              {productResultsCombo.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {productResultsCombo.map((prod) => {
                    const isAdded = comboData.items.some((i) => i.productId === prod.id);
                    return (
                      <div
                        key={prod.id}
                        onClick={() => {
                          if (isAdded) return;
                          const newItems = [
                            ...comboData.items,
                            {
                              productId: prod.id,
                              product: prod,
                              quantity: 1,
                            },
                          ];
                          const totalOriginal = newItems.reduce(
                            (sum, i) => sum + (i.product?.basePrice || 0) * (i.quantity || 1),
                            0
                          );
                          setComboData({
                            ...comboData,
                            items: newItems,
                            originalPrice: totalOriginal,
                            price: comboData.price || Math.round(totalOriginal * 0.85),
                          });
                          setProductSearchCombo('');
                          setProductResultsCombo([]);
                        }}
                        className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isAdded ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'hover:bg-red-50/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={prod.imageUrl || '/placeholder.png'}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover bg-slate-100"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">{prod.name}</p>
                            <p className="text-[11px] text-slate-400 font-semibold">{formatMoney(prod.basePrice)}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-red-600">
                          {isAdded ? 'Đã thêm' : '+ Thêm'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Added Items List */}
            {comboData.items.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">
                Chưa có món nào. Hãy tìm kiếm ở ô trên để thêm món vào Combo.
              </p>
            ) : (
              <div className="space-y-2">
                {comboData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={item.product?.imageUrl || '/placeholder.png'}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover bg-slate-100"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.product?.name || 'Món ăn'}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatMoney(item.product?.basePrice)} / phần
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500">Số lượng:</label>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const updated = [...comboData.items];
                            updated[idx] = { ...updated[idx], quantity: val };
                            const totalOriginal = updated.reduce(
                              (sum, i) => sum + (i.product?.basePrice || 0) * (i.quantity || 1),
                              0
                            );
                            setComboData({
                              ...comboData,
                              items: updated,
                              originalPrice: totalOriginal,
                            });
                          }}
                          className="w-16 h-8 px-2 text-xs font-bold text-slate-800 border border-slate-200 rounded-lg outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const updated = comboData.items.filter((_, i) => i !== idx);
                          const totalOriginal = updated.reduce(
                            (sum, i) => sum + (i.product?.basePrice || 0) * (i.quantity || 1),
                            0
                          );
                          setComboData({
                            ...comboData,
                            items: updated,
                            originalPrice: totalOriginal,
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteUrl}
        onClose={() => setDeleteUrl(null)}
        onConfirm={confirmDeleteAction}
        title={t('common.delete', 'Xác nhận xóa chương trình')}
        message="Bạn có chắc chắn muốn xóa chương trình khuyến mãi này không? Hành động này không thể hoàn tác."
        confirmText={t('common.delete', 'Xóa vĩnh viễn')}
        cancelText={t('common.cancel', 'Hủy')}
        loading={deleteLoading}
        type="danger"
      />
    </div>
  );
}
