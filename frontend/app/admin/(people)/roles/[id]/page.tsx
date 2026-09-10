'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import { useLanguage } from '@/contexts/LanguageContext';
import RoleEditor from '../RoleEditor';
import toast from 'react-hot-toast';

export default function EditRolePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const id = params?.id as string;

  const [roleData, setRoleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchRole = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/roles/${id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          setRoleData(json.data ?? json);
        } else {
          toast.error(t('roles.notFoundOrNoPermission', 'Không tìm thấy vai trò hoặc bạn không có quyền xem'));
          router.push('/admin/roles');
        }
      } catch (err) {
        console.error(err);
        toast.error(t('roles.loadError', 'Lỗi khi tải thông tin vai trò'));
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [id, router, t]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-medium">
            {t('roles.loadingRole', 'Đang tải thông tin vai trò...')}
          </span>
        </div>
      </div>
    );
  }

  if (!roleData) return null;

  return (
    <AdminPageGuard permission="roles.view">
      <RoleEditor
        isNew={false}
        initialData={{
          id: roleData.id,
          code: roleData.code,
          name: roleData.name,
          description: roleData.description,
          scopeType: roleData.scopeType,
          isActive: roleData.isActive,
          isSystem: roleData.isSystem,
          permissions: roleData.permissionKeys || roleData.permissions?.map((p: any) => p.permissionKey || p) || [],
        }}
      />
    </AdminPageGuard>
  );
}
