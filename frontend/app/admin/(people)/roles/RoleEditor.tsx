'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Save,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  Info,
  Globe,
  Store,
  KeyRound,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export interface PermissionDefinition {
  key: string;
  groupKey: string;
  name: string;
  description: string;
  scopeType: 'GLOBAL' | 'BRANCH' | 'MIXED';
  riskLevel: 'NORMAL' | 'SENSITIVE' | 'CRITICAL';
  sortOrder: number;
}

export interface PermissionGroupDefinition {
  key: string;
  name: string;
  category: string; // TỔNG QUAN, QUẢN LÝ BÁN HÀNG, QUẢN LÝ KHÁCH HÀNG, MARKETING, QUẢN LÝ HỆ THỐNG
  description?: string;
  sortOrder: number;
}

interface RoleEditorProps {
  initialData?: {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    scopeType?: 'GLOBAL' | 'BRANCH';
    isActive?: boolean;
    isSystem?: boolean;
    permissions?: string[];
  };
  isNew?: boolean;
}

export default function RoleEditor({ initialData, isNew = false }: RoleEditorProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();

  // Form State
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [scopeType, setScopeType] = useState<'GLOBAL' | 'BRANCH'>(
    initialData?.scopeType || 'BRANCH'
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(initialData?.permissions || [])
  );

  // Catalog State
  const [groups, setGroups] = useState<PermissionGroupDefinition[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCriticalWarning, setShowCriticalWarning] = useState(false);

  // Fetch permissions catalog
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setCatalogLoading(true);
        const res = await fetch('/api/admin/roles/permissions-catalog', {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const catalog = json.data ?? json;
          const groupList = catalog?.groups || [];
          const permList = catalog?.permissions || [];
          setGroups(groupList);
          setPermissions(permList);

          // Open all accordions by default
          const openMap: Record<string, boolean> = {};
          groupList.forEach((g: PermissionGroupDefinition) => {
            openMap[g.key] = true;
          });
          setOpenGroups(openMap);
        } else {
          toast.error(t('roles.cannotLoadCatalog', 'Không thể tải danh mục quyền hạn'));
        }
      } catch (err) {
        console.error(err);
        toast.error(t('roles.loadCatalogError', 'Lỗi khi tải danh mục quyền'));
      } finally {
        setCatalogLoading(false);
      }
    };

    fetchCatalog();
  }, [t]);

  // Update selected keys when initialData changes
  useEffect(() => {
    if (initialData?.permissions) {
      setSelectedKeys(new Set(initialData.permissions));
    }
    if (initialData?.name) setName(initialData.name);
    if (initialData?.code) setCode(initialData.code);
    if (initialData?.description) setDescription(initialData.description);
    if (initialData?.scopeType) setScopeType(initialData.scopeType);
    if (initialData?.isActive !== undefined) setIsActive(initialData.isActive);
  }, [initialData]);

  // Group permissions by groupKey
  const permissionsByGroup = useMemo(() => {
    const map = new Map<string, PermissionDefinition[]>();
    permissions.forEach((perm) => {
      const list = map.get(perm.groupKey) || [];
      list.push(perm);
      map.set(perm.groupKey, list);
    });
    return map;
  }, [permissions]);

  // Visual Categories mapping
  const CATEGORY_ORDER = [
    'TỔNG QUAN',
    'QUẢN LÝ BÁN HÀNG',
    'QUẢN LÝ KHÁCH HÀNG',
    'MARKETING',
    'QUẢN LÝ HỆ THỐNG',
  ];

  const groupedByCategory = useMemo(() => {
    const catMap = new Map<string, PermissionGroupDefinition[]>();
    CATEGORY_ORDER.forEach((cat) => catMap.set(cat, []));

    groups.forEach((group) => {
      const cat = group.category || 'QUẢN LÝ HỆ THỐNG';
      const list = catMap.get(cat) || [];
      list.push(group);
      catMap.set(cat, list);
    });

    return catMap;
  }, [groups]);

  // Filtered Permissions based on search
  const filteredPermissions = useMemo(() => {
    if (!searchTerm.trim()) return permissions;
    const q = searchTerm.toLowerCase();
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [permissions, searchTerm]);

  const filteredKeySet = useMemo(() => {
    return new Set(filteredPermissions.map((p) => p.key));
  }, [filteredPermissions]);

  // Check critical permissions count selected
  const criticalSelectedCount = useMemo(() => {
    let count = 0;
    permissions.forEach((p) => {
      if (p.riskLevel === 'CRITICAL' && selectedKeys.has(p.key)) {
        count++;
      }
    });
    return count;
  }, [permissions, selectedKeys]);

  // Permission selection helpers
  const togglePermission = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedKeys(new Set(permissions.map((p) => p.key)));
    toast.success(
      locale === 'en'
        ? `Selected all ${permissions.length} permissions`
        : `Đã chọn toàn bộ ${permissions.length} quyền`
    );
  };

  const deselectAll = () => {
    if (initialData?.isSystem && initialData?.code === 'ADMIN') {
      toast.error(t('roles.cannotDeselectAdmin', 'Không thể bỏ chọn quyền của Quản trị viên hệ thống (ADMIN)'));
      return;
    }
    setSelectedKeys(new Set());
    toast(t('roles.deselectedAll', 'Đã bỏ chọn toàn bộ quyền'));
  };

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((g) => (next[g.key] = true));
    setOpenGroups(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groups.forEach((g) => (next[g.key] = false));
    setOpenGroups(next);
  };

  const toggleGroupSelection = (groupKey: string) => {
    const groupPerms = permissionsByGroup.get(groupKey) || [];
    if (groupPerms.length === 0) return;

    const allInGroupSelected = groupPerms.every((p) => selectedKeys.has(p.key));

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allInGroupSelected) {
        groupPerms.forEach((p) => next.delete(p.key));
      } else {
        groupPerms.forEach((p) => next.add(p.key));
      }
      return next;
    });
  };

  // Submit Handler
  const handleSave = async (skipWarning = false) => {
    if (!name.trim()) {
      toast.error(t('roles.pleaseEnterName', 'Vui lòng nhập tên vai trò'));
      return;
    }

    if (isNew && !code.trim()) {
      toast.error(t('roles.pleaseEnterCode', 'Vui lòng nhập mã vai trò'));
      return;
    }

    // Warning before saving critical permissions if not confirmed yet
    if (!skipWarning && criticalSelectedCount > 0 && isNew) {
      setShowCriticalWarning(true);
      return;
    }

    try {
      setIsSubmitting(true);
      toast.loading(t('roles.saving', 'Đang lưu cấu hình vai trò...'), { id: 'save-role' });

      const payload = {
        name,
        code: isNew ? code.trim().toUpperCase() : undefined,
        description,
        scopeType,
        isActive,
        permissionKeys: Array.from(selectedKeys),
      };

      const url = isNew ? '/api/admin/roles' : `/api/admin/roles/${initialData?.id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.success !== false) {
        toast.success(
          isNew
            ? t('roles.createSuccess', 'Đã tạo vai trò mới thành công')
            : t('roles.updateSuccess', 'Đã cập nhật vai trò thành công'),
          { id: 'save-role' }
        );
        router.push('/admin/roles');
        router.refresh();
      } else {
        toast.error(json.message || t('roles.saveFailed', 'Lưu vai trò thất bại'), { id: 'save-role' });
      }
    } catch (err) {
      toast.error(t('roles.connError', 'Lỗi kết nối máy chủ'), { id: 'save-role' });
    } finally {
      setIsSubmitting(false);
      setShowCriticalWarning(false);
    }
  };

  if (catalogLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {t('roles.preparingCatalog', 'Đang chuẩn bị danh mục quyền AVORA...')}
          </span>
        </div>
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    'TỔNG QUAN': locale === 'en' ? 'OVERVIEW' : 'TỔNG QUAN',
    'QUẢN LÝ BÁN HÀNG': locale === 'en' ? 'SALES & ORDERS' : 'QUẢN LÝ BÁN HÀNG',
    'QUẢN LÝ KHÁCH HÀNG': locale === 'en' ? 'CUSTOMER MANAGEMENT' : 'QUẢN LÝ KHÁCH HÀNG',
    'MARKETING': locale === 'en' ? 'MARKETING & PROMOTIONS' : 'MARKETING',
    'QUẢN LÝ HỆ THỐNG': locale === 'en' ? 'SYSTEM SETTINGS' : 'QUẢN LÝ HỆ THỐNG',
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => router.push('/admin/roles')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800">
                {isNew ? t('roles.editorCreateTitle', 'Tạo vai trò phân quyền mới') : `${t('roles.editorEditTitle', 'Chỉnh sửa')}: ${initialData?.name}`}
              </h1>
              {initialData?.isSystem && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50 rounded-full">
                  {t('roles.systemRole', 'System Role')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('roles.editorSubtitle', 'Thiết lập quyền truy cập cho nhân viên theo từng chi nhánh hoặc toàn hệ thống')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push('/admin/roles')}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            {t('common.cancel', 'Hủy bỏ')}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm hover:shadow-md"
          >
            <Save className="w-4 h-4" /> {isSubmitting ? t('roles.saving', 'Đang lưu...') : t('roles.save', 'Lưu vai trò')}
          </button>
        </div>
      </div>

      {/* Role General Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-5">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-red-600" /> {t('roles.basicInfo', 'Thông tin vai trò')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('roles.roleName', 'Tên vai trò')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder={locale === 'en' ? 'e.g. Branch Accountant, Cashier Supervisor...' : 'Ví dụ: Kế toán chi nhánh, Thu ngân ca chiều...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('roles.roleCode', 'Mã vai trò (Code)')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="ACCOUNTANT, CASHIER_SUPERVISOR..."
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              disabled={!isNew || initialData?.isSystem}
              className="w-full text-sm font-mono px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition disabled:bg-slate-50 disabled:text-slate-400"
            />
            {!isNew && (
              <span className="text-[10px] text-slate-400 mt-1 block">
                {t('roles.codeCannotChange', 'Mã vai trò không thể thay đổi sau khi tạo')}
              </span>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('roles.roleDescription', 'Mô tả trách nhiệm & nhiệm vụ')}
            </label>
            <textarea
              rows={2}
              placeholder={locale === 'en' ? 'Brief description of roles and duties...' : 'Mô tả tóm tắt phạm vi quyền hạn và trách nhiệm của nhân viên đảm nhận vai trò này...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 border border-slate-200 rounded-xl focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('roles.scopeTypeLabel', 'Phạm vi áp dụng (Scope)')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScopeType('BRANCH')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                  scopeType === 'BRANCH'
                    ? 'border-amber-500 bg-amber-50/40 text-amber-900 font-bold ring-1 ring-amber-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Store className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <div className="text-xs">{t('roles.scopeBranch', 'Theo Chi nhánh')}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{locale === 'en' ? 'Assigned per branch' : 'Gán theo từng chi nhánh'}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScopeType('GLOBAL')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                  scopeType === 'GLOBAL'
                    ? 'border-blue-500 bg-blue-50/40 text-blue-900 font-bold ring-1 ring-blue-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Globe className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <div className="text-xs">{t('roles.scopeGlobal', 'Toàn hệ thống')}</div>
                  <div className="text-[10px] text-slate-400 font-normal">{locale === 'en' ? 'Applied nationwide' : 'Áp dụng trên toàn quốc'}</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('common.status', 'Trạng thái hoạt động')}
            </label>
            <div className="flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-3 text-xs font-medium text-slate-700">
                  {isActive ? t('roles.statusActiveDesc', 'Đang kích hoạt vai trò') : t('roles.statusInactiveDesc', 'Tạm dừng vai trò')}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Permission Matrix Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-6">
        {/* Permission Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-red-600" /> {t('roles.permissionTree', 'Bảng phân quyền chi tiết')}
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-full">
                {selectedKeys.size} / {permissions.length} {locale === 'en' ? 'permissions selected' : 'quyền đã chọn'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('roles.selectPermsHelp', 'Tích chọn các chức năng và quyền hạn được phép thực hiện')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-lg transition"
            >
              {t('roles.selectAll', 'Chọn tất cả')}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              {t('roles.deselectAll', 'Bỏ chọn tất cả')}
            </button>
            <span className="w-px h-4 bg-slate-200 mx-1 hidden sm:block"></span>
            <button
              type="button"
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              {t('roles.expandAll', 'Mở tất cả')}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              {t('roles.collapseAll', 'Đóng tất cả')}
            </button>
          </div>
        </div>

        {/* Live Search Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={t('roles.searchPermsPlaceholder', 'Tìm kiếm quyền theo tên, mã key hoặc hành vi... (vd: orders.refund, menu, bàn...)')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl outline-hidden focus:border-red-600 focus:ring-1 focus:ring-red-600 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 absolute right-3 top-2.5"
            >
              {t('common.clearFilter', 'Xóa')}
            </button>
          )}
        </div>

        {/* Accordions Grouped by Visual Category */}
        <div className="space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const categoryGroups = groupedByCategory.get(category) || [];
            // Filter groups that have permissions matching the search
            const visibleGroups = categoryGroups.filter((g) => {
              const groupPerms = permissionsByGroup.get(g.key) || [];
              return groupPerms.some((p) => filteredKeySet.has(p.key));
            });

            if (visibleGroups.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    {categoryLabels[category] || category}
                  </h3>
                </div>

                <div className="space-y-3">
                  {visibleGroups.map((group) => {
                    const allGroupPerms = permissionsByGroup.get(group.key) || [];
                    const visiblePerms = allGroupPerms.filter((p) => filteredKeySet.has(p.key));
                    const selectedInGroup = allGroupPerms.filter((p) => selectedKeys.has(p.key)).length;
                    const isOpen = openGroups[group.key] ?? true;

                    // Tristate evaluation
                    const isAllSelected = allGroupPerms.length > 0 && selectedInGroup === allGroupPerms.length;
                    const isPartiallySelected = selectedInGroup > 0 && selectedInGroup < allGroupPerms.length;

                    return (
                      <div
                        key={group.key}
                        className="border border-slate-200 rounded-xl overflow-hidden transition shadow-2xs"
                      >
                        {/* Accordion Header */}
                        <div
                          className={`flex items-center justify-between px-4 py-3 bg-slate-50/80 cursor-pointer select-none transition ${
                            isAllSelected ? 'bg-indigo-50/40' : ''
                          }`}
                          onClick={() => toggleGroup(group.key)}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroupSelection(group.key);
                              }}
                              className="text-slate-400 hover:text-red-600 transition"
                            >
                              {isAllSelected ? (
                                <CheckSquare className="w-5 h-5 text-indigo-600" />
                              ) : isPartiallySelected ? (
                                <MinusSquare className="w-5 h-5 text-indigo-500" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300" />
                              )}
                            </button>

                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-800">
                                {group.name}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                ({group.key})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                selectedInGroup > 0
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {selectedInGroup} / {allGroupPerms.length}
                            </span>
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Accordion Body */}
                        {isOpen && (
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white divide-y md:divide-y-0 divide-slate-100">
                            {visiblePerms.map((perm) => {
                              const isChecked = selectedKeys.has(perm.key);
                              return (
                                <div
                                  key={perm.key}
                                  onClick={() => togglePermission(perm.key)}
                                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition ${
                                    isChecked
                                      ? 'border-indigo-200 bg-indigo-50/20'
                                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                                  }`}
                                >
                                  <div className="pt-0.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}} // Handled by parent div
                                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <span className="text-xs font-bold text-slate-800">
                                        {perm.name}
                                      </span>
                                      {perm.riskLevel === 'CRITICAL' && (
                                        <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-red-100 text-red-700 border border-red-200 rounded">
                                          {t('roles.riskCritical', 'Quyền quan trọng')}
                                        </span>
                                      )}
                                      {perm.riskLevel === 'SENSITIVE' && (
                                        <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-100 text-amber-700 border border-amber-200 rounded">
                                          {t('roles.riskSensitive', 'Nhạy cảm')}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-2">
                                      {perm.description}
                                    </p>
                                    <code className="text-[10px] font-mono text-slate-400 mt-1 block">
                                      {perm.key}
                                    </code>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Permission Modal Warning */}
      {showCriticalWarning && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in border border-red-100">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{t('roles.criticalWarningTitle', 'Cảnh báo quyền hạn nhạy cảm')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {locale === 'en' ? (
                  <>
                    This role is granted <strong className="text-red-600">{criticalSelectedCount} CRITICAL permissions</strong> such as Permissions Management, Refunds, or System Configuration. Any staff assigned this role will have deep administrative access.
                  </>
                ) : (
                  <>
                    Vai trò này được cấp <strong className="text-red-600">{criticalSelectedCount} quyền mức độ QUAN TRỌNG (CRITICAL)</strong> như Quản lý quyền, Hoàn tiền, hoặc Cấu hình thanh toán. Bất kỳ nhân sự nào nhận vai trò này sẽ có quyền can thiệp sâu vào hệ thống.
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCriticalWarning(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {t('roles.reviewAgain', 'Kiểm tra lại')}
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm"
              >
                {t('roles.understandContinue', 'Tôi hiểu, tiếp tục lưu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
