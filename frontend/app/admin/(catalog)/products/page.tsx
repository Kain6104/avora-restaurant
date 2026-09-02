'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Search, Edit, Power, PowerOff, Plus, Trash2, PackageSearch, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/app/admin/components/Pagination';
import { buildApiUrl } from '@/lib/utils/api';

interface Product {
  id: string;
  itemCode: string;
  name: string;
  price: number;
  available: boolean;
  imageUrl: string;
  category?: { name: string };
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
  }
}

export default function AdminProductsPage() {
  const { selectedBranchId, role, availableBranches } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, totalPages: 1, page: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  
  const isInitialMount = useRef(true);

  // Sync state to URL
  useEffect(() => {
    if (isInitialMount.current) return;
    const params = new URLSearchParams(window.location.search);
    if (search) params.set('search', search); else params.delete('search');
    if (categoryId) params.set('categoryId', categoryId); else params.delete('categoryId');
    if (status) params.set('status', status); else params.delete('status');
    if (page > 1) params.set('page', page.toString()); else params.delete('page');
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [search, categoryId, status, page]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchProducts();
      fetchCategories();
    } else {
      fetchProducts();
    }
  }, [selectedBranchId, page, categoryId, status]);

  const fetchCategories = async () => {
    try {
      const url = buildApiUrl('/api/admin/categories', {
        limit: 100,
        branchId: selectedBranchId
      });
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/products', {
        branchId: selectedBranchId,
        search,
        categoryId,
        status,
        page,
        limit: 10
      });

      const res = await fetch(url, {
        credentials: 'include'
      });
      const data = await res.json();
      setProducts(data.data || []);
      setMeta(data.meta || { total: 0, totalPages: 1, page: 1 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const toggleAvailability = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/products/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Đã cập nhật trạng thái món');
        setProducts(prev => prev.map(p => p.id === id ? { ...p, available: !p.available } : p));
      } else {
        const error = await res.json();
        toast.error(error.message || 'Không thể cập nhật');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const openCreateModal = () => {
    router.push('/admin/products/create');
  };

  const openEditModal = (product: Product) => {
    router.push(`/admin/products/${product.id}/edit`);
  };


  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Đã xóa sản phẩm');
        fetchProducts();
        fetchCategories(); // Refresh categories to get updated counts
      } else {
        const error = await res.json();
        toast.error(error.message || 'Lỗi khi xóa sản phẩm');
      }
    } catch (error) {
      toast.error('Không thể kết nối đến server');
    }
  };

  const totalAllProducts = categories.reduce((sum, cat) => sum + (cat._count?.products || 0), 0);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý Sản phẩm</h1>
          <span className="text-sm text-gray-500">
            Tổng cộng: <span className="font-bold text-gray-800">{meta.total}</span> món ăn
          </span>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">
              Tất cả danh mục ({totalAllProducts})
            </option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c._count?.products || 0})
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="available">Đang bán</option>
            <option value="unavailable">Ngừng bán</option>
          </select>
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Tìm tên, mã sản phẩm..." 
              className="w-full border rounded-lg pl-10 pr-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-red-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <button type="submit" className="hidden"></button>
          </form>
          {search && (
            <button type="button" onClick={() => { setSearch(''); setPage(1); fetchProducts(); }} className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50 bg-white">
              Xóa
            </button>
          )}
          
          {role === 'ADMIN' && (
            <button onClick={openCreateModal} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 shadow-sm text-sm whitespace-nowrap flex items-center gap-1.5">
              <Plus size={16} /> Thêm Sản Phẩm
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-600 w-16">Ảnh</th>
                <th className="px-6 py-4 font-bold text-gray-600">Tên Món</th>
                <th className="px-6 py-4 font-bold text-gray-600">Mã Món</th>
                <th className="px-6 py-4 font-bold text-gray-600">Danh Mục</th>
                <th className="px-6 py-4 font-bold text-gray-600">Giá Bán</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-center">
                  {role === 'ADMIN' ? 'Phân bổ Chi nhánh' : 'Trạng Thái'}
                </th>
                <th className="px-6 py-4 font-bold text-gray-600 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <PackageSearch size={40} className="text-gray-300" />
                      <p className="font-medium text-gray-500">Không tìm thấy sản phẩm nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map(product => (
                  <tr key={product.id} onClick={() => openEditModal(product)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-6 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border flex items-center justify-center shrink-0">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-gray-400 text-[10px]">No img</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{product.name}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">{product.itemCode}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs font-semibold">
                        {product.category?.name || 'Chưa phân loại'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-red-600">
                      {formatMoney(product.price)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {role === 'ADMIN' ? (
                        <div className="flex flex-wrap justify-center gap-1 max-w-[200px] mx-auto">
                          {product.branches.length === 0 ? (
                            <span className="text-[10px] text-gray-400 italic">Chưa phân bổ</span>
                          ) : (
                            product.branches.map(b => (
                              <span key={b.id} className="bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                <Store size={10} /> {b.name}
                              </span>
                            ))
                          )}
                        </div>
                      ) : role === 'MANAGER' ? (
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleAvailability(product.id); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                            product.available 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {product.available ? <Power size={14} /> : <PowerOff size={14} />}
                          {product.available ? 'Đang Bán' : 'Tạm Ngưng'}
                        </button>
                      ) : (
                        // CHEF view
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                          product.available 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-gray-50 text-gray-500'
                        }`}>
                          {product.available ? 'Đang Bán' : 'Tạm Ngưng'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {role === 'ADMIN' ? (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(product); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition-colors" title="Chỉnh sửa">
                            <Edit size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }} className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors" title="Xóa">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Chỉ đọc</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <Pagination 
          currentPage={page} 
          totalPages={meta.totalPages} 
          totalItems={meta.total} 
          itemName="sản phẩm" 
          onPageChange={setPage} 
        />
      </div>


    </div>
  );
}
