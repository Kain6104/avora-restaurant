'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Search, Plus, Edit, Trash2, Power, PowerOff, Percent, Clock, Box, ShieldCheck, Crown } from 'lucide-react';
import ImageUploader from '@/app/admin/components/ImageUploader';
import { buildApiUrl } from '@/lib/utils/api';
import { toast } from 'react-hot-toast';

export default function PromotionsManager({ activeTab }: { activeTab: 'vouchers' | 'flash-sales' | 'combos' }) {
  const { role, selectedBranchId, availableBranches } = useAdmin();

  const [vouchers, setVouchers] = useState<any[]>([]);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTierId, setFilterTierId] = useState('ALL');

  // Forms states
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<any>(null);
  const [voucherData, setVoucherData] = useState({
    code: '', title: '', discountType: 'FIXED_AMOUNT', discountValue: 0,
    startDate: '', endDate: '', minOrderValue: 0, usageLimit: 0,
    imageUrl: '', imageFile: null as File | null, branchIds: [] as string[], membershipTierIds: [] as string[], isActive: true
  });

  const [isFlashSaleModalOpen, setIsFlashSaleModalOpen] = useState(false);
  const [editingFlashSale, setEditingFlashSale] = useState<any>(null);
  const [fsData, setFsData] = useState({
    name: '', startTime: '', endTime: '', status: 'DRAFT', imageUrl: '', imageFile: null as File | null, branchIds: [] as string[], membershipTierIds: [] as string[], isActive: true, items: [] as any[]
  });

  const [productSearchFS, setProductSearchFS] = useState('');
  const [productResultsFS, setProductResultsFS] = useState<any[]>([]);

  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<any>(null);
  const [comboData, setComboData] = useState({
    name: '', description: '', price: 0, originalPrice: 0, startDate: '', endDate: '',
    usageLimit: 0, imageUrl: '', imageFile: null as File | null, branchIds: [] as string[], membershipTierIds: [] as string[], isActive: true, items: [] as any[]
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl(`/api/admin/promotions/${activeTab}`, {
        branchId: selectedBranchId !== 'ALL' ? selectedBranchId : undefined,
        search,
        membershipTierId: filterTierId !== 'ALL' ? filterTierId : undefined
      });

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (activeTab === 'vouchers') setVouchers(data.data || []);
        else if (activeTab === 'flash-sales') setFlashSales(data.data || []);
        else if (activeTab === 'combos') setCombos(data.data || []);
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMembershipTiers();
  }, [activeTab, selectedBranchId, filterTierId]);

  // Combo product search
  useEffect(() => {
    if (productSearchCombo.trim().length >= 2) {
      const fetchProducts = async () => {
        try {
          const res = await fetch(`/api/admin/products?search=${encodeURIComponent(productSearchCombo)}&limit=10`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setProductResultsCombo(data.data || []);
          }
        } catch (error) {
          console.error('Lỗi tìm kiếm sản phẩm:', error);
        }
      };
      const debounce = setTimeout(fetchProducts, 400);
      return () => clearTimeout(debounce);
    } else {
      setProductResultsCombo([]);
    }
  }, [productSearchCombo]);

  // Flash Sale product search
  useEffect(() => {
    if (productSearchFS.trim().length >= 2) {
      const fetchProducts = async () => {
        try {
          const res = await fetch(`/api/admin/products?search=${encodeURIComponent(productSearchFS)}&limit=10`, { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setProductResultsFS(data.data || []);
          }
        } catch (error) {
          console.error('Lỗi tìm kiếm sản phẩm:', error);
        }
      };
      const debounce = setTimeout(fetchProducts, 400);
      return () => clearTimeout(debounce);
    } else {
      setProductResultsFS([]);
    }
  }, [productSearchFS]);

  // Recalculate original price when items change
  useEffect(() => {
    if (isComboModalOpen) {
      const newOriginalPrice = comboData.items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
      setComboData(prev => prev.originalPrice !== newOriginalPrice ? { ...prev, originalPrice: newOriginalPrice } : prev);
    }
  }, [comboData.items, isComboModalOpen]);

  // Recalculate final price when original price or discount changes
  useEffect(() => {
    if (isComboModalOpen && comboDiscountType !== 'NONE') {
      let finalPrice = comboData.originalPrice;
      if (comboDiscountType === 'FIXED') {
        finalPrice = Math.max(0, comboData.originalPrice - comboDiscountValue);
      } else if (comboDiscountType === 'PERCENTAGE') {
        finalPrice = Math.max(0, comboData.originalPrice * (1 - comboDiscountValue / 100));
      }
      setComboData(prev => prev.price !== finalPrice ? { ...prev, price: finalPrice } : prev);
    }
  }, [comboData.originalPrice, comboDiscountType, comboDiscountValue, isComboModalOpen]);



  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const formatDateTimeForInput = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toISOString().slice(0, 16);
  };

  const submitForm = async (url: string, method: string, body: any, closeAction: () => void, folder: string) => {
    // Validate time logic
    const start = body.startDate || body.startTime;
    const end = body.endDate || body.endTime;
    if (start && end) {
      if (new Date(start) > new Date(end)) {
        toast.error('Thời gian kết thúc không hợp lý (trước thời gian bắt đầu)!');
        return;
      }
      if (new Date(start).getTime() === new Date(end).getTime() && start.includes('T')) {
        toast.error('Thời gian bắt đầu và kết thúc không được trùng nhau!');
        return;
      }
    }

    try {
      const { imageFile, ...submitData } = body;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(method === 'POST' ? 'Tạo thành công' : 'Cập nhật thành công');
        closeAction();
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Có lỗi xảy ra');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleDelete = async (url: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
    try {
      const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Xóa thành công');
        fetchData();
      } else {
        toast.error('Lỗi khi xóa');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleToggleActive = async (type: string, id: string, newStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/promotions/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Đã cập nhật trạng thái');
        fetchData();
      } else {
        toast.error('Lỗi khi cập nhật trạng thái');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  // VOUCHER ACTIONS
  const openVoucherModal = (item?: any) => {
    if (item) {
      setEditingVoucher(item);
      setVoucherData({
        ...item,
        startDate: formatDateForInput(item.startDate),
        endDate: formatDateForInput(item.endDate),
        branchIds: item.branches ? item.branches.map((b: any) => b.id) : [],
        membershipTierIds: item.membershipTiers ? item.membershipTiers.map((t: any) => t.id) : [],
        usageLimit: item.usageLimit || 0,
        imageFile: null
      });
    } else {
      setEditingVoucher(null);
      setVoucherData({ code: '', title: '', discountType: 'FIXED_AMOUNT', discountValue: 0, startDate: '', endDate: '', minOrderValue: 0, usageLimit: 0, imageUrl: '', imageFile: null, branchIds: [], membershipTierIds: [], isActive: true });
    }
    setIsVoucherModalOpen(true);
  };

  // FLASH SALE ACTIONS
  const openFlashSaleModal = (item?: any) => {
    if (item) {
      setEditingFlashSale(item);
      setFsData({
        ...item,
        startTime: formatDateTimeForInput(item.startTime),
        endTime: formatDateTimeForInput(item.endTime),
        branchIds: item.branches ? item.branches.map((b: any) => b.id) : [],
        membershipTierIds: item.membershipTiers ? item.membershipTiers.map((t: any) => t.id) : [],
        imageFile: null,
        items: item.items ? item.items.map((i: any) => ({
          productId: i.productId,
          product: i.product,
          flashSalePrice: i.flashSalePrice,
          stock: i.stock,
          maxQuantityPerUser: i.maxQuantityPerUser
        })) : []
      });
    } else {
      setEditingFlashSale(null);
      setFsData({ name: '', startTime: '', endTime: '', status: 'DRAFT', imageUrl: '', imageFile: null, branchIds: [], membershipTierIds: [], isActive: true, items: [] });
    }
    setProductSearchFS('');
    setProductResultsFS([]);
    setIsFlashSaleModalOpen(true);
  };

  // COMBO ACTIONS
  const openComboModal = (item?: any) => {
    if (item) {
      setEditingCombo(item);
      setComboData({
        ...item,
        startDate: formatDateTimeForInput(item.startDate),
        endDate: formatDateTimeForInput(item.endDate),
        branchIds: item.branches ? item.branches.map((b: any) => b.id) : [],
        membershipTierIds: item.membershipTiers ? item.membershipTiers.map((t: any) => t.id) : [],
        imageFile: null,
        items: item.items ? item.items.map((i: any) => ({
          productId: i.productId,
          product: i.product,
          quantity: i.quantity
        })) : []
      });
    } else {
      setEditingCombo(null);
      setComboData({ name: '', description: '', price: 0, originalPrice: 0, startDate: '', endDate: '', usageLimit: 0, imageUrl: '', imageFile: null, branchIds: [], membershipTierIds: [], isActive: true, items: [] });
    }
    setComboDiscountType('NONE');
    setComboDiscountValue(0);
    setIsComboModalOpen(true);
  };

  // Render Branch Selector for Admin
  const BranchSelector = ({ value, onChange }: { value: string[], onChange: (val: string[]) => void }) => {
    if (role !== 'ADMIN') return null;

    const isGlobal = !value || value.length === 0;

    const handleToggle = (id: string) => {
      if (id === '') {
        onChange([]);
      } else {
        const current = value || [];
        if (current.includes(id)) {
          onChange(current.filter(v => v !== id));
        } else {
          onChange([...current, id]);
        }
      }
    };

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Áp dụng cho Chi nhánh (ADMIN)</label>
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isGlobal ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}>
            <input type="checkbox" className="hidden" checked={isGlobal} onChange={() => handleToggle('')} />
            Toàn hệ thống
          </label>
          {availableBranches.map(b => (
            <label key={b.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${(value || []).includes(b.id) ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}>
              <input type="checkbox" className="hidden" checked={(value || []).includes(b.id)} onChange={() => handleToggle(b.id)} />
              {b.name}
            </label>
          ))}
        </div>
      </div>
    );
  };

  const MembershipTierSelector = ({ value, onChange }: { value: string[], onChange: (val: string[]) => void }) => {
    const isAll = !value || value.length === 0;

    const handleToggle = (id: string) => {
      if (id === '') {
        onChange([]);
      } else {
        const current = value || [];
        if (current.includes(id)) {
          onChange(current.filter(v => v !== id));
        } else {
          onChange([...current, id]);
        }
      }
    };

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Áp dụng cho hạng thành viên</label>
        <p className="text-xs text-gray-500 mb-2">Để trống nếu áp dụng cho mọi thành viên</p>
        <div className="flex flex-wrap gap-2">
          <label className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isAll ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}>
            <input type="checkbox" className="hidden" checked={isAll} onChange={() => handleToggle('')} />
            Tất cả các hạng
          </label>
          {membershipTiers.map(t => (
            <label key={t.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${(value || []).includes(t.id) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}>
              <input type="checkbox" className="hidden" checked={(value || []).includes(t.id)} onChange={() => handleToggle(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
      </div>
    );
  };



  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Quản lý {activeTab === 'vouchers' ? 'Voucher' : activeTab === 'flash-sales' ? 'Flash Sale' : 'Combo'}</h1>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={(e) => { e.preventDefault(); fetchData(); }} className="relative flex-1 md:w-64">
            <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)} className="w-full border rounded-lg pl-10 pr-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-red-500" />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <button type="submit" className="hidden"></button>
          </form>

          <select
            value={filterTierId}
            onChange={(e) => setFilterTierId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="ALL">Tất cả hạng thành viên</option>
            {membershipTiers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button onClick={() => {
            if (activeTab === 'vouchers') openVoucherModal();
            else if (activeTab === 'flash-sales') openFlashSaleModal();
            else openComboModal();
          }} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 shadow-sm text-sm flex items-center gap-1.5 whitespace-nowrap">
            <Plus size={16} /> Thêm Mới
          </button>
        </div>
      </div>



      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 text-center text-gray-500">Đang tải dữ liệu...</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-600">Thông tin</th>
                  {activeTab === 'vouchers' && <th className="px-6 py-4 font-bold text-gray-600">Chi tiết giảm giá</th>}
                  <th className="px-6 py-4 font-bold text-gray-600">Thời gian{role === 'ADMIN' && ' & Chi nhánh'}</th>
                  {activeTab === 'vouchers' && <th className="px-6 py-4 font-bold text-gray-600 text-center">Đã Dùng / Giới hạn</th>}
                  {activeTab === 'combos' && <th className="px-6 py-4 font-bold text-gray-600 text-right">Giá Combo</th>}
                  <th className="px-6 py-4 font-bold text-gray-600 text-center">Trạng Thái</th>
                  <th className="px-6 py-4 font-bold text-gray-600 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* VOUCHERS LIST */}
                {activeTab === 'vouchers' && vouchers.map(v => (
                  <tr key={v.id} onClick={() => openVoucherModal(v)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {v.imageUrl && <img src={v.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                        <div>
                          <div className="font-bold text-gray-900 font-mono text-base">{v.code}</div>
                          <div className="text-gray-500 text-xs truncate max-w-[150px]" title={v.title}>{v.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-red-600">
                        {v.discountType === 'PERCENTAGE' ? `Giảm ${v.discountValue}%` : `Giảm ${formatMoney(v.discountValue)}`}
                      </div>
                      {v.minOrderValue > 0 && <div className="text-xs text-gray-500 mt-1">Đơn tối thiểu: {formatMoney(v.minOrderValue)}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-600 text-xs mb-1">
                        {new Date(v.startDate).toLocaleDateString()} - {new Date(v.endDate).toLocaleDateString()}
                      </div>
                      {role === 'ADMIN' && (
                        <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-gray-100 text-gray-700">
                          {v.branches && v.branches.length > 0 ? v.branches.map((b: any) => b.name).join(', ') : 'Toàn hệ thống'}
                        </div>
                      )}
                      {role !== 'ADMIN' && (!v.branches || v.branches.length === 0) && (
                        <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-blue-100 text-blue-700 mt-1">
                          Toàn hệ thống
                        </div>
                      )}
                      <div className="mt-1">
                        {v.membershipTiers && v.membershipTiers.length > 0 ? (
                           <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-amber-100 text-amber-700">
                             Hạng: {v.membershipTiers.map((t: any) => t.name).join(', ')}
                           </div>
                        ) : (
                           <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-green-100 text-green-700">
                             Mọi hạng thành viên
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      {v.usedCount} {v.usageLimit ? `/ ${v.usageLimit}` : ''}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive('vouchers', v.id, !v.isActive); }}
                        disabled={role !== 'ADMIN' && (!v.branches || v.branches.length === 0)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${role !== 'ADMIN' && (!v.branches || v.branches.length === 0) ? 'opacity-50 cursor-not-allowed ' : ''
                          }${v.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                      >
                        {v.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                        {v.isActive ? 'Hoạt Động' : 'Tạm Dừng'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(role === 'ADMIN' || (v.branches && v.branches.length > 0)) && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); openVoucherModal(v); }} className="p-2 text-blue-600"><Edit size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(`/api/admin/promotions/vouchers/${v.id}`); }} className="p-2 text-red-600"><Trash2 size={18} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}

                {/* FLASH SALES LIST */}
                {activeTab === 'flash-sales' && flashSales.map(fs => (
                  <tr key={fs.id} onClick={() => openFlashSaleModal(fs)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {fs.imageUrl && <img src={fs.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                        <span className="font-bold text-gray-900">{fs.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-600 text-xs mb-1">
                        {new Date(fs.startTime).toLocaleString()} - {new Date(fs.endTime).toLocaleString()}
                      </div>
                      {role === 'ADMIN' && (
                        <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-gray-100 text-gray-700">
                          {fs.branches && fs.branches.length > 0 ? fs.branches.map((b: any) => b.name).join(', ') : 'Toàn hệ thống'}
                        </div>
                      )}
                      {role !== 'ADMIN' && (!fs.branches || fs.branches.length === 0) && (
                        <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-blue-100 text-blue-700 mt-1">
                          Toàn hệ thống
                        </div>
                      )}
                      <div className="mt-1">
                        {fs.membershipTiers && fs.membershipTiers.length > 0 ? (
                           <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-amber-100 text-amber-700">
                             Hạng: {fs.membershipTiers.map((t: any) => t.name).join(', ')}
                           </div>
                        ) : (
                           <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-green-100 text-green-700">
                             Mọi hạng thành viên
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive('flash-sales', fs.id, !fs.isActive); }}
                        disabled={role !== 'ADMIN' && (!fs.branches || fs.branches.length === 0)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${role !== 'ADMIN' && (!fs.branches || fs.branches.length === 0) ? 'opacity-50 cursor-not-allowed ' : ''
                          }${fs.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                      >
                        {fs.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                        {fs.isActive ? 'Hoạt Động' : 'Tạm Dừng'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(role === 'ADMIN' || (fs.branches && fs.branches.length > 0)) && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); openFlashSaleModal(fs); }} className="p-2 text-blue-600"><Edit size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(`/api/admin/promotions/flash-sales/${fs.id}`); }} className="p-2 text-red-600"><Trash2 size={18} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}

                {/* COMBOS LIST */}
                {activeTab === 'combos' && combos.map(c => (
                  <tr key={c.id} onClick={() => openComboModal(c)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {c.imageUrl && <img src={c.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                        <span className="font-bold text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-600 text-xs mb-1">
                        {c.startDate ? new Date(c.startDate).toLocaleString() : 'Vô thời hạn'}
                      </div>
                      {role === 'ADMIN' && (
                        <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-gray-100 text-gray-700">
                          {c.branches && c.branches.length > 0 ? c.branches.map((b: any) => b.name).join(', ') : 'Toàn hệ thống'}
                        </div>
                      )}
                      {role !== 'ADMIN' && (!c.branches || c.branches.length === 0) && (
                        <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-blue-100 text-blue-700 mt-1">
                          Toàn hệ thống
                        </div>
                      )}
                      <div className="mt-1">
                        {c.membershipTiers && c.membershipTiers.length > 0 ? (
                           <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-amber-100 text-amber-700">
                             Hạng: {c.membershipTiers.map((t: any) => t.name).join(', ')}
                           </div>
                        ) : (
                           <div className="text-xs font-semibold px-2 py-0.5 rounded inline-block bg-green-100 text-green-700">
                             Mọi hạng thành viên
                           </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-600">
                      {formatMoney(c.price)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive('combos', c.id, !c.isActive); }}
                        disabled={role !== 'ADMIN' && (!c.branches || c.branches.length === 0)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${role !== 'ADMIN' && (!c.branches || c.branches.length === 0) ? 'opacity-50 cursor-not-allowed ' : ''
                          }${c.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                      >
                        {c.isActive ? <Power size={14} /> : <PowerOff size={14} />}
                        {c.isActive ? 'Hoạt Động' : 'Tạm Dừng'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {(role === 'ADMIN' || (c.branches && c.branches.length > 0)) && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); openComboModal(c); }} className="p-2 text-blue-600"><Edit size={18} /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(`/api/admin/promotions/combos/${c.id}`); }} className="p-2 text-red-600"><Trash2 size={18} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* VOUCHER MODAL */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingVoucher ? 'Sửa Voucher' : 'Thêm Voucher'}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const url = editingVoucher ? `/api/admin/promotions/vouchers/${editingVoucher.id}` : `/api/admin/promotions/vouchers`;
              submitForm(url, editingVoucher ? 'PATCH' : 'POST', voucherData, () => setIsVoucherModalOpen(false), 'vouchers');
            }}>
              <ImageUploader imageUrl={voucherData.imageUrl} folder="promotions" onUploadSuccess={(url) => setVoucherData((prev: any) => ({ ...prev, imageUrl: url }))} />
              <BranchSelector value={voucherData.branchIds} onChange={v => setVoucherData({ ...voucherData, branchIds: v })} />
              <MembershipTierSelector value={voucherData.membershipTierIds} onChange={v => setVoucherData({ ...voucherData, membershipTierIds: v })} />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm mb-1">Mã Voucher</label><input required value={voucherData.code} onChange={e => setVoucherData({ ...voucherData, code: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm mb-1">Tiêu đề</label><input required value={voucherData.title} onChange={e => setVoucherData({ ...voucherData, title: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1">Loại giảm giá</label>
                  <select value={voucherData.discountType} onChange={e => setVoucherData({ ...voucherData, discountType: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                    <option value="FIXED_AMOUNT">Giảm tiền mặt (VNĐ)</option>
                    <option value="PERCENTAGE">Giảm phần trăm (%)</option>
                  </select>
                </div>
                <div><label className="block text-sm mb-1">Mức giảm</label><input required type="number" value={voucherData.discountValue} onChange={e => setVoucherData({ ...voucherData, discountValue: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm mb-1">Ngày bắt đầu</label><input required type="date" value={voucherData.startDate} onChange={e => setVoucherData({ ...voucherData, startDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm mb-1">Ngày kết thúc</label><input required type="date" min={voucherData.startDate || undefined} value={voucherData.endDate} onChange={e => setVoucherData({ ...voucherData, endDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm mb-1">Đơn tối thiểu (VNĐ)</label><input type="number" value={voucherData.minOrderValue} onChange={e => setVoucherData({ ...voucherData, minOrderValue: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm mb-1">Giới hạn số lượng</label><input type="number" value={voucherData.usageLimit} onChange={e => setVoucherData({ ...voucherData, usageLimit: Number(e.target.value) })} placeholder="0 = Không giới hạn" className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={voucherData.isActive} onChange={e => setVoucherData({ ...voucherData, isActive: e.target.checked })} className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-sm">Kích hoạt Voucher này</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button type="button" onClick={() => setIsVoucherModalOpen(false)} className="px-4 py-2 border rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg">Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLASH SALE MODAL */}
      {isFlashSaleModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingFlashSale ? 'Sửa Flash Sale' : 'Tạo Flash Sale'}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const url = editingFlashSale ? `/api/admin/promotions/flash-sales/${editingFlashSale.id}` : `/api/admin/promotions/flash-sales`;
              submitForm(url, editingFlashSale ? 'PATCH' : 'POST', fsData, () => setIsFlashSaleModalOpen(false), 'flash-sales');
            }}>
              <ImageUploader imageUrl={fsData.imageUrl} folder="promotions" onUploadSuccess={(url) => setFsData((prev: any) => ({ ...prev, imageUrl: url }))} />
              <BranchSelector value={fsData.branchIds} onChange={v => setFsData({ ...fsData, branchIds: v })} />
              <MembershipTierSelector value={fsData.membershipTierIds} onChange={v => setFsData({ ...fsData, membershipTierIds: v })} />

              <div className="mb-4"><label className="block text-sm mb-1">Tên đợt Sale</label><input required value={fsData.name} onChange={e => setFsData({ ...fsData, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
              <div className="mb-4">
                <label className="block text-sm mb-1 font-semibold text-gray-700">Thêm sản phẩm vào Flash Sale</label>
                <div className="relative mb-3">
                  <div className="flex items-center border rounded-lg px-3 py-2 bg-white focus-within:ring-2 ring-red-100">
                    <Search size={18} className="text-gray-400 mr-2" />
                    <input type="text" value={productSearchFS} onChange={e => setProductSearchFS(e.target.value)} placeholder="Tìm tên sản phẩm..." className="w-full outline-none" />
                  </div>
                  {productResultsFS.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                      {productResultsFS.map(p => (
                        <div key={p.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b last:border-0" onClick={() => {
                          const exists = fsData.items.find((i: any) => i.productId === p.id);
                          if (!exists) {
                            setFsData({ ...fsData, items: [...fsData.items, { productId: p.id, product: p, flashSalePrice: p.price, stock: 100, maxQuantityPerUser: 0 }] });
                          }
                          setProductSearchFS('');
                          setProductResultsFS([]);
                        }}>
                          <div className="flex items-center gap-3">
                            {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                            <span className="font-medium text-gray-800">{p.name}</span>
                          </div>
                          <span className="text-red-600 font-bold">{formatMoney(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {fsData.items.length > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-gray-50/50">
                    {fsData.items.map((item: any, index: number) => (
                      <div key={item.productId} className="flex flex-col gap-2 p-3 border-b last:border-0 bg-white m-1 rounded shadow-sm">
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                            {item.product?.imageUrl && <img src={item.product?.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                            <span className="truncate max-w-[200px]" title={item.product?.name}>{item.product?.name}</span>
                            <span className="text-xs text-gray-400 line-through ml-2">{formatMoney(item.product?.price || 0)}</span>
                          </div>
                          <button type="button" onClick={() => {
                            setFsData({ ...fsData, items: fsData.items.filter((i: any) => i.productId !== item.productId) });
                          }} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Giá Sale (VNĐ)</label>
                            <input type="number" value={item.flashSalePrice} onChange={e => {
                              const newItems = [...fsData.items];
                              newItems[index].flashSalePrice = parseInt(e.target.value) || 0;
                              setFsData({ ...fsData, items: newItems });
                            }} className="w-full border rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400 font-bold text-red-600" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Kho xuất (SL)</label>
                            <input type="number" min="1" value={item.stock} onChange={e => {
                              const newItems = [...fsData.items];
                              newItems[index].stock = parseInt(e.target.value) || 1;
                              setFsData({ ...fsData, items: newItems });
                            }} className="w-full border rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Giới hạn/KH (0=Ko)</label>
                            <input type="number" min="0" value={item.maxQuantityPerUser} onChange={e => {
                              const newItems = [...fsData.items];
                              newItems[index].maxQuantityPerUser = parseInt(e.target.value) || 0;
                              setFsData({ ...fsData, items: newItems });
                            }} className="w-full border rounded-lg px-2 py-1 text-sm outline-none focus:border-red-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm mb-1">Bắt đầu</label><input required type="datetime-local" value={fsData.startTime} onChange={e => setFsData({ ...fsData, startTime: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm mb-1">Kết thúc</label><input required type="datetime-local" value={fsData.endTime} onChange={e => setFsData({ ...fsData, endTime: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fsData.isActive} onChange={e => setFsData({ ...fsData, isActive: e.target.checked })} className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-sm">Kích hoạt Flash Sale</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button type="button" onClick={() => setIsFlashSaleModalOpen(false)} className="px-4 py-2 border rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg">Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMBO MODAL */}
      {isComboModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingCombo ? 'Sửa Combo' : 'Tạo Combo'}</h2>
            <form onSubmit={e => {
              e.preventDefault();
              const url = editingCombo ? `/api/admin/promotions/combos/${editingCombo.id}` : `/api/admin/promotions/combos`;
              submitForm(url, editingCombo ? 'PATCH' : 'POST', comboData, () => setIsComboModalOpen(false), 'combos');
            }}>
              <ImageUploader imageUrl={comboData.imageUrl} folder="promotions" onUploadSuccess={(url) => setComboData((prev: any) => ({ ...prev, imageUrl: url }))} />
              <BranchSelector value={comboData.branchIds} onChange={v => setComboData({ ...comboData, branchIds: v })} />
              <MembershipTierSelector value={comboData.membershipTierIds} onChange={v => setComboData({ ...comboData, membershipTierIds: v })} />

              <div className="mb-4"><label className="block text-sm mb-1">Tên Combo</label><input required value={comboData.name} onChange={e => setComboData({ ...comboData, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>

              <div className="mb-4">
                <label className="block text-sm mb-1 font-semibold text-gray-700">Thêm sản phẩm vào Combo</label>
                <div className="relative mb-3">
                  <div className="flex items-center border rounded-lg px-3 py-2 bg-white focus-within:ring-2 ring-red-100">
                    <Search size={18} className="text-gray-400 mr-2" />
                    <input type="text" value={productSearchCombo} onChange={e => setProductSearchCombo(e.target.value)} placeholder="Tìm tên sản phẩm..." className="w-full outline-none" />
                  </div>
                  {productResultsCombo.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                      {productResultsCombo.map(p => (
                        <div key={p.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b last:border-0" onClick={() => {
                          const exists = comboData.items.find(i => i.productId === p.id);
                          if (exists) {
                            setComboData({ ...comboData, items: comboData.items.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i) });
                          } else {
                            setComboData({ ...comboData, items: [...comboData.items, { productId: p.id, product: p, quantity: 1 }] });
                          }
                          setProductSearchCombo('');
                          setProductResultsCombo([]);
                        }}>
                          <div className="flex items-center gap-3">
                            {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                            <span className="font-medium text-gray-800">{p.name}</span>
                          </div>
                          <span className="text-red-600 font-bold">{formatMoney(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {comboData.items.length > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-gray-50/50">
                    {comboData.items.map((item, index) => (
                      <div key={item.productId} className="flex justify-between items-center p-3 border-b last:border-0 bg-white m-1 rounded shadow-sm">
                        <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                          {item.product?.imageUrl && <img src={item.product?.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                          <span className="truncate max-w-[200px]" title={item.product?.name}>{item.product?.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-gray-500 w-24 text-right">{formatMoney(item.product?.price || 0)}</span>
                          <span className="text-gray-400">x</span>
                          <input type="number" min="1" value={item.quantity} onChange={e => {
                            const newQty = parseInt(e.target.value) || 1;
                            const newItems = [...comboData.items];
                            newItems[index].quantity = newQty;
                            setComboData({ ...comboData, items: newItems });
                          }} className="w-16 border rounded-lg px-2 py-1 text-center font-medium outline-none focus:border-red-400" />
                          <button type="button" onClick={() => {
                            setComboData({ ...comboData, items: comboData.items.filter(i => i.productId !== item.productId) });
                          }} className="text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-gray-50 text-right flex justify-between items-center text-sm border-t">
                      <span className="text-gray-500 font-medium">Tổng giá gốc các món:</span>
                      <span className="font-bold text-gray-900 text-lg">{formatMoney(comboData.originalPrice)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1 font-semibold text-gray-700">Hình thức tính giá</label>
                  <select value={comboDiscountType} onChange={e => setComboDiscountType(e.target.value as any)} className="w-full border rounded-lg px-3 py-2 bg-white outline-none focus:border-red-400">
                    <option value="NONE">Nhập giá bán trực tiếp</option>
                    <option value="FIXED">Giảm trừ tiền mặt (VNĐ)</option>
                    <option value="PERCENTAGE">Giảm theo %</option>
                  </select>
                </div>
                {comboDiscountType !== 'NONE' ? (
                  <div>
                    <label className="block text-sm mb-1 font-semibold text-gray-700">
                      Mức giảm {comboDiscountType === 'PERCENTAGE' ? '(%)' : '(VNĐ)'}
                    </label>
                    <input type="number" required value={comboDiscountValue} onChange={e => setComboDiscountValue(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-red-600 font-bold outline-none focus:border-red-400" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm mb-1 font-semibold text-gray-700">Giá bán Combo (VNĐ)</label>
                    <input type="number" required value={comboData.price} onChange={e => setComboData({ ...comboData, price: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-red-600 font-bold outline-none focus:border-red-400" />
                  </div>
                )}
              </div>

              {comboDiscountType !== 'NONE' && (
                <div className="mb-4 p-4 bg-red-50 rounded-lg flex justify-between items-center border border-red-100">
                  <span className="text-red-800 font-medium">Giá bán Combo cuối cùng:</span>
                  <span className="text-2xl font-bold text-red-600">{formatMoney(comboData.price)}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm mb-1">Thời gian bắt đầu (Tùy chọn)</label><input type="datetime-local" value={comboData.startDate} onChange={e => setComboData({ ...comboData, startDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
                <div><label className="block text-sm mb-1">Thời gian kết thúc (Tùy chọn)</label><input type="datetime-local" value={comboData.endDate} onChange={e => setComboData({ ...comboData, endDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" /></div>
              </div>

              <div className="mb-4">
                <label className="block text-sm mb-1">Giới hạn lượt mua</label>
                <input type="number" value={comboData.usageLimit} onChange={e => setComboData({ ...comboData, usageLimit: Number(e.target.value) })} placeholder="0 = Không giới hạn" className="w-full border rounded-lg px-3 py-2" />
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={comboData.isActive} onChange={e => setComboData({ ...comboData, isActive: e.target.checked })} className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-sm">Kích hoạt Combo</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button type="button" onClick={() => setIsComboModalOpen(false)} className="px-4 py-2 border rounded-lg">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg">Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Trigger rebuild


