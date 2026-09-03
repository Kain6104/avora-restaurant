'use client';

import React, { useState, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Bell } from 'lucide-react';
import Link from 'next/link';

export default function AdminHeader() {
  const { selectedBranchId, setSelectedBranchId, availableBranches, role, user } = useAdmin();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const url = new URL('/api/admin/orders/unread-count', window.location.origin);
        if (selectedBranchId && selectedBranchId !== 'ALL') {
          url.searchParams.set('branchId', selectedBranchId);
        }
        const res = await fetch(url.toString(), { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.data || 0);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // 15 seconds polling
    return () => clearInterval(interval);
  }, [selectedBranchId]);

  return (
    <header className="h-16 bg-white border-b shadow-sm flex items-center px-6 justify-between">
      <div className="font-semibold text-lg">Hệ Thống Quản Trị</div>
      <div className="flex items-center gap-4">
        {/* Branch Selector */}
        <select 
          className="bg-gray-100 border-none text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500"
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          disabled={role !== 'ADMIN'}
        >
          {role === 'ADMIN' && <option value="ALL">Tất cả chi nhánh</option>}
          {role === 'ADMIN' ? (
            availableBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))
          ) : (
            <option value={selectedBranchId}>
              {user?.branch?.name || 'Chi nhánh của bạn'}
            </option>
          )}
        </select>
        
        <Link href="/admin/orders" className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        
        <div className="flex items-center gap-2 ml-4">
          <div className="text-right hidden md:block leading-tight">
            <p className="text-sm font-bold text-gray-800">{user?.fullName || 'Người dùng'}</p>
            <p className="text-[11px] font-black text-red-600 uppercase tracking-wider">{role}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-red-100 border border-red-200 flex items-center justify-center text-red-600 font-bold text-sm uppercase shadow-sm">
            {(user?.fullName || 'A').charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
