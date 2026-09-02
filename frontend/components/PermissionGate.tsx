'use client';
import React from 'react';
import { useAdmin } from '../contexts/AdminContext';

interface Props {
  permission: string;
  children: React.ReactNode;
}

export default function PermissionGate({ permission, children }: Props) {
  const { permissions, loading } = useAdmin();

  if (loading) return null;
  
  if (!permissions.includes(permission)) {
    return null;
  }

  return <>{children}</>;
}
