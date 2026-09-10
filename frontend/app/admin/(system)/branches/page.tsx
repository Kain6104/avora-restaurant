'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import {
  Store,
  Edit2,
  Trash2,
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  Clock,
  RotateCw,
  Printer,
  ExternalLink,
  CheckCircle2,
  Sliders,
  Coins,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Modal,
  ConfirmDialog,
  FormField,
} from '@/app/admin/components/ui';
import AddressSearchInput, { AddressSearchResult } from '@/app/admin/components/AddressSearchInput';

const BranchMap = dynamic(() => import('./components/BranchMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[360px] bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center border border-slate-200 text-slate-400 text-xs font-semibold">
      Đang tải bản đồ tọa độ...
    </div>
  ),
});

export default function BranchesPage() {
  const { role } = useAdmin();
  const { t } = useLanguage();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [modalTab, setModalTab] = useState<'info' | 'print' | 'loyalty'>('info');
  const [branchPrinters, setBranchPrinters] = useState<any[]>([]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    branchCode: '',
    phone: '',
    email: '',
    province: '',
    district: '',
    ward: '',
    street: '',
    openTime: '',
    closeTime: '',
    latitude: null as number | null,
    longitude: null as number | null,
    onlineOrderingEnabled: true,
    // Print Settings
    splitKitchenTickets: false,
    printCancelTicket: false,
    autoPrintReceipt: true,
    autoPrintTempBill: false,
    receiptCopies: 1,
    kitchenCopies: 1,
    defaultPaperSize: '80mm',
    defaultReceiptPrinterId: '',
    // Loyalty Settings
    isLoyaltyOnlineEnabled: true,
    loyaltyEarnRateOnline: 40,
    isLoyaltyPosEnabled: true,
    loyaltyEarnRatePos: 40,
    allowDirectDiscount: true,
    pointRedeemRate: 1,
    allowRedeemVoucherOnline: true,
    allowRedeemItemPos: true,
  });

  const [addressSearch, setAddressSearch] = useState('');
  const [searchingAddress, setSearchingAddress] = useState(false);

  const fetchBranchPrinters = useCallback(async (branchId: string) => {
    if (!branchId) {
      setBranchPrinters([]);
      return;
    }
    try {
      const res = await fetch(`/api/print-routing/printers?branchId=${branchId}`, { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBranchPrinters(json.data);
      } else {
        setBranchPrinters([]);
      }
    } catch {
      setBranchPrinters([]);
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/branches', { credentials: 'include' });
      const data = await res.json();
      setBranches(data.data || []);
    } catch (error) {
      toast.error('Lỗi tải danh sách chi nhánh');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const openCreateModal = () => {
    setEditingBranch(null);
    setModalTab('info');
    setBranchPrinters([]);
    setFormData({
      name: '',
      branchCode: '',
      phone: '',
      email: '',
      province: '',
      district: '',
      ward: '',
      street: '',
      openTime: '',
      closeTime: '',
      latitude: null,
      longitude: null,
      onlineOrderingEnabled: true,
      splitKitchenTickets: false,
      printCancelTicket: false,
      autoPrintReceipt: true,
      autoPrintTempBill: false,
      receiptCopies: 1,
      kitchenCopies: 1,
      defaultPaperSize: '80mm',
      defaultReceiptPrinterId: '',
      isLoyaltyOnlineEnabled: true,
      loyaltyEarnRateOnline: 40,
      isLoyaltyPosEnabled: true,
      loyaltyEarnRatePos: 40,
      allowDirectDiscount: true,
      pointRedeemRate: 1,
      allowRedeemVoucherOnline: true,
      allowRedeemItemPos: true,
    });
    setAddressSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setModalTab('info');
    fetchBranchPrinters(branch.id);
    setFormData({
      ...branch,
      name: branch.name || '',
      branchCode: branch.branchCode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      province: branch.province || '',
      district: branch.district || '',
      ward: branch.ward || '',
      street: branch.street || '',
      openTime: branch.openTime || '',
      closeTime: branch.closeTime || '',
      latitude: branch.latitude ?? null,
      longitude: branch.longitude ?? null,
      onlineOrderingEnabled: branch.onlineOrderingEnabled ?? true,
      splitKitchenTickets: branch.splitKitchenTickets ?? false,
      printCancelTicket: branch.printCancelTicket ?? false,
      autoPrintReceipt: branch.autoPrintReceipt ?? true,
      autoPrintTempBill: branch.autoPrintTempBill ?? false,
      receiptCopies: branch.receiptCopies ?? 1,
      kitchenCopies: branch.kitchenCopies ?? 1,
      defaultPaperSize: branch.defaultPaperSize || '80mm',
      defaultReceiptPrinterId: branch.defaultReceiptPrinterId || '',
      isLoyaltyOnlineEnabled: branch.isLoyaltyOnlineEnabled ?? true,
      loyaltyEarnRateOnline: branch.loyaltyEarnRateOnline ?? 40,
      isLoyaltyPosEnabled: branch.isLoyaltyPosEnabled ?? true,
      loyaltyEarnRatePos: branch.loyaltyEarnRatePos ?? 40,
      allowDirectDiscount: branch.allowDirectDiscount ?? true,
      pointRedeemRate: branch.pointRedeemRate ?? 1,
      allowRedeemVoucherOnline: branch.allowRedeemVoucherOnline ?? true,
      allowRedeemItemPos: branch.allowRedeemItemPos ?? true,
    });
    setAddressSearch(branch.street || '');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/branches/${deleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Xóa chi nhánh thành công');
        setDeleteId(null);
        fetchBranches();
      } else {
        toast.error(data.message || 'Lỗi khi xóa');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.latitude === null || formData.longitude === null) {
      toast.error('Vui lòng chọn tọa độ trên bản đồ');
      return;
    }

    setSubmitLoading(true);
    try {
      const url = editingBranch ? `/api/admin/branches/${editingBranch.id}` : '/api/admin/branches';
      const method = editingBranch ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingBranch ? 'Cập nhật thành công' : 'Thêm mới thành công');
        setIsModalOpen(false);
        fetchBranches();
      } else {
        toast.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    } finally {
      setSubmitLoading(false);
    }
  };

  const searchAddressOnMap = async () => {
    if (!addressSearch.trim()) return;
    setSearchingAddress(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        setFormData((prev) => ({
          ...prev,
          latitude: newLat,
          longitude: newLng,
        }));
        toast.success('Đã tìm thấy vị trí trên bản đồ');
      } else {
        toast.error('Không tìm thấy địa chỉ này');
      }
    } catch (e) {
      toast.error('Lỗi khi tìm địa chỉ');
    } finally {
      setSearchingAddress(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Tên chi nhánh',
      render: (branch: any) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-red-50 text-red-600">
            <Store size={18} />
          </div>
          <div>
            <p className="font-bold text-slate-900">{branch.name}</p>
            <span className="font-mono text-xs text-slate-400">{branch.branchCode}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Địa chỉ',
      render: (branch: any) => (
        <div className="max-w-[280px] truncate text-slate-600 text-xs sm:text-sm">
          <span>
            {[branch.street, branch.ward, branch.province].filter(Boolean).join(', ')}
          </span>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Liên hệ',
      render: (branch: any) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-slate-700">{branch.phone || '-'}</p>
          <span className="text-slate-400">{branch.email || '-'}</span>
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Giờ mở cửa',
      align: 'center' as const,
      render: (branch: any) => (
        <span className="font-medium text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
          {branch.openTime || '--:--'} - {branch.closeTime || '--:--'}
        </span>
      ),
    },
    {
      key: 'printSettings',
      header: 'Thiết lập in',
      render: (branch: any) => (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <Printer size={13} className="text-slate-400 shrink-0" />
            <span>{branch.splitKitchenTickets ? 'Tách từng món' : 'Gộp phiếu bếp'}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-500">{branch.defaultPaperSize || '80mm'}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {branch.printCancelTicket && (
              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">In hủy</span>
            )}
            {branch.autoPrintReceipt !== false && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Tự in bill</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'loyalty',
      header: 'Tích điểm & Quy đổi',
      render: (branch: any) => (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-1.5">
            <Coins size={13} className="text-amber-500 shrink-0" />
            <span className="font-semibold text-slate-800">
              {branch.isLoyaltyOnlineEnabled !== false ? `${branch.loyaltyEarnRateOnline || 40}đ/đ (Web)` : 'Tắt Web'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-semibold text-slate-800">
              {branch.isLoyaltyPosEnabled !== false ? `${branch.loyaltyEarnRatePos || 40}đ/đ (POS)` : 'Tắt POS'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {branch.allowDirectDiscount !== false ? (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Giảm trực tiếp 1đ</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">Tắt giảm bill</span>
            )}
            {branch.allowRedeemVoucherOnline !== false && (
              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Đổi Voucher</span>
            )}
            {branch.allowRedeemItemPos !== false && (
              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">Đổi món POS</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Đặt online',
      align: 'center' as const,
      render: (branch: any) => (
        <StatusBadge status={branch.onlineOrderingEnabled ? 'ACTIVE' : 'INACTIVE'} size="sm" />
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right' as const,
      render: (branch: any) => (
        <div className="flex items-center justify-end gap-1">
          {role === 'ADMIN' && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(branch);
                }}
                aria-label="Chỉnh sửa chi nhánh"
                className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(branch.id);
                }}
                aria-label="Xóa chi nhánh"
                className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('branches.title', 'Hệ thống Chi nhánh')}
        subtitle={t('branches.subtitle', 'Quản lý địa điểm, bản đồ tọa độ giao hàng và trạng thái hoạt động')}
        breadcrumbs={[
          { label: t('nav.system', 'Hệ thống') },
          { label: t('nav.branches', 'Chi nhánh') },
        ]}
        badge={
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            {branches.length} {t('nav.branches', 'chi nhánh')}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchBranches}
              aria-label={t('common.refresh', 'Làm mới')}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Làm mới')}</span>
            </button>
            {role === 'ADMIN' && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Plus size={15} />
                <span>{t('common.add', 'Thêm chi nhánh')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Branches DataTable */}
      <DataTable
        columns={columns}
        data={branches}
        keyExtractor={(b) => b.id}
        loading={loading}
        onRowClick={(b) => role === 'ADMIN' && openEditModal(b)}
        emptyTitle="Chưa có chi nhánh nào"
        emptyDescription="Thêm chi nhánh nhà hàng đầu tiên của bạn vào hệ thống."
        mobileCardRender={(b) => (
          <MobileDataCard
            avatar={
              <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
                <Store size={20} />
              </div>
            }
            title={b.name}
            subtitle={<span className="font-mono text-slate-400">{b.branchCode}</span>}
            badge={
              <StatusBadge status={b.onlineOrderingEnabled ? 'ACTIVE' : 'INACTIVE'} size="sm" />
            }
            details={[
              {
                label: 'Địa chỉ',
                value: `${b.street}, ${b.ward}, ${b.district}`,
              },
              {
                label: 'Điện thoại',
                value: b.phone || 'Chưa cập nhật',
              },
              {
                label: 'Giờ mở',
                value: `${b.openTime || '--:--'} - ${b.closeTime || '--:--'}`,
              },
              {
                label: 'Thiết lập in',
                value: `${b.splitKitchenTickets ? 'Tách món' : 'Gộp phiếu'} (${b.defaultPaperSize || '80mm'})`,
              },
              {
                label: 'Tích điểm (Web / POS)',
                value: `${b.isLoyaltyOnlineEnabled !== false ? `${b.loyaltyEarnRateOnline || 40}đ/đ` : 'Tắt'} (Web) / ${b.isLoyaltyPosEnabled !== false ? `${b.loyaltyEarnRatePos || 40}đ/đ` : 'Tắt'} (POS)`,
              },
            ]}
            actions={
              role === 'ADMIN' && (
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => openEditModal(b)}
                    className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit2 size={13} />
                    <span>Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(b.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            }
          />
        )}
      />

      {/* Modal Add / Edit Branch */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBranch ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}
        subtitle="Thông tin vị trí, thiết lập bán hàng & cấu hình in ấn POS"
        maxWidth="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={submitLoading}
              onClick={handleSubmit}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {submitLoading ? 'Đang lưu...' : editingBranch ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modal Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-100 pb-3 mb-2 text-xs">
            <button
              type="button"
              onClick={() => setModalTab('info')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                modalTab === 'info'
                  ? 'bg-red-50 text-red-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Store size={14} />
              <span>Thông tin & Vị trí</span>
            </button>
            <button
              type="button"
              onClick={() => setModalTab('print')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                modalTab === 'print'
                  ? 'bg-red-50 text-red-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Printer size={14} />
              <span>Thiết lập In ấn & Bếp</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-semibold">
                POS
              </span>
            </button>
            <button
              type="button"
              onClick={() => setModalTab('loyalty')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                modalTab === 'loyalty'
                  ? 'bg-amber-50 text-amber-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Coins size={14} />
              <span>Tích điểm & Quy đổi</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-600 text-white font-semibold">
                Online / POS
              </span>
            </button>
          </div>

          {/* TAB 1: THÔNG TIN CƠ BẢN & ĐỊA CHỈ */}
          {modalTab === 'info' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Tên chi nhánh" required>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    placeholder="VD: AVORA Quận 1"
                  />
                </FormField>
                <FormField label="Mã chi nhánh" required>
                  <input
                    required
                    value={formData.branchCode}
                    onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                    className="w-full h-10 px-3 text-xs sm:text-sm font-mono uppercase bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    placeholder="VD: CN-Q1"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Số điện thoại">
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                  />
                </FormField>
                <FormField label="Email chi nhánh">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Tỉnh / Thành">
                  <input
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                    placeholder="Hồ Chí Minh"
                  />
                </FormField>
                <FormField label="Phường / Xã">
                  <input
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                    placeholder="Bến Nghé"
                  />
                </FormField>
              </div>

              <FormField label="Địa chỉ đường & số nhà">
                <input
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                  placeholder="123 Lê Lợi"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Giờ mở cửa">
                  <input
                    type="time"
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  />
                </FormField>
                <FormField label="Giờ đóng cửa">
                  <input
                    type="time"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  />
                </FormField>
              </div>

              <FormField label="Tìm kiếm & Định vị địa chỉ thông minh">
                <AddressSearchInput
                  value={addressSearch}
                  onSelect={(res: AddressSearchResult) => {
                    setAddressSearch(res.displayName);
                    setFormData((prev) => ({
                      ...prev,
                      latitude: res.lat,
                      longitude: res.lon,
                      province: res.province || prev.province,
                      district: res.district || prev.district,
                      ward: res.ward || prev.ward,
                      street: res.street || prev.street,
                    }));
                  }}
                  placeholder="Nhập tên địa điểm, số nhà, tên đường hoặc tọa độ..."
                />
              </FormField>

              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                <BranchMap
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onChange={(lat: number, lng: number) =>
                    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                  }
                  onReverseGeocode={(res) => {
                    setAddressSearch(res.displayName);
                    setFormData((prev) => ({
                      ...prev,
                      province: prev.province || res.province,
                      district: prev.district || res.district,
                      ward: prev.ward || res.ward,
                      street: prev.street || res.street,
                    }));
                  }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: THIẾT LẬP IN ẤN & PHIẾU BẾP */}
          {modalTab === 'print' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* 1. Chế độ in phiếu gửi Bếp / Bar */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Chế độ in phiếu gửi Bếp / Bar
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormData({ ...formData, splitKitchenTickets: false })}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      !formData.splitKitchenTickets
                        ? 'border-red-600 bg-red-50/40 text-red-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">Gộp theo khu vực chế biến</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-red-700 font-bold">
                          Khuyên dùng
                        </span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          !formData.splitKitchenTickets ? 'border-red-600 bg-red-600' : 'border-slate-300'
                        }`}
                      >
                        {!formData.splitKitchenTickets && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Các món ăn cùng quầy/bếp được in chung trên 1 phiếu tổng hợp. Tiết kiệm giấy in nhiệt và đầu bếp dễ nhìn bao quát toàn bộ bàn.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormData({ ...formData, splitKitchenTickets: true })}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.splitKitchenTickets
                        ? 'border-red-600 bg-red-50/40 text-red-950 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs">Tách riêng từng món ăn</span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          formData.splitKitchenTickets ? 'border-red-600 bg-red-600' : 'border-slate-300'
                        }`}
                      >
                        {formData.splitKitchenTickets && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Mỗi món ăn in ra 1 phiếu bếp riêng biệt. Thích hợp mô hình chế biến từng phần độc lập hoặc kẹp phiếu lên từng dĩa/tô ra món.
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Tùy chọn tự động in */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <span className="block text-xs font-bold text-slate-800">
                  Tùy chọn tự động in & Phiếu bếp
                </span>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.printCancelTicket}
                    onChange={(e) => setFormData({ ...formData, printCancelTicket: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Tự động in phiếu hủy món xuống bếp (Cancel Ticket)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Khi thu ngân hủy món hoặc hủy đơn trên POS, hệ thống sẽ phát lệnh in phiếu báo hủy màu đỏ xuống đúng máy in bếp đã nhận món.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoPrintReceipt}
                    onChange={(e) => setFormData({ ...formData, autoPrintReceipt: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Tự động in hóa đơn khi thanh toán hoàn tất
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Kích hoạt in hóa đơn thanh toán cho khách ngay khi thu ngân bấm xác nhận thanh toán thành công tại POS.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.autoPrintTempBill}
                    onChange={(e) => setFormData({ ...formData, autoPrintTempBill: e.target.checked })}
                    className="mt-0.5 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Cho phép in phiếu tạm tính trước khi thanh toán
                    </span>
                    <p className="text-[11px] text-slate-500">
                      In phiếu tạm tính để phục vụ mang ra bàn cho khách kiểm tra món trước khi thanh toán.
                    </p>
                  </div>
                </label>
              </div>

              {/* 3. Khổ giấy và số liên */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField label="Khổ giấy in nhiệt mặc định">
                  <select
                    value={formData.defaultPaperSize || '80mm'}
                    onChange={(e) => setFormData({ ...formData, defaultPaperSize: e.target.value })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="80mm">80mm (Khổ chuẩn K80 - Phổ biến nhất)</option>
                    <option value="58mm">58mm (Khổ nhỏ K58 / POS cầm tay)</option>
                  </select>
                </FormField>

                <FormField label="Số liên hóa đơn (Receipt)">
                  <select
                    value={formData.receiptCopies || 1}
                    onChange={(e) => setFormData({ ...formData, receiptCopies: Number(e.target.value) || 1 })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  >
                    <option value={1}>1 liên (Dành cho khách hàng)</option>
                    <option value={2}>2 liên (1 cho khách + 1 lưu quầy)</option>
                    <option value={3}>3 liên (1 khách + 1 quầy + 1 kế toán)</option>
                  </select>
                </FormField>

                <FormField label="Số liên phiếu bếp (Kitchen)">
                  <select
                    value={formData.kitchenCopies || 1}
                    onChange={(e) => setFormData({ ...formData, kitchenCopies: Number(e.target.value) || 1 })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  >
                    <option value={1}>1 liên (1 bản cho đầu bếp)</option>
                    <option value={2}>2 liên (1 cho bếp + 1 cho tiếp thực)</option>
                  </select>
                </FormField>
              </div>

              {/* 4. Máy in hóa đơn mặc định */}
              <FormField label="Máy in hóa đơn thu ngân mặc định">
                {branchPrinters.length > 0 ? (
                  <select
                    value={formData.defaultReceiptPrinterId || ''}
                    onChange={(e) => setFormData({ ...formData, defaultReceiptPrinterId: e.target.value })}
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="">-- Mặc định (Tự động theo trạm thu ngân) --</option>
                    {branchPrinters.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.connectionType === 'NETWORK_DIRECT' ? `LAN: ${p.ipAddress}:${p.port}` : 'Print Agent'}) - {p.paperSize}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    {editingBranch
                      ? 'Chi nhánh này chưa có máy in nào. Bạn có thể thêm máy in tại Cài đặt > Máy in & Khu vực bếp.'
                      : 'Máy in sẽ được liên kết sau khi tạo chi nhánh tại Cài đặt > Máy in & Khu vực bếp.'}
                  </div>
                )}
              </FormField>

              {/* 5. Lối tắt quản lý */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-medium">Cấu hình chuyên sâu:</span>
                <div className="flex items-center gap-3">
                  <Link
                    href="/admin/pos?view=printer-settings"
                    target="_blank"
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold"
                  >
                    <span>Máy in POS</span>
                    <ExternalLink size={12} />
                  </Link>
                  <Link
                    href="/admin/settings/print-templates"
                    target="_blank"
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold"
                  >
                    <span>Mẫu in chi nhánh</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TÍCH ĐIỂM & QUY ĐỔI ƯU ĐÃI (LOYALTY) */}
          {modalTab === 'loyalty' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* 1. TÍCH ĐIỂM ĐƠN ONLINE */}
              <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-blue-900 block">
                      Tích điểm cho đơn đặt hàng Online (Website / App)
                    </span>
                    <span className="text-[11px] text-blue-700">
                      Cộng điểm thưởng tự động cho khách hàng khi đơn giao hàng / mang đi hoàn thành
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isLoyaltyOnlineEnabled}
                      onChange={(e) => setFormData({ ...formData, isLoyaltyOnlineEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {formData.isLoyaltyOnlineEnabled && (
                  <div className="pt-2 border-t border-blue-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Tỷ lệ tích điểm Online (Số tiền để nhận 1 điểm)">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          value={formData.loyaltyEarnRateOnline}
                          onChange={(e) => setFormData({ ...formData, loyaltyEarnRateOnline: Math.max(1, parseFloat(e.target.value) || 1) })}
                          className="w-full h-9 px-3 pr-16 text-xs bg-white border border-blue-200 rounded-xl outline-none font-bold text-blue-900"
                        />
                        <span className="absolute right-3 top-2 text-[11px] text-blue-600 font-bold">đ / điểm</span>
                      </div>
                    </FormField>
                    <div className="flex items-center text-[11px] text-blue-800 bg-white p-2.5 rounded-xl border border-blue-100">
                      Ví dụ: Tiêu <strong>{formData.loyaltyEarnRateOnline}đ</strong> = 1 điểm. Đơn hàng <strong>40.000đ</strong> tích được <strong>{Math.floor(40000 / (formData.loyaltyEarnRateOnline || 40))} điểm</strong> (chưa kể hệ số rank).
                    </div>
                  </div>
                )}
              </div>

              {/* 2. TÍCH ĐIỂM ĐƠN POS / TẠI CỬA HÀNG */}
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-emerald-900 block">
                      Tích điểm cho đơn bán tại cửa hàng (POS / Ăn tại bàn / Mang về)
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      Tự động tích điểm cho khách khi thanh toán tại quầy thu ngân chi nhánh
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isLoyaltyPosEnabled}
                      onChange={(e) => setFormData({ ...formData, isLoyaltyPosEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {formData.isLoyaltyPosEnabled && (
                  <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Tỷ lệ tích điểm POS (Số tiền để nhận 1 điểm)">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          value={formData.loyaltyEarnRatePos}
                          onChange={(e) => setFormData({ ...formData, loyaltyEarnRatePos: Math.max(1, parseFloat(e.target.value) || 1) })}
                          className="w-full h-9 px-3 pr-16 text-xs bg-white border border-emerald-200 rounded-xl outline-none font-bold text-emerald-900"
                        />
                        <span className="absolute right-3 top-2 text-[11px] text-emerald-600 font-bold">đ / điểm</span>
                      </div>
                    </FormField>
                    <div className="flex items-center text-[11px] text-emerald-800 bg-white p-2.5 rounded-xl border border-emerald-100">
                      Ví dụ: Tiêu <strong>{formData.loyaltyEarnRatePos}đ</strong> = 1 điểm. Hóa đơn <strong>100.000đ</strong> tích được <strong>{Math.floor(100000 / (formData.loyaltyEarnRatePos || 40))} điểm</strong>.
                    </div>
                  </div>
                )}
              </div>

              {/* 3. QUY ĐỔI ĐIỂM THÀNH GIẢM GIÁ TRỰC TIẾP */}
              <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs sm:text-sm text-amber-900 block">
                      Quy đổi điểm thành giảm giá tiền mặt trực tiếp
                    </span>
                    <span className="text-[11px] text-amber-700">
                      Cho phép khách hàng sử dụng điểm tích lũy để trừ tiền thẳng vào hóa đơn thanh toán
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.allowDirectDiscount}
                      onChange={(e) => setFormData({ ...formData, allowDirectDiscount: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {formData.allowDirectDiscount && (
                  <div className="pt-2 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Giá trị quy đổi (1 điểm = X đồng)">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={formData.pointRedeemRate}
                          onChange={(e) => setFormData({ ...formData, pointRedeemRate: Math.max(0.1, parseFloat(e.target.value) || 1) })}
                          className="w-full h-9 px-3 pr-16 text-xs bg-white border border-amber-200 rounded-xl outline-none font-bold text-amber-900"
                        />
                        <span className="absolute right-3 top-2 text-[11px] text-amber-600 font-bold">đ / điểm</span>
                      </div>
                    </FormField>
                    <div className="flex items-center text-[11px] text-amber-800 bg-white p-2.5 rounded-xl border border-amber-100">
                      Ví dụ: 1 điểm = <strong>{formData.pointRedeemRate}đ</strong>. Khách dùng <strong>1.000 điểm</strong> giảm trực tiếp <strong>{(1000 * (formData.pointRedeemRate || 1)).toLocaleString('vi-VN')}đ</strong>.
                    </div>
                  </div>
                )}
              </div>

              {/* 4. CÁC HÌNH THỨC QUY ĐỔI ĐẶC THÙ KHÁC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Đổi Voucher Online */}
                <div className="p-3.5 rounded-2xl border border-purple-200 bg-purple-50/40 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-xs text-purple-900 block">
                      Đổi điểm lấy Voucher (Online)
                    </span>
                    <span className="text-[11px] text-purple-700 block mt-0.5">
                      Khách dùng điểm đổi mã ưu đãi khi đặt online
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formData.allowRedeemVoucherOnline}
                      onChange={(e) => setFormData({ ...formData, allowRedeemVoucherOnline: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {/* Đổi Món tại POS */}
                <div className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/40 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-xs text-rose-900 block">
                      Đổi điểm sang món ăn (Tại POS)
                    </span>
                    <span className="text-[11px] text-rose-700 block mt-0.5">
                      Thu ngân dùng điểm của khách đổi món tại quầy
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formData.allowRedeemItemPos}
                      onChange={(e) => setFormData({ ...formData, allowRedeemItemPos: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Xóa chi nhánh"
        message="Bạn có chắc chắn muốn xóa chi nhánh này không? Thao tác này có thể ảnh hưởng đến thực đơn và lịch sử đơn hàng của chi nhánh."
        confirmText="Xóa chi nhánh"
        loading={deleteLoading}
        type="danger"
      />
    </div>
  );
}
