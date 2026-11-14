'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Search,
  Ticket,
  ListPlus,
  Building2,
  Copy,
  Power,
  Gauge,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductOption {
  id: string;
  itemCode?: string | null;
  name: string;
  price: number;
  imageUrl?: string;
  category?: { id?: string; name: string };
  categoryId?: string;
}

interface BuffetPackage {
  id: string;
  branchId: string;
  name: string;
  description?: string;
  active: boolean;
  displayOrder: number;
  maxItemsPerSubmission?: number | null;
  createdAt: string;
  branch?: {
    id: string;
    name: string;
    branchCode?: string;
  };
  tickets: Array<{
    id: string;
    productId: string;
    product: ProductOption;
  }>;
  items: Array<{
    id: string;
    productId: string;
    displayOrder: number;
    maxQuantityPerRound?: number | null;
    maxTotalQuantity?: number | null;
    availableForQr: boolean;
    allowRetailPurchase: boolean;
    product: ProductOption;
  }>;
}

interface BranchOption {
  id: string;
  name: string;
  branchCode?: string;
}

export default function BuffetManagementPage() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [packages, setPackages] = useState<BuffetPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // 1. Fetch Branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        let res = await fetch('/api/admin/branches', { credentials: 'include' });
        let json = await res.json();
        let list: BranchOption[] = [];
        if (json.success && Array.isArray(json.data)) {
          list = json.data;
        } else if (Array.isArray(json)) {
          list = json;
        } else {
          res = await fetch('/api/home/branches');
          json = await res.json();
          if (Array.isArray(json)) list = json;
        }
        if (list.length > 0) {
          setBranches(list);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách chi nhánh:', err);
      }
    };
    void loadBranches();
  }, []);

  // 2. Fetch Buffet Packages
  const fetchPackages = useCallback(async (branchId: string) => {
    setIsLoading(true);
    try {
      const q = branchId && branchId !== 'ALL' ? `?branchId=${branchId}` : '';
      const res = await fetch(`/api/buffet/packages${q}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPackages(data.data);
      }
    } catch (err) {
      console.error('Lỗi tải gói buffet:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPackages(selectedBranchId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedBranchId, fetchPackages]);

  const handleDeletePackage = async (id: string, pkgName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa gói Buffet "${pkgName}"?`)) return;

    try {
      const res = await fetch(`/api/buffet/packages/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể xóa gói');
      }

      toast.success('Đã xóa gói Buffet');
      fetchPackages(selectedBranchId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa gói Buffet');
    }
  };

  const handleDuplicatePackage = async (pkg: BuffetPackage) => {
    try {
      const res = await fetch(`/api/buffet/packages/${pkg.id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể nhân bản gói');
      }
      toast.success(`Đã nhân bản gói "${pkg.name}"`);
      fetchPackages(selectedBranchId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi nhân bản gói Buffet');
    }
  };

  const handleTogglePackageActive = async (pkg: BuffetPackage) => {
    try {
      const nextActive = !pkg.active;
      const res = await fetch(`/api/buffet/packages/${pkg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể đổi trạng thái gói');
      }
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, active: nextActive } : p)),
      );
      toast.success(
        nextActive ? `Đã bật gói "${pkg.name}"` : `Đã tạm tắt gói "${pkg.name}"`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái gói');
    }
  };

  const filteredPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return packages.filter((pkg) => {
      const matchSearch =
        !q ||
        pkg.name.toLowerCase().includes(q) ||
        pkg.description?.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? pkg.active : !pkg.active);
      return matchSearch && matchStatus;
    });
  }, [packages, searchQuery, statusFilter]);

  const createHref =
    selectedBranchId && selectedBranchId !== 'ALL'
      ? `/admin/buffet/create?branchId=${encodeURIComponent(selectedBranchId)}`
      : '/admin/buffet/create';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none font-sans text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[#da251d] font-bold text-xs uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>POS Bán hàng · Gói Buffet &amp; QR</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cấu hình Gói Buffet</h1>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập vé đại diện, thực đơn 0đ theo danh mục và giới hạn từng món theo chi nhánh.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl">
            <Building2 className="w-4 h-4 text-[#da251d] shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả chi nhánh ({packages.length} gói)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <Link
            href={createHref}
            className="h-11 px-5 rounded-2xl bg-[#da251d] hover:bg-[#ba1b14] active:scale-95 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-red-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Gói Buffet Mới</span>
          </Link>
        </div>
      </div>

      {/* Branch Tabs Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedBranchId('ALL')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
            selectedBranchId === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tất cả chi nhánh
        </button>
        {branches.map((b) => {
          const count = packages.filter((p) => p.branchId === b.id).length;
          const isSelected = selectedBranchId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBranchId(b.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-[#da251d] text-white shadow-xs shadow-red-500/20 font-black'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{b.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên gói Buffet..."
              className="w-full h-10 pl-9 pr-4 rounded-2xl bg-white border border-slate-200 focus:border-[#da251d] text-xs font-medium outline-none transition-all shadow-2xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="inline-flex items-center bg-white border border-slate-200 rounded-2xl p-1 gap-1 shadow-2xs">
            {([
              { id: 'ALL', label: 'Tất cả' },
              { id: 'ACTIVE', label: 'Đang bật' },
              { id: 'INACTIVE', label: 'Tạm tắt' },
            ] as const).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs font-bold text-slate-400">
          Hiển thị: {filteredPackages.length} gói Buffet
        </span>
      </div>

      {/* Packages Grid */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-400">
          <UtensilsCrossed className="w-8 h-8 animate-spin mx-auto text-[#da251d] mb-2" />
          <p className="text-xs font-bold">Đang tải danh sách gói Buffet...</p>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Chưa có gói Buffet nào</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {selectedBranchId !== 'ALL'
              ? 'Chi nhánh này chưa thiết lập gói Buffet. Vui lòng tạo gói mới để bắt đầu.'
              : 'Hệ thống chưa có gói Buffet nào. Nhấn nút bên dưới để tạo gói Buffet đầu tiên.'}
          </p>
          <Link
            href={createHref}
            className="px-5 py-2.5 bg-[#da251d] hover:bg-[#ba1b14] text-white rounded-2xl text-xs font-bold shadow-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Gói Buffet Ngay</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => {
            const branchInfo = branches.find((b) => b.id === pkg.branchId) || pkg.branch;
            const itemLimitCount = pkg.items.filter(
              (it) =>
                (typeof it.maxQuantityPerRound === 'number' && it.maxQuantityPerRound > 0) ||
                (typeof it.maxTotalQuantity === 'number' && it.maxTotalQuantity > 0),
            ).length;

            return (
              <div
                key={pkg.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Thứ tự: #{pkg.displayOrder}
                        </span>
                        {branchInfo && (
                          <span className="text-[10px] font-black bg-red-50 text-[#da251d] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            <span>{branchInfo.name}</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-slate-900 mt-0.5">{pkg.name}</h3>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        pkg.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {pkg.active ? 'Đang hoạt động' : 'Tạm tắt'}
                    </span>
                  </div>

                  {pkg.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pkg.description}</p>
                  )}

                  {/* Submission limit & per-dish limit badges */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                      <Gauge className="w-3.5 h-3.5 text-amber-600" />
                      {typeof pkg.maxItemsPerSubmission === 'number' && pkg.maxItemsPerSubmission > 0
                        ? `${pkg.maxItemsPerSubmission} món / lần gửi`
                        : 'Không giới hạn / lần gửi'}
                    </span>

                    {itemLimitCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        {itemLimitCount} món giới hạn riêng
                      </span>
                    )}
                  </div>

                  {/* Section 1: Vé Buffet (Món đại diện) */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Ticket className="w-3.5 h-3.5" />
                      <span>Vé Buffet đại diện ({pkg.tickets.length} vé)</span>
                    </span>
                    <div className="space-y-1.5">
                      {pkg.tickets.map((tk) => (
                        <div
                          key={tk.id}
                          className="flex items-center justify-between text-xs bg-indigo-50/60 p-2 rounded-xl border border-indigo-100/60"
                        >
                          <span className="font-bold text-slate-800">{tk.product?.name}</span>
                          <span className="font-mono font-black text-indigo-700">
                            {tk.product?.price.toLocaleString('vi-VN')}đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Món con được gọi */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <ListPlus className="w-3.5 h-3.5" />
                      <span>Món con trong gói ({pkg.items.length} món)</span>
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                      {pkg.items.slice(0, 10).map((it) => {
                        const hasCap =
                          (it.maxQuantityPerRound && it.maxQuantityPerRound > 0) ||
                          (it.maxTotalQuantity && it.maxTotalQuantity > 0);
                        return (
                          <span
                            key={it.id}
                            className={`text-[11px] px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${
                              hasCap
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span>{it.product?.name}</span>
                            {hasCap && (
                              <span className="text-[10px] font-mono text-amber-700">
                                ({it.maxQuantityPerRound ?? '∞'}/{it.maxTotalQuantity ?? '∞'})
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {pkg.items.length > 10 && (
                        <span className="text-[11px] text-slate-400 font-bold px-1 py-0.5">
                          +{pkg.items.length - 10} món nữa...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTogglePackageActive(pkg)}
                      title={pkg.active ? 'Tạm tắt gói Buffet' : 'Kích hoạt gói Buffet'}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                        pkg.active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{pkg.active ? 'Đang bật' : 'Đã tắt'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicatePackage(pkg)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Nhân bản</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/admin/buffet/${pkg.id}/edit`}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sửa</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
