'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from 'react-hot-toast';
import { Save, ArrowLeft, Plus } from 'lucide-react';
import ImageUploader from '@/app/admin/components/ImageUploader';

interface ProductFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function ProductForm({ initialData, isEdit }: ProductFormProps) {
  const router = useRouter();
  const { role, selectedBranchId, availableBranches } = useAdmin();
  const [categories, setCategories] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    itemCode: '', name: '', description: '', post: '', price: 0, oldPrice: 0, 
    discountedPrice: 0, flashSalePrice: 0, unit: 'phần', taxPercentage: 0, 
    isTaxIncludedInPrice: true, badge: '', imageUrl: '', videoUrl: '',
    available: true, isBestSeller: false, isAiRecommended: false, 
    spiciness: 0, targetAudience: 'Mọi lứa tuổi', 
    isRedeemable: false, redemptionPoints: 0, categoryId: '', 
    branchIds: [] as string[]
  });

  // Modal for new category
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    fetchCategories();
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        description: initialData.description || '',
        post: initialData.post || '',
        badge: initialData.badge || '',
        imageUrl: initialData.imageUrl || '',
        videoUrl: initialData.videoUrl || '',
        itemCode: initialData.itemCode || '',
        branchIds: initialData.branches ? initialData.branches.map((b: any) => b.id) : prev.branchIds
      }));
    } else if (role === 'ADMIN') {
      setFormData(prev => ({ ...prev, branchIds: availableBranches.map(b => b.id) }));
    } else if (selectedBranchId !== 'ALL') {
      setFormData(prev => ({ ...prev, branchIds: [selectedBranchId] }));
    }
  }, [initialData, role, selectedBranchId, availableBranches]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories?limit=100', { credentials: 'include' });
      const data = await res.json();
      setCategories(data.data || []);
      if (!initialData && data.data && data.data.length > 0) {
        setFormData(prev => ({ ...prev, categoryId: data.data[0].id }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Thêm danh mục thành công');
        setIsCategoryModalOpen(false);
        setNewCategoryName('');
        await fetchCategories();
      } else {
        toast.error('Lỗi khi thêm danh mục');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (role === 'ADMIN' && formData.branchIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 chi nhánh');
      return;
    }

    setUploading(true);
    try {
      const finalImageUrl = formData.imageUrl;

      const submitData = {
        itemCode: formData.itemCode,
        name: formData.name,
        description: formData.description || null,
        post: formData.post || null,
        price: Number(formData.price),
        oldPrice: formData.oldPrice ? Number(formData.oldPrice) : null,
        discountedPrice: formData.discountedPrice ? Number(formData.discountedPrice) : null,
        flashSalePrice: formData.flashSalePrice ? Number(formData.flashSalePrice) : null,
        unit: formData.unit,
        taxPercentage: Number(formData.taxPercentage),
        isTaxIncludedInPrice: formData.isTaxIncludedInPrice,
        badge: formData.badge || null,
        imageUrl: finalImageUrl || null,
        videoUrl: formData.videoUrl || null,
        available: formData.available,
        isBestSeller: formData.isBestSeller,
        isAiRecommended: formData.isAiRecommended,
        spiciness: Number(formData.spiciness),
        targetAudience: formData.targetAudience,
        isRedeemable: formData.isRedeemable,
        redemptionPoints: formData.redemptionPoints ? Number(formData.redemptionPoints) : null,
        categoryId: formData.categoryId,
        branchIds: formData.branchIds,
      };
      const url = isEdit ? `/api/admin/products/${initialData.id}` : `/api/admin/products`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include'
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật thành công' : 'Tạo mới thành công');
        router.back();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      toast.error('Không thể kết nối đến server');
    } finally {
      setUploading(false);
    }
  };

  const handleBranchToggle = (id: string) => {
    setFormData(prev => ({
      ...prev,
      branchIds: prev.branchIds.includes(id) 
        ? prev.branchIds.filter(b => b !== id)
        : [...prev.branchIds, id]
    }));
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">{isEdit ? 'Sửa Món Ăn' : 'Thêm Món Ăn Mới'}</h1>
        </div>
        <button onClick={handleSubmit} disabled={uploading} className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-red-700 disabled:opacity-50">
          <Save size={18} /> {uploading ? 'Đang lưu...' : 'Lưu Món Ăn'}
        </button>
      </div>

      <form className="space-y-6">
        {/* HÀNG 1: THÔNG TIN CƠ BẢN & ẢNH */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Thông tin cơ bản</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mã món *</label>
                <input required value={formData.itemCode} onChange={e => setFormData({...formData, itemCode: e.target.value})} className="w-full border rounded-lg px-3 py-2 font-mono uppercase" placeholder="VD: PRD-001" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tên món *</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="VD: Trà Đào Cam Sả" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Danh mục *</label>
                <div className="flex gap-2">
                  <select required value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="flex-1 border rounded-lg px-3 py-2">
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-100 hover:bg-red-100">
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Trạng thái Bán</label>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input type="checkbox" className="sr-only peer" checked={formData.available} onChange={e => setFormData({...formData, available: e.target.checked})} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">{formData.available ? 'Đang bán' : 'Tạm ngưng'}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mô tả ngắn</label>
              <textarea rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Mô tả ngắn gọn về món ăn..." />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Bài viết chi tiết (Tùy chọn)</label>
              <textarea rows={4} value={formData.post} onChange={e => setFormData({...formData, post: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Bài viết giới thiệu chi tiết..." />
            </div>
          </div>

          {/* ẢNH ĐẠI DIỆN */}
          <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col items-center justify-center">
            <h2 className="text-lg font-bold border-b pb-2 w-full mb-4">Hình ảnh / Media</h2>
            <ImageUploader 
              imageUrl={formData.imageUrl} 
              folder="products" 
              onUploadSuccess={(url) => setFormData(prev => ({ ...prev, imageUrl: url }))} 
              label=""
              className="flex flex-col items-center justify-center w-full"
            />
            <div className="w-full">
               <label className="block text-sm font-medium mb-1">Video URL (Tùy chọn)</label>
               <input value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Link Youtube/Tiktok..." />
            </div>
          </div>
        </div>

        {/* HÀNG 2: GIÁ & CHI NHÁNH */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Giá cả & Phân bổ</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Giá gốc (VNĐ) *</label>
                <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 font-bold text-red-600" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Giá giảm (VNĐ - Tùy chọn)</label>
                <input type="number" value={formData.discountedPrice || ''} onChange={e => setFormData({...formData, discountedPrice: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
               <div>
                  <label className="block text-sm font-medium mb-1">ĐVT</label>
                  <input value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Phần, Ly..." />
               </div>
               <div>
                  <label className="block text-sm font-medium mb-1">Thuế (%)</label>
                  <input type="number" value={formData.taxPercentage} onChange={e => setFormData({...formData, taxPercentage: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2 text-sm" />
               </div>
               <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isTaxIncludedInPrice} onChange={e => setFormData({...formData, isTaxIncludedInPrice: e.target.checked})} className="w-4 h-4 text-red-600" />
                    <span className="text-sm">Đã gồm thuế</span>
                  </label>
               </div>
            </div>

            {role === 'ADMIN' && (
              <div>
                <label className="block text-sm font-medium mb-2 mt-4 border-t pt-4">Áp dụng cho Chi nhánh</label>
                <div className="flex flex-wrap gap-2">
                  {availableBranches.map(b => (
                    <label key={b.id} className={`cursor-pointer px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${formData.branchIds.includes(b.id) ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'}`}>
                      <input type="checkbox" className="hidden" checked={formData.branchIds.includes(b.id)} onChange={() => handleBranchToggle(b.id)} />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Thuộc tính & Đổi điểm</h2>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm font-medium mb-1">Nhãn dán (Badge)</label>
                 <input value={formData.badge} onChange={e => setFormData({...formData, badge: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Mới, Hot, Signature..." />
               </div>
               <div>
                 <label className="block text-sm font-medium mb-1">Độ cay (0-5)</label>
                 <input type="number" min="0" max="5" value={formData.spiciness} onChange={e => setFormData({...formData, spiciness: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-2" />
               </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Đối tượng mục tiêu</label>
              <input value={formData.targetAudience} onChange={e => setFormData({...formData, targetAudience: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Mọi lứa tuổi, Trẻ em, Ăn chay..." />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 border-t pt-4">
              <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-3 rounded-lg border">
                <input type="checkbox" checked={formData.isBestSeller} onChange={e => setFormData({...formData, isBestSeller: e.target.checked})} className="w-5 h-5 text-red-600 rounded" />
                <span className="font-bold text-gray-700">Best Seller 🔥</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer bg-blue-50 p-3 rounded-lg border border-blue-100">
                <input type="checkbox" checked={formData.isAiRecommended} onChange={e => setFormData({...formData, isAiRecommended: e.target.checked})} className="w-5 h-5 text-blue-600 rounded" />
                <span className="font-bold text-blue-700">AI Recommend 🤖</span>
              </label>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 mt-4">
               <label className="flex items-center gap-2 cursor-pointer font-bold text-yellow-800 mb-2">
                 <input type="checkbox" checked={formData.isRedeemable} onChange={e => setFormData({...formData, isRedeemable: e.target.checked})} className="w-4 h-4 text-yellow-600" />
                 Cho phép đổi điểm thưởng
               </label>
               {formData.isRedeemable && (
                 <div>
                   <label className="block text-xs font-medium mb-1 text-yellow-700">Số điểm cần để đổi</label>
                   <input type="number" value={formData.redemptionPoints || 0} onChange={e => setFormData({...formData, redemptionPoints: Number(e.target.value)})} className="w-full border rounded-lg px-3 py-1.5" />
                 </div>
               )}
            </div>

          </div>
        </div>
      </form>

      {/* MODAL THÊM DANH MỤC */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold mb-4">Thêm Danh Mục Mới</h3>
            <form onSubmit={handleCreateCategory}>
              <input required autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full border rounded-lg px-3 py-2 mb-4" placeholder="Nhập tên danh mục..." />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm font-medium">Hủy</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
