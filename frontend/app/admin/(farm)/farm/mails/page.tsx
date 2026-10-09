'use client';

import React, { useEffect, useState } from 'react';
import AdminFarmNav from '../components/AdminFarmNav';
import {
  Mail,
  Plus,
  Trash2,
  Gift,
  Coins,
  Sparkles,
  Users,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  Package,
  Ticket,
  AlertTriangle,
  RotateCcw,
  Eye,
  Search,
  Check,
  X,
  ShieldAlert,
  Layers,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminFarmMailsPage() {
  const [mails, setMails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // External catalogs for selectors
  const [availableCrops, setAvailableCrops] = useState<any[]>([]);
  const [availableMutations, setAvailableMutations] = useState<any[]>([]);
  const [membershipTiers, setMembershipTiers] = useState<any[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [sender, setSender] = useState('Ban Quản Trị AVORA Farm');
  const [content, setContent] = useState('');
  const [mailType, setMailType] = useState('MAINTENANCE');
  const [targetType, setTargetType] = useState('ALL');

  // Detailed Target Filter Values
  const [minLevel, setMinLevel] = useState<number>(1);
  const [maxLevel, setMaxLevel] = useState<number>(50);
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [inactiveDays, setInactiveDays] = useState<number>(7);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Scheduling & Expiration
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // Rewards builder
  const [rewards, setRewards] = useState<any[]>([
    { type: 'COIN', name: 'Xu Nông Trại', quantity: 5000 },
  ]);

  // Recipient Analytics Modal State
  const [selectedMailForAnalytics, setSelectedMailForAnalytics] = useState<any | null>(null);
  const [recipientsData, setRecipientsData] = useState<any | null>(null);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [recipientFilterTab, setRecipientFilterTab] = useState<'ALL' | 'CLAIMED' | 'UNCLAIMED'>('ALL');
  const [recipientSearch, setRecipientSearch] = useState('');

  useEffect(() => {
    fetchMails();
    fetchCropsAndMutations();
    fetchMembershipTiers();
  }, []);

  const fetchMails = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/farm/mails', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        setMails(json.data || []);
      }
    } catch (e) {
      console.warn('Could not fetch admin mails:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCropsAndMutations = async () => {
    try {
      const [cropsRes, mutRes] = await Promise.all([
        fetch('/api/admin/farm/crops', { credentials: 'include' }),
        fetch('/api/admin/farm/mutations', { credentials: 'include' }),
      ]);
      if (cropsRes.ok) {
        const cJson = await cropsRes.json();
        setAvailableCrops(cJson.data || []);
      }
      if (mutRes.ok) {
        const mJson = await mutRes.json();
        setAvailableMutations(mJson.data || []);
      }
    } catch (e) {
      console.warn('Could not fetch crops/mutations catalog:', e);
    }
  };

  const fetchMembershipTiers = async () => {
    try {
      const res = await fetch('/api/admin/membership-tiers', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const tiers = json.data?.items || json.data || [];
        setMembershipTiers(Array.isArray(tiers) ? tiers : []);
        if (tiers.length > 0 && !selectedTierId) {
          setSelectedTierId(tiers[0].id || tiers[0].name);
        }
      }
    } catch (e) {
      console.warn('Could not fetch membership tiers:', e);
    }
  };

  // Autocomplete User Search for SPECIFIC_USERS
  const handleSearchUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (!query.trim() || query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    try {
      setIsSearchingUsers(true);
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query.trim())}&limit=8`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const users = json.data?.items || json.data || [];
        setUserSearchResults(Array.isArray(users) ? users : []);
      }
    } catch (e) {
      console.warn('Error searching users:', e);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleSelectUser = (user: any) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  // Add specific reward types
  const handleAddReward = (type: string, customData?: { name: string; quantity: number; code?: string }) => {
    if (customData) {
      setRewards([...rewards, { type, ...customData }]);
      return;
    }

    const defaults: Record<string, { name: string; quantity: number }> = {
      COIN: { name: 'Xu Nông Trại', quantity: 2000 },
      AVORA_POINT: { name: 'Điểm Loyalty AVORA', quantity: 50 },
      MYSTERY_PACK: { name: 'Gói Hạt Giống Bí Ẩn Hoàng Gia', quantity: 2 },
      FERTILIZER: { name: 'Phân Bón Thần Tốc (Giảm 50% thời gian)', quantity: 3 },
      VOUCHER: { name: 'Voucher Giảm 50.000đ Nhà Hàng', quantity: 1 },
    };
    const def = defaults[type] || { name: 'Phần Thưởng', quantity: 1 };
    setRewards([...rewards, { type, ...def }]);
  };

  const handleRemoveReward = (index: number) => {
    setRewards(rewards.filter((_, idx) => idx !== index));
  };

  const handleRewardChange = (index: number, field: string, value: any) => {
    const updated = [...rewards];
    updated[index] = { ...updated[index], [field]: value };
    setRewards(updated);
  };

  // Send Mail Action
  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Vui lòng nhập tiêu đề và nội dung thư!');
      return;
    }
    if (rewards.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 phần thưởng!');
      return;
    }

    // Build target value
    let targetValue: any = null;
    if (targetType === 'LEVEL_RANGE') {
      targetValue = { minLevel: Number(minLevel), maxLevel: Number(maxLevel) };
    } else if (targetType === 'MEMBERSHIP_TIER') {
      targetValue = selectedTierId;
    } else if (targetType === 'INACTIVE_USERS') {
      targetValue = { days: Number(inactiveDays) };
    } else if (targetType === 'SPECIFIC_USERS') {
      if (selectedUsers.length === 0) {
        toast.error('Vui lòng chọn ít nhất 1 khách hàng nhận thư!');
        return;
      }
      targetValue = selectedUsers.map((u) => u.id);
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        title: title.trim(),
        sender: sender.trim() || 'Ban Quản Trị AVORA Farm',
        content: content.trim(),
        type: mailType,
        targetType,
        targetValue,
        rewards,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      const res = await fetch('/api/admin/farm/mails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          scheduledAt
            ? 'Đã lên lịch phát hành thư thành công!'
            : 'Đã gửi thư và quà thành công đến người chơi!'
        );
        setIsCreateOpen(false);
        setTitle('');
        setContent('');
        setSelectedUsers([]);
        setScheduledAt('');
        setExpiresAt('');
        fetchMails();
      } else {
        toast.error(json.message || 'Không thể gửi thư');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi gửi thư');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke Mail Action ("Thu hồi quà tặng / vật phẩm nếu lỡ bấm nhầm")
  const handleRevokeMail = async (mail: any) => {
    const confirmPrompt = window.confirm(
      `CẢNH BÁO THU HỒI:\n\nBạn có chắc chắn muốn THU HỒI thư "${mail.title}"?\n\nToàn bộ người chơi chưa nhận sẽ không thể nhận quà này nữa.`
    );
    if (!confirmPrompt) return;

    try {
      const res = await fetch(`/api/admin/farm/mails/${mail.id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Đã thu hồi thư thành công!');
        fetchMails();
      } else {
        toast.error(json.message || 'Không thể thu hồi thư');
      }
    } catch (e) {
      toast.error('Lỗi khi thu hồi thư');
    }
  };

  // Delete Mail Action
  const handleDeleteMail = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa thư này khỏi hệ thống?')) return;
    try {
      const res = await fetch(`/api/admin/farm/mails/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Đã xóa thư');
        setMails(mails.filter((m) => m.id !== id));
      }
    } catch (e) {
      toast.error('Lỗi khi xóa thư');
    }
  };

  // Open Recipient Analytics Modal
  const handleOpenRecipients = async (mail: any) => {
    setSelectedMailForAnalytics(mail);
    setRecipientsData(null);
    setRecipientFilterTab('ALL');
    setRecipientSearch('');
    setIsLoadingRecipients(true);

    try {
      const res = await fetch(`/api/admin/farm/mails/${mail.id}/recipients`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setRecipientsData(json.data);
      } else {
        toast.error('Không thể tải chi tiết người nhận');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi tải dữ liệu người nhận');
    } finally {
      setIsLoadingRecipients(false);
    }
  };

  const formatVietnamTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Không có';
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  const getTargetTypeBadge = (mail: any) => {
    switch (mail.targetType) {
      case 'ALL':
        return <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">Toàn Bộ Người Chơi</span>;
      case 'LEVEL_RANGE':
        return <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-bold">Cấp Farm {mail.targetValue || ''}</span>;
      case 'MEMBERSHIP_TIER':
        return <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold">Hạng Hội Viên</span>;
      case 'INACTIVE_USERS':
        return <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">Khách Lâu Chưa Vào</span>;
      case 'SPECIFIC_USERS':
        return <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">Khách Cụ Thể</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold">{mail.targetType}</span>;
    }
  };

  const getStatusBadge = (mail: any) => {
    if (mail.isRevoked || mail.status === 'REVOKED') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black uppercase flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-rose-600" /> Đã Thu Hồi
        </span>
      );
    }
    if (mail.status === 'SCHEDULED' || (mail.scheduledAt && new Date(mail.scheduledAt) > new Date())) {
      return (
        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-300 text-[10px] font-black uppercase flex items-center gap-1">
          <Clock className="w-3 h-3 text-indigo-600" /> Đã Lên Lịch ({formatVietnamTime(mail.scheduledAt)})
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã Phát Hành
      </span>
    );
  };

  // Filtered recipients for modal
  const filteredRecipients = React.useMemo(() => {
    if (!recipientsData?.recipients) return [];
    let list = recipientsData.recipients;

    if (recipientFilterTab === 'CLAIMED') {
      list = list.filter((r: any) => r.isClaimed);
    } else if (recipientFilterTab === 'UNCLAIMED') {
      list = list.filter((r: any) => !r.isClaimed);
    }

    if (recipientSearch.trim()) {
      const q = recipientSearch.toLowerCase().trim();
      list = list.filter(
        (r: any) =>
          r.fullName?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.phone?.includes(q)
      );
    }
    return list;
  }, [recipientsData?.recipients, recipientFilterTab, recipientSearch]);

  return (
    <div className="space-y-6 text-[#2d3748]">
      <AdminFarmNav />

      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-serif font-black text-gray-900 flex items-center gap-2.5">
            <Mail className="w-6 h-6 text-amber-600" />
            Quản Lý Hòm Thư & Phát Quà Nông Trại
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Gửi quà bảo trì, sự kiện, tri ân và đền bù cho người chơi kèm tính năng lên lịch, thu hồi quà và phân tích người nhận
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Soạn Thư & Tặng Quà</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* CREATE MAIL MODAL                                                         */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-gray-200 shadow-2xl p-5 sm:p-6 overflow-y-auto max-h-[92vh] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-serif font-black text-base sm:text-lg text-gray-900 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-600" />
                Soạn Thư & Đính Kèm Quà Tặng Nông Trại
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendMail} className="space-y-4 text-xs font-medium">
              {/* Tiêu đề & Người gửi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Tiêu đề thư *</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: QUÀ BẢO TRÌ HỆ THỐNG"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Người gửi</label>
                  <input
                    type="text"
                    placeholder="Ban Quản Trị AVORA Farm"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  />
                </div>
              </div>

              {/* Nội dung thư */}
              <div>
                <label className="block text-gray-700 font-bold mb-1">Nội dung thư *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Nhập lời nhắn gửi đến các chủ vườn AVORA Farm..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Loại thư & Đối tượng nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Loại thư</label>
                  <select
                    value={mailType}
                    onChange={(e) => setMailType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold"
                  >
                    <option value="MAINTENANCE">🛠️ Quà Bảo Trì Hệ Thống</option>
                    <option value="EVENT">🎉 Sự Kiện Đặc Biệt</option>
                    <option value="COMPENSATION">🩹 Đền Bù Sự Cố</option>
                    <option value="ADMIN_CUSTOM">🎁 Quà Admin Tri Ân</option>
                    <option value="SEASONAL">🌸 Quà Lễ Hội / Theo Mùa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1">Đối tượng nhận *</label>
                  <select
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 font-bold bg-amber-50/50"
                  >
                    <option value="ALL">🌐 Toàn Bộ Người Chơi</option>
                    <option value="LEVEL_RANGE">📊 Khoảng Cấp Độ Farm (Min - Max)</option>
                    <option value="MEMBERSHIP_TIER">👑 Hạng Thành Viên Nhà Hàng</option>
                    <option value="INACTIVE_USERS">⏳ Khách Hàng Lâu Ngày Không Truy Cập</option>
                    <option value="SPECIFIC_USERS">🎯 Khách Hàng Cụ Thể (Chọn User)</option>
                  </select>
                </div>
              </div>

              {/* Chi Tiết Cấu Hình Đối Tượng Nhận */}
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200">
                {targetType === 'ALL' && (
                  <p className="text-gray-500 text-[11px] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Thư và quà sẽ được phát đến tất cả người chơi trong hệ sinh thái AVORA Farm.
                  </p>
                )}

                {targetType === 'LEVEL_RANGE' && (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <span className="font-bold text-gray-700 shrink-0">Khoảng cấp độ nông trại:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Từ Lv.</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={minLevel}
                        onChange={(e) => setMinLevel(parseInt(e.target.value) || 1)}
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 font-bold text-center"
                      />
                      <span className="text-gray-500">đến Lv.</span>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={maxLevel}
                        onChange={(e) => setMaxLevel(parseInt(e.target.value) || 50)}
                        className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 font-bold text-center"
                      />
                    </div>
                  </div>
                )}

                {targetType === 'MEMBERSHIP_TIER' && (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <span className="font-bold text-gray-700 shrink-0">Chọn hạng thành viên:</span>
                    <select
                      value={selectedTierId}
                      onChange={(e) => setSelectedTierId(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-300 font-bold"
                    >
                      {membershipTiers.length === 0 ? (
                        <>
                          <option value="Đồng">Hạng Đồng (Bronze)</option>
                          <option value="Bạc">Hạng Bạc (Silver)</option>
                          <option value="Vàng">Hạng Vàng (Gold)</option>
                          <option value="Kim Cương">Hạng Kim Cương (Diamond)</option>
                        </>
                      ) : (
                        membershipTiers.map((tier: any) => (
                          <option key={tier.id} value={tier.id}>
                            👑 {tier.name} (Tích lũy từ {tier.minPoints?.toLocaleString('vi-VN') || 0} điểm)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {targetType === 'INACTIVE_USERS' && (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <span className="font-bold text-gray-700 shrink-0">Không hoạt động trong ít nhất:</span>
                    <select
                      value={inactiveDays}
                      onChange={(e) => setInactiveDays(parseInt(e.target.value) || 7)}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-300 font-bold"
                    >
                      <option value="7">⏳ Hơn 7 ngày qua không đăng nhập</option>
                      <option value="14">⏳ Hơn 14 ngày qua không đăng nhập</option>
                      <option value="30">⏳ Hơn 30 ngày qua không đăng nhập</option>
                      <option value="60">⏳ Hơn 60 ngày qua không đăng nhập</option>
                    </select>
                  </div>
                )}

                {targetType === 'SPECIFIC_USERS' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Tìm khách hàng theo tên, email hoặc SĐT..."
                          value={userSearchQuery}
                          onChange={(e) => handleSearchUsers(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-xs"
                        />
                      </div>
                    </div>

                    {/* Autocomplete Search Dropdown */}
                    {userSearchResults.length > 0 && (
                      <div className="border border-gray-200 rounded-xl bg-white shadow-md max-h-40 overflow-y-auto divide-y divide-gray-100">
                        {userSearchResults.map((u: any) => (
                          <div
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className="p-2 hover:bg-amber-50 flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-gray-900 block">{u.fullName}</span>
                              <span className="text-[10px] text-gray-500">{u.email || u.phone || 'Chưa cập nhật'}</span>
                            </div>
                            <Plus className="w-4 h-4 text-amber-600" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Users Chips */}
                    {selectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedUsers.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200"
                          >
                            <span>{u.fullName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(u.id)}
                              className="hover:text-rose-600 ml-0.5"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lên Lịch & Ngày Hết Hạn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 font-bold mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    Lên lịch gửi trước (Tới ngày mới phát hành)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Để trống nếu muốn gửi ngay lập tức sau khi bấm Phát Hành
                  </span>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Ngày hết hạn nhận quà (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Để trống nếu quà không có thời hạn hết hạn
                  </span>
                </div>
              </div>

              {/* REWARDS BUILDER */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-gray-900 font-serif font-black uppercase text-[11px] flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-amber-600" />
                    Danh Sách Phần Thưởng Đính Kèm ({rewards.length})
                  </label>

                  {/* Add reward buttons */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleAddReward('COIN')}
                      className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      + Xu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddReward('AVORA_POINT')}
                      className="px-2 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold hover:bg-purple-100 cursor-pointer"
                    >
                      + Điểm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddReward('MYSTERY_PACK')}
                      className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold hover:bg-indigo-100 cursor-pointer"
                    >
                      + Hạt Ngẫu Nhiên
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddReward('FERTILIZER')}
                      className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                    >
                      + Phân Bón
                    </button>
                  </div>
                </div>

                {/* Dropdowns to add specific Seed or Mutation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-bold text-gray-600 shrink-0">🌾 Hạt giống cụ thể:</span>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const crop = availableCrops.find((c) => c.code === e.target.value);
                        if (crop) {
                          handleAddReward('SEED', {
                            name: `Hạt giống ${crop.name}`,
                            quantity: 5,
                            code: crop.code,
                          });
                        }
                        e.target.value = '';
                      }}
                      className="flex-1 px-2 py-1 rounded-lg border border-gray-300 text-[11px] font-bold bg-white"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Chọn hạt giống từ DB --</option>
                      {availableCrops.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name} ({c.growDuration}s)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-bold text-purple-700 shrink-0">✨ Nông sản đột biến:</span>
                    <select
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const mut = availableMutations.find((m) => m.code === e.target.value);
                        if (mut) {
                          handleAddReward('PRODUCE', {
                            name: `Nông sản ${mut.name} (${mut.rarity})`,
                            quantity: 3,
                            code: mut.code,
                          });
                        }
                        e.target.value = '';
                      }}
                      className="flex-1 px-2 py-1 rounded-lg border border-purple-200 text-[11px] font-bold bg-purple-50/50"
                      defaultValue=""
                    >
                      <option value="" disabled>-- Chọn nông sản đột biến --</option>
                      {availableMutations.map((m) => (
                        <option key={m.id} value={m.code}>
                          {m.name} [{m.rarity}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Rewards list */}
                <div className="space-y-2">
                  {rewards.map((r, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white border border-gray-200 flex items-center gap-2.5 shadow-xs"
                    >
                      <span className="text-xs font-bold text-gray-500 w-18 uppercase font-mono">
                        {r.type}
                      </span>
                      <input
                        type="text"
                        value={r.name}
                        onChange={(e) => handleRewardChange(idx, 'name', e.target.value)}
                        placeholder="Tên phần thưởng"
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs font-bold"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold">SL:</span>
                        <input
                          type="number"
                          min="1"
                          value={r.quantity}
                          onChange={(e) => handleRewardChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1.5 rounded-lg border border-gray-300 text-xs font-mono font-bold text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveReward(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Xóa phần thưởng này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-serif font-black flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmitting
                      ? 'Đang phát hành...'
                      : scheduledAt
                      ? 'Lên Lịch Gửi'
                      : 'Phát Hành Thư & Quà'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECIPIENTS ANALYTICS MODAL                                                */}
      {/* ========================================================================= */}
      {selectedMailForAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-gray-200 shadow-2xl p-5 sm:p-6 overflow-y-auto max-h-[90vh] space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-serif font-black text-lg text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  Chi Tiết Người Nhận & Tỷ Lệ Nhận Quà
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Thư: <span className="font-bold text-gray-800 font-serif">{selectedMailForAnalytics.title}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedMailForAnalytics(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingRecipients ? (
              <div className="p-16 text-center text-gray-400 font-bold text-xs">
                Đang tải dữ liệu phân tích người nhận...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col">
                    <span className="text-[11px] font-bold text-amber-800">Tổng Người Nhận</span>
                    <span className="font-mono font-black text-xl text-amber-900 mt-0.5">
                      {recipientsData?.metrics?.totalRecipients ?? 0}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col">
                    <span className="text-[11px] font-bold text-emerald-800">Đã Nhận Quà</span>
                    <span className="font-mono font-black text-xl text-emerald-900 mt-0.5">
                      {recipientsData?.metrics?.claimedCount ?? 0}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col">
                    <span className="text-[11px] font-bold text-stone-600">Chưa Mở / Nhận</span>
                    <span className="font-mono font-black text-xl text-stone-800 mt-0.5">
                      {recipientsData?.metrics?.unclaimedCount ?? 0}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col">
                    <span className="text-[11px] font-bold text-indigo-800">Tỷ Lệ Nhận Thưởng</span>
                    <span className="font-mono font-black text-xl text-indigo-900 mt-0.5">
                      {recipientsData?.metrics?.claimRate ?? 0}%
                    </span>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
                    <button
                      onClick={() => setRecipientFilterTab('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        recipientFilterTab === 'ALL'
                          ? 'bg-white text-gray-900 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Tất Cả ({recipientsData?.recipients?.length || 0})
                    </button>
                    <button
                      onClick={() => setRecipientFilterTab('CLAIMED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        recipientFilterTab === 'CLAIMED'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Đã Nhận ({recipientsData?.metrics?.claimedCount || 0})
                    </button>
                    <button
                      onClick={() => setRecipientFilterTab('UNCLAIMED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        recipientFilterTab === 'UNCLAIMED'
                          ? 'bg-white text-stone-700 shadow-xs'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Chưa Nhận ({recipientsData?.metrics?.unclaimedCount || 0})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên, email, sđt..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-300 text-xs"
                    />
                  </div>
                </div>

                {/* Recipients Table */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Người chơi</th>
                        <th className="p-3">Cấp Farm</th>
                        <th className="p-3">Hạng Hội Viên</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3">Thời gian nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {filteredRecipients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-400">
                            Không tìm thấy người chơi nào trong danh mục này.
                          </td>
                        </tr>
                      ) : (
                        filteredRecipients.map((r: any) => (
                          <tr key={r.userMailId} className="hover:bg-gray-50/70">
                            <td className="p-3 flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                                {(r.fullName || 'U')[0]}
                              </div>
                              <div>
                                <span className="font-bold text-gray-900 block">{r.fullName}</span>
                                <span className="text-[10px] text-gray-400">{r.email || r.phone || ''}</span>
                              </div>
                            </td>
                            <td className="p-3 font-mono font-bold text-amber-700">Lv.{r.farmLevel}</td>
                            <td className="p-3 font-semibold text-purple-700">{r.membershipTierName}</td>
                            <td className="p-3">
                              {r.isClaimed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                  <Check className="w-3 h-3 text-emerald-600" /> Đã nhận quà
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold">
                                  Chưa nhận
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-gray-500">
                              {r.claimedAt ? formatVietnamTime(r.claimedAt) : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIL LIST TABLE                                                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="font-serif font-black text-sm text-gray-900">
            Danh Sách Thư & Quà Đã Phát Hành ({mails.length})
          </span>
          <button
            onClick={fetchMails}
            className="text-xs text-amber-700 hover:text-amber-800 font-bold cursor-pointer"
          >
            Làm mới danh sách
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 font-bold text-xs">
            Đang tải danh sách thư...
          </div>
        ) : mails.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-xs space-y-2">
            <Mail className="w-12 h-12 mx-auto text-gray-300" />
            <p>Chưa có thư nào được phát hành</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {mails.map((m) => {
              let parsedRewards = [];
              try {
                parsedRewards = typeof m.rewards === 'string' ? JSON.parse(m.rewards) : m.rewards;
              } catch {}

              const isRevoked = Boolean(m.isRevoked || m.status === 'REVOKED');

              return (
                <div
                  key={m.id}
                  className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-gray-50/60 transition ${
                    isRevoked ? 'bg-rose-50/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                      {isRevoked ? '🚫' : '🎁'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {getStatusBadge(m)}
                        {getTargetTypeBadge(m)}
                        <span className="text-[10.5px] text-gray-400 font-mono">
                          {formatVietnamTime(m.sentAt || m.createdAt)}
                        </span>
                      </div>

                      <h4 className={`font-serif font-black text-sm text-gray-900 truncate ${isRevoked ? 'line-through text-gray-500' : ''}`}>
                        {m.title}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{m.content}</p>

                      {/* Rewards summary */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {parsedRewards?.map((r: any, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold"
                          >
                            ×{r.quantity} {r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Analytics */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {/* View Recipients Button */}
                    <button
                      onClick={() => handleOpenRecipients(m)}
                      className="px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      title="Xem chi tiết ai đã nhận, ai chưa nhận"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      <span>Chi tiết ({m.claimedCount ?? 0}/{m.totalRecipients ?? 0})</span>
                    </button>

                    {/* Revoke Button */}
                    {!isRevoked && (
                      <button
                        onClick={() => handleRevokeMail(m)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Thu hồi quà tặng / thư nếu lỡ gửi nhầm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Thu Hồi</span>
                      </button>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteMail(m.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Xóa thư khỏi lịch sử"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
