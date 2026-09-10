"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Truck,
  User,
  Phone,
  CheckCircle2,
  Search,
  UserCheck,
  Users,
  PlusCircle,
  Award,
  Crown,
  Edit3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateCustomerModal } from './CreateCustomerModal';

export interface PosDeliveryInfo {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  notes?: string;
  isMember?: boolean;
  memberId?: string;
  member?: any;
}

interface DeliveryAddressModalProps {
  initialInfo?: PosDeliveryInfo;
  onClose: () => void;
  onConfirm: (info: PosDeliveryInfo) => void;
}

export const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({
  initialInfo,
  onClose,
  onConfirm,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Customer Type: 'MEMBER' (Khách thành viên) or 'GUEST' (Khách vãng lai)
  const [customerType, setCustomerType] = useState<'MEMBER' | 'GUEST'>(
    initialInfo?.isMember ? 'MEMBER' : 'MEMBER'
  );

  // Guest Fields
  const [guestName, setGuestName] = useState(initialInfo?.customerName || '');
  const [guestPhone, setGuestPhone] = useState(initialInfo?.customerPhone || '');
  const [guestAddress, setGuestAddress] = useState(initialInfo?.deliveryAddress || '');
  const [guestNotes, setGuestNotes] = useState(initialInfo?.notes || '');

  // Member Search State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(initialInfo?.member || null);

  // Member Selected Address Mode: 'SAVED' or 'CUSTOM'
  const [addressMode, setAddressMode] = useState<'SAVED' | 'CUSTOM'>('SAVED');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Custom address inputs for member
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [customRecipientPhone, setCustomRecipientPhone] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [memberNotes, setMemberNotes] = useState(initialInfo?.notes || '');

  // Modal create customer
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);

  // When member is selected, select default address if available
  useEffect(() => {
    if (selectedMember) {
      const addrs = selectedMember.addresses || [];
      if (addrs.length > 0) {
        const defaultAddr = addrs.find((a: any) => a.isDefault) || addrs[0];
        setSelectedAddressId(defaultAddr.id);
        setAddressMode('SAVED');
      } else {
        setAddressMode('CUSTOM');
        setCustomRecipientName(selectedMember.fullName || '');
        setCustomRecipientPhone(selectedMember.phone || '');
      }
    }
  }, [selectedMember]);

  // Search members from backend
  const handleSearchMembers = async (q: string) => {
    setMemberSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setMemberSearchResults([]);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/members/search?query=${encodeURIComponent(q.trim())}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setMemberSearchResults(json.data);
      }
    } catch (e) {
      console.error('Member search error:', e);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleSelectMember = (member: any) => {
    setSelectedMember(member);
    setMemberSearchResults([]);
    setMemberSearchQuery('');
    setCustomRecipientName(member.fullName || '');
    setCustomRecipientPhone(member.phone || '');
    toast.success(`Đã chọn thành viên: ${member.fullName}`);
  };

  const handleConfirm = () => {
    if (customerType === 'GUEST') {
      if (!guestAddress.trim()) {
        toast.error('Vui lòng nhập địa chỉ giao hàng');
        return;
      }
      onConfirm({
        customerName: guestName.trim() || 'Khách vãng lai',
        customerPhone: guestPhone.trim(),
        deliveryAddress: guestAddress.trim(),
        notes: guestNotes.trim(),
        isMember: false,
      });
      onClose();
    } else {
      // Member flow
      if (!selectedMember) {
        toast.error('Vui lòng chọn khách hàng thành viên hoặc chuyển sang Khách vãng lai');
        return;
      }

      let finalName = '';
      let finalPhone = '';
      let finalAddress = '';

      if (addressMode === 'SAVED') {
        const savedList = selectedMember.addresses || [];
        const chosen = savedList.find((a: any) => a.id === selectedAddressId) || savedList[0];
        if (!chosen) {
          toast.error('Vui lòng chọn địa chỉ giao hàng hoặc chọn Dùng địa chỉ khác');
          return;
        }
        finalName = chosen.recipientName || selectedMember.fullName;
        finalPhone = chosen.phone || selectedMember.phone || '';
        finalAddress = `${chosen.streetDetail}, ${chosen.ward}, ${chosen.province}`.replace(/,\s*,/g, ',').trim();
      } else {
        if (!customAddress.trim()) {
          toast.error('Vui lòng nhập địa chỉ giao hàng cụ thể');
          return;
        }
        finalName = customRecipientName.trim() || selectedMember.fullName;
        finalPhone = customRecipientPhone.trim() || selectedMember.phone || '';
        finalAddress = customAddress.trim();
      }

      onConfirm({
        customerName: finalName,
        customerPhone: finalPhone,
        deliveryAddress: finalAddress,
        notes: memberNotes.trim(),
        isMember: true,
        memberId: selectedMember.id,
        member: selectedMember,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-blue-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Thiết lập đơn giao hàng (F2)</h3>
              <p className="text-[11px] text-gray-500">
                Chọn đối tượng nhận hàng và xác nhận địa chỉ giao
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Customer Type Selector (Khách thành viên vs Khách vãng lai) */}
        <div className="px-5 pt-4 pb-2 bg-gray-50/50 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCustomerType('MEMBER')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                customerType === 'MEMBER'
                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-400'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  customerType === 'MEMBER' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="block font-bold text-xs">Khách thành viên</span>
                <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">
                  Chọn địa chỉ đã lưu & tích điểm
                </span>
              </div>
              {customerType === 'MEMBER' && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setCustomerType('GUEST')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                customerType === 'GUEST'
                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-400'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  customerType === 'GUEST' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <span className="block font-bold text-xs">Khách vãng lai</span>
                <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">
                  Nhập địa chỉ giao nhanh cho đơn lẻ
                </span>
              </div>
              {customerType === 'GUEST' && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* ========================================================
              CASE 1: KHÁCH THÀNH VIÊN
              ======================================================== */}
          {customerType === 'MEMBER' && (
            <div className="space-y-3.5">
              {!selectedMember ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-800 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tìm kiếm khách hàng thành viên:</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreateCustomerOpen(true)}
                      className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Thêm khách mới</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => handleSearchMembers(e.target.value)}
                      placeholder="Nhập số điện thoại, mã thẻ, hoặc tên khách..."
                      className="w-full pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-xs font-medium transition-all"
                    />
                    {isSearchingMembers && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                        Đang tìm...
                      </span>
                    )}

                    {memberSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-30 max-h-56 overflow-y-auto">
                        {memberSearchResults.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectMember(m)}
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between text-xs border-b border-gray-50 last:border-0 cursor-pointer"
                          >
                            <div>
                              <div className="font-bold text-gray-900">{m.fullName}</div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                {m.phone || 'Chưa SĐT'} {m.memberCode && `• Mã: ${m.memberCode}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-amber-600">
                                {m.points?.toLocaleString('vi-VN')} điểm
                              </span>
                              <span className="block text-[10px] text-gray-400">
                                {m.addresses?.length || 0} địa chỉ
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 italic">
                    Gợi ý: Tìm theo 3 số cuối điện thoại hoặc tên khách hàng
                  </p>
                </div>
              ) : (
                /* Member Selected Card */
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        {selectedMember.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 text-xs">{selectedMember.fullName}</span>
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded text-[9px] font-bold">
                            {selectedMember.membershipTier?.name || 'Thành viên'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono block">
                          {selectedMember.phone} • {selectedMember.points?.toLocaleString('vi-VN')} điểm
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer"
                    >
                      Đổi khách
                    </button>
                  </div>

                  {/* Member Addresses */}
                  <div className="space-y-2">
                    <label className="font-bold text-gray-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <span>Chọn địa chỉ giao hàng:</span>
                    </label>

                    {/* Saved Addresses List */}
                    {selectedMember.addresses && selectedMember.addresses.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMember.addresses.map((addr: any) => {
                          const isSelected = addressMode === 'SAVED' && selectedAddressId === addr.id;
                          const fullAddr = `${addr.streetDetail}, ${addr.ward}, ${addr.province}`.replace(/,\s*,/g, ',').trim();
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setAddressMode('SAVED');
                                setSelectedAddressId(addr.id);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium ring-1 ring-blue-500'
                                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900">
                                    {addr.recipientName || selectedMember.fullName}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-mono">
                                    ({addr.phone || selectedMember.phone})
                                  </span>
                                  {addr.isDefault && (
                                    <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
                                      Mặc định
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-600 mt-0.5 leading-relaxed">{fullAddr}</p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              )}
                            </button>
                          );
                        })}

                        {/* Option: Dùng địa chỉ khác */}
                        <button
                          type="button"
                          onClick={() => setAddressMode('CUSTOM')}
                          className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            addressMode === 'CUSTOM'
                              ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-500'
                              : 'border-dashed border-gray-300 hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Dùng địa chỉ khác cho đơn này</span>
                          </div>
                          {addressMode === 'CUSTOM' && (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                        Khách hàng này chưa có địa chỉ đã lưu. Vui lòng nhập địa chỉ giao hàng bên dưới:
                      </div>
                    )}

                    {/* If Custom Address Mode is selected or member has no saved addresses */}
                    {(addressMode === 'CUSTOM' || (!selectedMember.addresses || selectedMember.addresses.length === 0)) && (
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5 animate-in fade-in duration-150 mt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-gray-600 font-semibold mb-1">Tên người nhận:</label>
                            <input
                              type="text"
                              value={customRecipientName}
                              onChange={(e) => setCustomRecipientName(e.target.value)}
                              placeholder="Tên người nhận..."
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600 font-semibold mb-1">SĐT người nhận:</label>
                            <input
                              type="tel"
                              value={customRecipientPhone}
                              onChange={(e) => setCustomRecipientPhone(e.target.value)}
                              placeholder="SĐT người nhận..."
                              className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-xs font-mono font-medium"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-gray-700 font-bold mb-1">
                            Địa chỉ giao hàng cụ thể: <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            value={customAddress}
                            onChange={(e) => setCustomAddress(e.target.value)}
                            rows={2}
                            placeholder="Số nhà, đường, phường, quận, thành phố..."
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-xs font-medium resize-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Ghi chú giao hàng (nếu có):</label>
                      <input
                        type="text"
                        value={memberNotes}
                        onChange={(e) => setMemberNotes(e.target.value)}
                        placeholder="VD: Giao giờ hành chính, gọi trước khi đến..."
                        className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              CASE 2: KHÁCH VÃNG LAI
              ======================================================== */}
          {customerType === 'GUEST' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Tên khách hàng:</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="VD: Anh Minh..."
                      className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Số điện thoại:</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="VD: 0912345678..."
                      className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-xs font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  Địa chỉ giao hàng chi tiết: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  rows={2}
                  placeholder="Số nhà, tên đường, tòa nhà, phường/xã, quận/huyện..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-xs font-medium resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Ghi chú giao hàng:</label>
                <input
                  type="text"
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  placeholder="VD: Giao trước 12h, để tại quầy lễ tân..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-semibold transition-colors text-xs cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xs text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Xác nhận giao hàng</span>
          </button>
        </div>
      </div>

      {/* Quick Add Customer Modal */}
      {isCreateCustomerOpen && (
        <CreateCustomerModal
          onClose={() => setIsCreateCustomerOpen(false)}
          onSuccess={(newMember) => {
            handleSelectMember(newMember);
          }}
        />
      )}
    </div>
  );
};
