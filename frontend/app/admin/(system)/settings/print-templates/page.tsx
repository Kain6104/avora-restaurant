'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Printer,
  Save,
  Plus,
  Trash2,
  Copy,
  History,
  Eye,
  Store,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  MoreVertical,
  Sliders,
  Code2,
  FileEdit,
  Tag,
  Download,
  Upload,
  Check,
  Search,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';

import { TemplateEditor, TemplateEditorRef } from './components/TemplateEditor';
import { TagSelectorPanel, TagCategoryGroup } from './components/TagSelectorPanel';
import { PrintPreviewPanel } from './components/PrintPreviewPanel';
import { VersionHistoryDrawer } from './components/VersionHistoryDrawer';
import { DuplicateModal } from './components/DuplicateModal';

interface PrintTemplateItem {
  id: string;
  name: string;
  type: 'RECEIPT' | 'TEMP_BILL' | 'KITCHEN_TICKET' | 'ITEM_LABEL' | 'ONLINE_ORDER';
  content: string;
  branchId: string;
  isDefault: boolean;
  paperSize: string;
  settings?: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Hóa đơn thanh toán (Receipt)',
  TEMP_BILL: 'Phiếu tạm tính (Temp Bill)',
  KITCHEN_TICKET: 'Phiếu gửi Bếp/Bar (Kitchen)',
  ITEM_LABEL: 'Tem nhãn món ăn (Item Label)',
  ONLINE_ORDER: 'Đơn hàng Online / Delivery',
};

const PAPER_SIZES = [
  { value: '80mm', label: '80mm (Khổ in nhiệt tiêu chuẩn)' },
  { value: '58mm', label: '58mm (Khổ in nhiệt mini / cầm tay)' },
  { value: '50x30mm', label: '50x30mm (Tem nhãn dán ly / dĩa tiêu chuẩn)' },
  { value: '30x50mm', label: '30x50mm (Tem dán ly / dĩa)' },
  { value: '50x70mm', label: '50x70mm (Tem nhãn hộp lớn)' },
  { value: 'A5', label: 'A5 (Hóa đơn đặt tiệc / phiếu thu)' },
  { value: 'A4', label: 'A4 (Hóa đơn chứng từ lớn)' },
  { value: 'CUSTOM', label: 'Tùy chỉnh kích thước (CUSTOM)' },
];

