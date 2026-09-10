'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role?: string;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
}

export interface Branch {
  id: string;
  name: string;
  branchCode?: string;
}

export interface RoleAssignment {
  roleCode: string;
  roleName: string;
  branchScope: 'ALL_BRANCHES' | 'SELECTED_BRANCHES';
  isPrimary: boolean;
  branches: Branch[];
}

export interface UserBranchPermission {
  isGlobal: boolean;
  branchIds: string[];
}

export interface UserCapabilities {
  user: AdminUser;
  roles: {
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
    scopeType: string;
  }[];
  assignments: RoleAssignment[];
  effectivePermissions: Record<string, UserBranchPermission>;
  allBranches: Branch[];
  defaultBranchId?: string | null;
}

interface AdminContextType {
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  availableBranches: Branch[];
  allBranches: Branch[];
  permissions: string[];
  effectivePermissions: Record<string, UserBranchPermission>;
  role: string | null;
  roles: string[];
  user: AdminUser | null;
  capabilities: UserCapabilities | null;
  loading: boolean;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  isSidebarCollapsed: boolean;
  toggleSidebarCollapse: () => void;
  getBranchQueryParam: (paramName?: string) => string;
  can: (permissionKey: string, branchId?: string | null) => boolean;
  getAllowedBranchesForPermission: (permissionKey: string) => Branch[];
  refreshCapabilities: () => Promise<any>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const LOCAL_STORAGE_BRANCH_KEY = 'avora_admin_selected_branch';

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [capabilities, setCapabilities] = useState<UserCapabilities | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, UserBranchPermission>>({});
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchCapabilities = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me/capabilities', {
        credentials: 'include',
      });

      if (!res.ok) {
        // Fallback to /api/auth/me if capabilities endpoint fails
        const meRes = await fetch('/api/auth/me', { credentials: 'include' });
        if (!meRes.ok) {
          router.push('/login');
          return null;
        }
        const meData = await meRes.json();
        if (!meData?.role || meData.role === 'USER') {
          router.push('/');
          return null;
        }
        setUser(meData);
        return null;
      }

      const caps: UserCapabilities = await res.json();
      setCapabilities(caps);
      setUser(caps.user);
      setAllBranches(caps.allBranches || []);
      setEffectivePermissions(caps.effectivePermissions || {});

      // Calculate distinct branches the user is authorized to operate on
      const isSystemAdmin = caps.roles.some((r) => r.code === 'ADMIN');
      let branchesForUser: Branch[] = [];

      if (isSystemAdmin) {
        branchesForUser = caps.allBranches || [];
      } else {
        const branchMap = new Map<string, Branch>();
        caps.assignments.forEach((assignment) => {
          if (assignment.branchScope === 'ALL_BRANCHES') {
            caps.allBranches.forEach((b) => branchMap.set(b.id, b));
          } else if (assignment.branches) {
            assignment.branches.forEach((b) => branchMap.set(b.id, b));
          }
        });
        branchesForUser = Array.from(branchMap.values());
      }

      setAvailableBranches(branchesForUser);

      // Determine selected branch from URL or Storage or Default
      const branchFromUrl = searchParams.get('branch');
      const branchFromStorage =
        typeof window !== 'undefined'
          ? localStorage.getItem(LOCAL_STORAGE_BRANCH_KEY)
          : null;

      if (branchFromUrl) {
        setSelectedBranchIdState(branchFromUrl);
      } else if (branchFromStorage && (branchFromStorage === 'ALL' || branchesForUser.some((b) => b.id === branchFromStorage))) {
        setSelectedBranchIdState(branchFromStorage);
      } else if (caps.user.branchId && branchesForUser.some((b) => b.id === caps.user.branchId)) {
        setSelectedBranchIdState(caps.user.branchId);
      } else if (branchesForUser.length > 0) {
        setSelectedBranchIdState(isSystemAdmin ? 'ALL' : branchesForUser[0].id);
      } else {
        setSelectedBranchIdState('ALL');
      }

      return caps;
    } catch (err) {
      console.error('Error fetching admin capabilities:', err);
      return null;
    }
  }, [router, searchParams]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      await fetchCapabilities();
      if (mounted) {
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [fetchCapabilities]);

  // WebSocket Real-time Authorization Refresh
  useEffect(() => {
    if (!user?.id) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const socket = io(`${socketUrl}/pos`, {
      withCredentials: true,
      auth: { userId: user.id },
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('AUTHORIZATION_UPDATED', async (data: any) => {
      console.log('Realtime AUTHORIZATION_UPDATED received:', data);
      // Invalidate and refresh capabilities
      await fetchCapabilities();
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id, fetchCapabilities]);

  const handleBranchChange = useCallback(
    (id: string) => {
      setSelectedBranchIdState(id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_BRANCH_KEY, id);
      }
      const newParams = new URLSearchParams(searchParams.toString());
      if (id && id !== 'ALL') {
        newParams.set('branch', id);
      } else {
        newParams.delete('branch');
      }
      const newQuery = newParams.toString();
      const currentPath = pathname || window.location.pathname;
      router.push(newQuery ? `${currentPath}?${newQuery}` : currentPath);
    },
    [router, searchParams, pathname]
  );

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('avora_admin_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('avora_admin_sidebar_collapsed', String(next));
      }
      return next;
    });
  }, []);

  const getBranchQueryParam = useCallback(
    (paramName: string = 'branchId'): string => {
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        return `${paramName}=${encodeURIComponent(selectedBranchId)}`;
      }
      return '';
    },
    [selectedBranchId]
  );

  /**
   * Kiểm tra người dùng có quyền cụ thể hay không (kèm theo ngữ cảnh chi nhánh)
   */
  const can = useCallback(
    (permissionKey: string, branchId?: string | null): boolean => {
      if (!capabilities) {
        // Fallback check on user.role
        if (user?.role === 'ADMIN') return true;
        return false;
      }

      // Check System Admin role
      const isSystemAdmin = capabilities.roles.some((r) => r.code === 'ADMIN');
      if (isSystemAdmin) return true;

      const perm = effectivePermissions[permissionKey];
      if (!perm) return false;

      // Quyền toàn cục
      if (perm.isGlobal) return true;

      // Nếu không chỉ định chi nhánh hoặc chi nhánh là 'ALL':
      // Chỉ cần người dùng có quyền tại ít nhất 1 chi nhánh
      if (!branchId || branchId === 'ALL') {
        return perm.branchIds.length > 0;
      }

      // Kiểm tra xem chi nhánh có trong danh sách được cấp phép không
      return perm.branchIds.includes(branchId);
    },
    [capabilities, effectivePermissions, user?.role]
  );

  /**
   * Lấy danh sách chi nhánh được phép thao tác đối với một quyền cụ thể
   */
  const getAllowedBranchesForPermission = useCallback(
    (permissionKey: string): Branch[] => {
      if (!capabilities) {
        if (user?.role === 'ADMIN') return allBranches;
        return [];
      }

      const isSystemAdmin = capabilities.roles.some((r) => r.code === 'ADMIN');
      if (isSystemAdmin) return allBranches;

      const perm = effectivePermissions[permissionKey];
      if (!perm) return [];

      if (perm.isGlobal) return allBranches;

      const branchSet = new Set(perm.branchIds);
      return allBranches.filter((b) => branchSet.has(b.id));
    },
    [capabilities, effectivePermissions, allBranches, user?.role]
  );

  const permissionsList = Object.keys(effectivePermissions);
  const roleCodes = capabilities?.roles.map((r) => r.code) || (user?.role ? [user.role] : []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Đang tải hệ thống phân quyền...
          </span>
        </div>
      </div>
    );
  }

  return (
    <AdminContext.Provider
      value={{
        selectedBranchId,
        setSelectedBranchId: handleBranchChange,
        availableBranches,
        allBranches,
        permissions: permissionsList,
        effectivePermissions,
        role: roleCodes[0] || null,
        roles: roleCodes,
        user,
        capabilities,
        loading,
        isMobileSidebarOpen,
        setMobileSidebarOpen,
        toggleMobileSidebar,
        isSidebarCollapsed,
        toggleSidebarCollapse,
        getBranchQueryParam,
        can,
        getAllowedBranchesForPermission,
        refreshCapabilities: fetchCapabilities,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
