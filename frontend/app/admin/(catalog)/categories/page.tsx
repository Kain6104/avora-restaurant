'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Search, Edit, Trash2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Pagination from '@/app/admin/components/Pagination';
import ImageUploader from '@/app/admin/components/ImageUploader';
import { buildApiUrl } from '@/lib/utils/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  image?: string;
  _count: { products: number };
}

export default function AdminCategoriesPage() {
  const { role, selectedBranchId } = useAdmin();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '', slug: '', displayOrder: 0, image: ''
  });



  useEffect(() => {
    fetchCategories();
  }, [selectedBranchId, page]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/categories', {
        branchId: selectedBranchId,
        search,
        page,
        limit: 10
      });

      const res = await fetch(url, {
        credentials: 'include'
      });
      const data = await res.json();
      setCategories(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCategories();
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', slug: '', displayOrder: 0, image: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({ 
      name: category.name, 
      slug: category.slug, 
      displayOrder: category.displayOrder, 
      image: category.image || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingCategory ? `/api/admin/categories/${editingCategory.id}` : `/api/admin/categories`;
    const method = editingCategory ? 'PATCH' : 'POST';
    
    try {
      const finalImageUrl = formData.image;
      const submitData = { ...formData, image: finalImageUrl };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(editingCategory ? 'Cập nhật thành công' : 'Thêm mới thành công');
        setIsModalOpen(false);
        fetchCategories();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Có lỗi xảy ra');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Đã xóa danh mục');
        fetchCategories();
      } else {
        toast.error('Không thể xóa danh mục');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold">Quản lý Danh mục</h1>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
            <input 
              type="text" 
              placeholder="Tìm tên danh mục..." 
              className="w-full border rounded-lg pl-10 pr-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-red-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <button type="submit" className="hidden"></button>
          </form>
          
          {role === 'ADMIN' && (
            <button onClick={openCreateModal} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 shadow-sm text-sm whitespace-nowrap flex items-center gap-1.5">
              <Plus size={16} /> Thêm Danh Mục
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
                <th className="px-6 py-4 font-bold text-gray-600">Tên Danh Mục</th>
                <th className="px-6 py-4 font-bold text-gray-600">Slug</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-center">Thứ Tự</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-center">Số Sản Phẩm</th>
                <th className="px-6 py-4 font-bold text-gray-600 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    <div className="flex justify-center items-center gap-2">
                      <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      Đang tải dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Không tìm thấy danh mục nào</td>
                </tr>
              ) : (
                categories.map(cat => (
                  <tr key={cat.id} onClick={() => openEditModal(cat)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-6 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border flex items-center justify-center">
                        {cat.image ? (
                          <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 text-[10px]">No img</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 text-base">{cat.name}</td>
                    <td className="px-6 py-4 text-gray-500">{cat.slug}</td>
                    <td className="px-6 py-4 text-center font-bold">
                      <span className="bg-gray-100 px-3 py-1 rounded-full text-gray-700">{cat.displayOrder}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-bold text-red-600 bg-red-50 px-3 py-1 rounded-md">{cat._count.products} món</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {role === 'ADMIN' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(cat); }} className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-blue-600" title="Chỉnh sửa">
                            <Edit size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600" title="Xóa">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium italic">Không có quyền</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && (
          <Pagination 
            currentPage={page} 
            totalPages={totalPages} 
            itemName="danh mục" 
            onPageChange={setPage} 
          />
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4">{editingCategory ? 'Chỉnh sửa Danh mục' : 'Thêm Danh mục mới'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên danh mục</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:border-red-500" placeholder="Bo-trong-se-tu-tao" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thứ tự hiển thị (Số)</label>
                <input type="number" value={formData.displayOrder} onChange={e => setFormData({...formData, displayOrder: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 outline-none focus:border-red-500" />
              </div>
              <div>
                <ImageUploader 
                  imageUrl={formData.image} 
                  folder="categories" 
                  onUploadSuccess={(url) => setFormData(prev => ({ ...prev, image: url }))} 
                  label="Hình ảnh danh mục"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                  {editingCategory ? 'Lưu thay đổi' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
