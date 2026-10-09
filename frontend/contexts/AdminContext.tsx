'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

const CAPS_CACHE_KEY = 'avora_admin_caps_cache_v1';

const getCachedCapabilities = (): UserCapabilities | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CAPS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setCachedCapabilities = (caps: UserCapabilities | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (caps) {
      sessionStorage.setItem(CAPS_CACHE_KEY, JSON.stringify(caps));
    } else {
      sessionStorage.removeItem(CAPS_CACHE_KEY);
    }
  } catch {}
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Khởi tạo an toàn cho SSR (tránh hydration mismatch giữa server và client)
  const [capabilities, setCapabilities] = useState<UserCapabilities | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, UserBranchPermission>>({});
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  // Đồng bộ branch từ URL khi query thay đổi mà không re-fetch capabilities
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const branchFromUrl = urlParams.get('branch');
    if (branchFromUrl && branchFromUrl !== selectedBranchId) {
      setSelectedBranchIdState(branchFromUrl);
    }
  }, [pathname, selectedBranchId]);

  const fetchCapabilities = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('access_token')) : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/me/capabilities', {
        credentials: 'include',
        headers,
      });

      if (!res.ok) {
        // Fallback to /api/auth/me if capabilities endpoint fails
        const meRes = await fetch('/api/auth/me', { credentials: 'include', headers });
        if (!meRes.ok) {
          setCachedCapabilities(null);
          router.push('/login');
          return null;
        }
        const meData = await meRes.json();
        if (!meData?.role || meData.role === 'USER') {
          setCachedCapabilities(null);
          router.push('/');
          return null;
        }
        setUser(meData);
        return null;
      }

      const caps: UserCapabilities = await res.json();
      setCachedCapabilities(caps);
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

      // Determine selected branch from Storage or Default if not already selected
      setSelectedBranchIdState((prev) => {
        if (prev && prev !== 'ALL' && branchesForUser.some((b) => b.id === prev)) {
          return prev;
        }
        const branchFromStorage =
          typeof window !== 'undefined'
            ? localStorage.getItem(LOCAL_STORAGE_BRANCH_KEY)
            : null;

        if (branchFromStorage && (branchFromStorage === 'ALL' || branchesForUser.some((b) => b.id === branchFromStorage))) {
          return branchFromStorage;
        }
        if (caps.user.branchId && branchesForUser.some((b) => b.id === caps.user.branchId)) {
          return caps.user.branchId;
        }
        if (branchesForUser.length > 0) {
          return isSystemAdmin ? 'ALL' : branchesForUser[0].id;
        }
        return 'ALL';
      });

      return caps;
    } catch (err) {
      console.error('Error fetching admin capabilities:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;

    // 1. Hydrate tức thì từ client storage ở client mount (0ms chờ)
    const cached = getCachedCapabilities();
    if (cached) {
      setCapabilities(cached);
      setUser(cached.user || null);
      setAllBranches(cached.allBranches || []);
      setEffectivePermissions(cached.effectivePermissions || {});

      const isSysAdmin = cached.roles?.some((r) => r.code === 'ADMIN');
      if (isSysAdmin) {
        setAvailableBranches(cached.allBranches || []);
      } else {
        const branchMap = new Map<string, Branch>();
        cached.assignments?.forEach((assignment) => {
          if (assignment.branchScope === 'ALL_BRANCHES') {
            cached.allBranches?.forEach((b) => branchMap.set(b.id, b));
          } else if (assignment.branches) {
            assignment.branches.forEach((b) => branchMap.set(b.id, b));
          }
        });
        setAvailableBranches(Array.from(branchMap.values()));
      }
      setLoading(false);
    }

    try {
      if (localStorage.getItem('avora_admin_sidebar_collapsed') === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch {}

    try {
      const urlBranch = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('branch') : null;
      if (urlBranch) {
        setSelectedBranchIdState(urlBranch);
      } else {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_BRANCH_KEY) : null;
        if (stored) {
          setSelectedBranchIdState(stored);
        }
      }
    } catch {}

    // 2. Revalidate fresh capabilities ngầm (Stale-While-Revalidate)
    const init = async () => {
      if (!cached) {
        setLoading(true);
      }
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
      const newParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
      if (id && id !== 'ALL') {
        newParams.set('branch', id);
      } else {
        newParams.delete('branch');
      }
      const newQuery = newParams.toString();
      const currentPath = pathname || (typeof window !== 'undefined' ? window.location.pathname : '/admin');
      router.push(newQuery ? `${currentPath}?${newQuery}` : currentPath);
    },
    [router, pathname]
  );

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);


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
