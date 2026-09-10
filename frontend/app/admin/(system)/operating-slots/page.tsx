'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  AlertCircle,
  X,
  Loader2,
  Truck,
  ShoppingBag,
  Utensils,
  Globe,
  Zap,
  CheckCircle2,
  Settings,
  Sparkles,
  Save,
  Timer,
  Power,
  PowerOff,
  Layers,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageHeader } from '@/app/admin/components/ui';

const DAYS_OF_WEEK = [
  { key: 'MONDAY', label: 'Thứ 2', order: 1 },
  { key: 'TUESDAY', label: 'Thứ 3', order: 2 },
  { key: 'WEDNESDAY', label: 'Thứ 4', order: 3 },
  { key: 'THURSDAY', label: 'Thứ 5', order: 4 },
  { key: 'FRIDAY', label: 'Thứ 6', order: 5 },
  { key: 'SATURDAY', label: 'Thứ 7', order: 6 },
  { key: 'SUNDAY', label: 'Chủ Nhật', order: 7 },
];

const ORDER_TYPES = [
  { key: 'ONLINE', label: 'Online (App)', badgeColor: 'bg-emerald-700 text-white' },
  { key: 'DELIVERY', label: 'Giao hàng (Delivery)', badgeColor: 'bg-blue-700 text-white' },
  { key: 'TAKEAWAY', label: 'Mang về (Takeaway)', badgeColor: 'bg-amber-700 text-white' },
  { key: 'DINE_IN', label: 'Tại quán (Dine-in)', badgeColor: 'bg-purple-700 text-white' },
];

interface SlotRow {
  startTime: string;
  endTime: string;
  maxOrders: number;
  isActive: boolean;
}

interface GroupedSlot {
  groupKey: string;
  branchId: string;
  branchName: string;
  dayOfWeek: string;
  dayLabel: string;
  orderType: string;
  orderTypeLabel: string;
  orderBadgeColor: string;
  leadTimeMinutes: number;
  isActive: boolean;
  totalCapacity: number;
  slots: any[];
}

