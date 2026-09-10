"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  User,
  Phone,
  Crown,
  Award,
  Plus,
  UserCheck,
  UserMinus,
  Building2,
  Edit3,
  Loader2,
  Sparkles,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RealMember } from './PaymentModal';
import { CreateCustomerModal } from './CreateCustomerModal';
import { EditCustomerVatModal } from './EditCustomerVatModal';

interface CustomerSelectModalProps {
  currentCustomer: RealMember | null;
  onClose: () => void;
  onSelectCustomer: (customer: RealMember | null) => void;
  onCustomerUpdated?: (customer: RealMember) => void;
  hasRedeemedPoints?: boolean;
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({
  currentCustomer,
  onClose,
  onSelectCustomer,
  onCustomerUpdated,
  hasRedeemedPoints = false,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RealMember[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditVatOpen, setIsEditVatOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<RealMember | null>(null);

  // Search API
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${baseUrl}/api/pos/members/search?query=${encodeURIComponent(q)}`,
          { credentials: 'include' }
        );
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Customer search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, baseUrl]);

  // Tier badge
  const renderTierBadge = (tier?: { name: string; discountPercent?: number } | null) => {
    if (!tier) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-bold text-[10px] flex items-center gap-1">
          <Award className="w-3 h-3 text-gray-500" />
          <span>Thành viên</span>
        </span>
      );
    }
    const name = tier.name;
    const isDiamond = name.includes('Kim Cương') || name.toLowerCase().includes('diamond');
    const isGold = name.includes('Vàng') || name.toLowerCase().includes('gold');
    const isSilver = name.includes('Bạc') || name.toLowerCase().includes('silver');

    if (isDiamond) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-gradient-to-r from-purple-100 to-cyan-100 text-purple-900 border border-purple-200 font-bold text-[10px] flex items-center gap-1 shadow-2xs">
          <Crown className="w-3 h-3 text-purple-600 fill-purple-200" />
          <span>Hạng {name}</span>
        </span>
      );
    }
    if (isGold) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] flex items-center gap-1 shadow-2xs">
          <Crown className="w-3 h-3 text-amber-600 fill-amber-300" />
          <span>Hạng {name}</span>
        </span>
      );
    }
    if (isSilver) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[10px] flex items-center gap-1">
          <Award className="w-3 h-3 text-slate-600" />
          <span>Hạng {name}</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-900 border border-orange-200 font-bold text-[10px] flex items-center gap-1">
        <Award className="w-3 h-3 text-orange-600" />
        <span>Hạng {name}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 leading-none">Thêm khách hàng vào đơn</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">Tìm kiếm khách thành viên hoặc chuyển về khách vãng lai</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {/* Warning Banner if points already redeemed */}
          {hasRedeemedPoints && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Đơn hàng đã có món đổi điểm thưởng. <strong>Không thể thay đổi hoặc gỡ tài khoản hội viên</strong>!
              </span>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={hasRedeemedPoints}
              onClick={() => {
                if (hasRedeemedPoints) {
                  toast.error('Đơn hàng đã đổi điểm, không thể gỡ hội viên!');
                  return;
                }
                onSelectCustomer(null);
                toast.success('Đã chọn Khách vãng lai');
                onClose();
              }}
              className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                hasRedeemedPoints
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                  : !currentCustomer
                  ? 'bg-gray-800 text-white border-gray-800 shadow-xs cursor-pointer'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 cursor-pointer'
              }`}
            >
              <UserMinus className="w-4 h-4" />
              <span>Khách vãng lai</span>
            </button>

            <button
              type="button"
              disabled={hasRedeemedPoints}
              onClick={() => {
                if (hasRedeemedPoints) {
                  toast.error('Đơn hàng đã đổi điểm, không thể thay đổi hội viên!');
                  return;
                }
                setIsCreateOpen(true);
              }}
              className={`flex-1 py-2 px-3 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                hasRedeemedPoints
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                  : 'border-[#da251d] bg-red-50/50 hover:bg-red-50 text-[#da251d] cursor-pointer'
              }`}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Tạo khách mới</span>
            </button>
          </div>

          {/* Current Selected Customer Card */}
          {currentCustomer && (
            <div className="p-3 bg-red-50/50 border border-red-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider block">
                    Khách hàng đang chọn:
                  </span>
                  <span className="font-bold text-gray-900 text-sm">{currentCustomer.fullName}</span>
                  <div className="text-[11px] text-gray-500 font-mono">
                    {currentCustomer.phone || 'Chưa có SĐT'} {currentCustomer.memberCode && `• ${currentCustomer.memberCode}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {renderTierBadge(currentCustomer.membershipTier)}
                  <span className="text-[10px] font-bold text-amber-700">
                    {currentCustomer.points?.toLocaleString('vi-VN')} điểm
                  </span>
                </div>
              </div>

              {/* VAT info preview & Edit VAT button */}
              <div className="pt-2 border-t border-red-200/60 flex items-center justify-between text-xs">
                <div className="text-[11px] text-gray-600 truncate max-w-[240px]">
                  {currentCustomer.taxCode ? (
                    <span className="flex items-center gap-1 font-mono font-medium text-slate-700">
                      <Building2 className="w-3 h-3 text-[#da251d]" />
                      MST: {currentCustomer.taxCode}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Chưa có thông tin xuất VAT</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCustomer(currentCustomer);
                    setIsEditVatOpen(true);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-red-100 border border-red-300 text-[#da251d] rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Chỉ cho phép sửa/thêm thông tin xuất hóa đơn VAT"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Sửa thông tin VAT</span>
                </button>
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-[#da251d]" /> : <Search className="w-4 h-4" />}
            </div>
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập số điện thoại, họ tên khách hàng..."
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#da251d] focus:bg-white text-xs font-medium text-gray-900 transition-all shadow-inner"
            />
          </div>

          {/* Search Results */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {searchResults.length > 0 ? (
              searchResults.map((member) => {
                const isCurrent = currentCustomer?.id === member.id;
                return (
                  <div
                    key={member.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'border-[#da251d] bg-red-50/40'
                        : 'border-gray-100 hover:border-gray-300 bg-white hover:bg-gray-50/80'
                    }`}
                  >
                    <div className="space-y-0.5 flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs truncate">{member.fullName}</span>
                        {renderTierBadge(member.membershipTier)}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {member.phone || 'Chưa SĐT'} {member.memberCode && `• ${member.memberCode}`}
                      </div>
                      {member.taxCode && (
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5 text-gray-400" />
                          MST: {member.taxCode}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomer(member);
                          setIsEditVatOpen(true);
                        }}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors cursor-pointer"
                        title="Sửa thông tin xuất hóa đơn VAT"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={hasRedeemedPoints && !isCurrent}
                        onClick={() => {
                          if (hasRedeemedPoints && !isCurrent) {
                            toast.error('Đơn hàng đã đổi điểm, không thể thay đổi hội viên!');
                            return;
                          }
                          onSelectCustomer(member);
                          toast.success(`Đã chọn khách hàng: ${member.fullName}`);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          hasRedeemedPoints && !isCurrent
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isCurrent
                            ? 'bg-emerald-600 text-white shadow-xs cursor-pointer'
                            : 'bg-[#da251d] hover:bg-[#b81d16] text-white shadow-xs cursor-pointer'
                        }`}
                      >
                        {isCurrent ? 'Đang chọn' : 'Chọn'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : searchQuery.trim().length >= 2 && !isSearching ? (
              <div className="text-center py-6 text-gray-400 space-y-1.5">
                <User className="w-8 h-8 mx-auto text-gray-300 stroke-[1.5]" />
                <p className="text-xs font-semibold text-gray-600">Không tìm thấy khách hàng nào</p>
                <p className="text-[11px] text-gray-400">Bạn có thể bấm "+ Tạo khách mới" để thêm thông tin</p>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 space-y-1">
                <Search className="w-6 h-6 mx-auto text-gray-300 stroke-[1.5]" />
                <p className="text-[11px] text-gray-400">Nhập số điện thoại để tra cứu thành viên tích điểm</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Sub-Modal: Create Customer */}
      {isCreateOpen && (
        <CreateCustomerModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(newMember) => {
            setIsCreateOpen(false);
            onSelectCustomer(newMember);
            toast.success(`Đã tạo và chọn khách: ${newMember.fullName}`);
            onClose();
          }}
        />
      )}

      {/* Sub-Modal: Edit VAT Info Only */}
      {isEditVatOpen && editingCustomer && (
        <EditCustomerVatModal
          customer={editingCustomer}
          onClose={() => {
            setIsEditVatOpen(false);
            setEditingCustomer(null);
          }}
          onSuccess={(updated) => {
            setIsEditVatOpen(false);
            setEditingCustomer(null);
            if (currentCustomer?.id === updated.id) {
              onSelectCustomer(updated);
            }
            if (onCustomerUpdated) {
              onCustomerUpdated(updated);
            }
          }}
        />
      )}
    </div>
  );
};
