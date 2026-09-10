'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Search,
  AlertCircle,
  Tag,
  Ticket,
  ListPlus,
  Building2,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductOption {
  id: string;
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
    availableForQr: boolean;
    allowRetailPurchase: boolean;
    product: ProductOption;
  }>;
}

export default function BuffetManagementPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [packages, setPackages] = useState<BuffetPackage[]>([]);
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BuffetPackage | null>(null);

  // Form State
  const [modalBranchId, setModalBranchId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [active, setActive] = useState(true);
  const [ticketProductIds, setTicketProductIds] = useState<string[]>([]);
  const [itemProductIds, setItemProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        let res = await fetch('/api/admin/branches', { credentials: 'include' });
        let json = await res.json();
        let list: any[] = [];
        if (json.success && Array.isArray(json.data)) {
          list = json.data;
        } else if (Array.isArray(json)) {
          list = json;
        } else {
          // Fallback to /api/home/branches
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
    loadBranches();
  }, []);

  // 2. Fetch All Products for a specific branch
  const fetchProducts = useCallback(async (branchId: string) => {
    if (!branchId || branchId === 'ALL') return;
    setIsLoadingProducts(true);
    try {
      const res = await fetch(`/api/pos/products?branchId=${branchId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.products)) {
        setAllProducts(data.data.products);
      }
    } catch (err) {
      console.error('Lỗi tải sản phẩm:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  // 3. Fetch Buffet Packages
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
    fetchPackages(selectedBranchId);
  }, [selectedBranchId, fetchPackages]);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    const targetBranchId = selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id || '';
    setEditingPackage(null);
    setModalBranchId(targetBranchId);
    setName('');
    setDescription('');
    setDisplayOrder(packages.length + 1);
    setActive(true);
    setTicketProductIds([]);
    setItemProductIds([]);
    setProductSearch('');
    setSelectedCategoryFilter('ALL');
    setIsModalOpen(true);
    if (targetBranchId) {
      fetchProducts(targetBranchId);
    }
  };

  // Handle open edit modal
  const handleOpenEditModal = (pkg: BuffetPackage) => {
    setEditingPackage(pkg);
    setModalBranchId(pkg.branchId);
    setName(pkg.name);
    setDescription(pkg.description || '');
    setDisplayOrder(pkg.displayOrder);
    setActive(pkg.active);
    setTicketProductIds(pkg.tickets.map((t) => t.productId));
    setItemProductIds(pkg.items.map((i) => i.productId));
    setProductSearch('');
    setSelectedCategoryFilter('ALL');
    setIsModalOpen(true);
    fetchProducts(pkg.branchId);
  };

  const handleToggleTicket = (prodId: string) => {
    setTicketProductIds((prev) =>
      prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId]
    );
  };

  const handleToggleItem = (prodId: string) => {
    setItemProductIds((prev) =>
      prev.includes(prodId) ? prev.filter((id) => id !== prodId) : [...prev, prodId]
    );
  };

  const handleSelectAllFilteredAsItems = () => {
    const newIds = new Set(itemProductIds);
    filteredProductsForModal.forEach((p) => newIds.add(p.id));
    setItemProductIds(Array.from(newIds));
    toast.success(`Đã thêm ${filteredProductsForModal.length} món vào gói Buffet`);
  };

  const handleDeselectAllFilteredItems = () => {
    const filterIds = new Set(filteredProductsForModal.map((p) => p.id));
    setItemProductIds((prev) => prev.filter((id) => !filterIds.has(id)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên gói Buffet');
      return;
    }

    if (!modalBranchId) {
      toast.error('Vui lòng chọn chi nhánh áp dụng');
      return;
    }

    // YÊU CẦU BẮT BUỘC: Ít nhất 1 vé buffet
    if (ticketProductIds.length === 0) {
      toast.error('BẮT BUỘC phải chọn ít nhất 1 Món đại diện / Vé Buffet!');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      branchId: modalBranchId,
      name: name.trim(),
      description: description.trim() || undefined,
      displayOrder: Number(displayOrder) || 0,
      active,
      ticketProductIds,
      items: itemProductIds.map((productId, idx) => ({
        productId,
        displayOrder: idx + 1,
        availableForQr: true,
        allowRetailPurchase: true,
      })),
    };

    try {
      const url = editingPackage
        ? `/api/buffet/packages/${editingPackage.id}`
        : '/api/buffet/packages';
      const method = editingPackage ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi khi lưu gói Buffet');
      }

      toast.success(editingPackage ? 'Cập nhật gói Buffet thành công!' : 'Tạo gói Buffet thành công!');
      setIsModalOpen(false);
      fetchPackages(selectedBranchId);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa gói Buffet');
    }
  };

  // Categories in current modal branch
  const modalCategories = useMemo(() => {
    const catsMap = new Map<string, string>();
    allProducts.forEach((p) => {
      if (p.category?.name) {
        catsMap.set(p.category.name, p.category.name);
      }
    });
    return Array.from(catsMap.keys());
  }, [allProducts]);

  // Filter products for modal selection
  const filteredProductsForModal = useMemo(() => {
    return allProducts.filter((p) => {
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase());
      const matchCat =
        selectedCategoryFilter === 'ALL' ||
        p.category?.name === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [allProducts, productSearch, selectedCategoryFilter]);

  // Filter packages in list
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchSearch =
        !searchQuery.trim() ||
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [packages, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none font-sans text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-[#da251d] font-bold text-xs uppercase tracking-wider mb-1">
            <UtensilsCrossed className="w-4 h-4" />
            <span>Quản lý Thực đơn</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cấu hình Gói Buffet</h1>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập các gói Buffet, vé đại diện tính tiền và danh mục món con được gọi 0đ theo từng chi nhánh.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Branch Selector Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl">
            <Building2 className="w-4 h-4 text-[#da251d] shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            >
              <option value="ALL">🏢 Tất cả chi nhánh ({packages.length} gói)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="h-11 px-5 rounded-2xl bg-[#da251d] hover:bg-[#ba1b14] active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Gói Buffet Mới</span>
          </button>
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
      <div className="flex items-center justify-between gap-4">
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
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-[#da251d] hover:bg-[#ba1b14] text-white rounded-2xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Gói Buffet Ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => {
            const branchInfo = branches.find((b) => b.id === pkg.branchId) || pkg.branch;
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
                      {pkg.items.slice(0, 10).map((it) => (
                        <span
                          key={it.id}
                          className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg"
                        >
                          {it.product?.name}
                        </span>
                      ))}
                      {pkg.items.length > 10 && (
                        <span className="text-[11px] text-slate-400 font-bold px-1 py-0.5">
                          +{pkg.items.length - 10} món nữa...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(pkg)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Chỉnh sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT BUFFET PACKAGE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-50 text-[#da251d] flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingPackage ? 'Chỉnh sửa Gói Buffet' : 'Tạo Gói Buffet Mới'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cấu hình chi nhánh, vé đại diện tính tiền và danh mục món con được gọi 0đ
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 pr-1">
              {/* Chi nhánh áp dụng */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Chi nhánh áp dụng <span className="text-[#da251d]">*</span>
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                  <Building2 className="w-4 h-4 text-[#da251d] shrink-0" />
                  <select
                    value={modalBranchId}
                    onChange={(e) => {
                      setModalBranchId(e.target.value);
                      fetchProducts(e.target.value);
                    }}
                    className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.district || b.province || ''})
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Chọn chi nhánh để tải danh sách sản phẩm và thực đơn của chi nhánh đó.
                </span>
              </div>

              {/* Thông tin cơ bản */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tên gói Buffet <span className="text-[#da251d]">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Buffet Nướng & Lẩu Premium"
                    required
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mô tả gói</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Hơn 50 món nướng, lẩu, sashimi hảo hạng..."
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none"
                />
              </div>

              {/* Status toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-[#da251d] rounded border-slate-300 focus:ring-[#da251d]"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Kích hoạt gói Buffet này tại chi nhánh
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Khi bật: Cho phép khách và nhân viên áp dụng gói buffet này khi mở bàn.
                  </span>
                </div>
              </label>

              {/* Product search & Category Filter for selection */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Tìm & Chọn sản phẩm gán vào gói
                  </label>
                  {isLoadingProducts && (
                    <span className="text-xs text-[#da251d] font-bold animate-pulse">
                      Đang tải danh sách món...
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Gõ tên món ăn để lọc danh sách dưới đây..."
                    className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#da251d] focus:bg-white text-xs outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                {/* Category Pills */}
                {modalCategories.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                        selectedCategoryFilter === 'ALL'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tất cả ({allProducts.length})
                    </button>
                    {modalCategories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(c)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer ${
                          selectedCategoryFilter === c
                            ? 'bg-[#da251d] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* NHÓM 1: VÉ BUFFET / MÓN ĐẠI DIỆN TÍNH TIỀN (BẮT BUỘC TỐI THIỂU 1 VÉ) */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-black text-xs uppercase tracking-wide">
                    <Ticket className="w-4 h-4 text-indigo-600" />
                    <span>Món Đại diện / Vé Buffet (BẮT BUỘC từ 1 vé trở lên)</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 font-mono">
                    Đã chọn: {ticketProductIds.length} vé
                  </span>
                </div>
                <p className="text-[11px] text-indigo-700/80">
                  Đây là các món tính tiền (VD: Buffet Người lớn 399k, Trẻ em 199k). Khi nhân viên thêm món này vào bàn, Buffet Session sẽ được kích hoạt!
                </p>

                <div className="max-h-44 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-xl border border-indigo-100">
                  {filteredProductsForModal.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {isLoadingProducts ? 'Đang nạp dữ liệu món...' : 'Không tìm thấy món ăn phù hợp'}
                    </div>
                  ) : (
                    filteredProductsForModal.map((p) => {
                      const isSelected = ticketProductIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleToggleTicket(p.id)}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-100 text-indigo-950 font-black'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <span className="block leading-tight">{p.name}</span>
                              {p.category?.name && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {p.category.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="font-mono font-bold text-indigo-700 shrink-0">
                            {p.price.toLocaleString('vi-VN')}đ
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* NHÓM 2: MÓN CON ĐƯỢC PHÉP GỌI TRONG BUFFET (0đ) */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-black text-xs uppercase tracking-wide">
                    <ListPlus className="w-4 h-4 text-emerald-600" />
                    <span>Món con được phép gọi (0đ base price)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredAsItems}
                      className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-md cursor-pointer"
                    >
                      + Chọn tất cả ({filteredProductsForModal.length})
                    </button>
                    {itemProductIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAllFilteredItems}
                        className="text-[10px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-md cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    )}
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      Đã chọn: {itemProductIds.length} món
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-700/80">
                  Khi bàn có Buffet Session, các món này sẽ được gọi với giá gốc 0đ (phụ thu option tính riêng nếu có).
                </p>

                <div className="max-h-56 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-xl border border-emerald-100">
                  {filteredProductsForModal.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {isLoadingProducts ? 'Đang nạp dữ liệu món...' : 'Không tìm thấy món ăn phù hợp'}
                    </div>
                  ) : (
                    filteredProductsForModal.map((p) => {
                      const isSelected = itemProductIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleToggleItem(p.id)}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-100 text-emerald-950 font-black'
                              : 'hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <span className="block leading-tight">{p.name}</span>
                              {p.category?.name && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  {p.category.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded font-bold mr-1.5">
                              0đ Buffet
                            </span>
                            <span className="font-mono text-slate-400 line-through text-[11px]">
                              {p.price.toLocaleString('vi-VN')}đ
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#da251d] hover:bg-[#ba1b14] active:scale-95 text-white text-xs font-bold shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Đang lưu...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingPackage ? 'Cập nhật Gói Buffet' : 'Lưu Gói Buffet Mới'}</span>
                    </>
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
