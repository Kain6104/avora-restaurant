'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Plus,
  Copy,
  Trash2,
  Edit,
  Users,
  KeyRound,
  Globe,
  Store,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { Can } from '@/components/Can';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  scopeType: 'GLOBAL' | 'BRANCH' | 'MIXED';
  memberCount: number;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function RolesListPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/roles', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const items = json.data ?? (Array.isArray(json) ? json : []);
        setRoles(items);
      } else {
        toast.error(t('roles.loadError', 'Không thể tải danh sách vai trò'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('roles.loadError', 'Lỗi khi tải dữ liệu vai trò'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleDuplicate = async (role: RoleItem) => {
    const confirm = window.confirm(
      locale === 'en'
        ? `Do you want to duplicate role "${role.name}"?`
        : `Bạn có muốn nhân bản vai trò "${role.name}" không?`
    );
    if (!confirm) return;

    try {
      toast.loading(t('roles.duplicating', 'Đang nhân bản vai trò...'), { id: 'dup-role' });
      const res = await fetch(`/api/admin/roles/${role.id}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          locale === 'en'
            ? `Successfully duplicated: ${data.data?.name}`
            : `Đã nhân bản thành công: ${data.data?.name}`,
          { id: 'dup-role' }
        );
        fetchRoles();
        router.push(`/admin/roles/${data.data.id}`);
      } else {
        toast.error(data.message || t('roles.dupFailed', 'Không thể nhân bản vai trò'), { id: 'dup-role' });
      }
    } catch (err) {
      toast.error(t('roles.connError', 'Lỗi máy chủ khi nhân bản vai trò'), { id: 'dup-role' });
    }
  };

  const handleDelete = async (role: RoleItem) => {
    if (role.isSystem) {
      toast.error(t('roles.cannotDeleteSystem', 'Không thể xóa Vai trò hệ thống mặc định'));
      return;
    }
    if (role.memberCount > 0) {
      alert(
        locale === 'en'
          ? `This role is assigned to ${role.memberCount} staff members. Please unassign all staff before deleting this role.`
          : `Vai trò này đang được gán cho ${role.memberCount} nhân viên. Vui lòng hủy gán nhân viên trước khi xóa vai trò.`
      );
      return;
    }

    const confirm = window.confirm(
      locale === 'en'
        ? `Are you sure you want to permanently delete role "${role.name}"? This action cannot be undone.`
        : `Bạn có chắc chắn muốn xóa vĩnh viễn vai trò "${role.name}"? Thao tác này không thể phục hồi.`
    );
    if (!confirm) return;

    try {
      setDeletingRoleId(role.id);
      const res = await fetch(`/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || t('roles.deleteSuccess', 'Đã xóa vai trò thành công'));
        fetchRoles();
      } else {
        toast.error(data.message || t('roles.deleteFailed', 'Xóa vai trò thất bại'));
      }
    } catch (err) {
      toast.error(t('roles.deleteError', 'Lỗi khi xóa vai trò'));
    } finally {
      setDeletingRoleId(null);
    }
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const systemRoles = filteredRoles.filter((r) => r.isSystem);
  const customRoles = filteredRoles.filter((r) => !r.isSystem);

  return (
    <AdminPageGuard permission="roles.view">
      <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 pb-8 sm:pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800">{t('roles.title', 'Vai trò & Phân quyền')}</h1>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {t('roles.subtitle', 'Quản lý phân quyền Enterprise động, phân nhánh linh hoạt (RBAC Multi-Branch)')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Can permission="roles.create">
              <Link
                href="/admin/roles/new"
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm hover:shadow-md min-h-[40px]"
              >
                <Plus className="w-4 h-4" /> {t('roles.add', 'Tạo vai trò mới')}
              </Link>
            </Can>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-100 flex items-center gap-2.5 min-h-[40px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            placeholder={t('roles.searchPlaceholder', 'Tìm kiếm vai trò theo tên, mã code hoặc mô tả...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs sm:text-sm outline-hidden text-slate-800 placeholder-slate-400 bg-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 min-h-[32px]"
            >
              {t('common.clearFilter', 'Xóa')}
            </button>
          )}
        </div>

        {/* System Roles Section */}
        <div className="space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              {t('roles.systemRole', 'Vai trò hệ thống')} ({systemRoles.length})
            </h2>
            <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              {locale === 'en' ? 'Protected system default roles' : 'Được bảo vệ'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            {systemRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onDuplicate={() => handleDuplicate(role)}
                onDelete={() => handleDelete(role)}
                isDeleting={deletingRoleId === role.id}
              />
            ))}
          </div>
        </div>

        {/* Custom Roles Section */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {t('roles.customRole', 'Vai trò tùy chỉnh')} ({customRoles.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              {locale === 'en' ? 'Custom roles created for organizational needs' : 'Do Admin tự tạo theo nhu cầu thực tế'}
            </span>
          </div>

          {customRoles.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-sm text-slate-500 mb-3">
                {locale === 'en' ? 'No custom roles have been created yet.' : 'Chưa có vai trò tùy chỉnh nào được tạo.'}
              </p>
              <Can permission="roles.create">
                <Link
                  href="/admin/roles/new"
                  className="inline-flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 underline"
                >
                  {locale === 'en' ? '+ Create first custom role' : '+ Tạo vai trò tùy chỉnh đầu tiên'}
                </Link>
              </Can>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
              {customRoles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onDuplicate={() => handleDuplicate(role)}
                  onDelete={() => handleDelete(role)}
                  isDeleting={deletingRoleId === role.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageGuard>
  );
}

function RoleCard({
  role,
  onDuplicate,
  onDelete,
  isDeleting,
}: {
  role: RoleItem;
  onDuplicate: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-100 shadow-2xs hover:shadow-md transition p-3 sm:p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">{role.name}</h3>
              {role.isSystem ? (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50 rounded-full">
                  {t('roles.systemRole', 'Hệ thống')}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-full">
                  {t('roles.customRole', 'Tùy chỉnh')}
                </span>
              )}
            </div>
            <code className="text-[11px] font-mono text-slate-400 mt-0.5 block">{role.code}</code>
          </div>

          <div className="shrink-0">
            {role.isActive ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> {t('common.active', 'Hoạt động')}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3" /> {t('common.inactive', 'Tạm dừng')}
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-500 line-clamp-2 mb-4">
          {role.description || t('roles.emptyDesc', 'Không có mô tả chi tiết')}
        </p>

        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-slate-50 rounded-xl mb-4 text-center">
          <div>
            <span className="text-[10px] text-slate-400 font-medium block">{t('roles.scope', 'Phạm vi')}</span>
            <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1 mt-0.5">
              {role.scopeType === 'GLOBAL' ? (
                <>
                  <Globe className="w-3 h-3 text-blue-500" /> {t('roles.scopeGlobal', 'Toàn quốc')}
                </>
              ) : (
                <>
                  <Store className="w-3 h-3 text-amber-500" /> {t('roles.scopeBranch', 'Chi nhánh')}
                </>
              )}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-medium block">{t('roles.permissionsCount', 'Số quyền')}</span>
            <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1 mt-0.5">
              <KeyRound className="w-3 h-3 text-indigo-500" /> {role.permissionCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-medium block">{t('roles.assignedUsers', 'Nhân sự')}</span>
            <span className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1 mt-0.5">
              <Users className="w-3 h-3 text-emerald-500" /> {role.memberCount}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-auto">
        <Can permission="roles.create">
          <button
            onClick={onDuplicate}
            title={t('roles.duplicate', 'Nhân bản')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition"
          >
            <Copy className="w-3.5 h-3.5" /> {t('roles.duplicate', 'Nhân bản')}
          </button>
        </Can>

        <div className="flex items-center gap-1">
          <Can permission="roles.view">
            <Link
              href={`/admin/roles/${role.id}`}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              <Edit className="w-3.5 h-3.5" /> {t('roles.edit', 'Chỉnh sửa')}
            </Link>
          </Can>

          {!role.isSystem && (
            <Can permission="roles.delete">
              <button
                onClick={onDelete}
                disabled={isDeleting}
                title={role.memberCount > 0 ? (t('roles.cannotDeleteAssigned', 'Không thể xóa khi còn nhân sự')) : t('roles.delete', 'Xóa vai trò')}
                className={`p-1.5 rounded-lg transition ${
                  role.memberCount > 0
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Can>
          )}
        </div>
      </div>
    </div>
  );
}
