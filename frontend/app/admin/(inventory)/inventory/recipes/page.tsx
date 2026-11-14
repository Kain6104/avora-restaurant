'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  X,
  Trash2,
  DollarSign,
  UtensilsCrossed,
  Download,
  AlertTriangle,
  Send,
  ShieldCheck,
  Upload,
  Sliders,
} from 'lucide-react';
import { PageHeader, AdminCard, StatusBadge } from '@/app/admin/components/ui';

export default function RecipesManagementPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recipes' | 'modifiers'>('recipes');
  const [recipes, setRecipes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [missingPrepInfo, setMissingPrepInfo] = useState<{ missingCount: number; totalTrackedCount: number; warning: string } | null>(null);
  const [modifierMatrix, setModifierMatrix] = useState<any>({ summary: {}, matrix: [] });
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);
  const [modifierFilter, setModifierFilter] = useState<'ALL' | 'UNMAPPED' | 'ANOMALIES'>('ALL');
  const [search, setSearch] = useState('');
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Import CSV Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvContent, setImportCsvContent] = useState('');
  const [importPreview, setImportPreview] = useState<any>(null);
  const [createDraftRevisionIfApproved, setCreateDraftRevisionIfApproved] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState<any>({
    code: '',
    name: '',
    description: '',
    productId: '',
    servingSize: 1,
    preparationLossPercent: 0,
    ingredients: [
      { ingredientId: '', quantity: 50, unitSymbol: 'g', preparationLossPercent: 0 },
    ],
  });

  const formatMoney = (val = 0) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (search) p.set('search', search);

      const [recRes, prodRes, ingRes, prepRes, modRes] = await Promise.all([
        fetch(`/api/admin/inventory/recipes?${p.toString()}`, { credentials: 'include' }),
        fetch('/api/admin/products?limit=250', { credentials: 'include' }),
        fetch('/api/admin/inventory/ingredients?limit=250', { credentials: 'include' }),
        fetch('/api/admin/inventory/recipes/missing-prep-sheet', { credentials: 'include' }),
        fetch('/api/admin/inventory/recipes/modifier-coverage', { credentials: 'include' }),
      ]);

      const recJson = await recRes.json();
      const prodJson = await prodRes.json();
      const ingJson = await ingRes.json();
      const prepJson = await prepRes.json();
      const modJson = await modRes.json();

      if (recJson.success) setRecipes(recJson.data || []);
      if (prodJson.success) setProducts(prodJson.data?.items || prodJson.data || []);
      if (ingJson.success) setIngredients(ingJson.data?.items || []);
      if (prepJson.success && prepJson.data) {
        setMissingPrepInfo({
          missingCount: prepJson.data.missingCount,
          totalTrackedCount: prepJson.data.totalTrackedCount,
          warning: prepJson.data.warning,
        });
      }
      if (modJson.success && modJson.data) {
        setModifierMatrix(modJson.data);
      }
    } catch (e) {
      console.error('Error loading recipes:', e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const handleWorkflowAction = async (
    recipeId: string,
    versionId: string,
    action: 'submit' | 'approve' | 'reject' | 'publish',
  ) => {
    try {
      const res = await fetch(`/api/admin/inventory/recipes/${recipeId}/versions/${versionId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message || 'Cập nhật trạng thái công thức thành công');
        fetchData();
      } else {
        alert(json.message || 'Không thể thực hiện thao tác');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePreviewCsvImport = async () => {
    try {
      const res = await fetch('/api/admin/inventory/recipes/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ csvContent: importCsvContent, createDraftRevisionIfApproved }),
      });
      const json = await res.json();
      if (json.success) {
        setImportPreview(json.data);
      } else {
        alert(json.message || 'Lỗi kiểm tra file CSV');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCommitCsvImport = async () => {
    try {
      const res = await fetch('/api/admin/inventory/recipes/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ csvContent: importCsvContent, createDraftRevisionIfApproved }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`Đã lưu ${json.data?.importedCount || 0} công thức vào trạng thái DRAFT!`);
        setIsImportModalOpen(false);
        setImportPreview(null);
        setImportCsvContent('');
        fetchData();
      } else {
        alert(json.message || 'Lỗi lưu công thức import');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkClassifyModifiers = async (
    classification: 'NON_INVENTORY_MODIFIER' | 'REQUIRES_CHEF_REVIEW' | 'INVALID_CATALOG_ASSIGNMENT',
  ) => {
    if (selectedModifierIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 OptionItem');
      return;
    }
    const reason = prompt(`Ghi chú phân loại (${classification}):`) || classification;
    try {
      const res = await fetch('/api/admin/inventory/recipes/modifiers/bulk-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ optionItemIds: selectedModifierIds, classification, reason }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedModifierIds([]);
        fetchData();
      } else {
        alert(json.message || 'Lỗi phân loại hàng loạt');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/inventory/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(recipeForm),
      });
      const json = await res.json();
      if (json.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(json.message || 'Lỗi tạo công thức');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Công Thức Món Ăn & Định Mức (Bill of Materials)"
        subtitle="Quản lý định lượng nguyên liệu chuẩn, chi phí hao hụt chế biến và giá vốn món ăn (Cost Per Serving)"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/admin/inventory/recipes/export/onboarding-template?format=csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <Download size={14} />
              Tải Bảng Onboarding (CSV)
            </a>
            <a
              href="/api/admin/inventory/recipes/missing-prep-sheet?format=csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition"
            >
              <Download size={14} />
              Phiếu Món Thiếu Công Thức
            </a>
            <button
              onClick={() => {
                setImportPreview(null);
                setIsImportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
            >
              <Upload size={14} />
              Import Công Thức (CSV)
            </button>
            <button
              onClick={fetchData}
              className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              title="Làm mới"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => {
                setRecipeForm({
                  code: `REC-${Date.now().toString().slice(-4)}`,
                  name: '',
                  description: '',
                  productId: products[0]?.id || '',
                  servingSize: 1,
                  preparationLossPercent: 0,
                  ingredients: [
                    {
                      ingredientId: ingredients[0]?.id || '',
                      quantity: 50,
                      unitSymbol: ingredients[0]?.primaryUnit?.symbol || 'g',
                      preparationLossPercent: 0,
                    },
                  ],
                });
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#da251d] rounded-lg hover:bg-red-700 transition shadow-sm"
            >
              <Plus size={15} />
              Tạo Công Thức Mới
            </button>
          </div>
        }
      />

      {/* MISSING RECIPE WARNING */}
      {missingPrepInfo && missingPrepInfo.missingCount > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-900">
                CẢNH BÁO THIẾU CÔNG THỨC ({missingPrepInfo.missingCount}/{missingPrepInfo.totalTrackedCount} món theo dõi kho)
              </p>
              <p className="text-xs text-amber-800 mt-0.5">{missingPrepInfo.warning}</p>
            </div>
          </div>
          <a
            href="/api/admin/inventory/recipes/missing-prep-sheet?format=csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            <Download size={13} /> Tải Bảng Kê Bếp Điền Định Lượng
          </a>
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center border-b border-slate-200 gap-2 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'recipes' ? 'border-[#da251d] text-[#da251d]' : 'border-transparent text-slate-500'
          }`}
        >
          <BookOpen size={14} />
          Danh Sách Công Thức BOM ({recipes.length})
        </button>
        <button
          onClick={() => setActiveTab('modifiers')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-bold text-xs transition ${
            activeTab === 'modifiers' ? 'border-[#da251d] text-[#da251d]' : 'border-transparent text-slate-500'
          }`}
        >
          <Sliders size={14} />
          Phân Loại Option Modifiers ({modifierMatrix.summary?.resolvedCount || 0}/{modifierMatrix.summary?.totalOptionItems || 0})
        </button>
      </div>

      {activeTab === 'recipes' && (
        <>
          {/* SEARCH */}
          <AdminCard className="p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên công thức..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#da251d]"
          />
        </div>
      </AdminCard>

      {/* RECIPES LIST WITH ACCORDION BOM */}
      <div className="space-y-3">
        {recipes.map((rec) => {
          const isExpanded = expandedRecipeId === rec.id;
          const { costAnalysis, activeVersion } = rec;

          return (
            <AdminCard key={rec.id} className="overflow-hidden border border-slate-200">
              <div
                onClick={() => setExpandedRecipeId(isExpanded ? null : rec.id)}
                className="p-4 bg-white hover:bg-slate-50 cursor-pointer flex flex-wrap items-center justify-between gap-4 transition select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 text-slate-400 hover:text-slate-600">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-600">{rec.code}</span>
                      <h4 className="text-sm font-black text-slate-900">{rec.name}</h4>
                      {rec.isSemiFinished ? (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-extrabold rounded text-[10px]">
                          BÁN THÀNH PHẨM
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-extrabold rounded text-[10px]">
                          MÓN HOÀN CHỈNH
                        </span>
                      )}
                      {activeVersion?.workflowStage && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            activeVersion.workflowStage === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : activeVersion.workflowStage === 'APPROVED'
                              ? 'bg-indigo-100 text-indigo-800'
                              : activeVersion.workflowStage === 'SUBMITTED_FOR_REVIEW'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {activeVersion.workflowStage}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Phiên bản áp dụng: <span className="font-bold">v{activeVersion?.versionNumber || 1}</span> • Khẩu phần: {rec.servingSize} {rec.yieldUnit}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Giá bán</p>
                    <p className="text-sm font-black text-slate-900">{formatMoney(costAnalysis?.sellingPrice)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Giá vốn (BOM)</p>
                    <p className="text-sm font-black text-[#da251d]">{formatMoney(costAnalysis?.costPerServing)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Lãi gộp</p>
                    <p className="text-sm font-black text-emerald-700">{formatMoney(costAnalysis?.grossProfit)}</p>
                  </div>
                  <div className="pl-3 border-l border-slate-200 text-center min-w-[70px]">
                    <p className="text-[10px] font-bold uppercase text-slate-400">% Food Cost</p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-black bg-indigo-50 text-indigo-700">
                      {costAnalysis?.foodCostPercent}%
                    </span>
                  </div>
                </div>
              </div>

              {/* EXPANDABLE BILL OF MATERIALS (BOM) */}
              {isExpanded && activeVersion && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <UtensilsCrossed size={14} className="text-[#da251d]" />
                      Định Lượng Nguyên Liệu Chi Tiết (BOM v{activeVersion.versionNumber} — {activeVersion.workflowStage || activeVersion.status})
                    </h5>
                    <div className="flex items-center gap-2">
                      {activeVersion.workflowStage === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => handleWorkflowAction(rec.id, activeVersion.id, 'submit')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <Send size={12} /> Gửi R&D Duyệt
                        </button>
                      )}
                      {activeVersion.workflowStage === 'SUBMITTED_FOR_REVIEW' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleWorkflowAction(rec.id, activeVersion.id, 'approve')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded hover:bg-indigo-700"
                          >
                            <ShieldCheck size={12} /> Phê Duyệt (SoD)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWorkflowAction(rec.id, activeVersion.id, 'reject')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded hover:bg-rose-100"
                          >
                            Trả Về Nháp
                          </button>
                        </>
                      )}
                      {activeVersion.workflowStage === 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => handleWorkflowAction(rec.id, activeVersion.id, 'publish')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          <CheckCircle2 size={12} /> Ban Hành (Publish)
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-[11px] font-black uppercase text-slate-500 border-b">
                          <th className="py-2.5 px-3">Nguyên Liệu</th>
                          <th className="py-2.5 px-3 text-right">Định Lượng</th>
                          <th className="py-2.5 px-3 text-right">Hao Hụt (%)</th>
                          <th className="py-2.5 px-3 text-right">Đơn Giá Vốn</th>
                          <th className="py-2.5 px-3 text-right">Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeVersion.ingredients?.map((ing: any) => (
                          <tr key={ing.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {ing.ingredient?.name}
                              <span className="ml-2 font-mono text-[10px] text-slate-400">({ing.ingredient?.code})</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {Number(ing.quantity).toLocaleString()} {ing.unitSymbol}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500">
                              {Number(ing.preparationLossPercent || 0)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                              {formatMoney(Number(ing.unitCostSnapshot))}/{ing.unitSymbol}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                              {formatMoney(Number(ing.totalCostSnapshot))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t">
                          <td colSpan={4} className="py-2.5 px-3 text-right font-black uppercase text-slate-700">
                            Tổng Giá Vốn Công Thức:
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-rose-700 text-sm">
                            {formatMoney(Number(activeVersion.costPerServing))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </AdminCard>
          );
        })}
        {recipes.length === 0 && !loading && (
          <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed">
            Chưa có công thức món ăn nào được tạo
          </div>
        )}
      </div>
        </>
      )}

      {/* MODIFIER COVERAGE MATRIX TAB */}
      {activeTab === 'modifiers' && (
        <AdminCard className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setModifierFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold ${modifierFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                Tất cả ({modifierMatrix.summary?.totalOptionItems || 0})
              </button>
              <button
                onClick={() => setModifierFilter('UNMAPPED')}
                className={`px-3 py-1.5 rounded-lg font-bold ${modifierFilter === 'UNMAPPED' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800'}`}
              >
                Chưa xử lý ({modifierMatrix.summary?.unmappedCount || 0})
              </button>
              <button
                onClick={() => setModifierFilter('ANOMALIES')}
                className={`px-3 py-1.5 rounded-lg font-bold ${modifierFilter === 'ANOMALIES' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'}`}
              >
                Bất thường Menu ({modifierMatrix.summary?.anomaliesDetectedCount || 0})
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkClassifyModifiers('NON_INVENTORY_MODIFIER')}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Gán NON_INVENTORY ({selectedModifierIds.length})
              </button>
              <button
                onClick={() => handleBulkClassifyModifiers('REQUIRES_CHEF_REVIEW')}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Chờ Chef Review
              </button>
              <button
                onClick={() => handleBulkClassifyModifiers('INVALID_CATALOG_ASSIGNMENT')}
                className="px-3 py-1.5 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
              >
                Đánh dấu Bất thường Menu
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[520px] border rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 border-b text-[11px] font-black uppercase text-slate-600">
                <tr>
                  <th className="py-2.5 px-3 w-8">Chọn</th>
                  <th className="py-2.5 px-3">Món Ăn / Danh Mục</th>
                  <th className="py-2.5 px-3">Nhóm & Tùy Chọn</th>
                  <th className="py-2.5 px-3">Phân Loại</th>
                  <th className="py-2.5 px-3">Cảnh Báo Dữ Liệu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(modifierMatrix.matrix || [])
                  .filter((m: any) => {
                    if (modifierFilter === 'UNMAPPED') return m.classification === 'UNMAPPED';
                    if (modifierFilter === 'ANOMALIES') return Boolean(m.anomalyFlag);
                    return true;
                  })
                  .slice(0, 150)
                  .map((m: any) => (
                    <tr key={m.optionItemId} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedModifierIds.includes(m.optionItemId)}
                          onChange={(e) =>
                            setSelectedModifierIds((prev) =>
                              e.target.checked ? [...prev, m.optionItemId] : prev.filter((id) => id !== m.optionItemId),
                            )
                          }
                        />
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[10px] text-slate-500 mr-1">{m.itemCode}</span>
                        <span className="font-bold text-slate-900">{m.productName}</span>
                        <div className="text-[10px] text-slate-500">{m.category}</div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-slate-500">{m.optionGroupName}:</span>{' '}
                        <span className="font-bold text-slate-800">{m.optionItemName}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {m.classification}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-rose-700">{m.anomalyFlag || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* MODAL IMPORT CSV DRY-RUN */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Upload size={16} className="text-indigo-600" /> Import Công Thức Từ Bảng Onboarding (Dry-Run Validation)
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-slate-600">
              Chọn file CSV đã điền từ <code>RECIPE_ONBOARDING_WORKBOOK_212_PRODUCTS.csv</code> hoặc dán nội dung CSV. Hệ thống luôn kiểm tra đơn vị & lưu bản nháp <strong>DRAFT</strong>, không ghi đè công thức đã <strong>PUBLISHED</strong>.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setImportCsvContent(String(reader.result || ''));
                reader.readAsText(file, 'utf-8');
              }}
              className="block w-full text-xs"
            />
            <textarea
              rows={5}
              value={importCsvContent}
              onChange={(e) => setImportCsvContent(e.target.value)}
              placeholder="Hoặc dán nội dung CSV tại đây..."
              className="w-full border rounded-lg p-2 font-mono text-[11px]"
            />
            <label className="flex items-center gap-2 font-bold text-slate-700">
              <input
                type="checkbox"
                checked={createDraftRevisionIfApproved}
                onChange={(e) => setCreateDraftRevisionIfApproved(e.target.checked)}
              />
              Tạo phiên bản DRAFT mới (v+1) nếu món đã có công thức APPROVED/PUBLISHED
            </label>

            {importPreview && (
              <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
                <p className="font-black text-slate-800">
                  Kết quả Dry-Run: Hợp lệ: {importPreview.summary?.validRecipesCount} • Lỗi/Chặn: {importPreview.summary?.invalidCount} • Dòng trống bỏ qua: {importPreview.summary?.skippedBlankRows}
                </p>
                <div className="max-h-48 overflow-y-auto divide-y">
                  {(importPreview.recipes || []).map((r: any) => (
                    <div key={r.productId} className="py-1.5 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono mr-1">{r.productCode}</span>
                        <span className="font-bold">{r.productName}</span>
                        {r.errors?.length > 0 && <p className="text-rose-600">{r.errors.join('; ')}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${r.status === 'VALID_DRAFT_READY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={handlePreviewCsvImport} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg">
                1. Chạy Kiểm Tra (Dry-Run)
              </button>
              <button
                type="button"
                disabled={!importPreview || (importPreview.summary?.validRecipesCount || 0) === 0}
                onClick={handleCommitCsvImport}
                className="px-4 py-2 bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-lg"
              >
                2. Lưu Các Món Hợp Lệ (DRAFT)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TẠO CÔNG THỨC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <BookOpen size={18} className="text-[#da251d]" /> Tạo Công Thức Món Ăn Mới
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mã công thức *</label>
                  <input
                    type="text"
                    required
                    value={recipeForm.code}
                    onChange={(e) => setRecipeForm({ ...recipeForm, code: e.target.value })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tên công thức *</label>
                  <input
                    type="text"
                    required
                    value={recipeForm.name}
                    onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Món ăn trong thực đơn (Product)</label>
                <select
                  value={recipeForm.productId}
                  onChange={(e) => {
                    const sel = products.find((p) => p.id === e.target.value);
                    setRecipeForm({
                      ...recipeForm,
                      productId: e.target.value,
                      name: recipeForm.name || sel?.name || '',
                    });
                  }}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="">-- Chọn món ăn --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - Giá bán: {formatMoney(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* BẢNG NGUYÊN LIỆU ĐỊNH MỨC */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-black uppercase text-slate-800">Thành phần nguyên liệu (BOM)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipeForm({
                        ...recipeForm,
                        ingredients: [
                          ...recipeForm.ingredients,
                          {
                            ingredientId: ingredients[0]?.id || '',
                            quantity: 50,
                            unitSymbol: ingredients[0]?.primaryUnit?.symbol || 'g',
                            preparationLossPercent: 0,
                          },
                        ],
                      });
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-900"
                  >
                    + Thêm dòng
                  </button>
                </div>

                {recipeForm.ingredients.map((ingRow: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border">
                    <select
                      value={ingRow.ingredientId}
                      onChange={(e) => {
                        const sel = ingredients.find((i) => i.id === e.target.value);
                        const updated = [...recipeForm.ingredients];
                        updated[idx].ingredientId = e.target.value;
                        updated[idx].unitSymbol = sel?.primaryUnit?.symbol || 'g';
                        setRecipeForm({ ...recipeForm, ingredients: updated });
                      }}
                      className="flex-1 border rounded p-1.5 bg-white"
                    >
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({formatMoney(i.costPerPrimaryUnit)}/{i.primaryUnit?.symbol})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="any"
                      placeholder="Số lượng"
                      value={ingRow.quantity}
                      onChange={(e) => {
                        const updated = [...recipeForm.ingredients];
                        updated[idx].quantity = parseFloat(e.target.value) || 0;
                        setRecipeForm({ ...recipeForm, ingredients: updated });
                      }}
                      className="w-24 border rounded p-1.5 bg-white text-right font-bold"
                    />

                    <span className="w-12 text-slate-600 font-bold text-center">{ingRow.unitSymbol}</span>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = recipeForm.ingredients.filter((_: any, i: number) => i !== idx);
                        setRecipeForm({ ...recipeForm, ingredients: updated });
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#da251d] text-white font-bold rounded-lg hover:bg-red-700 shadow-sm"
                >
                  Lưu Bản Nháp Công Thức (DRAFT)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
