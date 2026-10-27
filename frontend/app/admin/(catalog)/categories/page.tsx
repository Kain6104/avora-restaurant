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
  FileSpreadsheet,
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Check
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

interface CategoryImportSummary {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  deactivatedProductsCount: number;
  warnings: string[];
  errors: { row: number; message: string }[];
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

  // Excel Import / Export states
  const [exporting, setExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'UPSERT' | 'REPLACE'>('UPSERT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<CategoryImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const method = isEdit ? 'PATCH' : 'POST';

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

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/categories/export/excel', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_Categories_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Xuất file Excel danh mục thành công!');
    } catch (e) {
      toast.error('Lỗi kết nối khi tải file Excel');
    } finally {
      setExporting(false);
    }
  };

  // Download Template
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/admin/categories/export/template', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Template download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AVORA_Categories_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Đã tải xuống file mẫu Excel danh mục!');
    } catch (e) {
      toast.error('Không thể tải file mẫu Excel');
    }
  };

  // Import Excel
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Vui lòng chọn một file Excel (.xlsx) để tải lên!');
      return;
    }

    setImportLoading(true);
    setImportResult(null);

    const formDataUpload = new FormData();
    formDataUpload.append('file', selectedFile);

    try {
      const res = await fetch(`/api/admin/categories/import/excel?mode=${importMode}`, {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setImportResult(json.data);
        toast.success('Nhập file Excel danh mục thành công!');
        fetchCategories();
      } else {
        toast.error(json.message || 'Lỗi khi nhập file Excel');
      }
    } catch (e: any) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setImportLoading(false);
    }
  };

  const resetImportModal = () => {
    setSelectedFile(null);
    setImportResult(null);
    setIsImportModalOpen(false);
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
      header: t('table.productsCount', 'Số lượng món'),
      align: 'center' as const,
      render: (cat: Category) => (
        <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
          {cat._count?.products || 0} món
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions', 'Thao tác'),
      align: 'right' as const,
      render: (cat: Category) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {role === 'ADMIN' && (
            <>
              <button
                type="button"
                onClick={() => openEditModal(cat)}
                className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={t('common.edit', 'Chỉnh sửa')}
              >
                <Edit2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteId(cat.id)}
                className="p-1.5 sm:p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title={t('common.delete', 'Xóa')}
              >
                <Trash2 size={15} />
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

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {exporting ? (
                <RotateCw size={14} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={15} />
              )}
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            {/* Import Excel Button */}
            {role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setImportResult(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              >
                <Upload size={14} />
                <span>Nhập Excel</span>
              </button>
            )}

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

      {/* Modal Nhập Dữ Liệu Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-xl w-full p-4 sm:p-6 my-4 space-y-4 max-h-[96vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Nhập Danh Mục từ Excel</h3>
                  <p className="text-xs text-slate-500">Cập nhật nhanh ảnh danh mục, thứ tự, tên hoặc thêm mới</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetImportModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template download link & Quick Tips */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <HelpCircle size={16} className="text-blue-600 shrink-0" />
                  <span>Cần file mẫu chuẩn để chỉnh sửa hoặc cập nhật ảnh?</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold shadow-2xs transition-colors shrink-0"
                >
                  <Download size={13} />
                  <span>Tải file mẫu (.xlsx)</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                💡 <strong>Mẹo:</strong> Bạn có thể xuất file Excel hiện tại bằng nút <strong>Xuất Excel</strong>, sau đó điền link ảnh vào cột <strong>URL HÌNH ẢNH</strong> và chọn chế độ <strong>Cập nhật & Thêm mới (UPSERT)</strong> để cập nhật toàn bộ ảnh danh mục chỉ trong 5 giây!
              </div>
            </div>

            {/* Results Summary if completed */}
            {importResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Nhập dữ liệu danh mục thành công!</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Thêm mới</span>
                      <span className="text-lg font-black text-emerald-700">{importResult.createdCount}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Cập nhật</span>
                      <span className="text-lg font-black text-blue-700">{importResult.updatedCount}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-100">
                      <span className="text-xs text-slate-500 block">Tạm ngưng bán</span>
                      <span className="text-lg font-black text-amber-700">{importResult.deactivatedProductsCount}</span>
                    </div>
                  </div>

                  {importResult.deactivatedProductsCount > 0 && (
                    <p className="text-xs text-amber-700 italic">
                      * Đã tự động chuyển sang &quot;Tạm ngưng bán&quot; cho các món không thuộc danh mục trong file tải lên.
                    </p>
                  )}
                </div>

                {importResult.errors?.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 max-h-32 overflow-y-auto space-y-1">
                    <span className="font-bold flex items-center gap-1"><AlertCircle size={14} /> Lỗi bỏ qua ({importResult.errors.length}):</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>Dòng {err.row}: {err.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={resetImportModal}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
                  >
                    Hoàn tất & Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImportSubmit} className="space-y-4">
                {/* Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">Chọn phương thức nhập dữ liệu:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        importMode === 'UPSERT'
                          ? 'bg-red-50/50 border-red-500 ring-2 ring-red-500/10'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        value="UPSERT"
                        checked={importMode === 'UPSERT'}
                        onChange={() => setImportMode('UPSERT')}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          Cập nhật & Thêm mới (UPSERT)
                          <span className="text-[9px] px-1.5 py-0.2 bg-red-100 text-red-700 rounded-md font-black">Khuyên dùng</span>
                        </span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Cập nhật món trùng mã, thêm mới các món chưa có, giữ nguyên món khác.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        importMode === 'REPLACE'
                          ? 'bg-red-50/50 border-red-500 ring-2 ring-red-500/10'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="importMode"
                        value="REPLACE"
                        checked={importMode === 'REPLACE'}
                        onChange={() => setImportMode('REPLACE')}
                        className="mt-0.5 text-red-600 focus:ring-red-500"
                      />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-900">Ghi đè & Tắt món cũ (REPLACE)</span>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Chuyển sang &quot;Tạm ngưng bán&quot; cho các món không nằm trong file tải lên.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : 'border-slate-300 hover:border-red-400 bg-slate-50/60 hover:bg-red-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  {selectedFile ? (
                    <div className="space-y-1.5 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Check size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB - Nhấp để chọn file khác</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                        <Upload size={18} />
                      </div>
                      <p className="text-xs font-bold text-slate-800">Chọn tệp Excel danh mục (.xlsx)</p>
                      <p className="text-[10px] text-slate-500">Kéo thả tệp vào đây hoặc duyệt tệp từ máy tính</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={resetImportModal}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedFile || importLoading}
                    className="flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {importLoading ? (
                      <>
                        <RotateCw size={14} className="animate-spin" />
                        <span>Đang xử lý dữ liệu...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        <span>Bắt đầu nhập dữ liệu</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
