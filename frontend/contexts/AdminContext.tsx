'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface User {
  role: string;
  branchId: string | null;
  branch?: { id: string; name: string };
}

interface Branch {
  id: string;
  name: string;
}

interface AdminContextType {
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  availableBranches: Branch[];
  permissions: string[];
  role: string | null;
  user: User | null;
  loading: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [user, setUser] = useState<User | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    const initAdmin = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        
        if (!res.ok) {
          router.push('/login');
          return;
        }
        
        const userData = await res.json();
        const role = userData?.role;
        
        if (!role || role === 'USER') {
          router.push('/');
          return;
        }
        
        setUser(userData);
        setPermissions(userData.permissions || []);
        
        if (role === 'ADMIN') {
          const branchRes = await fetch('/api/admin/branches', {
            credentials: 'include'
          });
          const branchData = await branchRes.json();
          setAvailableBranches(branchData.data || []);
          
          const branchParam = searchParams.get('branch');
          if (branchParam) setSelectedBranchId(branchParam);
        } else {
          setSelectedBranchId(userData.branchId || 'ALL');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    initAdmin();
  }, [router, searchParams]);

  const handleBranchChange = (id: string) => {
    setSelectedBranchId(id);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('branch', id);
    router.push(`?${newParams.toString()}`);
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Đang tải...</div>;

  return (
    <AdminContext.Provider value={{
      selectedBranchId,
      setSelectedBranchId: handleBranchChange,
      availableBranches,
      permissions,
      role: user?.role || null,
      user,
      loading
    }}>
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
