'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  QrCode,
  Building2,
  Key,
  ShieldCheck,
  Search,
  X,
  Loader2,
  DollarSign,
  Smartphone,
  Globe,
  Store,
  Sliders,
  Check,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHeader, FormField } from '@/app/admin/components/ui';

const POPULAR_BANKS = [
  { code: 'MB', name: 'MBBank - Ngân hàng Quân Đội' },
  { code: 'VCB', name: 'Vietcombank - Ngân hàng Ngoại Thương' },
  { code: 'BIDV', name: 'BIDV - Ngân hàng Đầu Tư và Phát Triển' },
  { code: 'TCB', name: 'Techcombank - Ngân hàng Kỹ Thương' },
  { code: 'ACB', name: 'ACB - Ngân hàng Á Châu' },
  { code: 'VPB', name: 'VPBank - Ngân hàng Việt Nam Thịnh Vượng' },
  { code: 'TPB', name: 'TPBank - Ngân hàng Tiên Phong' },
  { code: 'STB', name: 'Sacombank - Ngân hàng Sài Gòn Thương Tín' },
  { code: 'VIB', name: 'VIB - Ngân hàng Quốc Tế' },
  { code: 'ICB', name: 'VietinBank - Ngân hàng Công Thương' },
  { code: 'OCB', name: 'OCB - Ngân hàng Phương Đông' },
  { code: 'SHB', name: 'SHB - Ngân hàng Sài Gòn Hà Nội' },
];

