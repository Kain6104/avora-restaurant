'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search,
  Plus,
  Edit2,
  Shield,
  ShieldAlert,
  UserCheck,
  ChefHat,
  User as UserIcon,
  RotateCw,
  Store,
  Eye,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  StatusBadge,
  DataTable,
  MobileDataCard,
  Pagination,
} from '@/app/admin/components/ui';
import { buildApiUrl } from '@/lib/utils/api';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  branch?: { name: string };
  membershipTier?: { name: string };
}

const ROLES = ['ADMIN', 'MANAGER', 'CHEF', 'USER'] as const;

export default function AdminUsersPage() {
  const { role, selectedBranchId } = useAdmin();
  const { t, locale } = useLanguage();
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams: Record<string, any> = {
        page,
        limit: 12,
      };

      if (selectedBranchId && selectedBranchId !== 'ALL') {
        queryParams.branchId = selectedBranchId;
      }
      if (search) queryParams.search = search;
      if (roleFilter) queryParams.role = roleFilter;

      const url = buildApiUrl('/api/admin/users', queryParams);
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
        if (json.meta) setMeta(json.meta);
      }
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, search, roleFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getRoleIcon = (r: string) => {
    switch (r) {
      case 'ADMIN':
        return <ShieldAlert size={14} className="text-red-600" />;
      case 'MANAGER':
        return <Shield size={14} className="text-blue-600" />;
      case 'CHEF':
        return <ChefHat size={14} className="text-amber-600" />;
      default:
        return <UserIcon size={14} className="text-slate-500" />;
    }
  };

  const columns = [
    {
      key: 'user',
      header: t('table.customer', 'Người dùng & Tài khoản'),
      render: (u: UserItem) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 uppercase shrink-0">
            {u.fullName?.charAt(0) || u.email?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
              {u.fullName || 'Chưa đặt tên'}
            </p>
            <span className="text-[11px] text-slate-400 block truncate">{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Vai trò & Chi nhánh',
      render: (u: UserItem) => (
        <div>
          <div className="flex items-center gap-1.5">
            {getRoleIcon(u.role)}
            <span className="font-bold text-xs text-slate-800 uppercase">
              {t(`role.${u.role}`, u.role)}
            </span>
          </div>
          {u.branch && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Store size={10} /> {u.branch.name}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'membershipTier',
      header: 'Hạng thành viên',
      render: (u: UserItem) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
          {u.membershipTier?.name || 'Thành viên mới'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Số điện thoại',
      render: (u: UserItem) => (
        <span className="text-xs font-mono text-slate-600">{u.phone || '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: t('table.time', 'Ngày tham gia'),
      render: (u: UserItem) => (
        <span className="text-xs text-slate-400 font-medium">
          {new Date(u.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('table.action', 'Thao tác'),
      align: 'right' as const,
      render: (u: UserItem) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/users/${u.id}`);
          }}
          aria-label={t('common.details', 'Xem chi tiết')}
          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          {role === 'ADMIN' ? <Edit2 size={16} /> : <Eye size={16} />}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t('users.title', 'Quản lý Người dùng')}
        subtitle={t('users.subtitle', 'Danh sách tài khoản khách hàng, quản lý chi nhánh và phân quyền nhân sự')}
        breadcrumbs={[
          { label: t('nav.customers', 'Khách hàng') },
          { label: t('nav.users', 'Người dùng') },
        ]}
        badge={
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100">
            {t('common.total', 'Tổng')} {meta.total} {t('common.results', 'tài khoản')}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchUsers()}
              aria-label={t('common.refresh', 'Làm mới')}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200/80 text-xs font-bold shadow-2xs transition-colors"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>{t('common.refresh', 'Làm mới')}</span>
            </button>
            {role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => router.push('/admin/users/create')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Plus size={15} />
                <span>{t('common.add', 'Thêm tài khoản')}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Role KPI Filter Tabs */}
      {role === 'ADMIN' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {ROLES.map((r) => {
            const isActive = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(isActive ? '' : r);
                  setPage(1);
                }}
                className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden flex items-center gap-3 ${
                  isActive
                    ? 'bg-red-50/90 border-red-300 text-red-700 shadow-xs'
                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 shadow-2xs'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {getRoleIcon(r)}
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold block truncate">
                    {t(`role.${r}`, r)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {r === 'ADMIN' ? 'Full Access' : r === 'MANAGER' ? 'Branch' : 'General'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        actions={
          (search || roleFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setRoleFilter('');
                setPage(1);
              }}
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              {t('common.clearFilter', 'Xóa lọc')}
            </button>
          )
        }
      >
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder={t('common.search', 'Tìm theo tên, email, số điện thoại...')}
          />
        </div>
      </FilterBar>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={users}
        keyExtractor={(u) => u.id}
        loading={loading}
        onRowClick={(u) => router.push(`/admin/users/${u.id}`)}
        emptyTitle={t('common.noData', 'Không tìm thấy người dùng nào')}
        emptyDescription="Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc vai trò."
        mobileCardRender={(u) => (
          <MobileDataCard
            title={u.fullName || u.email}
            subtitle={u.email}
            badge={
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                {t(`role.${u.role}`, u.role)}
              </span>
            }
            details={[
              {
                label: 'SĐT',
                value: u.phone || '—',
              },
              {
                label: 'Chi nhánh',
                value: u.branch?.name || 'Tất cả',
              },
              {
                label: 'Hạng thẻ',
                value: u.membershipTier?.name || 'Thành viên mới',
              },
            ]}
            actions={
              <button
                type="button"
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors"
              >
                <Edit2 size={13} />
                <span>{t('common.details', 'Xem chi tiết tài khoản')}</span>
              </button>
            }
          />
        )}
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        pageSize={12}
        onPageChange={setPage}
        itemName={t('nav.users', 'tài khoản')}
      />
    </div>
  );
}
