'use client';
import React from 'react';
import { useAdmin } from '../contexts/AdminContext';
import { useCan } from '../hooks/useCan';

interface Props {
  permission: string;
  branchId?: string;
  children: React.ReactNode;
}

export default function PermissionGate({ permission, branchId, children }: Props) {
  const { loading } = useAdmin();
  const allowed = useCan(permission, branchId);

  if (loading) return null;

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
