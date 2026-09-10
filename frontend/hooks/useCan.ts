'use client';

import { useAdmin } from '@/contexts/AdminContext';
import { useMemo } from 'react';

/**
 * Hook kiểm tra quyền hạn của người dùng hiện tại
 * @param permission Mã quyền (vd: 'orders.refund', 'products.update')
 * @param branchId ID chi nhánh cần thao tác (nếu không truyền, lấy selectedBranchId từ AdminContext)
 * @returns boolean: true nếu có quyền, false nếu không
 */
export function useCan(permission: string, branchId?: string): boolean {
  const { can, selectedBranchId } = useAdmin();
  const targetBranchId = branchId !== undefined ? branchId : selectedBranchId;
  return can(permission, targetBranchId);
}

/**
 * Hook lấy danh sách các chi nhánh mà user có quyền thực hiện hành động này
 * @param permission Mã quyền
 */
export function useAllowedBranches(permission: string) {
  const { getAllowedBranchesForPermission } = useAdmin();
  return useMemo(() => getAllowedBranchesForPermission(permission), [getAllowedBranchesForPermission, permission]);
}
