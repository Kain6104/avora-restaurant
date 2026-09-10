'use client';

import React from 'react';
import { useCan } from '@/hooks/useCan';

export interface CanProps {
  permission: string;
  branchId?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Component hiển thị nội dung con CHỈ KHI người dùng có quyền hạn tương ứng.
 * Nếu không có quyền, render fallback (mặc định là null).
 * 
 * Ví dụ:
 * <Can permission="orders.refund">
 *   <button onClick={handleRefund}>Hoàn tiền</button>
 * </Can>
 */
export function Can({ permission, branchId, fallback = null, children }: CanProps) {
  const allowed = useCan(permission, branchId);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
