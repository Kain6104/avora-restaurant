'use client';

import React from 'react';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import RoleEditor from '../RoleEditor';

export default function NewRolePage() {
  return (
    <AdminPageGuard permission="roles.create">
      <RoleEditor isNew={true} />
    </AdminPageGuard>
  );
}