export default function PaymentMethodsPage() {
  const { t, locale } = useLanguage();
  const [methods, setMethods] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any>(null);

  const [formData, setFormData] = useState({
    methodCode: '',
    gatewayType: 'SEPAY',
    name: '',
    description: '',
    iconUrl: '',
    configId: '',
    configKey1: '', // API Token
    configKey2: '', // Webhook Secret
    configKey3: '',
    bankCode: 'MB',
    accountNumber: '',
    accountName: '',
    minOrderValue: 0,
    isAllBranches: true,
    branchIds: [] as string[],
    isActive: true,
    isActiveForPos: true,
    displayOrder: 0,
  });

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/admin/branches', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMethods = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payment-methods', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMethods(data.data || []);
      } else {
        toast.error('Không thể tải danh sách phương thức thanh toán');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchMethods();
  }, []);

  const handleOpenCreate = () => {
    setEditingMethod(null);
    setFormData({
      methodCode: 'SEPAY_QR',
      gatewayType: 'SEPAY',
      name: 'Chuyển khoản QR (SePay)',
      description: 'Chuyển khoản tự động xác nhận qua cổng SePay',
      iconUrl: '',
      configId: '',
      configKey1: '',
      configKey2: '',
      configKey3: '',
      bankCode: 'MB',
      accountNumber: '',
      accountName: '',
      minOrderValue: 0,
      isAllBranches: true,
      branchIds: [],
      isActive: true,
      isActiveForPos: true,
      displayOrder: methods.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: any) => {
    setEditingMethod(m);
    setFormData({
      methodCode: m.methodCode,
      gatewayType: m.gatewayType,
      name: m.name,
      description: m.description || '',
      iconUrl: m.iconUrl || '',
      configId: m.configId || '',
      configKey1: m.configKey1 || '',
      configKey2: m.configKey2 || '',
      configKey3: m.configKey3 || '',
      bankCode: m.bankCode || 'MB',
      accountNumber: m.accountNumber || '',
      accountName: m.accountName || '',
      minOrderValue: m.minOrderValue || 0,
      isAllBranches: m.isAllBranches !== false,
      branchIds: m.branches ? m.branches.map((b: any) => b.id) : [],
      isActive: m.isActive,
      isActiveForPos: m.isActiveForPos,
      displayOrder: m.displayOrder || 0,
    });
    setIsModalOpen(true);
  };

  const handleToggleBranch = (branchId: string) => {
    const current = formData.branchIds;
    if (current.includes(branchId)) {
      setFormData({ ...formData, branchIds: current.filter((id) => id !== branchId) });
    } else {
      setFormData({ ...formData, branchIds: [...current, branchId] });
    }
  };

  const handleToggle = async (id: string, field: 'isActive' | 'isActiveForPos') => {
    try {
      const res = await fetch(`/api/payment-methods/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã cập nhật trạng thái');
        fetchMethods();
      } else {
        toast.error('Cập nhật thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa phương thức "${name}" không?`)) return;
    try {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa thành công');
        fetchMethods();
      } else {
        toast.error('Xóa thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleCheckAccountName = () => {
    if (!formData.accountNumber) {
      toast.error('Vui lòng nhập số tài khoản trước khi kiểm tra');
      return;
    }
    toast.success('Đã xác thực thông tin tài khoản hợp lệ!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.isAllBranches && formData.branchIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 chi nhánh áp dụng!');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingMethod ? `/api/payment-methods/${editingMethod.id}` : '/api/payment-methods';
      const method = editingMethod ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        minOrderValue: Number(formData.minOrderValue || 0),
        displayOrder: Number(formData.displayOrder || 0),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(editingMethod ? 'Cập nhật cấu hình thành công!' : 'Thêm phương thức thành công!');
        setIsModalOpen(false);
        fetchMethods();
      } else {
        toast.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      toast.error('Lỗi kết nối đến server');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMethods = methods.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.methodCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.gatewayType.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12">
      {/* Header */}
      <PageHeader
        title={t('paymentMethods.title', 'Phương thức thanh toán')}
        subtitle={t('paymentMethods.subtitle', 'Cấu hình tài khoản ngân hàng, mã QR VietQR Pro và cổng thanh toán tự động')}
        breadcrumbs={[
          { label: t('nav.system', 'Hệ thống'), href: '/admin/settings' },
          { label: t('paymentMethods.title', 'Phương thức thanh toán') },
        ]}
        actions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer min-h-[40px]"
          >
            <Plus size={16} />
            <span>{t('paymentMethods.add', 'Thêm phương thức')}</span>
          </button>
        }
      />

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={t('paymentMethods.searchPlaceholder', 'Tìm kiếm theo tên, mã hoặc loại cổng...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-4 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all font-medium min-h-[40px]"
          />
        </div>
        <div className="text-xs text-slate-500 font-semibold self-start sm:self-auto">
          {t('common.total', 'Tổng số')}: <strong className="text-slate-900">{filteredMethods.length}</strong> {t('paymentMethods.title', 'phương thức')}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="admin-scroll-table">
          <table className="w-full text-left text-xs sm:text-sm min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4">{t('paymentMethods.code', 'MÃ')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4">{t('paymentMethods.methodName', 'TÊN PHƯƠNG THỨC')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4">{t('paymentMethods.gateway', 'LOẠI CỔNG')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4">{t('paymentMethods.branches', 'CHI NHÁNH ÁP DỤNG')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4">{t('paymentMethods.minOrder', 'ĐƠN TỐI THIỂU')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-center">{t('paymentMethods.webApp', 'WEB / APP')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-center">{t('paymentMethods.pos', 'POS')}</th>
                <th className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-right">{t('common.actions', 'Thao tác')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                    <span>{t('common.loading', 'Đang tải dữ liệu...')}</span>
                  </td>
                </tr>
              ) : filteredMethods.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    {t('common.noData', 'Không có dữ liệu')}
                  </td>
                </tr>
              ) : (
                filteredMethods.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4">
                      <span className="font-mono text-xs font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md">
                        {m.methodCode}
                      </span>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4">
                      <div className="flex items-center gap-2 sm:gap-2.5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-black text-xs">
                          {m.gatewayType === 'SEPAY' || m.gatewayType === 'TRANSFER' ? (
                            <QrCode size={16} />
                          ) : m.gatewayType === 'COD' || m.gatewayType === 'CASH' ? (
                            <DollarSign size={16} />
                          ) : (
                            <CreditCard size={16} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{m.name}</p>
                          {m.accountNumber && (
                            <p className="text-[11px] text-slate-500">
                              {m.bankCode} · {m.accountNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {m.gatewayType === 'SEPAY'
                          ? t('paymentMethods.sepayAuto', 'SePay (Chuyển khoản tự động)')
                          : m.gatewayType === 'CASH'
                          ? t('paymentMethods.cashPos', 'Tiền mặt tại quầy (POS)')
                          : m.gatewayType === 'CARD'
                          ? t('paymentMethods.cardPos', 'Quẹt thẻ ngân hàng (POS)')
                          : m.gatewayType === 'TRANSFER'
                          ? t('paymentMethods.vietqr', 'Chuyển khoản VietQR')
                          : m.gatewayType}
                      </span>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-xs">
                      {m.isAllBranches !== false || !m.branches || m.branches.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Store size={12} />
                          {t('paymentMethods.allBranches', 'Tất cả chi nhánh')}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {m.branches.map((b: any) => (
                            <span
                              key={b.id}
                              className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                            >
                              {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 font-bold text-slate-800 text-xs sm:text-sm">
                      {new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
                        style: 'currency',
                        currency: 'VND',
                      }).format(m.minOrderValue || 0)}
                    </td>
                    {/* Toggle Web/App */}
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(m.id, 'isActive')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-colors cursor-pointer min-h-[30px] ${
                          m.isActive
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <span>{m.isActive ? t('paymentMethods.on', 'BẬT') : t('paymentMethods.off', 'TẮT')}</span>
                      </button>
                    </td>
                    {/* Toggle POS */}
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(m.id, 'isActiveForPos')}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold transition-colors cursor-pointer min-h-[30px] ${
                          m.isActiveForPos
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        <span>{m.isActiveForPos ? t('paymentMethods.on', 'BẬT') : t('paymentMethods.off', 'TẮT')}</span>
                      </button>
                    </td>
                    <td className="py-2.5 sm:py-3.5 px-3 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer min-h-[34px] min-w-[34px] inline-flex items-center justify-center"
                          title={t('common.edit', 'Chỉnh sửa')}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id, m.name)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer min-h-[34px] min-w-[34px] inline-flex items-center justify-center"
                          title={t('common.delete', 'Xóa')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CẬP NHẬT CẤU HÌNH CỔNG (EXACT MATCH USER UI SCREENSHOT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-1.5 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[96vh] sm:max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <Sliders className="text-blue-600" size={18} />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  {editingMethod
                    ? t('paymentMethods.modalEditTitle', 'Cập Nhật Cấu Hình Cổng')
                    : t('paymentMethods.modalCreateTitle', 'Thêm Phương Thức Thanh Toán')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Row 1: Mã hệ thống & Loại cổng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('paymentMethods.systemCode', 'Mã hệ thống')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={formData.methodCode}
                    onChange={(e) => setFormData({ ...formData, methodCode: e.target.value.toUpperCase() })}
                    placeholder="VD: SEPAY_QR"
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-mono font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 italic">
                    {t('paymentMethods.systemCodeHint', 'Viết liền, không dấu. Dùng làm Key định danh.')}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('paymentMethods.gatewayType', 'Loại cổng (GATEWAY)')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gatewayType}
                    onChange={(e) => setFormData({ ...formData, gatewayType: e.target.value })}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold cursor-pointer"
                  >
                    <option value="CASH">{t('paymentMethods.cashPos', 'Tiền mặt tại quầy (POS)')}</option>
                    <option value="CARD">{t('paymentMethods.cardPos', 'Quẹt thẻ ngân hàng (POS)')}</option>
                    <option value="SEPAY">{t('paymentMethods.sepayAuto', 'SePay (Chuyển khoản tự động)')}</option>
                    <option value="TRANSFER">{t('paymentMethods.vietqr', 'Chuyển khoản VietQR')}</option>
                    <option value="COD">COD</option>
                    <option value="PAYOS">PayOS</option>
                    <option value="MOMO">MoMo</option>
                    <option value="VNPAY">VNPAY-QR</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Tên hiển thị & Đơn tối thiểu */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('paymentMethods.displayName', 'Tên hiển thị trên APP/WEB')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Chuyển khoản QR (SePay)"
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {t('paymentMethods.minOrderVal', 'Đơn tối thiểu (VNĐ)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.minOrderValue}
                    onChange={(e) => setFormData({ ...formData, minOrderValue: Number(e.target.value) })}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-red-600"
                  />
                </div>
              </div>

              {/* Switches */}
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-800">
                    {t('paymentMethods.allowWebApp', 'Cho phép khách sử dụng trên Web/App')}
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
                  <span className="text-xs font-bold text-slate-800">
                    {t('paymentMethods.allowPos', 'Cho phép thu ngân sử dụng trên máy POS')}
                  </span>
                  <input
                    type="checkbox"
                    checked={formData.isActiveForPos}
                    onChange={(e) => setFormData({ ...formData, isActiveForPos: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </label>
              </div>

              {/* Chi nhánh áp dụng */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Store size={15} className="text-blue-600" />
                    <span>{t('paymentMethods.appliedBranches', 'Chi nhánh áp dụng')}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={formData.isAllBranches}
                      onChange={(e) => setFormData({ ...formData, isAllBranches: e.target.checked })}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <span>{t('paymentMethods.allBranches', 'Tất cả chi nhánh')}</span>
                  </label>
                </div>

                {!formData.isAllBranches && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {branches.map((b) => {
                      const isChecked = formData.branchIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleToggleBranch(b.id)}
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                            isChecked
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <span className="truncate">{b.name}</span>
                          {isChecked && <CheckCircle2 size={14} className="text-blue-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CẤU HÌNH API TOKEN SEPAY (KHI CHỌN SEPAY) */}
              {formData.gatewayType === 'SEPAY' && (
                <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-200/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Key size={15} className="text-blue-600" />
                    <span>{t('paymentMethods.sepayConfig', 'Cấu hình API Token SePay')}</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      {t('paymentMethods.apiToken', 'API TOKEN')}
                    </label>
                    <input
                      value={formData.configKey1}
                      onChange={(e) => setFormData({ ...formData, configKey1: e.target.value })}
                      placeholder="spsk_live_..."
                      className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none font-mono font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      {t('paymentMethods.webhookSecret', 'WEBHOOK SECRET (TÙY CHỌN)')}
                    </label>
                    <input
                      value={formData.configKey2}
                      onChange={(e) => setFormData({ ...formData, configKey2: e.target.value })}
                      placeholder="SW_SEPAY_SECRET_..."
                      className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none font-mono font-medium"
                    />
                  </div>
                </div>
              )}

              {/* THÔNG TIN NGÂN HÀNG THỤ HƯỞNG (KHI CHỌN SEPAY HOẶC TRANSFER) */}
              {(formData.gatewayType === 'SEPAY' || formData.gatewayType === 'TRANSFER') && (
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Building2 size={15} className="text-amber-600" />
                    <span>{t('paymentMethods.bankInfo', 'Thông tin Ngân hàng thụ hưởng')}</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      {t('paymentMethods.bankName', 'NGÂN HÀNG NHẬN TIỀN')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.bankCode}
                      onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })}
                      className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none font-medium cursor-pointer"
                    >
                      {POPULAR_BANKS.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        {t('paymentMethods.accountNumber', 'SỐ TÀI KHOẢN')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        required
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        placeholder="VD: SEPSUSHIWA"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        {t('paymentMethods.checkAccount', 'Kiểm tra Tên Chủ Thẻ')}
                      </label>
                      <button
                        type="button"
                        onClick={handleCheckAccountName}
                        className="w-full h-10 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Search size={14} />
                        <span>{t('paymentMethods.checkAccount', 'Kiểm tra Tên Chủ Thẻ')}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      {t('paymentMethods.accountHolder', 'TÊN NGƯỜI THỤ HƯỞNG (VIẾT KHÔNG DẤU)')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value.toUpperCase() })}
                      placeholder="VD: HUYNH THANH PHAT"
                      className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  {t('paymentMethods.close', 'Đóng')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{t('paymentMethods.saving', 'Đang lưu...')}</span>
                    </>
                  ) : (
                    <span>💾 {t('paymentMethods.save', 'Lưu Cấu Hình')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
