'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  Edit2,
  Trash2,
  Plus,
  Tags,
  Image as ImageIcon,
  RotateCw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ImageUploader from '@/app/admin/components/ImageUploader';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  MobileDataCard,
  Pagination,
  Modal,
  ConfirmDialog,
  FormField,
} from '@/app/admin/components/ui';
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
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    displayOrder: 0,
    image: '',
  });

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/categories', {
        search,
        page,
        limit: 12,
      });

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setCategories(json.data || []);
        if (json.meta) {
          setTotalPages(json.meta.totalPages || 1);
          setTotalCount(json.meta.total || 0);
        }
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', slug: '', displayOrder: categories.length + 1, image: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      displayOrder: cat.displayOrder,
      image: cat.image || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên danh mục');
      return;
    }

    try {
      const isEdit = !!editingCategory;
      const url = isEdit
        ? `/api/admin/categories/${editingCategory.id}`
        : '/api/admin/categories';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật danh mục thành công' : 'Tạo danh mục mới thành công');
        setIsModalOpen(false);
        fetchCategories();
      } else {
        toast.error('Không thể lưu danh mục');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa danh mục');
        setDeleteId(null);
        fetchCategories();
      } else {
        toast.error('Không thể xóa danh mục này');
      }
    } catch (err) {
      toast.error('Lỗi kết nối');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'image',
      header: t('common.image', 'Hình ảnh'),
      width: '80px',
      render: (cat: Category) => (
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center">
          {cat.image ? (
            <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
          ) : (
            <Tags size={20} className="text-slate-400" />
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: t('table.category', 'Tên danh mục'),
      render: (cat: Category) => (
        <div>
          <p className="font-bold text-xs sm:text-sm text-slate-900">{cat.name}</p>
          <span className="text-[11px] font-mono text-slate-400">/{cat.slug}</span>
        </div>
      ),
    },
    {
      key: 'displayOrder',
      header: t('common.order', 'Thứ tự'),
      align: 'center' as const,
      render: (cat: Category) => (
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          #{cat.displayOrder}
        </span>
      ),
    },
    {
      key: 'productsCount',
      header: t('categories.dishCount', 'Số món ăn'),
      align: 'center' as const,
      render: (cat: Category) => (
        <span className="font-black text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
          {cat._count?.products || 0} {t('nav.products', 'món')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('table.action', 'Thao tác'),
      align: 'right' as const,
      render: (cat: Category) => (
        <div className="flex items-center justify-end gap-1">
          {role === 'ADMIN' && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(cat);
                }}
                aria-label={t('common.edit', 'Chỉnh sửa danh mục')}
                className="p-1.5 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Edit2 size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteId(cat.id);
                }}
                aria-label={t('common.delete', 'Xóa danh mục')}
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
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('categories.title', 'Danh mục Thực đơn')}
        subtitle={t('categories.subtitle', 'Phân loại các nhóm món ăn trong thực đơn của nhà hàng')}
        breadcrumbs={[
          { label: t('nav.sales', 'Bán hàng') },
          { label: t('nav.categories', 'Danh mục') },
        ]}
        badge={
          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            {t('common.total', 'Tổng')} {totalCount} {t('common.results', 'danh mục')}
          </span>
        }
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={fetchCategories}
              aria-label={t('common.refresh', 'Làm mới')}
              className="flex items-center gap-1 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Làm mới')}</span>
            </button>
            {role === 'ADMIN' && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-1.5 min-h-[38px] px-3 sm:px-3.5 py-1.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={15} />
                <span>{t('common.add', 'Thêm danh mục')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <FilterBar
        actions={
          search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
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
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder={t('common.search', 'Tìm kiếm tên danh mục...')}
          />
        </div>
      </FilterBar>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={categories}
        keyExtractor={(c) => c.id}
        loading={loading}
        onRowClick={(c) => {
          if (role === 'ADMIN') openEditModal(c);
        }}
        emptyTitle={t('common.noData', 'Không tìm thấy danh mục nào')}
        emptyDescription="Thử tìm kiếm với từ khóa khác hoặc tạo thêm danh mục mới."
        mobileCardRender={(cat) => (
          <MobileDataCard
            title={cat.name}
            subtitle={`/${cat.slug}`}
            badge={
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600">
                {cat._count?.products || 0} món
              </span>
            }
            details={[
              {
                label: 'Thứ tự',
                value: `#${cat.displayOrder}`,
              },
            ]}
            actions={
              role === 'ADMIN' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(cat)}
                    className="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
                  >
                    <Edit2 size={13} />
                    <span>{t('common.edit', 'Sửa')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(cat.id)}
                    className="py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : undefined
            }
          />
        )}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        pageSize={12}
        onPageChange={setPage}
        itemName={t('nav.categories', 'danh mục')}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? t('categories.editTitle', 'Chỉnh sửa danh mục') : t('categories.addTitle', 'Thêm danh mục mới')}
        subtitle={editingCategory ? `ID: ${editingCategory.id}` : t('categories.modalSubtitle', 'Nhập thông tin danh mục thực đơn')}
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <FormField label={t('categories.nameLabel', 'Tên danh mục')} required>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value;
                const slug = name
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/đ/g, 'd')
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '');
                setFormData({ ...formData, name, slug: editingCategory ? formData.slug : slug });
              }}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              placeholder={t('categories.namePlaceholder', 'VD: Món Khai Vị, Tráng Miệng...')}
            />
          </FormField>

          <FormField label={t('categories.slugLabel', 'Đường dẫn (Slug)')} required>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full h-10 px-3 text-xs sm:text-sm font-mono bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500"
              placeholder="mon-khai-vi"
            />
          </FormField>

          <FormField label={t('categories.orderLabel', 'Thứ tự hiển thị')}>
            <input
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
              className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500"
            />
          </FormField>

          <ImageUploader
            imageUrl={formData.image}
            folder="categories"
            onUploadSuccess={(url) => setFormData({ ...formData, image: url })}
            label={t('categories.imageLabel', 'Ảnh đại diện danh mục')}
          />

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              {t('common.cancel', 'Hủy')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              {editingCategory ? t('common.saveChanges', 'Lưu thay đổi') : t('common.add', 'Tạo danh mục')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.delete', 'Xóa danh mục')}
        message="Bạn có chắc chắn muốn xóa danh mục này? Các món ăn trong danh mục sẽ được chuyển về Chưa phân loại."
        confirmText={t('common.delete', 'Xác nhận xóa')}
        cancelText={t('common.cancel', 'Hủy')}
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