export default function PrintTemplatesPage() {
  const { availableBranches, role } = useAdmin();
  const { t, locale } = useLanguage();

  const templateTypeLabels: Record<string, string> = {
    RECEIPT: t('printTemplates.receipt', 'Hóa đơn thanh toán (Receipt)'),
    TEMP_BILL: t('printTemplates.tempBill', 'Phiếu tạm tính (Temp Bill)'),
    KITCHEN_TICKET: t('printTemplates.kitchenTicket', 'Phiếu gửi Bếp/Bar (Kitchen)'),
    ITEM_LABEL: t('printTemplates.itemLabel', 'Tem nhãn món ăn (Item Label)'),
    ONLINE_ORDER: t('printTemplates.onlineOrder', 'Đơn hàng Online / Delivery'),
  };

  // Active Tab: 'editor' | 'tags' | 'preview'
  const [activeTab, setActiveTab] = useState<'editor' | 'tags' | 'preview'>('editor');

  // Branch & Templates
  const [currentBranchId, setCurrentBranchId] = useState<string>('');
  const [templates, setTemplates] = useState<PrintTemplateItem[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplateItem | null>(null);

  // Form State
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState<PrintTemplateItem['type']>('RECEIPT');
  const [paperSize, setPaperSize] = useState('80mm');
  const [isDefault, setIsDefault] = useState(false);
  const [customWidthMm, setCustomWidthMm] = useState<number>(72);
  const [customHeightMm, setCustomHeightMm] = useState<number>(40);
  const [content, setContent] = useState('');
  const [currentVersion, setCurrentVersion] = useState<number>(1);

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tagCategories, setTagCategories] = useState<TagCategoryGroup[]>([]);
  const [syntaxErrors, setSyntaxErrors] = useState<string[]>([]);
  const [syntaxWarnings, setSyntaxWarnings] = useState<string[]>([]);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const editorRef = useRef<TemplateEditorRef>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close Action dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize branch
  useEffect(() => {
    const validBranches = availableBranches.filter((b) => b.id !== 'ALL');
    if (validBranches.length > 0 && !currentBranchId) {
      setCurrentBranchId(validBranches[0].id);
    }
  }, [availableBranches, currentBranchId]);

  // Load tags
  useEffect(() => {
    async function loadTags() {
      try {
        const res = await fetch('/api/print-templates/tags', { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data) {
          const cats = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.data.categories)
            ? json.data.categories
            : [];
          setTagCategories(cats);
        }
      } catch (err) {
        console.error('Failed to load print template tags:', err);
      }
    }
    loadTags();
  }, []);

  // Fetch templates for current branch
  const fetchTemplates = useCallback(
    async (branchId: string, preferredSelectId?: string) => {
      if (!branchId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/print-templates?branchId=${branchId}`, { credentials: 'include' });
        const json = await res.json();

        if (json.success && Array.isArray(json.data)) {
          const list: PrintTemplateItem[] = json.data;
          setTemplates(list);

          if (list.length > 0) {
            let target = list[0];
            if (preferredSelectId) {
              const matched = list.find((t) => t.id === preferredSelectId);
              if (matched) target = matched;
            } else {
              const defaultTpl = list.find((t) => t.isDefault);
              if (defaultTpl) target = defaultTpl;
            }
            loadTemplateIntoEditor(target);
          } else {
            setSelectedTemplate(null);
            setContent('');
            setTemplateName('');
          }
        }
      } catch (err: any) {
        toast.error('Lỗi khi tải danh sách mẫu in: ' + err.message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (currentBranchId) {
      fetchTemplates(currentBranchId);
    }
  }, [currentBranchId, fetchTemplates]);

  // Populate editor form
  const loadTemplateIntoEditor = (tpl: PrintTemplateItem) => {
    setSelectedTemplate(tpl);
    setTemplateName(tpl.name);
    setTemplateType(tpl.type);
    setPaperSize(tpl.paperSize || '80mm');
    setIsDefault(tpl.isDefault);
    setContent(tpl.content || '');
    setCurrentVersion(tpl.version || 1);
    setHasUnsavedChanges(false);
    setSyntaxErrors([]);
    setSyntaxWarnings([]);
    if (tpl.settings && tpl.paperSize === 'CUSTOM') {
      setCustomWidthMm(tpl.settings.widthMm || 72);
      setCustomHeightMm(tpl.settings.heightMm || 40);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTemplate, templateName, templateType, content, paperSize, isDefault, currentVersion, customWidthMm, customHeightMm]);

  // Handle template selection
  const handleSelectTemplate = (id: string) => {
    if (hasUnsavedChanges) {
      const isConfirmed = window.confirm(
        'Bạn có thay đổi chưa lưu trên mẫu in hiện tại. Bạn có chắc chắn muốn chuyển sang mẫu khác?',
      );
      if (!isConfirmed) return;
    }
    const found = templates.find((t) => t.id === id);
    if (found) {
      loadTemplateIntoEditor(found);
    }
  };

  // Handle branch switch
  const handleBranchChange = (newBranchId: string) => {
    if (hasUnsavedChanges) {
      const isConfirmed = window.confirm(
        'Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn chuyển sang chi nhánh khác?',
      );
      if (!isConfirmed) return;
    }
    setCurrentBranchId(newBranchId);
    setHasUnsavedChanges(false);
  };

  // Insert tag from tag panel
  const handleInsertTag = (tagText: string) => {
    editorRef.current?.insertTagAtCursor(tagText);
    setHasUnsavedChanges(true);
    toast.success(`Đã chèn thẻ ${tagText} vào mẫu`);
  };

  // Save template
  const handleSave = async () => {
    if (!selectedTemplate) return;
    if (!templateName.trim()) {
      toast.error('Vui lòng nhập tên mẫu in');
      return;
    }

    setSaving(true);
    setSyntaxErrors([]);
    setSyntaxWarnings([]);

    const settingsPayload: Record<string, any> = {};
    if (paperSize === 'CUSTOM') {
      settingsPayload.widthMm = customWidthMm;
      settingsPayload.heightMm = customHeightMm;
    }

    try {
      const res = await fetch(`/api/print-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: templateName.trim(),
          type: templateType,
          content,
          isDefault,
          paperSize,
          settings: settingsPayload,
          version: currentVersion,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        Swal.fire({
          icon: 'warning',
          title: 'Xung đột phiên bản!',
          text: data.message || 'Mẫu in đã được chỉnh sửa bởi người khác. Vui lòng tải lại phiên bản mới nhất.',
          confirmButtonColor: '#da251d',
          confirmButtonText: 'Tải lại mẫu in',
        }).then(() => {
          fetchTemplates(currentBranchId, selectedTemplate.id);
        });
        return;
      }

      if (!res.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          setSyntaxErrors(data.errors);
          toast.error('Mẫu in có lỗi cú pháp. Vui lòng kiểm tra thông báo màu đỏ!');
        } else {
          toast.error(data.message || 'Lỗi khi lưu mẫu in');
        }
        return;
      }

      toast.success(`Đã lưu mẫu in thành công (v${data.data.version})`);
      setHasUnsavedChanges(false);
      setCurrentVersion(data.data.version);
      fetchTemplates(currentBranchId, selectedTemplate.id);
    } catch (err: any) {
      toast.error(err.message || 'Không thể kết nối đến máy chủ');
    } finally {
      setSaving(false);
    }
  };

  // Set as default
  const handleSetDefault = async () => {
    if (!selectedTemplate) return;
    try {
      const res = await fetch(`/api/print-templates/${selectedTemplate.id}/default`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã đặt "${selectedTemplate.name}" làm mẫu in mặc định`);
        setIsDefault(true);
        fetchTemplates(currentBranchId, selectedTemplate.id);
      } else {
        toast.error(data.message || 'Không thể đặt làm mặc định');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hệ thống');
    }
  };

  // Reset to default template
  const handleResetToDefault = async () => {
    if (!selectedTemplate) return;
    const confirm = await Swal.fire({
      title: 'Khôi phục mẫu gốc?',
      text: 'Toàn bộ nội dung hiện tại sẽ được thay thế bằng mẫu chuẩn mặc định của AVORA.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#da251d',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý khôi phục',
      cancelButtonText: 'Hủy bỏ',
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`/api/print-templates/${selectedTemplate.id}/reset-default`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã khôi phục mẫu in gốc thành công');
        loadTemplateIntoEditor(data.data);
        fetchTemplates(currentBranchId, selectedTemplate.id);
      } else {
        toast.error(data.message || 'Không thể khôi phục');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối');
    }
  };

  // Delete template
  const handleDelete = async () => {
    if (!selectedTemplate) return;

    const result = await Swal.fire({
      title: 'Xóa mẫu in?',
      text: `Bạn có chắc chắn muốn xóa mẫu in "${selectedTemplate.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#da251d',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Đồng ý xóa',
      cancelButtonText: 'Hủy',
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/print-templates/${selectedTemplate.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Lỗi khi xóa mẫu in');
        return;
      }

      toast.success('Đã xóa mẫu in thành công');
      fetchTemplates(currentBranchId);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    }
  };

  // Export JSON
  const handleExportJson = () => {
    if (!selectedTemplate) return;
    const exportData = {
      name: selectedTemplate.name,
      type: selectedTemplate.type,
      paperSize: selectedTemplate.paperSize,
      content: selectedTemplate.content,
      settings: selectedTemplate.settings,
      version: selectedTemplate.version,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `print_template_${selectedTemplate.type}_${selectedTemplate.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file JSON thành công');
  };

  // Create new template modal action
  const handleCreateNew = async (name: string, type: PrintTemplateItem['type'], basePaper: string) => {
    try {
      const res = await fetch('/api/print-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branchId: currentBranchId,
          name: name.trim(),
          type,
          paperSize: basePaper,
          content: '',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('printTemplates.createSuccess', 'Đã tạo mẫu in mới thành công'));
        setIsCreateModalOpen(false);
        fetchTemplates(currentBranchId, data.data.id);
      } else {
        toast.error(data.message || t('printTemplates.errorCreate', 'Lỗi khi tạo mẫu in'));
      }
    } catch (err: any) {
      toast.error(err.message || t('common.serverError', 'Lỗi máy chủ'));
    }
  };

  const branchList = availableBranches.filter((b) => b.id !== 'ALL');

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 overflow-hidden select-none">
      {/* 1. TOP HEADER */}
      <header className="px-6 py-3.5 bg-white border-b border-slate-200 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Title & Status */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 leading-tight">
                  {t('printTemplates.title', 'Mẫu in hóa đơn & Tem nhãn')}
                </h1>
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {locale === 'en' ? 'Unsaved' : 'Chưa lưu'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {locale === 'en' ? 'Saved' : 'Đã lưu'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('printTemplates.subtitle', 'Cấu hình mẫu hóa đơn, phiếu bếp, tem nhãn theo từng chi nhánh')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Action Dropdown Menu */}
            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
              >
                <span>{t('common.actions', 'Thao tác')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isActionMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 text-xs font-medium text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      handleSetDefault();
                    }}
                    disabled={!selectedTemplate || isDefault}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 disabled:opacity-40"
                  >
                    <Check className="w-4 h-4 text-amber-500" />
                    <span>{t('printTemplates.defaultTemplate', 'Đặt làm mặc định')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setIsDuplicateOpen(true);
                    }}
                    disabled={!selectedTemplate}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 disabled:opacity-40"
                  >
                    <Copy className="w-4 h-4 text-slate-500" />
                    <span>{t('printTemplates.duplicate', 'Nhân bản sang chi nhánh')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      setIsHistoryOpen(true);
                    }}
                    disabled={!selectedTemplate}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 disabled:opacity-40"
                  >
                    <History className="w-4 h-4 text-slate-500" />
                    <span>{t('printTemplates.versionHistory', 'Lịch sử phiên bản')} (v{currentVersion})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      handleResetToDefault();
                    }}
                    disabled={!selectedTemplate}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 disabled:opacity-40"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    <span>{t('printTemplates.restoreDefault', 'Khôi phục mẫu gốc')}</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      handleExportJson();
                    }}
                    disabled={!selectedTemplate}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 disabled:opacity-40"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>{locale === 'en' ? 'Export JSON File' : 'Xuất file JSON'}</span>
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsActionMenuOpen(false);
                      handleDelete();
                    }}
                    disabled={!selectedTemplate}
                    className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('common.delete', 'Xóa mẫu in')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Create New Button */}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-slate-600" />
              <span>{t('common.add', 'Thêm mẫu')}</span>
            </button>

            {/* Primary Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? t('printTemplates.saving', 'Đang lưu...') : t('printTemplates.saveTemplate', 'Lưu thay đổi')}</span>
              <span className="hidden sm:inline-block text-[10px] bg-red-800/60 px-1.5 py-0.5 rounded text-red-100">
                Ctrl+S
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. CARD CẤU HÌNH GỌN GÀNG (2 HÀNG) */}
      <section className="px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Row 1: Chi nhánh */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {t('printTemplates.branch', 'Chi nhánh')}
            </label>
            <div className="relative">
              <select
                value={currentBranchId}
                disabled={role === 'MANAGER'}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:border-red-500 transition-colors"
              >
                {branchList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 1: Loại mẫu */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {t('printTemplates.templateType', 'Loại mẫu in')}
            </label>
            <select
              value={templateType}
              onChange={(e) => {
                setTemplateType(e.target.value as any);
                setHasUnsavedChanges(true);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:border-red-500 transition-colors"
            >
              {Object.entries(templateTypeLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Row 1: Chọn mẫu template */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {t('printTemplates.selectTemplate', 'Chọn mẫu trong chi nhánh')}
            </label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              disabled={templates.length === 0}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:border-red-500 transition-colors"
            >
              {templates.length === 0 ? (
                <option value="">{t('common.noData', 'Chưa có mẫu nào')}</option>
              ) : (
                templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.isDefault ? '★ ' : ''}
                    {tpl.name} ({tpl.paperSize})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Row 2: Tên mẫu */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {t('printTemplates.templateName', 'Tên mẫu in')}
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="VD: Hóa đơn thanh toán 80mm"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:border-red-500 transition-colors"
            />
          </div>

          {/* Row 2: Khổ giấy */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              {t('printTemplates.paperSize', 'Khổ giấy máy in')}
            </label>
            <select
              value={paperSize}
              onChange={(e) => {
                setPaperSize(e.target.value);
                setHasUnsavedChanges(true);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:border-red-500 transition-colors"
            >
              {PAPER_SIZES.map((ps) => (
                <option key={ps.value} value={ps.value}>
                  {ps.label}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Mặc định chi nhánh (Toggle) */}
          <div className="flex items-center justify-between pt-4">
            <div>
              <div className="text-xs font-bold text-slate-800">{t('printTemplates.defaultTemplate', 'Đặt làm mẫu mặc định')}</div>
              <div className="text-[11px] text-slate-500">{locale === 'en' ? 'Auto applied when printing' : 'Áp dụng tự động khi in loại này'}</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => {
                  setIsDefault(e.target.checked);
                  setHasUnsavedChanges(true);
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600" />
            </label>
          </div>
        </div>
      </section>

      {/* 3. TABS NAVIGATION */}
      <div className="px-6 bg-white border-b border-slate-200 flex items-center gap-6 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 py-3 border-b-2 text-xs font-bold transition-all ${
            activeTab === 'editor'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>{t('printTemplates.tabEditor', 'Trình soạn thảo')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tags')}
          className={`flex items-center gap-2 py-3 border-b-2 text-xs font-bold transition-all ${
            activeTab === 'tags'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>{t('printTemplates.tabTags', 'Thẻ dữ liệu')}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600">
            {Array.isArray(tagCategories) ? tagCategories.reduce((acc, cat) => acc + (cat.tags?.length || 0), 0) : 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 py-3 border-b-2 text-xs font-bold transition-all ${
            activeTab === 'preview'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Xem trước bản in nhiệt</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      <div className="flex-1 overflow-hidden relative">
        {/* TAB 1: SOẠN MẪU (EDITOR) */}
        {activeTab === 'editor' && (
          <div className="h-full flex flex-col">
            <TemplateEditor
              ref={editorRef}
              value={content}
              onChange={(val) => {
                setContent(val);
                setHasUnsavedChanges(true);
              }}
              syntaxErrors={syntaxErrors}
              syntaxWarnings={syntaxWarnings}
            />
          </div>
        )}

        {/* TAB 2: THẺ DỮ LIỆU */}
        {activeTab === 'tags' && (
          <div className="h-full overflow-y-auto p-6 bg-slate-50">
            <div className="max-w-5xl mx-auto">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-slate-900">Danh mục thẻ dữ liệu thông minh</h2>
                <p className="text-xs text-slate-500">
                  Bấm vào thẻ để sao chép hoặc chèn trực tiếp vào vị trí con trỏ của mẫu in
                </p>
              </div>
              <TagSelectorPanel
                categories={Array.isArray(tagCategories) ? tagCategories : []}
                onInsertTag={handleInsertTag}
              />
            </div>
          </div>
        )}

        {/* TAB 3: XEM TRƯỚC BẢN IN NHIỆT */}
        {activeTab === 'preview' && (
          <div className="h-full overflow-y-auto p-6 bg-slate-100 flex flex-col items-center">
            <div className="w-full max-w-2xl">
              <PrintPreviewPanel
                branchId={currentBranchId}
                templateContent={content}
                paperSize={paperSize}
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. MODALS & DRAWERS */}
      {selectedTemplate && (
        <VersionHistoryDrawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          templateId={selectedTemplate.id}
          onRestoreSuccess={() => {
            setIsHistoryOpen(false);
            fetchTemplates(currentBranchId, selectedTemplate.id);
            toast.success('Đã khôi phục phiên bản thành công');
          }}
        />
      )}

      {selectedTemplate && (
        <DuplicateModal
          isOpen={isDuplicateOpen}
          onClose={() => setIsDuplicateOpen(false)}
          sourceTemplateName={selectedTemplate.name}
          branches={availableBranches.filter((b) => b.id !== 'ALL')}
          currentBranchId={currentBranchId}
          onConfirm={async (targetBranchId: string, newName: string) => {
            const res = await fetch(`/api/print-templates/${selectedTemplate.id}/duplicate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetBranchId,
                newName,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.message || 'Lỗi khi nhân bản mẫu in');
            }
            toast.success('Nhân bản mẫu in thành công');
            setIsDuplicateOpen(false);
            if (targetBranchId === currentBranchId) {
              fetchTemplates(currentBranchId, data.id);
            }
          }}
        />
      )}

      {/* Simple Create Modal */}
      {isCreateModalOpen && (
        <CreateTemplateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateNew}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, type: PrintTemplateItem['type'], paperSize: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PrintTemplateItem['type']>('RECEIPT');
  const [paper, setPaper] = useState('80mm');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên mẫu in');
      return;
    }
    onCreate(name, type, paper);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Thêm mẫu in mới</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên mẫu in *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Hóa đơn thanh toán K80"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Loại mẫu in</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-red-500 bg-white"
            >
              {Object.entries(TEMPLATE_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Khổ giấy mặc định</label>
            <select
              value={paper}
              onChange={(e) => setPaper(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-red-500 bg-white"
            >
              {PAPER_SIZES.map((ps) => (
                <option key={ps.value} value={ps.value}>
                  {ps.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
            >
              Tạo mẫu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