export default function OperatingSlotsPage() {
  const { t, locale } = useLanguage();

  const getDayLabel = (key: string) => {
    if (locale === 'en') {
      switch (key) {
        case 'MONDAY': return 'Monday';
        case 'TUESDAY': return 'Tuesday';
        case 'WEDNESDAY': return 'Wednesday';
        case 'THURSDAY': return 'Thursday';
        case 'FRIDAY': return 'Friday';
        case 'SATURDAY': return 'Saturday';
        case 'SUNDAY': return 'Sunday';
        default: return key;
      }
    }
    return DAYS_OF_WEEK.find((d) => d.key === key)?.label || key;
  };

  const getOrderTypeLabel = (key: string) => {
    if (locale === 'en') {
      switch (key) {
        case 'ONLINE': return 'Online (App)';
        case 'DELIVERY': return 'Delivery';
        case 'TAKEAWAY': return 'Takeaway';
        case 'DINE_IN': return 'Dine-in';
        default: return key;
      }
    }
    return ORDER_TYPES.find((t) => t.key === key)?.label || key;
  };

  const [slots, setSlots] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedOrderType, setSelectedOrderType] = useState<string>('ALL');

  // Modal Setup state (Bulk / Auto generation modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Modal Form State
  const [modalBranchId, setModalBranchId] = useState('ALL');
  const [modalDayOfWeek, setModalDayOfWeek] = useState('ALL');
  const [modalOrderType, setModalOrderType] = useState('ONLINE');
  const [modalLeadTime, setModalLeadTime] = useState(15);

  // Auto Generator state
  const [autoFrom, setAutoFrom] = useState('10:00');
  const [autoTo, setAutoTo] = useState('22:00');
  const [autoStepMinutes, setAutoStepMinutes] = useState(60);

  // Dynamic slot list in modal
  const [slotRows, setSlotRows] = useState<SlotRow[]>([
    { startTime: '10:00', endTime: '11:00', maxOrders: 10, isActive: true },
    { startTime: '11:00', endTime: '12:00', maxOrders: 10, isActive: true },
    { startTime: '12:00', endTime: '13:00', maxOrders: 10, isActive: true },
    { startTime: '13:00', endTime: '14:00', maxOrders: 10, isActive: true },
    { startTime: '14:00', endTime: '15:00', maxOrders: 10, isActive: true },
    { startTime: '15:00', endTime: '16:00', maxOrders: 10, isActive: true },
    { startTime: '16:00', endTime: '17:00', maxOrders: 10, isActive: true },
    { startTime: '17:00', endTime: '18:00', maxOrders: 10, isActive: true },
    { startTime: '18:00', endTime: '19:00', maxOrders: 10, isActive: true },
    { startTime: '19:00', endTime: '20:00', maxOrders: 10, isActive: true },
    { startTime: '20:00', endTime: '21:00', maxOrders: 10, isActive: true },
    { startTime: '21:00', endTime: '22:00', maxOrders: 10, isActive: true },
  ]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/admin/branches', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBranches(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSlots = async () => {
    try {
      setLoading(true);
      let url = '/api/operating-slots?';
      if (selectedBranchId && selectedBranchId !== 'ALL') url += `branchId=${selectedBranchId}&`;
      if (selectedDay !== 'ALL') url += `dayOfWeek=${selectedDay}&`;
      if (selectedOrderType !== 'ALL') url += `orderType=${selectedOrderType}&`;

      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSlots(data.data || []);
      } else {
        toast.error('Không thể tải danh sách khung giờ');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [selectedBranchId, selectedDay, selectedOrderType]);

  // Group slots by (branchId, dayOfWeek, orderType)
  const groupedSlots: GroupedSlot[] = React.useMemo(() => {
    const map = new Map<string, GroupedSlot>();

    for (const slot of slots) {
      const bName = slot.branch?.name || 'Chi nhánh';
      const key = `${slot.branchId}_${slot.dayOfWeek}_${slot.orderType}`;

      if (!map.has(key)) {
        const dayObj = DAYS_OF_WEEK.find((d) => d.key === slot.dayOfWeek);
        const typeObj = ORDER_TYPES.find((t) => t.key === slot.orderType);

        map.set(key, {
          groupKey: key,
          branchId: slot.branchId,
          branchName: bName,
          dayOfWeek: slot.dayOfWeek,
          dayLabel: getDayLabel(slot.dayOfWeek),
          orderType: slot.orderType,
          orderTypeLabel: getOrderTypeLabel(slot.orderType),
          orderBadgeColor: typeObj?.badgeColor || 'bg-slate-700 text-white',
          leadTimeMinutes: slot.leadTimeMinutes || 15,
          isActive: slot.isActive !== false,
          totalCapacity: 0,
          slots: [],
        });
      }

      const group = map.get(key)!;
      group.slots.push(slot);
      group.totalCapacity += slot.maxOrders || 0;
      if (!slot.isActive) {
        group.isActive = false;
      }
    }

    // Sort slots inside each group
    for (const group of map.values()) {
      group.slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    // Sort groups: by branchName, then dayOfWeek order (MONDAY -> SUNDAY)
    const result = Array.from(map.values());
    result.sort((a, b) => {
      if (a.branchName !== b.branchName) {
        return a.branchName.localeCompare(b.branchName);
      }
      const dayA = DAYS_OF_WEEK.find((d) => d.key === a.dayOfWeek)?.order || 99;
      const dayB = DAYS_OF_WEEK.find((d) => d.key === b.dayOfWeek)?.order || 99;
      return dayA - dayB;
    });

    return result;
  }, [slots]);

  const handleOpenSetupModal = (group?: GroupedSlot) => {
    if (group) {
      setModalBranchId(group.branchId);
      setModalDayOfWeek(group.dayOfWeek);
      setModalOrderType(group.orderType);
      setModalLeadTime(group.leadTimeMinutes || 15);
      setSlotRows(
        group.slots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          maxOrders: s.maxOrders || 10,
          isActive: s.isActive !== false,
        })),
      );
    } else {
      setModalBranchId(selectedBranchId !== 'ALL' ? selectedBranchId : 'ALL');
      setModalDayOfWeek(selectedDay !== 'ALL' ? selectedDay : 'ALL');
      setModalOrderType(selectedOrderType !== 'ALL' ? selectedOrderType : 'ONLINE');
      setModalLeadTime(15);
      setSlotRows([
        { startTime: '10:00', endTime: '11:00', maxOrders: 10, isActive: true },
        { startTime: '11:00', endTime: '12:00', maxOrders: 10, isActive: true },
        { startTime: '12:00', endTime: '13:00', maxOrders: 10, isActive: true },
        { startTime: '13:00', endTime: '14:00', maxOrders: 10, isActive: true },
        { startTime: '14:00', endTime: '15:00', maxOrders: 10, isActive: true },
        { startTime: '15:00', endTime: '16:00', maxOrders: 10, isActive: true },
        { startTime: '16:00', endTime: '17:00', maxOrders: 10, isActive: true },
        { startTime: '17:00', endTime: '18:00', maxOrders: 10, isActive: true },
        { startTime: '18:00', endTime: '19:00', maxOrders: 10, isActive: true },
        { startTime: '19:00', endTime: '20:00', maxOrders: 10, isActive: true },
        { startTime: '20:00', endTime: '21:00', maxOrders: 10, isActive: true },
        { startTime: '21:00', endTime: '22:00', maxOrders: 10, isActive: true },
      ]);
    }
    setIsModalOpen(true);
  };

  const handleAutoGenerate = () => {
    const timeToMin = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const minToTime = (m: number) => {
      const h = Math.floor(m / 60)
        .toString()
        .padStart(2, '0');
      const min = (m % 60).toString().padStart(2, '0');
      return `${h}:${min}`;
    };

    const startMin = timeToMin(autoFrom);
    const endMin = timeToMin(autoTo);

    if (startMin >= endMin) {
      toast.error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc!');
      return;
    }

    const generated: SlotRow[] = [];
    let cur = startMin;
    while (cur + autoStepMinutes <= endMin) {
      generated.push({
        startTime: minToTime(cur),
        endTime: minToTime(cur + autoStepMinutes),
        maxOrders: 10,
        isActive: true,
      });
      cur += autoStepMinutes;
    }

    if (generated.length === 0) {
      toast.error('Khoảng thời gian không đủ để tạo mốc giờ với bước nhảy đã chọn');
      return;
    }

    setSlotRows(generated);
    toast.success(`⚡ Đã sinh tự động ${generated.length} mốc giờ từ ${autoFrom} đến ${autoTo}!`);
  };

  const handleAddManualRow = () => {
    const lastRow = slotRows[slotRows.length - 1];
    let nextStart = '08:00';
    let nextEnd = '09:00';
    if (lastRow) {
      nextStart = lastRow.endTime;
      const [h, m] = nextStart.split(':').map(Number);
      const endH = Math.min(23, (h || 0) + 1)
        .toString()
        .padStart(2, '0');
      nextEnd = `${endH}:${(m || 0).toString().padStart(2, '0')}`;
    }

    setSlotRows([...slotRows, { startTime: nextStart, endTime: nextEnd, maxOrders: 10, isActive: true }]);
  };

  const handleUpdateRow = (index: number, field: keyof SlotRow, value: any) => {
    const updated = [...slotRows];
    updated[index] = { ...updated[index], [field]: value };
    setSlotRows(updated);
  };

  const handleDeleteRow = (index: number) => {
    if (slotRows.length <= 1) {
      toast.error('Cần giữ lại ít nhất 1 mốc giờ!');
      return;
    }
    setSlotRows(slotRows.filter((_, i) => i !== index));
  };

  const handleToggleGroup = async (group: GroupedSlot) => {
    const nextState = !group.isActive;
    try {
      const res = await fetch('/api/operating-slots/group/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: group.branchId,
          dayOfWeek: group.dayOfWeek,
          orderType: group.orderType,
          isActive: nextState,
        }),
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(nextState ? 'Đã mở nhóm khung giờ' : 'Đã khóa nhóm khung giờ');
        fetchSlots();
      } else {
        toast.error('Cập nhật trạng thái thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleDeleteGroup = async (group: GroupedSlot) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa tất cả ${group.slots.length} khung giờ của chi nhánh "${group.branchName}" vào ${group.dayLabel} không?`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/operating-slots/group?branchId=${group.branchId}&dayOfWeek=${group.dayOfWeek}&orderType=${group.orderType}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      if (res.ok) {
        toast.success('Đã xóa nhóm khung giờ thành công');
        fetchSlots();
      } else {
        toast.error('Xóa thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const handleSaveAllConfig = async () => {
    if (!modalBranchId) {
      toast.error('Vui lòng chọn chi nhánh áp dụng!');
      return;
    }
    if (slotRows.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 mốc giờ!');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        branchId: modalBranchId,
        dayOfWeek: modalDayOfWeek !== 'ALL' ? modalDayOfWeek : undefined,
        daysOfWeek:
          modalDayOfWeek === 'ALL'
            ? DAYS_OF_WEEK.map((d) => d.key)
            : undefined,
        orderType: modalOrderType,
        leadTimeMinutes: Number(modalLeadTime || 15),
        slots: slotRows,
      };

      const res = await fetch('/api/operating-slots/bulk-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Đã lưu toàn bộ cấu hình khung giờ!');
        setIsModalOpen(false);
        fetchSlots();
      } else {
        toast.error(data.message || 'Lỗi lưu cấu hình');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header matching Image 1 */}
      <PageHeader
        title={t('operatingSlots.title', 'Khung Giờ Hoạt Động')}
        subtitle={t('operatingSlots.subtitle', 'Cấu hình khung giờ nhận đơn theo thứ, số lượng đơn tối đa (Slot Capacity) và thời gian chuẩn bị món')}
        breadcrumbs={[
          { label: t('nav.system', 'Hệ thống'), href: '/admin/settings' },
          { label: t('operatingSlots.title', 'Khung giờ hoạt động') },
        ]}
        actions={
          <button
            type="button"
            onClick={() => handleOpenSetupModal()}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={16} />
            <span>{t('operatingSlots.btnSetup', 'Thiết lập khung giờ')}</span>
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t('operatingSlots.filterBranch', 'Chi nhánh')}
          </label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
          >
            <option value="ALL">{t('operatingSlots.allBranches', 'Tất cả chi nhánh')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.branchCode})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t('operatingSlots.filterDay', 'Thứ trong tuần')}
          </label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold"
          >
            <option value="ALL">{t('operatingSlots.allDays', 'Tất cả các ngày (Thứ 2 - CN)')}</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.key} value={d.key}>
                {getDayLabel(d.key)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            {t('operatingSlots.filterOrderType', 'Loại hình phục vụ')}
          </label>
          <select
            value={selectedOrderType}
            onChange={(e) => setSelectedOrderType(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold"
          >
            <option value="ALL">{t('operatingSlots.allOrderTypes', 'Tất cả loại đơn')}</option>
            {ORDER_TYPES.map((ot) => (
              <option key={ot.key} value={ot.key}>
                {getOrderTypeLabel(ot.key)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* GROUPED TABLE VIEW (EXACT MATCH IMAGE 1) */}
      <div className="space-y-3">
        {/* Table Column Header Titles */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          <div className="col-span-3">{t('operatingSlots.filterBranch', 'Chi nhánh')}</div>
          <div className="col-span-1 text-center">{t('operatingSlots.filterDay', 'Ngày áp dụng')}</div>
          <div className="col-span-1 text-center">{t('operatingSlots.filterOrderType', 'Loại đơn')}</div>
          <div className="col-span-1 text-center">{t('operatingSlots.leadTime', 'Delay chuẩn bị')}</div>
          <div className="col-span-4 pl-2">{locale === 'en' ? 'Operating Slots Details' : 'Chi tiết các mốc giờ'}</div>
          <div className="col-span-1 text-center">{t('common.status', 'Trạng thái')}</div>
          <div className="col-span-1 text-right">{t('common.actions', 'Hành động')}</div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
            <span>{t('common.loading', 'Đang tải danh sách khung giờ...')}</span>
          </div>
        ) : groupedSlots.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-3">
            <Clock size={36} className="mx-auto text-slate-300" />
            <p className="font-semibold text-slate-600">{t('operatingSlots.empty', 'Chưa có khung giờ nào được thiết lập.')}</p>
            <button
              type="button"
              onClick={() => handleOpenSetupModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer mt-2"
            >
              <Sparkles size={15} />
              <span>{t('operatingSlots.btnSetup', 'Thiết lập ngay')}</span>
            </button>
          </div>
        ) : (
          groupedSlots.map((group) => (
            <div
              key={group.groupKey}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col lg:grid lg:grid-cols-12 gap-4 items-start lg:items-center"
            >
              {/* CỘT 1: CHI NHÁNH */}
              <div className="lg:col-span-3">
                <p className="text-xs sm:text-sm font-bold text-blue-700 hover:underline cursor-pointer">
                  {group.branchName}
                </p>
              </div>

              {/* CỘT 2: NGÀY ÁP DỤNG */}
              <div className="lg:col-span-1 flex lg:justify-center">
                <span className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs">
                  {group.dayLabel}
                </span>
              </div>

              {/* CỘT 3: LOẠI ĐƠN */}
              <div className="lg:col-span-1 flex lg:justify-center">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-black tracking-tight ${group.orderBadgeColor}`}
                >
                  {group.orderTypeLabel}
                </span>
              </div>

              {/* CỘT 4: DELAY CHUẨN BỊ */}
              <div className="lg:col-span-1 flex lg:justify-center items-center gap-1 text-xs font-bold text-red-600">
                <Timer size={14} className="text-red-500" />
                <span>{group.leadTimeMinutes} {t('operatingSlots.minutes', 'phút')}</span>
              </div>

              {/* CỘT 5: CHI TIẾT CÁC MỐC GIỜ (GRID PILLS + TỔNG NĂNG LỰC) */}
              <div className="lg:col-span-4 space-y-2 w-full">
                <div className="flex flex-wrap gap-1.5">
                  {group.slots.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-200/80 bg-blue-50/70 text-blue-800 text-[11px] font-bold"
                    >
                      <Clock size={11} className="text-blue-500" />
                      <span>{s.startTime}</span>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium pt-0.5">
                  <span className="text-blue-600 font-bold">🥣 {t('operatingSlots.totalCapacity', 'Tổng năng lực')}:</span>
                  <strong className="text-slate-900 font-black">
                    {group.totalCapacity > 0
                      ? `${group.totalCapacity} ${t('operatingSlots.orders', 'đơn')}`
                      : (locale === 'en' ? 'Unlimited' : 'Không giới hạn')}
                  </strong>
                </div>
              </div>

              {/* CỘT 6: TRẠNG THÁI */}
              <div className="lg:col-span-1 flex lg:justify-center">
                <button
                  type="button"
                  onClick={() => handleToggleGroup(group)}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    group.isActive
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  }`}
                >
                  <CheckCircle2 size={12} />
                  <span>{group.isActive ? (locale === 'en' ? 'OPEN' : 'ĐANG MỞ') : (locale === 'en' ? 'LOCKED' : 'ĐANG KHÓA')}</span>
                </button>
              </div>

              {/* CỘT 7: HÀNH ĐỘNG */}
              <div className="lg:col-span-1 flex items-center justify-end gap-1.5 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => handleOpenSetupModal(group)}
                  className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title={t('common.edit', 'Chỉnh sửa')}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(group)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title={t('common.delete', 'Xóa')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: THIẾT LẬP KHUNG GIỜ CHI TIẾT (EXACT MATCH USER UI SCREENSHOT) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <Settings className="text-blue-600" size={22} />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {t('operatingSlots.btnSetup', 'Thiết Lập Khung Giờ Chi Tiết')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Top Row: 4 Configuration fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('operatingSlots.filterBranch', 'Chi nhánh áp dụng')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalBranchId}
                    onChange={(e) => setModalBranchId(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold cursor-pointer"
                  >
                    <option value="ALL">{t('operatingSlots.allBranches', 'Tất cả chi nhánh')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('operatingSlots.filterDay', 'Ngày trong tuần')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalDayOfWeek}
                    onChange={(e) => setModalDayOfWeek(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold cursor-pointer"
                  >
                    <option value="ALL">{t('operatingSlots.allDays', 'Tất cả các ngày trong tuần')}</option>
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.key} value={d.key}>
                        {getDayLabel(d.key)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('operatingSlots.filterOrderType', 'Phân loại đơn')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalOrderType}
                    onChange={(e) => setModalOrderType(e.target.value)}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold cursor-pointer"
                  >
                    {ORDER_TYPES.map((ot) => (
                      <option key={ot.key} value={ot.key}>
                        {getOrderTypeLabel(ot.key)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    {t('operatingSlots.leadTime', 'TG chuẩn bị (Delay)')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      min={0}
                      value={modalLeadTime}
                      onChange={(e) => setModalLeadTime(Number(e.target.value))}
                      className="w-full h-10 pl-3 pr-12 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold text-red-600"
                    />
                    <span className="absolute right-3 text-xs font-semibold text-slate-400">
                      {t('operatingSlots.minutes', 'Phút')}
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD: SINH TỰ ĐỘNG NHANH */}
              <div className="p-4 bg-white rounded-2xl border-2 border-blue-400/80 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 shrink-0">
                    <div className="p-1 rounded-md bg-blue-50 text-blue-600">
                      <Sparkles size={16} />
                    </div>
                    <span>{t('operatingSlots.autoGenTitle', 'Sinh tự động nhanh')}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">{t('operatingSlots.from', 'Từ giờ')}:</span>
                      <input
                        type="time"
                        value={autoFrom}
                        onChange={(e) => setAutoFrom(e.target.value)}
                        className="h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">{t('operatingSlots.to', 'Đến giờ')}:</span>
                      <input
                        type="time"
                        value={autoTo}
                        onChange={(e) => setAutoTo(e.target.value)}
                        className="h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">{t('operatingSlots.stepMinutes', 'Mỗi mốc')}:</span>
                      <select
                        value={autoStepMinutes}
                        onChange={(e) => setAutoStepMinutes(Number(e.target.value))}
                        className="h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold cursor-pointer"
                      >
                        <option value={30}>30 {t('operatingSlots.minutes', 'phút')}</option>
                        <option value={45}>45 {t('operatingSlots.minutes', 'phút')}</option>
                        <option value={60}>60 {t('operatingSlots.minutes', 'phút')}</option>
                        <option value={90}>90 {t('operatingSlots.minutes', 'phút')}</option>
                        <option value={120}>120 {t('operatingSlots.minutes', 'phút')}</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoGenerate}
                      className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      <Zap size={14} />
                      <span>⚡ {t('operatingSlots.btnGenerate', 'Chạy Tự Động')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION: CHI TIẾT CÁC MỐC GIỜ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Clock size={16} className="text-blue-600" />
                    <span>{locale === 'en' ? 'Operating Slots Details' : 'Chi Tiết Các Mốc Giờ'}</span>
                    <span className="text-xs font-semibold text-slate-400">({slotRows.length})</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddManualRow}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Plus size={14} className="text-emerald-600" />
                    <span>{t('operatingSlots.addSlot', 'Thêm Dòng Thủ Công')}</span>
                  </button>
                </div>

                {/* Rows List */}
                <div className="space-y-2.5">
                  {slotRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-slate-50/70 border border-slate-200 rounded-2xl"
                    >
                      {/* Bắt đầu */}
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          {t('operatingSlots.startTime', 'Bắt đầu')}
                        </label>
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => handleUpdateRow(idx, 'startTime', e.target.value)}
                          className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                        />
                      </div>

                      <div className="hidden sm:flex items-center justify-center pt-4 text-slate-400 font-bold">
                        →
                      </div>

                      {/* Kết thúc */}
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          {t('operatingSlots.endTime', 'Kết thúc')}
                        </label>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => handleUpdateRow(idx, 'endTime', e.target.value)}
                          className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                        />
                      </div>

                      {/* Giới hạn tối đa (đơn) */}
                      <div className="w-full sm:w-36">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          {t('operatingSlots.maxOrders', 'Giới hạn tối đa (Đơn)')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={row.maxOrders}
                          onChange={(e) => handleUpdateRow(idx, 'maxOrders', Number(e.target.value))}
                          className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-xl outline-none font-bold text-blue-600"
                        />
                      </div>

                      {/* Trạng thái mốc */}
                      <div className="w-full sm:w-36">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                          {t('common.status', 'Trạng thái mốc')}
                        </label>
                        <select
                          value={row.isActive ? 'true' : 'false'}
                          onChange={(e) => handleUpdateRow(idx, 'isActive', e.target.value === 'true')}
                          className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-xl outline-none font-bold text-emerald-700 cursor-pointer"
                        >
                          <option value="true">{locale === 'en' ? 'Open' : 'Đang Mở'}</option>
                          <option value="false">{locale === 'en' ? 'Locked' : 'Đang Khóa'}</option>
                        </select>
                      </div>

                      {/* Delete */}
                      <div className="pt-0 sm:pt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title={t('common.delete', 'Xóa mốc này')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                {t('common.close', 'Đóng')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveAllConfig}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>{t('operatingSlots.saving', 'Đang lưu cấu hình...')}</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>💾 {t('operatingSlots.saveConfig', 'Lưu Toàn Bộ Cấu Hình')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
