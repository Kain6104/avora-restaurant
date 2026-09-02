'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Search, UserPlus, Filter, Settings, Shield, ChefHat, User as UserIcon, X, Plus, Users, ShieldCheck, Crown, User, ShoppingBag, MapPin, Calendar, Star, Receipt, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/app/admin/components/Pagination';
import { buildApiUrl } from '@/lib/utils/api';

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  branchId?: string;
  branch?: { name: string };
  createdAt: string;
  isAccountLocked: boolean;
}

interface Meta {
  total: number;
  totalPages: number;
  page: number;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  MANAGER: 'bg-blue-100 text-blue-800',
  CHEF: 'bg-orange-100 text-orange-800',
  USER: 'bg-gray-100 text-gray-700',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  ADMIN: <Crown size={12} />,
  MANAGER: <ShieldCheck size={12} />,
  CHEF: <ChefHat size={12} />,
  USER: <User size={12} />,
};

export default function AdminUsersPage() {
  const { selectedBranchId, role } = useAdmin();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, totalPages: 1, page: 1 });
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [filterRole, setFilterRole] = useState(searchParams.get('role') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  // Role count state
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});

  const isInitialMount = useRef(true);

  // Sync state to URL
  useEffect(() => {
    if (isInitialMount.current) return;
    const params = new URLSearchParams(window.location.search);
    if (search) params.set('search', search); else params.delete('search');
    if (filterRole) params.set('role', filterRole); else params.delete('role');
    if (page > 1) params.set('page', page.toString()); else params.delete('page');
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [search, filterRole, page]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchUsers();
    } else {
      fetchUsers();
    }

    if (role === 'ADMIN') fetchBranches();
  }, [selectedBranchId, page, filterRole]);

  // Fetch role counts in parallel
  useEffect(() => {
    if (role === 'ADMIN') fetchRoleCounts();
  }, [selectedBranchId]);

  const fetchUsers = async (currentSearch = search) => {
    setLoading(true);
    try {
      const url = buildApiUrl('/api/admin/users', {
        branchId: selectedBranchId,
        search: currentSearch,
        role: filterRole,
        page,
        limit: 10
      });

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      setUsers(data.data || []);
      setMeta(data.meta || { total: 0, totalPages: 1, page: 1 });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoleCounts = async () => {
    try {
      const roles = ['ADMIN', 'MANAGER', 'CHEF', 'USER'];
      const counts: Record<string, number> = {};
      await Promise.all(
        roles.map(async (r) => {
          const url = buildApiUrl('/api/admin/users', {
            branchId: selectedBranchId,
            limit: 1,
            role: r
          });
          const res = await fetch(url, { credentials: 'include' });
          const data = await res.json();
          counts[r] = data.meta?.total ?? 0;
        })
      );
      setRoleCounts(counts);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBranches = async () => {};


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };



  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
          <span className="text-sm text-gray-500">
            Tổng: <span className="font-bold text-gray-800">{meta.total}</span> người dùng
          </span>
        </div>
        <button
          onClick={() => router.push('/admin/users/create')}
          className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-red-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Thêm tài khoản
        </button>
      </div>

      {/* Role count cards */}
      {role === 'ADMIN' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['ADMIN', 'MANAGER', 'CHEF', 'USER'] as const).map((r) => (
            <button
              key={r}
              onClick={() => { setFilterRole(filterRole === r ? '' : r); setPage(1); }}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                filterRole === r ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${ROLE_COLORS[r]}`}>
                  {ROLE_ICONS[r]} {r}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{roleCounts[r] ?? '...'}</div>
              <div className="text-xs text-gray-500">người dùng</div>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row items-start md:items-center gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Tìm tên, email hoặc số điện thoại..."
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
            >
              Tìm
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); fetchUsers(); }}
                className="border px-3 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Xóa
              </button>
            )}
          </form>

          {filterRole && (
            <span className="text-sm text-red-600 font-medium bg-red-50 px-3 py-1.5 rounded-lg">
              Đang lọc: {filterRole}
              <button onClick={() => { setFilterRole(''); setPage(1); }} className="ml-2 hover:underline">✕</button>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 font-bold text-gray-600">Tên</th>
                <th className="px-6 py-3 font-bold text-gray-600">Email</th>
                <th className="px-6 py-3 font-bold text-gray-600">Số điện thoại</th>
                <th className="px-6 py-3 font-bold text-gray-600">Vai trò</th>
                <th className="px-6 py-3 font-bold text-gray-600">Chi nhánh</th>
                <th className="px-6 py-3 font-bold text-gray-600 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Đang tải...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Users size={36} />
                      <span>Không tìm thấy người dùng nào</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr 
                    key={user.id} 
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/admin/users/${user.id}`)}
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{user.fullName}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-gray-600">{user.phone || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1 w-fit ${ROLE_COLORS[user.role]}`}>
                        {ROLE_ICONS[user.role]} {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.branch?.name || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      {role === 'ADMIN' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/users/${user.id}`);
                          }}
                          className="text-blue-600 hover:underline font-medium text-sm border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                          Chỉnh sửa
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/users/${user.id}`);
                          }}
                          className="text-gray-600 hover:text-gray-900 font-medium text-sm bg-gray-100 px-3 py-1.5 rounded-lg flex items-center justify-end gap-1 ml-auto"
                        >
                          <Eye size={14} /> Xem
                        </button>
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
          itemName="người dùng" 
          onPageChange={setPage} 
        />
      </div>


    </div>
  );
}
