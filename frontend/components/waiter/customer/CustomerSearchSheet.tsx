'use client';

import React, { useState } from 'react';
import { X, Search, Phone, Star } from 'lucide-react';
import useSWR from 'swr';
import { useWaiterStore } from '@/store/useWaiterStore';
import toast from 'react-hot-toast';

interface CustomerSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: any) => void;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CustomerSearchSheet({ isOpen, onClose, onSelect }: CustomerSearchSheetProps) {
  const [query, setQuery] = useState('');
  const activeBranchId = useWaiterStore(s => s.activeBranchId);
  
  // In a real app, this would be a debounced search API call
  const { data: response, isLoading } = useSWR(
    isOpen && query.length > 2 ? `/api/pos/customers/search?q=${query}&branchId=${activeBranchId}` : null,
    fetcher
  );

  if (!isOpen) return null;

  const customers = response?.data || [];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80]" onClick={onClose} />
      
      <div className="fixed bottom-0 left-0 w-full h-[85dvh] bg-slate-50 rounded-t-2xl z-[90] flex flex-col shadow-2xl transition-transform">
        
        <div className="flex flex-col p-4 bg-white rounded-t-2xl border-b border-slate-100 shrink-0 gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-slate-800">Tìm Khách Hàng</h2>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 active:bg-slate-200">
              <X size={20} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên, số điện thoại..."
              className="w-full pl-10 pr-4 py-3 bg-slate-100 border-transparent rounded-xl text-base focus:bg-white focus:border-[#DA251D] focus:ring-1 focus:ring-[#DA251D] outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 touch-pan-y">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#DA251D]"></div>
            </div>
          ) : customers.length === 0 && query.length > 2 ? (
            <div className="text-center py-10 text-slate-500">
              Không tìm thấy khách hàng nào.
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c);
                    onClose();
                  }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between active:scale-[0.98] transition-transform text-left"
                >
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{c.fullName}</h3>
                    <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                      <Phone size={14} />
                      {c.phone}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center justify-center bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold uppercase mb-1">
                      {c.membershipTier?.name || c.membershipTier || 'Thành viên'}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-sm font-bold text-[#DA251D]">
                      <Star size={14} className="fill-[#DA251D]" />
                      {c.points || 0} điểm
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
