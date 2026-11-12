'use client';

import React, { useState } from 'react';
import { Search, Phone, Star, User } from 'lucide-react';
import { useWaiterStore } from '@/store/useWaiterStore';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { useInstantCustomerSearch } from '@/lib/offline/useOfflineData';

interface CustomerSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: any) => void;
}

export default function CustomerSearchSheet({ isOpen, onClose, onSelect }: CustomerSearchSheetProps) {
  const [query, setQuery] = useState('');
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  const { customers, isLoading } = useInstantCustomerSearch(isOpen ? query : '', activeBranchId);

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Tìm kiếm khách hàng"
      subtitle="Nhập tên hoặc số điện thoại để tích điểm"
      icon={<User size={18} className="text-[#DA251D]" />}
      maxWidth="md"
    >
      <div className="space-y-3 py-1">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập tên, số điện thoại khách hàng..."
            className="w-full pl-9 pr-3 py-2.5 bg-slate-100 border border-transparent rounded-xl text-xs sm:text-sm focus:bg-white focus:border-[#DA251D] focus:ring-1 focus:ring-[#DA251D] outline-none transition-all shadow-2xs"
          />
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain touch-pan-y space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-[#DA251D] border-t-transparent" />
            </div>
          ) : customers.length === 0 && query.length > 2 ? (
            <div className="text-center py-8 text-xs text-slate-500 font-medium">
              Không tìm thấy khách hàng phù hợp.
            </div>
          ) : query.length <= 2 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Nhập tối thiểu 3 ký tự để tìm kiếm
            </div>
          ) : (
            customers.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c);
                  onClose();
                }}
                className="w-full bg-white rounded-2xl p-3 shadow-2xs border border-slate-200/80 hover:border-slate-300 flex items-center justify-between active:scale-[0.98] transition-all text-left cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{c.fullName}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                    <Phone size={12} className="shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="inline-block bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mb-0.5">
                    {c.membershipTier?.name || c.membershipTier || 'Thành viên'}
                  </span>
                  <div className="flex items-center justify-end gap-1 text-xs font-bold text-[#DA251D]">
                    <Star size={12} className="fill-[#DA251D]" />
                    <span>{c.points || 0} điểm</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
