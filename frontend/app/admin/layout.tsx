import React from 'react';
import { AdminProvider } from '@/contexts/AdminContext';
import AdminHeader from './components/AdminHeader';
import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AdminHeader />
          
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}
