'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Ticket, 
  Truck, 
  ArrowLeft, 
  Save, 
  Calendar, 
  Clock, 
  DollarSign, 
  Percent, 
  Store, 
  CreditCard, 
  Users, 
  Eye, 
  AlertCircle, 
  Check,
  Sparkles,
  Info,
  Dices,
  Shuffle,
  Bell,
  Wallet,
  ShoppingBag,
  Layers,
  Flame,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface VoucherFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function VoucherForm({ initialData, isEdit = false }: VoucherFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [distributing, setDistributing] = useState(false);

  // Reference data
  const [branches, setBranches] = useState<any[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    code: initialData?.code || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    discountType: initialData?.discountType || 'FIXED_AMOUNT',
    discountValue: initialData?.discountValue !== undefined ? initialData.discountValue : 20000,
    maxDiscount: initialData?.maxDiscount || '',
    minOrderValue: initialData?.minOrderValue !== undefined ? initialData.minOrderValue : 0,
    isFirstOrderOnly: initialData?.isFirstOrderOnly ?? false,
    usageLimit: initialData?.usageLimit ?? '',
    usageLimitPerUser: initialData?.usageLimitPerUser ?? 1,
    isPublic: initialData?.isPublic ?? true,
    isActive: initialData?.isActive ?? true,
    applicableScope: initialData?.applicableScope || 'ALL',
    applicableProductsScope: initialData?.applicableProductsScope || 'ALL',
    applicableCategoryIds: initialData?.applicableCategoryIds || '',
    applicableProductIds: initialData?.applicableProductIds || '',
    targetCustomerScope: initialData?.targetCustomerScope || 'ALL',
    targetCustomerIds: initialData?.targetCustomerIds || '',
    startDate: initialData?.startDate 
      ? new Date(initialData.startDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    endDate: initialData?.endDate 
      ? new Date(initialData.endDate).toISOString().slice(0, 16)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    branchIds: initialData?.branches ? initialData.branches.map((b: any) => b.id) : [],
    membershipTierIds: initialData?.membershipTiers ? initialData.membershipTiers.map((t: any) => t.id) : [],
    appliesToAllPaymentMethods: initialData?.appliesToAllPaymentMethods ?? true,
    paymentMethodIds: initialData?.voucherPaymentMethods 
      ? initialData.voucherPaymentMethods.map((vpm: any) => vpm.paymentMethodId || vpm.paymentMethod?.id)
      : [],
    imageUrl: initialData?.imageUrl || '',
  });

  // Fetch branches, tiers, payment methods, categories, products
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [branchRes, tierRes, pmRes, catRes, prodRes] = await Promise.all([
          fetch('/api/admin/branches', { credentials: 'include' }).catch(() => null),
          fetch('/api/admin/membership-tiers', { credentials: 'include' }).catch(() => null),
          fetch('/api/payment-methods/admin/all', { credentials: 'include' }).catch(() => null),
          fetch('/api/categories').catch(() => null),
          fetch('/api/products/search?limit=100').catch(() => null),
        ]);

        if (branchRes && branchRes.ok) {
          const data = await branchRes.json();
          setBranches(Array.isArray(data) ? data : (data?.data || []));
        }
        if (tierRes && tierRes.ok) {
          const data = await tierRes.json();
          setMembershipTiers(Array.isArray(data) ? data : (data?.data || []));
        }
        if (pmRes && pmRes.ok) {
          const data = await pmRes.json();
          setPaymentMethods(Array.isArray(data) ? data : (data?.data || []));
        }
        if (catRes && catRes.ok) {
          const data = await catRes.json();
          setCategories(Array.isArray(data) ? data : (data?.data || []));
        }
        if (prodRes && prodRes.ok) {
          const data = await prodRes.json();
          setProducts(Array.isArray(data) ? data : (data?.data || []));
        }
      } catch (err) {
        console.error('Error fetching voucher form metadata:', err);
      }
    };

    fetchMetadata();
  }, []);

  // Sinh mã voucher ngẫu nhiên chuyên nghiệp
  const handleGenerateRandomCode = (prefix = 'AVORA') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generated = `${prefix}${rand}`;
    setFormData((prev) => ({ ...prev, code: generated }));
    toast.success(`Đã sinh mã ngẫu nhiên: ${generated}`, { icon: '🎲', duration: 2500 });
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('Vui lòng nhập mã Voucher');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề Voucher');
      return;
    }
    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error('Ngày kết thúc phải diễn ra sau ngày bắt đầu');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        maxDiscount: formData.maxDiscount !== '' ? Number(formData.maxDiscount) : null,
        minOrderValue: Number(formData.minOrderValue) || 0,
        isFirstOrderOnly: Boolean(formData.isFirstOrderOnly),
        usageLimit: formData.usageLimit !== '' ? Number(formData.usageLimit) : null,
        usageLimitPerUser: formData.usageLimitPerUser !== '' ? Number(formData.usageLimitPerUser) : null,
        isPublic: Boolean(formData.isPublic),
        isActive: Boolean(formData.isActive),
        applicableScope: formData.applicableScope,
        applicableProductsScope: formData.applicableProductsScope,
        applicableCategoryIds: formData.applicableCategoryIds || null,
        applicableProductIds: formData.applicableProductIds || null,
        targetCustomerScope: formData.targetCustomerScope,
        targetCustomerIds: formData.targetCustomerIds || null,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        branchIds: formData.branchIds,
        membershipTierIds: formData.membershipTierIds,
        appliesToAllPaymentMethods: formData.appliesToAllPaymentMethods,
        paymentMethodIds: formData.appliesToAllPaymentMethods ? [] : formData.paymentMethodIds,
        imageUrl: formData.imageUrl.trim() || null,
      };

      const url = isEdit
        ? `/api/admin/promotions/vouchers/${initialData.id}`
        : `/api/admin/promotions/vouchers`;

      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật Voucher thành công!' : 'Tạo mới Voucher thành công!', { icon: '🎉' });
        router.push('/admin/vouchers');
        router.refresh();
      } else {
        toast.error(resData.message || 'Lỗi khi lưu voucher');
      }
    } catch (err) {
      toast.error('Không thể kết nối đến máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!initialData?.id) return;
    if (!window.confirm('Hệ thống sẽ kiểm tra đối tượng hợp lệ của Voucher và tự động lưu vào Ví voucher của các khách hàng phù hợp, đồng thời gửi thông báo. Bạn có chắc chắn muốn phát không?')) {
      return;
    }

    setDistributing(true);
    const loadingToast = toast.loading('Đang tự động phát voucher vào ví khách hàng...');
    try {
      const res = await fetch(`/api/admin/promotions/vouchers/${initialData.id}/auto-distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Đã phát voucher thành công!`, { id: loadingToast, duration: 4000 });
      } else {
        toast.error(data.message || 'Lỗi khi phát voucher', { id: loadingToast });
      }
    } catch (err: any) {
      toast.error('Không thể kết nối máy chủ', { id: loadingToast });
    } finally {
      setDistributing(false);
    }
  };

  // Toggle helpers
  const toggleBranch = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(id)
        ? prev.branchIds.filter((bid: string) => bid !== id)
        : [...prev.branchIds, id],
    }));
  };

  const toggleTier = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      membershipTierIds: prev.membershipTierIds.includes(id)
        ? prev.membershipTierIds.filter((tid: string) => tid !== id)
        : [...prev.membershipTierIds, id],
    }));
  };

  const togglePaymentMethod = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      paymentMethodIds: prev.paymentMethodIds.includes(id)
        ? prev.paymentMethodIds.filter((pmId: string) => pmId !== id)
        : [...prev.paymentMethodIds, id],
    }));
  };

  const toggleCategory = (id: string) => {
    const current = formData.applicableCategoryIds ? formData.applicableCategoryIds.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const updated = current.includes(id) ? current.filter((cid: string) => cid !== id) : [...current, id];
    setFormData(prev => ({ ...prev, applicableCategoryIds: updated.join(',') }));
  };

  const toggleProduct = (id: string) => {
    const current = formData.applicableProductIds ? formData.applicableProductIds.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const updated = current.includes(id) ? current.filter((pid: string) => pid !== id) : [...current, id];
    setFormData(prev => ({ ...prev, applicableProductIds: updated.join(',') }));
  };

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            href="/admin/vouchers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Quay lại Quản lý Vouchers</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Ticket className="text-red-600" />
            <span>{isEdit ? `Chỉnh sửa Voucher: ${initialData?.code}` : 'Tạo Mới Mã Ưu Đãi (Voucher)'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Cấu hình chiết khấu, điều kiện kích hoạt, giới hạn hạn ngạch và phân quyền sử dụng.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isEdit && initialData?.id && (
            <>
              <button
                type="button"
                onClick={handleAutoDistribute}
                disabled={distributing}
                className="px-3.5 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                title="Kiểm tra đối tượng và tự động lưu vào ví khách hàng"
              >
                <Wallet size={14} />
                <span>{distributing ? 'Đang phát...' : 'Tự động phát vào ví'}</span>
              </button>

              <Link
                href={`/admin/vouchers/${initialData.id}/notify`}
                className="px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Bell size={14} />
                <span>Gửi Thông Báo</span>
              </Link>
            </>
          )}

          <Link
            href="/admin/vouchers"
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Hủy bỏ
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save size={14} />
                <span>{isEdit ? 'Lưu thay đổi' : 'Phát hành Voucher'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Grid: Form 2/3 and Live Ticket Preview 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT 2 COLUMNS: FORM CONFIGURATION */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          
          {/* SECTION 1: CƠ BẢN */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <Sparkles size={16} className="text-red-600" />
              <span>1. Thông Tin Nhận Diện Voucher</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Mã Code hiển thị <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleGenerateRandomCode('AVORA')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer shadow-2xs"
                      title="Sinh mã ngẫu nhiên dạng AVORA-XXXXX"
                    >
                      <Dices size={13} className="text-red-500" />
                      <span>Tạo mã ngẫu nhiên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateRandomCode('SALE')}
                      className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer"
                      title="Sinh mã dạng SALE-XXXXX"
                    >
                      SALE
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateRandomCode('VIP')}
                      className="px-1.5 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer"
                      title="Sinh mã dạng VIP-XXXXX"
                    >
                      VIP
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="VD: AVORA50K, FREESHIP..."
                    className="w-full pl-3.5 pr-10 py-2 font-mono font-black text-sm uppercase text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateRandomCode('AVORA')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Đổi mã ngẫu nhiên khác"
                  >
                    <Shuffle size={15} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Mã viết liền không dấu, tự động viết hoa (nhấn nút để tự sinh mã)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề voucher <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="VD: Giảm 50.000đ cho đơn từ 200k"
                  className="w-full px-3.5 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mô tả chi tiết & Thể lệ áp dụng
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Nhập thể lệ áp dụng, điều kiện chi tiết cho khách hàng xem..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">Hiển thị công khai</p>
                  <p className="text-[11px] text-slate-500">Khách thấy trên Kho Voucher để bấm lưu</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-800">Trạng thái phát hành</p>
                  <p className="text-[11px] text-slate-500">Kích hoạt để khách hàng sử dụng</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: CƠ CHẾ GIẢM GIÁ */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <DollarSign size={16} className="text-red-600" />
              <span>2. Cơ Chế Giảm Giá & Điều Kiện Đơn Hàng</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loại chiết khấu</label>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                >
                  <option value="FIXED_AMOUNT">Giảm số tiền cố định (VNĐ)</option>
                  <option value="PERCENTAGE">Giảm theo phần trăm (%)</option>
                  <option value="FREE_SHIP">Miễn phí giao hàng (FreeShip)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {formData.discountType === 'PERCENTAGE'
                    ? 'Phần trăm giảm (%) *'
                    : formData.discountType === 'FREE_SHIP'
                    ? 'Mức giảm tối đa phí ship (0 = 100%)'
                    : 'Số tiền giảm (VNĐ) *'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 font-bold text-sm text-red-600 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              {formData.discountType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Giảm tối đa (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Để trống = Không giới hạn"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Giá trị đơn hàng tối thiểu (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minOrderValue}
                  onChange={(e) => setFormData({ ...formData, minOrderValue: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  placeholder="0 = Mọi đơn hàng"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="isFirstOrderOnly"
                  checked={formData.isFirstOrderOnly}
                  onChange={(e) => setFormData({ ...formData, isFirstOrderOnly: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded cursor-pointer"
                />
                <label htmlFor="isFirstOrderOnly" className="cursor-pointer">
                  <p className="text-xs font-bold text-slate-800">Chỉ dành cho đơn hàng đầu tiên</p>
                  <p className="text-[11px] text-slate-500">Chỉ khách chưa từng có đơn được dùng</p>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 3: HẠN NGẠCH & THỜI HẠN */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <Clock size={16} className="text-red-600" />
              <span>3. Hạn Ngạch Sử Dụng & Thời Gian Hiệu Lực</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tổng lượt sử dụng toàn hệ thống
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                  placeholder="Để trống = Không giới hạn lượt"
                  className="w-full px-3.5 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Khi đạt mốc này, mã sẽ tự chuyển sang hết lượt</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số lần dùng tối đa mỗi khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.usageLimitPerUser}
                  onChange={(e) => setFormData({ ...formData, usageLimitPerUser: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 text-sm font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Khách dùng hết số lần này sẽ bị khóa mã ngay tại app</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thời gian bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thời gian kết thúc (HSD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: PHẠM VI ÁP DỤNG */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-900 font-bold text-sm">
              <Store size={16} className="text-red-600" />
              <span>4. Phân Quyền & Phạm Vi Áp Dụng</span>
            </div>

            {/* Kênh áp dụng */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Kênh bán hàng</label>
              <div className="flex items-center gap-2">
                {[
                  { id: 'ALL', label: 'Tất cả (Online & POS)' },
                  { id: 'ONLINE', label: 'Chỉ Online Website' },
                  { id: 'POS', label: 'Chỉ Tại quầy (POS)' },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, applicableScope: scope.id })}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formData.applicableScope === scope.id
                        ? 'bg-red-50 text-red-600 border-red-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phạm vi Món ăn áp dụng */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-red-600" />
                <span>Món ăn áp dụng</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'ALL', label: 'Tất cả các món' },
                  { id: 'CATEGORY', label: 'Theo danh mục món' },
                  { id: 'SPECIFIC_PRODUCTS', label: 'Món ăn cụ thể' },
                  { id: 'BEST_SELLER', label: 'Món bán nhiều (Best Seller)' },
                  { id: 'SLOW_SELLER', label: 'Món bán chậm (Cần đẩy số)' },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, applicableProductsScope: scope.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                      formData.applicableProductsScope === scope.id
                        ? 'bg-red-50 text-red-600 border-red-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>

              {/* Nếu chọn THEO DANH MỤC */}
              {formData.applicableProductsScope === 'CATEGORY' && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Chọn danh mục món áp dụng:</span>
                    <span className="text-[11px] text-slate-400">
                      {formData.applicableCategoryIds ? `${formData.applicableCategoryIds.split(',').filter(Boolean).length} danh mục` : 'Chưa chọn'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => {
                      const selectedList = formData.applicableCategoryIds ? formData.applicableCategoryIds.split(',').map((s: string) => s.trim()) : [];
                      const isSelected = selectedList.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCategory(c.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nếu chọn MÓN ĂN CỤ THỂ */}
              {formData.applicableProductsScope === 'SPECIFIC_PRODUCTS' && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Chọn món ăn áp dụng:</span>
                    <span className="text-[11px] text-slate-400">
                      {formData.applicableProductIds ? `${formData.applicableProductIds.split(',').filter(Boolean).length} món đã chọn` : 'Chưa chọn'}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 p-1">
                    {products.slice(0, 50).map((p) => {
                      const selectedList = formData.applicableProductIds ? formData.applicableProductIds.split(',').map((s: string) => s.trim()) : [];
                      const isSelected = selectedList.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleProduct(p.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Đối tượng Khách hàng áp dụng */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Users size={14} className="text-purple-600" />
                <span>Đối tượng khách hàng áp dụng</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ALL', label: 'Tất cả khách hàng' },
                  { id: 'NEW_CUSTOMER', label: 'Khách hàng mới' },
                  { id: 'MEMBERSHIP_TIER', label: 'Theo hạng thẻ' },
                  { id: 'SPECIFIC_CUSTOMERS', label: 'Khách hàng cụ thể' },
                ].map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, targetCustomerScope: scope.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                      formData.targetCustomerScope === scope.id
                        ? 'bg-purple-50 text-purple-700 border-purple-300 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>

              {formData.targetCustomerScope === 'NEW_CUSTOMER' && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200 mt-2">
                  ✨ Chỉ áp dụng cho tài khoản khách hàng mới chưa từng hoàn tất bất kỳ đơn hàng nào tại Avora.
                </p>
              )}

              {formData.targetCustomerScope === 'SPECIFIC_CUSTOMERS' && (
                <div className="mt-2 space-y-1">
                  <input
                    type="text"
                    value={formData.targetCustomerIds}
                    onChange={(e) => setFormData({ ...formData, targetCustomerIds: e.target.value })}
                    placeholder="Nhập User IDs hoặc Số điện thoại, phân tách bằng dấu phẩy..."
                    className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">Ví dụ: user_123, user_456 hoặc SĐT 0901234567, 0987654321</p>
                </div>
              )}
            </div>

            {/* Chi nhánh áp dụng */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Chi nhánh áp dụng</label>
                <span className="text-[11px] text-slate-400">
                  {formData.branchIds.length === 0 ? 'Tất cả chi nhánh' : `Đã chọn ${formData.branchIds.length} chi nhánh`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, branchIds: [] })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                    formData.branchIds.length === 0
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  Tất cả chi nhánh
                </button>
                {branches.map((b) => {
                  const isChecked = formData.branchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBranch(b.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hạng thẻ thành viên */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Hạng thẻ thành viên áp dụng</label>
                <span className="text-[11px] text-slate-400">
                  {formData.membershipTierIds.length === 0 ? 'Mọi khách hàng' : `Đã chọn ${formData.membershipTierIds.length} hạng thẻ`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, membershipTierIds: [] })}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                    formData.membershipTierIds.length === 0
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  Mọi hạng thẻ
                </button>
                {membershipTiers.map((tier) => {
                  const isChecked = formData.membershipTierIds.includes(tier.id);
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => toggleTier(tier.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-purple-50 text-purple-700 border-purple-300 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tier.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Phương thức thanh toán áp dụng</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="pmAll"
                    checked={formData.appliesToAllPaymentMethods}
                    onChange={() => setFormData({ ...formData, appliesToAllPaymentMethods: true })}
                    className="w-4 h-4 text-red-600 cursor-pointer"
                  />
                  <span>Áp dụng cho tất cả phương thức thanh toán</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="pmAll"
                    checked={!formData.appliesToAllPaymentMethods}
                    onChange={() => setFormData({ ...formData, appliesToAllPaymentMethods: false })}
                    className="w-4 h-4 text-red-600 cursor-pointer"
                  />
                  <span>Chỉ áp dụng cho các phương thức chỉ định bên dưới:</span>
                </label>

                {!formData.appliesToAllPaymentMethods && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    {paymentMethods.map((pm) => {
                      const isChecked = formData.paymentMethodIds.includes(pm.id);
                      return (
                        <label
                          key={pm.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePaymentMethod(pm.id)}
                            className="w-3.5 h-3.5 text-red-600 rounded cursor-pointer"
                          />
                          <span className="truncate">{pm.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

        </form>

        {/* RIGHT 1 COLUMN: REAL-TIME TICKET PREVIEW */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Eye size={14} className="text-red-600" />
                <span>Xem Trước Hiển Thị (Live Preview)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Khách hàng nhìn thấy
              </span>
            </div>

            {/* Ticket Card Preview */}
            <div className="border border-red-200 rounded-2xl overflow-hidden shadow-sm bg-white flex">
              <div className={`w-28 shrink-0 flex flex-col items-center justify-center p-3 text-white text-center select-none relative ${
                formData.discountType === 'FREE_SHIP'
                  ? 'bg-gradient-to-b from-emerald-500 to-teal-600'
                  : 'bg-gradient-to-b from-red-500 to-rose-600'
              }`}>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mb-1">
                  {formData.discountType === 'FREE_SHIP' ? <Truck size={16} /> : <Ticket size={16} />}
                </div>
                <span className="font-black text-base tracking-tight leading-tight">
                  {formData.discountType === 'PERCENTAGE' && `GIẢM ${formData.discountValue || 0}%`}
                  {formData.discountType === 'FIXED_AMOUNT' && `GIẢM ${Math.round((formData.discountValue || 0) / 1000)}K`}
                  {formData.discountType === 'FREE_SHIP' && 'FREESHIP'}
                </span>
                <span className="text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full bg-black/20">
                  {formData.discountType === 'FREE_SHIP' ? 'Vận chuyển' : 'Đơn hàng'}
                </span>
              </div>

              <div className="flex-1 p-3 min-w-0 flex flex-col justify-between border-l border-dashed border-slate-200">
                <div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-mono font-bold text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">
                      {formData.code || 'CODE'}
                    </span>
                    {formData.minOrderValue > 0 && (
                      <span className="text-[9px] text-slate-500">
                        Đơn từ {Math.round(formData.minOrderValue / 1000)}k
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-xs text-slate-800 mt-1 line-clamp-1">
                    {formData.title || 'Tiêu đề voucher của bạn'}
                  </p>

                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                    {formData.description || 'Chưa có mô tả chi tiết'}
                  </p>
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>HSD: {new Date(formData.endDate).toLocaleDateString('vi-VN')}</span>
                  <span className="font-bold text-red-600">Áp dụng</span>
                </div>
              </div>
            </div>

            {/* Quick Summary Info */}
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Kênh bán:</span>
                <strong className="text-slate-800">{formData.applicableScope}</strong>
              </div>
              <div className="flex justify-between">
                <span>Lượt dùng/khách:</span>
                <strong className="text-slate-800">{formData.usageLimitPerUser} lượt</strong>
              </div>
              <div className="flex justify-between">
                <span>Tổng quota:</span>
                <strong className="text-slate-800">
                  {formData.usageLimit ? `${formData.usageLimit} lượt` : 'Không giới hạn'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Công khai:</span>
                <strong className={formData.isPublic ? 'text-emerald-600' : 'text-amber-600'}>
                  {formData.isPublic ? 'Công khai' : 'Mã ẩn'}
                </strong>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
