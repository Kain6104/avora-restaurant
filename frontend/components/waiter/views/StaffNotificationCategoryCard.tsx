'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  UtensilsCrossed,
  ChefHat,
  QrCode,
  BellRing,
  Wallet,
  Grid2X2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCheck,
  Ban,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface StaffPreferences {
  orderEnabled: boolean;
  itemEnabled: boolean;
  kitchenEnabled: boolean;
  qrOrderEnabled: boolean;
  serviceEnabled: boolean;
  paymentEnabled: boolean;
  tableEnabled: boolean;
  buffetEnabled: boolean;
  alertEnabled: boolean;
}

const DEFAULT_PREFS: StaffPreferences = {
  orderEnabled: true,
  itemEnabled: true,
  kitchenEnabled: true,
  qrOrderEnabled: true,
  serviceEnabled: true,
  paymentEnabled: true,
  tableEnabled: true,
  buffetEnabled: true,
  alertEnabled: true,
};

interface CategoryItem {
  key: keyof StaffPreferences;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryItem[] = [
  {
    key: 'orderEnabled',
    label: 'Đơn hàng (ORDER)',
    desc: 'Tạo đơn mới, lưu đơn, hủy đơn, chuyển & gộp bàn',
    icon: <Bell size={18} className="text-blue-600" />,
  },
  {
    key: 'itemEnabled',
    label: 'Món ăn (ITEM)',
    desc: 'Thêm món, xóa món, thay đổi số lượng, sửa ghi chú',
    icon: <UtensilsCrossed size={18} className="text-amber-600" />,
  },
  {
    key: 'kitchenEnabled',
    label: 'Bếp & Chế biến (KITCHEN)',
    desc: 'Món gửi xuống bếp, bếp hoàn thành món ăn',
    icon: <ChefHat size={18} className="text-orange-600" />,
  },
  {
    key: 'qrOrderEnabled',
    label: 'QR Order (QR_ORDER)',
    desc: 'Khách gọi món qua mã QR tại bàn, phê duyệt lượt gọi',
    icon: <QrCode size={18} className="text-purple-600" />,
  },
  {
    key: 'serviceEnabled',
    label: 'Gọi nhân viên (SERVICE)',
    desc: 'Khách gọi phục vụ, yêu cầu hỗ trợ khăn, nước, gia vị',
    icon: <BellRing size={18} className="text-rose-600" />,
  },
  {
    key: 'paymentEnabled',
    label: 'Thanh toán (PAYMENT)',
    desc: 'Yêu cầu thanh toán, tiếp nhận, hoàn tất thanh toán',
    icon: <Wallet size={18} className="text-emerald-600" />,
  },
  {
    key: 'tableEnabled',
    label: 'Trạng thái bàn (TABLE)',
    desc: 'Mở phiên bàn, bàn có khách, giải phóng bàn sạch',
    icon: <Grid2X2 size={18} className="text-indigo-600" />,
  },
  {
    key: 'buffetEnabled',
    label: 'Buffet (BUFFET)',
    desc: 'Kích hoạt gói buffet, đổi gói, thay đổi số vé',
    icon: <Sparkles size={18} className="text-pink-600" />,
  },
  {
    key: 'alertEnabled',
    label: 'Cảnh báo nghiệp vụ (ALERT)',
    desc: 'Cảnh báo hết món, cảnh báo kiểm kho, cảnh báo khẩn',
    icon: <AlertTriangle size={18} className="text-red-600" />,
  },
];

export const StaffNotificationCategoryCard: React.FC = () => {
  const [prefs, setPrefs] = useState<StaffPreferences>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchPrefs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/notifications/preferences', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setPrefs({
            orderEnabled: json.data.orderEnabled ?? true,
            itemEnabled: json.data.itemEnabled ?? true,
            kitchenEnabled: json.data.kitchenEnabled ?? true,
            qrOrderEnabled: json.data.qrOrderEnabled ?? true,
            serviceEnabled: json.data.serviceEnabled ?? true,
            paymentEnabled: json.data.paymentEnabled ?? true,
            tableEnabled: json.data.tableEnabled ?? true,
            buffetEnabled: json.data.buffetEnabled ?? true,
            alertEnabled: json.data.alertEnabled ?? true,
          });
        }
      }
    } catch {
      // Fallback to defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrefs();
  }, [fetchPrefs]);

  const savePreferences = async (newPrefs: StaffPreferences) => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPrefs),
      });
      if (res.ok) {
        toast.success('Đã lưu tùy chỉnh thông báo');
      } else {
        toast.error('Lỗi khi lưu tùy chỉnh');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof StaffPreferences) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    void savePreferences(updated);
  };

  const handleEnableAll = () => {
    const allEnabled: StaffPreferences = {
      orderEnabled: true,
      itemEnabled: true,
      kitchenEnabled: true,
      qrOrderEnabled: true,
      serviceEnabled: true,
      paymentEnabled: true,
      tableEnabled: true,
      buffetEnabled: true,
      alertEnabled: true,
    };
    setPrefs(allEnabled);
    void savePreferences(allEnabled);
  };

  const handleDisableAll = () => {
    const allDisabled: StaffPreferences = {
      orderEnabled: false,
      itemEnabled: false,
      kitchenEnabled: false,
      qrOrderEnabled: false,
      serviceEnabled: false,
      paymentEnabled: false,
      tableEnabled: false,
      buffetEnabled: false,
      alertEnabled: false,
    };
    setPrefs(allDisabled);
    void savePreferences(allDisabled);
  };

  const handleResetDefaults = async () => {
    try {
      setIsSaving(true);
      const res = await fetch('/api/notifications/preferences/reset', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setPrefs(DEFAULT_PREFS);
        toast.success('Đã khôi phục cài đặt thông báo mặc định');
      }
    } catch {
      toast.error('Lỗi khi khôi phục mặc định');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = Object.values(prefs).filter(Boolean).length;

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>Cài đặt danh mục thông báo</span>
            {isSaving && <Loader2 size={13} className="animate-spin text-slate-400" />}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Mặc định bật toàn bộ. Bật/tắt theo nhu cầu cá nhân ({activeCount}/9 danh mục)
          </p>
        </div>
      </div>

      {/* Action Buttons: Bật tất cả, Tắt tất cả, Khôi phục mặc định */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleEnableAll}
          disabled={isLoading || isSaving}
          className="h-8 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 active:scale-95 border border-emerald-200/80 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <CheckCheck size={13} />
          <span>Bật tất cả</span>
        </button>

        <button
          type="button"
          onClick={handleDisableAll}
          disabled={isLoading || isSaving}
          className="h-8 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 active:scale-95 border border-slate-200/80 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Ban size={13} />
          <span>Tắt tất cả</span>
        </button>

        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={isLoading || isSaving}
          className="h-8 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 active:scale-95 border border-rose-200/80 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Mặc định</span>
        </button>
      </div>

      {/* Category List */}
      <div className="divide-y divide-slate-100">
        {CATEGORIES.map((cat) => {
          const isEnabled = prefs[cat.key];
          return (
            <div
              key={cat.key}
              className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center shrink-0">
                  {cat.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-slate-900 truncate">{cat.label}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-1">{cat.desc}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggle(cat.key)}
                disabled={isLoading || isSaving}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                  isEnabled ? 'bg-[#34C759]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    isEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StaffNotificationCategoryCard;

