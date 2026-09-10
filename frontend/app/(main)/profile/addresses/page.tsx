'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Plus,
  Edit3,
  Trash2,
  ChevronLeft,
  CheckCircle2,
  Home,
  Briefcase,
  Star,
  Phone,
  PhoneCall,
  Copy,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AddressModal, { Address } from '@/components/AddressModal';

type FilterType = 'all' | 'default' | 'home' | 'work' | 'other';

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Quick Action states
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all addresses for current user
  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/addresses', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(Array.isArray(data) ? data : []);
      } else if (res.status === 401) {
        toast.error('Vui lòng đăng nhập để xem danh sách địa chỉ');
        router.push('/login?redirectURL=/profile/addresses');
      } else {
        toast.error('Không thể tải danh sách địa chỉ');
      }
    } catch (error) {
      console.error('Fetch addresses error:', error);
      toast.error('Lỗi kết nối khi tải danh sách địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  // Helper to detect tag from streetDetail
  const getAddressTag = (streetDetail: string): { type: 'home' | 'work' | 'other'; label: string; icon: React.ReactNode; color: string } => {
    const lower = (streetDetail || '').toLowerCase();
    if (lower.startsWith('[văn phòng]') || lower.startsWith('[công ty]') || lower.includes('văn phòng') || lower.includes('công ty')) {
      return {
        type: 'work',
        label: 'Văn phòng',
        icon: <Briefcase size={12} />,
        color: 'bg-blue-50 text-blue-700 border-blue-200/80',
      };
    }
    if (lower.startsWith('[khác]')) {
      return {
        type: 'other',
        label: 'Khác',
        icon: <MapPin size={12} />,
        color: 'bg-purple-50 text-purple-700 border-purple-200/80',
      };
    }
    return {
      type: 'home',
      label: 'Nhà riêng',
      icon: <Home size={12} />,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    };
  };

  // Clean streetDetail to strip tag prefix and eliminate 'Vị trí hiện tại'
  const getCleanStreetDetail = (streetDetail: string) => {
    if (!streetDetail) return 'Chưa nhập số nhà, tên đường';
    const cleaned = streetDetail.replace(/^\[(Nhà riêng|Văn phòng|Khác)\]\s*/i, '').trim();
    if (cleaned.toLowerCase() === 'vị trí hiện tại' || cleaned.toLowerCase().startsWith('vị trí hiện tại')) {
      return 'Chưa nhập số nhà, tên đường';
    }
    return cleaned || 'Chưa nhập số nhà, tên đường';
  };

  // Format Ward display to remove duplicates and add standard prefix
  const formatDisplayWard = (ward: string) => {
    if (!ward) return '';
    const parts = ward.split(',').map(s => s.trim()).filter(Boolean);
    const uniqueParts: string[] = [];
    for (const part of parts) {
      const cleanPart = part.replace(/^(phường|xã|thị trấn|p\.|x\.|tt\.)\s+/i, '').trim();
      if (!uniqueParts.some(u => u.toLowerCase() === cleanPart.toLowerCase() || u.toLowerCase() === part.toLowerCase())) {
        uniqueParts.push(part);
      }
    }
    let w = uniqueParts[0] || ward;
    const lower = w.toLowerCase();
    if (!lower.startsWith('phường') && !lower.startsWith('xã') && !lower.startsWith('thị trấn') && !lower.startsWith('p.') && !lower.startsWith('x.')) {
      if (lower.includes('xã')) {
        w = `Xã ${w.replace(/^xã\s+/i, '')}`;
      } else {
        w = `Phường ${w}`;
      }
    }
    return w;
  };

  // Open modal for adding / editing
  const handleOpenAdd = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (addr: Address) => {
    setEditingAddress(addr);
    setIsModalOpen(true);
  };

  // 1-Click Set Default Address
  const handleSetDefault = async (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    if (addr.isDefault || settingDefaultId) return;

    setSettingDefaultId(addr.id);
    const toastId = toast.loading('Đang đặt làm mặc định...');

    try {
      const res = await fetch(`/api/addresses/${addr.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientName: addr.recipientName,
          phone: addr.phone,
          province: addr.province,
          ward: addr.ward,
          streetDetail: addr.streetDetail,
          isDefault: true,
          latitude: addr.latitude,
          longitude: addr.longitude,
        }),
      });

      if (res.ok) {
        toast.success('Đã đặt làm địa chỉ mặc định! ⭐', { id: toastId });
        await fetchAddresses();
      } else {
        toast.error('Không thể cập nhật địa chỉ mặc định', { id: toastId });
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi cập nhật', { id: toastId });
    } finally {
      setSettingDefaultId(null);
    }
  };

  // Confirm and Delete Address
  const handleConfirmDelete = async () => {
    if (!addressToDelete) return;

    const id = addressToDelete.id;
    setDeletingId(id);
    const toastId = toast.loading('Đang xóa...');

    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Đã xóa địa chỉ thành công! 🗑️', { id: toastId });
        setAddressToDelete(null);
        await fetchAddresses();
      } else {
        toast.error('Không thể xóa địa chỉ', { id: toastId });
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi xóa', { id: toastId });
    } finally {
      setDeletingId(null);
    }
  };

  // Copy full address text
  const handleCopyAddress = (addr: Address, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanStreet = getCleanStreetDetail(addr.streetDetail);
    const fullText = `${addr.recipientName} - ${addr.phone}, ${cleanStreet}, ${addr.ward}, ${addr.province}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      toast.success('Đã sao chép địa chỉ vào clipboard! 📋');
    } else {
      toast.error('Không hỗ trợ sao chép tự động');
    }
  };

  // Copy phone number
  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      toast.success(`Đã sao chép SĐT: ${phone} 📞`);
    }
  };

  // Filter logic
  const filteredAddresses = useMemo(() => {
    return addresses.filter(addr => {
      if (activeFilter === 'default') return addr.isDefault;
      if (activeFilter === 'home') return getAddressTag(addr.streetDetail).type === 'home';
      if (activeFilter === 'work') return getAddressTag(addr.streetDetail).type === 'work';
      if (activeFilter === 'other') return getAddressTag(addr.streetDetail).type === 'other';
      return true;
    });
  }, [addresses, activeFilter]);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 md:pb-12">
      {/* ── 1. COMPACT SLEEK HEADER & BREADCRUMBS ── */}
      <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white relative overflow-hidden border-b border-slate-800">
        {/* Soft Ambient Light */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-5 sm:pb-6 relative z-10">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-400 mb-2.5">
            <Link href="/" className="hover:text-white transition-colors">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href="/profile" className="hover:text-white transition-colors">
              Tài khoản
            </Link>
            <span>/</span>
            <span className="text-red-400 font-bold">Sổ địa chỉ</span>
          </div>

          {/* Header Title Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/profile"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all shrink-0 active:scale-95"
                title="Quay lại tài khoản"
              >
                <ChevronLeft size={20} />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white truncate">
                    Sổ Địa Chỉ Giao Hàng
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    <Sparkles size={10} /> VIP
                  </span>
                </div>
                <p className="text-slate-400 text-xs truncate mt-0.5">
                  {addresses.length} địa chỉ đã lưu
                </p>
              </div>
            </div>

            {/* Desktop Add Address Button */}
            <div className="hidden sm:block shrink-0">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-red-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5 active:scale-95"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Thêm địa chỉ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. COMPACT FILTER BAR ── */}
      {addresses.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3.5 sm:pt-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tất cả ({addresses.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('default')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                activeFilter === 'default'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Star size={12} /> Mặc định
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('home')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                activeFilter === 'home'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Home size={12} /> Nhà riêng
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('work')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all cursor-pointer ${
                activeFilter === 'work'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Briefcase size={12} /> Văn phòng
            </button>
          </div>
        </div>
      )}

      {/* ── 3. MAIN ADDRESS LIST & STATES ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3.5 sm:pt-4">
        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4].map(idx => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs space-y-3 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="h-5 w-20 bg-slate-200 rounded-full" />
                  <div className="h-5 w-16 bg-slate-200 rounded-lg" />
                </div>
                <div className="h-4 w-36 bg-slate-200 rounded-md" />
                <div className="h-3.5 w-full bg-slate-100 rounded-md" />
                <div className="pt-2 flex justify-between border-t border-slate-100">
                  <div className="h-6 w-24 bg-slate-200 rounded-lg" />
                  <div className="h-6 w-16 bg-slate-200 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : addresses.length === 0 ? (
          /* ── Empty State ── */
          <div className="bg-white rounded-3xl p-7 sm:p-10 border border-slate-100 shadow-sm text-center max-w-md mx-auto mt-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <MapPin size={32} />
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Chưa có địa chỉ giao hàng
            </h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Thêm địa chỉ nhận món để đặt món giao tận nơi nhanh chóng, nóng hổi.
            </p>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-5 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md shadow-red-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Thêm địa chỉ ngay</span>
            </button>
          </div>
        ) : (
          /* ── 4. COMPACT RESPONSIVE ADDRESS CARDS ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            {filteredAddresses.map(addr => {
              const tagInfo = getAddressTag(addr.streetDetail);
              const cleanStreet = getCleanStreetDetail(addr.streetDetail);
              const isSettingDef = settingDefaultId === addr.id;

              return (
                <div
                  key={addr.id}
                  className={`bg-white rounded-2xl p-4 sm:p-4.5 transition-all duration-200 relative flex flex-col justify-between group shadow-2xs hover:shadow-md ${
                    addr.isDefault
                      ? 'border-2 border-red-500/90 bg-gradient-to-br from-white via-red-50/15 to-amber-50/10'
                      : 'border border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Default Address Ribbon Badge */}
                  {addr.isDefault && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-gradient-to-l from-red-600 to-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-bl-xl shadow-2xs uppercase tracking-wider flex items-center gap-1">
                        <Star size={9} className="fill-white" />
                        <span>Mặc định</span>
                      </div>
                    </div>
                  )}

                  <div>
                    {/* Top Row: Tag badge */}
                    <div className="flex items-center justify-between gap-2 mb-2 pr-16">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${tagInfo.color}`}
                      >
                        {tagInfo.icon}
                        <span>{tagInfo.label}</span>
                      </span>
                    </div>

                    {/* Recipient Name & Phone */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-slate-900">
                        {addr.recipientName}
                      </span>
                      <span className="text-slate-300">|</span>

                      {/* Phone with quick call & copy */}
                      <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-slate-600">
                        <Phone size={12} className="text-emerald-600" />
                        <span>{addr.phone}</span>
                        <button
                          type="button"
                          onClick={e => handleCopyPhone(addr.phone, e)}
                          className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                          title="Sao chép SĐT"
                        >
                          <Copy size={11} />
                        </button>
                        <a
                          href={`tel:${addr.phone}`}
                          onClick={e => e.stopPropagation()}
                          className="text-emerald-600 hover:text-emerald-700 transition-colors p-0.5"
                          title="Gọi điện"
                        >
                          <PhoneCall size={11} />
                        </a>
                      </div>
                    </div>

                    {/* Clean Detailed Address */}
                    <div className="text-xs text-slate-600 leading-snug my-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <p className="font-semibold text-slate-900 line-clamp-1">
                        {cleanStreet}
                      </p>
                      <p className="text-slate-500 mt-0.5 text-[11px] line-clamp-1">
                        {formatDisplayWard(addr.ward)}, {addr.province}
                      </p>
                    </div>
                  </div>

                  {/* ── CARD ACTION FOOTER ── */}
                  <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Left Actions: Default status / Set Default */}
                    <div>
                      {addr.isDefault ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <CheckCircle2 size={13} /> Địa chỉ chính
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={e => handleSetDefault(addr, e)}
                          disabled={isSettingDef}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isSettingDef ? (
                            <Loader2 size={11} className="animate-spin text-red-600" />
                          ) : (
                            <Star size={11} />
                          )}
                          <span>Đặt mặc định</span>
                        </button>
                      )}
                    </div>

                    {/* Right Actions: Copy, Edit, Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={e => handleCopyAddress(addr, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        title="Sao chép địa chỉ"
                      >
                        <Copy size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(addr)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Sửa địa chỉ"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddressToDelete(addr)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Xóa địa chỉ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 5. COMPACT MOBILE STICKY ACTION BAR ── */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 p-3 z-30 pointer-events-none">
        <div className="max-w-sm mx-auto pointer-events-auto">
          <button
            type="button"
            onClick={handleOpenAdd}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-red-600/30 active:scale-98 transition-all text-xs"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Thêm địa chỉ giao hàng</span>
          </button>
        </div>
      </div>

      {/* ── 6. ADDRESS FORM MODAL / BOTTOM SHEET ── */}
      {isModalOpen && (
        <AddressModal
          address={editingAddress}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAddress(null);
          }}
          onSuccess={async () => {
            await fetchAddresses();
            setIsModalOpen(false);
            setEditingAddress(null);
          }}
        />
      )}

      {/* ── 7. COMPACT DELETE CONFIRMATION DIALOG ── */}
      {addressToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => !deletingId && setAddressToDelete(null)}
          />
          <div className="relative bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 z-10 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 border border-red-100">
              <AlertTriangle size={22} />
            </div>

            <h3 className="text-sm font-bold text-slate-900">Xóa Địa Chỉ Này?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
              {addressToDelete.recipientName} - {getCleanStreetDetail(addressToDelete.streetDetail)}
            </p>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setAddressToDelete(null)}
                disabled={!!deletingId}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!!deletingId}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deletingId ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xác nhận xóa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
