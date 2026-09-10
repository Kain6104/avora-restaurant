'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Store, ChevronDown, Check, Lock, Building2 } from 'lucide-react';

export default function BranchSelector() {
  const { selectedBranchId, setSelectedBranchId, availableBranches, role, user, capabilities } = useAdmin();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Xác định người dùng có toàn quyền xem tất cả chi nhánh hay không
  const isSystemAdmin =
    role === 'ADMIN' ||
    capabilities?.roles.some((r) => r.code === 'ADMIN') ||
    capabilities?.assignments.some((a) => a.branchScope === 'ALL_BRANCHES');

  // Cho phép chuyển đổi chi nhánh nếu là System Admin hoặc được gán từ 2 chi nhánh trở lên
  const canSwitchBranch = isSystemAdmin || availableBranches.length > 1;

  // Find currently selected branch object
  const allBranchesLabel = t('header.allBranches', 'Tất cả chi nhánh');
  const currentBranch =
    selectedBranchId === 'ALL'
      ? { id: 'ALL', name: allBranchesLabel }
      : availableBranches.find((b) => b.id === selectedBranchId) || {
          id: selectedBranchId,
          name: user?.branch?.name || t('header.branch', 'Chi nhánh của bạn'),
        };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={!canSwitchBranch}
        onClick={() => canSwitchBranch && setIsOpen(!isOpen)}
        aria-label="Chọn chi nhánh hoạt động"
        title={
          canSwitchBranch
            ? `Chuyển đổi giữa ${isSystemAdmin ? 'tất cả các chi nhánh' : `${availableBranches.length} chi nhánh được phân công`}`
            : 'Tài khoản của bạn chỉ được phân công tại chi nhánh này'
        }
        className={`flex items-center gap-2 sm:gap-2.5 h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 transition-all duration-150 shadow-xs outline-none focus:ring-2 focus:ring-red-500/20 ${
          !canSwitchBranch ? 'cursor-default opacity-90' : 'cursor-pointer hover:border-slate-300'
        }`}
      >
        <div className="p-1 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <Store size={15} strokeWidth={2.2} />
        </div>
        <span className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[130px] sm:max-w-[180px] lg:max-w-[220px]">
          {selectedBranchId === 'ALL' ? allBranchesLabel : currentBranch.name}
        </span>

        {/* Badge số chi nhánh nếu được gán nhiều hơn 1 */}
        {!isSystemAdmin && availableBranches.length > 1 && (
          <span className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200/60">
            {availableBranches.length} CN
          </span>
        )}

        {canSwitchBranch ? (
          <ChevronDown
            size={14}
            className={`text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-slate-700' : ''
            }`}
            strokeWidth={2}
          />
        ) : (
          <Lock size={12} className="text-slate-400 shrink-0" strokeWidth={2} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && canSwitchBranch && (
        <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Option: All Branches (Chỉ dành cho Admin hệ thống) */}
          {isSystemAdmin && (
            <button
              type="button"
              onClick={() => handleSelect('ALL')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                selectedBranchId === 'ALL'
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Building2
                  size={16}
                  className={selectedBranchId === 'ALL' ? 'text-red-600' : 'text-slate-400'}
                />
                <span className="truncate">{allBranchesLabel}</span>
              </div>
              {selectedBranchId === 'ALL' && (
                <Check size={16} className="text-red-600 shrink-0" strokeWidth={2.5} />
              )}
            </button>
          )}

          {/* Section: Branches List */}
          {availableBranches.length > 0 && (
            <div className={isSystemAdmin ? 'mt-1.5 pt-1.5 border-t border-slate-100' : ''}>
              <div className="px-3 py-1 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('header.branch', 'Chi nhánh')}
                </p>
                <span className="text-[10px] text-slate-400 font-medium">
                  {availableBranches.length} được gán
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5 mt-0.5">
                {availableBranches.map((branch) => {
                  const isSelected = selectedBranchId === branch.id;
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => handleSelect(branch.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-red-50 text-red-600 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Store
                          size={15}
                          className={isSelected ? 'text-red-600 shrink-0' : 'text-slate-400 shrink-0'}
                        />
                        <span className="truncate">{branch.name}</span>
                      </div>
                      {isSelected && (
                        <Check size={15} className="text-red-600 shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
