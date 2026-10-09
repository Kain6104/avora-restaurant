'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Save,
  Store,
  Truck,
  Settings2,
  AlertTriangle,
  Receipt,
  Navigation,
  Image as ImageIcon,
  Upload,
  RotateCw,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PageHeader, AdminCard, FormField } from '@/app/admin/components/ui';

export default function AdminSettingsPage() {
  const { role, can } = useAdmin();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('restaurant');
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Uploading states for brand assets
  const [uploadingLogoDesktop, setUploadingLogoDesktop] = useState(false);
  const [uploadingLogoMobile, setUploadingLogoMobile] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  // Permission check for settings update
  const canManageSettings = role === 'ADMIN' || can('settings.general.update');

  useEffect(() => {
    if (role === 'ADMIN' || can('settings.general.view') || can('settings.general.update')) {
      fetchSettings();
    }
  }, [role, can]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(
        '/api/admin/settings?keys=restaurant_name,restaurant_phone,restaurant_address,logo_desktop_url,logo_mobile_url,favicon_url,delivery_fee,delivery_min_free,delivery_radius,maintenance_mode,max_orders_per_day,vat_price_mode,vat_show_on_invoice,vat_show_on_pos,vat_show_on_checkout,delivery_enabled,delivery_max_distance_km,delivery_base_distance_km,delivery_base_fee,delivery_price_per_km,delivery_min_fee,delivery_max_fee,delivery_routing_provider,delivery_quote_ttl_minutes,ORDER_REVIEW_REWARD_POINTS,ORDER_REVIEW_WINDOW_DAYS,REVIEW_REWARD_ENABLED,ORDER_REVIEW_REQUEST_ENABLED,PRODUCT_REVIEW_MEDIA_ENABLED',
        { credentials: 'include' }
      );
      const data = await res.json();
      setSettings(data.data || {});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    settingKey: 'logo_desktop_url' | 'logo_mobile_url' | 'favicon_url',
    setUploading: (val: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canManageSettings) {
      toast.error('Bạn không có quyền cập nhật nhận diện thương hiệu!');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước tệp không được vượt quá 5MB!');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/upload?folder=branding', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedUrl = data.url;
        setSettings((prev: any) => ({ ...prev, [settingKey]: uploadedUrl }));
        toast.success('Tải ảnh từ máy lên thành công!');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Không thể tải tệp lên');
      }
    } catch (err) {
      toast.error('Lỗi kết nối khi tải tệp lên máy chủ');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) {
      toast.error('Bạn không có quyền chỉnh sửa cài đặt hệ thống!');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(t('settings.saveSuccess', 'Cập nhật cài đặt thành công!'));
      } else {
        toast.error(t('settings.saveError', 'Lỗi khi cập nhật cài đặt'));
      }
    } catch (error) {
      toast.error(t('settings.connError', 'Lỗi kết nối'));
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-md">
          <AlertTriangle size={36} className="text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-1">{t('settings.accessDenied', 'Quyền truy cập bị từ chối')}</h2>
          <p className="text-xs text-slate-500">
            {t('settings.accessDeniedDesc', 'Chỉ Quản trị viên (ADMIN) mới có quyền truy cập và cấu hình cài đặt hệ thống.')}
          </p>
        </div>
      </div>
    );
  }

  const tabItems = [
    { id: 'restaurant', label: t('settings.tabRestaurant', 'Thông tin chung & Thương hiệu'), icon: Store },
    { id: 'delivery', label: t('settings.tabDelivery', 'Giao hàng & Phí ship (Tọa độ)'), icon: Truck },
    { id: 'tax', label: t('settings.tabTax', 'Thuế giá trị gia tăng (VAT)'), icon: Receipt },
    { id: 'reviews', label: 'Đánh giá & Trải nghiệm', icon: MessageSquare },
    { id: 'system', label: t('settings.tabSystem', 'Cấu hình nâng cao'), icon: Settings2 },
  ];

  return (
    <div className="admin-page-wrapper space-y-3 sm:space-y-4 md:space-y-6 max-w-5xl pb-8 sm:pb-12">
      {/* Page Header */}
      <PageHeader
        title={t('settings.title', 'Cài đặt Hệ thống')}
        subtitle={t('settings.subtitle', 'Cấu hình thông tin thương hiệu AVORA, biểu tượng Logo, Favicon và quy tắc giao hàng')}
        breadcrumbs={[
          { label: t('nav.system', 'Hệ thống') },
          { label: t('nav.settings', 'Cài đặt') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!canManageSettings && (
              <span className="text-[11px] sm:text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 truncate">
                Chỉ xem
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canManageSettings}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
            >
              <Save size={15} />
              <span>{saving ? t('settings.saving', 'Đang lưu...') : t('settings.save', 'Lưu cài đặt')}</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
        {/* Navigation Tabs - Horizontal scroll on mobile */}
        <div className="md:col-span-1 flex md:flex-col overflow-x-auto md:overflow-x-visible scrollbar-none gap-1 pb-1 md:pb-0 shrink-0">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs font-bold transition-all text-left whitespace-nowrap md:whitespace-normal shrink-0 md:shrink min-h-[38px] ${
                  isActive
                    ? 'bg-red-50 text-red-600 shadow-2xs'
                    : 'bg-white md:bg-transparent border md:border-0 border-slate-100 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-red-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Form */}
        <div className="md:col-span-3">
          <AdminCard title={tabItems.find((tab) => tab.id === activeTab)?.label || t('nav.settings', 'Cài đặt')}>
            <form onSubmit={handleSave} className="space-y-4">
              {activeTab === 'restaurant' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label={t('settings.restaurantName', 'Tên cửa hàng / Nhà hàng')}>
                      <input
                        type="text"
                        value={settings.restaurant_name || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, restaurant_name: e.target.value })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-semibold text-slate-800"
                        placeholder="AVORA Restaurant"
                      />
                    </FormField>
                    <FormField label={t('settings.phone', 'Số điện thoại Hotline')}>
                      <input
                        type="text"
                        value={settings.restaurant_phone || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, restaurant_phone: e.target.value })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-slate-800"
                        placeholder="1900 xxxx"
                      />
                    </FormField>
                  </div>
                  <FormField label={t('settings.address', 'Địa chỉ trụ sở chính')}>
                    <input
                      type="text"
                      value={settings.restaurant_address || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, restaurant_address: e.target.value })
                      }
                      className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none text-slate-800"
                      placeholder="Số nhà, đường, quận, thành phố..."
                    />
                  </FormField>

                  {/* CẤU HÌNH LOGO & ICON THƯƠNG HIỆU */}
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon size={14} className="text-red-600" />
                        <span>Nhận diện thương hiệu & Logo</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Thiết lập logo hiển thị trên thanh điều hướng Desktop, Mobile và Favicon trình duyệt.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Logo Desktop */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                        <FormField label="Logo trên Desktop (Dạng ngang / Banner)">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={settings.logo_desktop_url ?? '/avora_logo_ngang.png'}
                              onChange={(e) =>
                                setSettings({ ...settings, logo_desktop_url: e.target.value })
                              }
                              className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 text-slate-800 font-mono"
                              placeholder="/avora_logo_ngang.png hoặc https://..."
                              disabled={!canManageSettings}
                            />
                            <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                              uploadingLogoDesktop
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : canManageSettings
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}>
                              {uploadingLogoDesktop ? (
                                <RotateCw size={13} className="animate-spin" />
                              ) : (
                                <Upload size={13} />
                              )}
                              <span>{uploadingLogoDesktop ? 'Đang tải...' : 'Tải lên từ máy'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(e) => handleFileUpload(e, 'logo_desktop_url', setUploadingLogoDesktop)}
                                className="hidden"
                                disabled={!canManageSettings || uploadingLogoDesktop}
                              />
                            </label>
                          </div>
                        </FormField>
                        <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200">
                          <div className="w-36 h-12 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center overflow-hidden p-1">
                            {settings.logo_desktop_url || '/avora_logo_ngang.png' ? (
                              <img
                                src={settings.logo_desktop_url || '/avora_logo_ngang.png'}
                                alt="Desktop Logo Preview"
                                className="max-h-full max-w-full object-contain"
                                onError={(e: any) => { e.target.src = '/avora_logo_ngang.png'; }}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Chưa có logo</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            <span className="font-semibold text-slate-700 block">Xem trước Desktop</span>
                            Kích thước gợi ý: 200x50px hoặc PNG trong suốt.
                          </div>
                        </div>
                      </div>

                      {/* Logo Mobile */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                        <FormField label="Logo trên Mobile (Dạng vuông / Biểu tượng)">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={settings.logo_mobile_url ?? '/avora_logo.png'}
                              onChange={(e) =>
                                setSettings({ ...settings, logo_mobile_url: e.target.value })
                              }
                              className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 text-slate-800 font-mono"
                              placeholder="/avora_logo.png hoặc https://..."
                              disabled={!canManageSettings}
                            />
                            <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                              uploadingLogoMobile
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                : canManageSettings
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            }`}>
                              {uploadingLogoMobile ? (
                                <RotateCw size={13} className="animate-spin" />
                              ) : (
                                <Upload size={13} />
                              )}
                              <span>{uploadingLogoMobile ? 'Đang tải...' : 'Tải lên từ máy'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(e) => handleFileUpload(e, 'logo_mobile_url', setUploadingLogoMobile)}
                                className="hidden"
                                disabled={!canManageSettings || uploadingLogoMobile}
                              />
                            </label>
                          </div>
                        </FormField>
                        <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200">
                          <div className="w-12 h-12 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center overflow-hidden p-1">
                            {settings.logo_mobile_url || '/avora_logo.png' ? (
                              <img
                                src={settings.logo_mobile_url || '/avora_logo.png'}
                                alt="Mobile Logo Preview"
                                className="max-h-full max-w-full object-contain"
                                onError={(e: any) => { e.target.src = '/avora_logo.png'; }}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Chưa có</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            <span className="font-semibold text-slate-700 block">Xem trước Mobile</span>
                            Kích thước gợi ý: 80x80px vuông, bo góc.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Favicon Browser */}
                    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2.5 max-w-xl">
                      <FormField label="Favicon trình duyệt (Icon thanh tab)">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={settings.favicon_url ?? '/avora_logo.png'}
                            onChange={(e) =>
                              setSettings({ ...settings, favicon_url: e.target.value })
                            }
                            className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 text-slate-800 font-mono"
                            placeholder="/avora_logo.png hoặc https://..."
                            disabled={!canManageSettings}
                          />
                          <label className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
                            uploadingFavicon
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : canManageSettings
                              ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}>
                            {uploadingFavicon ? (
                              <RotateCw size={13} className="animate-spin" />
                            ) : (
                              <Upload size={13} />
                            )}
                            <span>{uploadingFavicon ? 'Đang tải...' : 'Tải icon từ máy'}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,.ico,.png"
                              onChange={(e) => handleFileUpload(e, 'favicon_url', setUploadingFavicon)}
                              className="hidden"
                              disabled={!canManageSettings || uploadingFavicon}
                            />
                          </label>
                        </div>
                      </FormField>
                      <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
                          <img
                            src={settings.favicon_url || '/avora_logo.png'}
                            alt="Favicon Preview"
                            className="w-4 h-4 object-contain rounded-xs"
                            onError={(e: any) => { e.target.src = '/avora_logo.png'; }}
                          />
                          <span className="text-[11px] font-medium text-slate-600 truncate max-w-[120px]">
                            {settings.restaurant_name || 'AVORA Restaurant'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">Mô phỏng Tab trình duyệt (32x32px, hỗ trợ .png, .ico, .svg)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'delivery' && (
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 cursor-pointer">
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-blue-900">
                        {t('settings.deliveryEnabled', 'Bật dịch vụ giao hàng Online (Delivery)')}
                      </p>
                      <span className="text-[11px] text-blue-700">
                        {t('settings.deliveryEnabledDesc', 'Cho phép khách hàng đặt đơn giao tận nơi qua Website / App theo tọa độ GPS')}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.delivery_enabled === true || settings.delivery_enabled === 'true' || settings.delivery_enabled === undefined}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          delivery_enabled: e.target.checked ? 'true' : 'false',
                        })
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label={t('settings.deliveryBaseDistance', 'Km cơ bản đầu tiên')}>
                      <input
                        type="number"
                        value={settings.delivery_base_distance_km ?? 3}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_base_distance_km: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="3"
                      />
                    </FormField>
                    <FormField label={t('settings.deliveryBaseFee', 'Phí km cơ bản (VNĐ)')}>
                      <input
                        type="number"
                        value={settings.delivery_base_fee ?? 15000}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_base_fee: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm font-bold text-red-600 bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="15000"
                      />
                    </FormField>
                    <FormField label={t('settings.deliveryPricePerKm', 'Giá mỗi km tiếp theo (VNĐ/km)')}>
                      <input
                        type="number"
                        value={settings.delivery_price_per_km ?? 5000}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_price_per_km: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="5000"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label={t('settings.deliveryMaxDistance', 'Khoảng cách tối đa (km)')}>
                      <input
                        type="number"
                        value={settings.delivery_max_distance_km ?? (settings.delivery_radius || 15)}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_max_distance_km: Number(e.target.value), delivery_radius: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="15"
                      />
                    </FormField>
                    <FormField label={t('settings.deliveryMinFee', 'Phí giao tối thiểu (VNĐ)')}>
                      <input
                        type="number"
                        value={settings.delivery_min_fee ?? 15000}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_min_fee: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="15000"
                      />
                    </FormField>
                    <FormField label={t('settings.deliveryMaxFee', 'Phí giao tối đa (VNĐ)')}>
                      <input
                        type="number"
                        value={settings.delivery_max_fee ?? 100000}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_max_fee: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="100000"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label={t('settings.deliveryFreeThreshold', 'Miễn phí ship khi đơn từ (VNĐ)')}>
                      <input
                        type="number"
                        value={settings.delivery_min_free || 0}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_min_free: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder={t('settings.maxOrdersUnlimited', '0 = Không áp dụng')}
                      />
                    </FormField>
                    <FormField label={t('settings.deliveryRoutingProvider', 'Routing Engine (Định tuyến đường đi)')}>
                      <select
                        value={settings.delivery_routing_provider || 'OSRM'}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_routing_provider: e.target.value })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                      >
                        <option value="OSRM">OSRM Routing (Đường bộ thực tế)</option>
                        <option value="GOOGLE">Google Maps Routes API</option>
                        <option value="MAPBOX">Mapbox Navigation API</option>
                      </select>
                    </FormField>
                    <FormField label={t('settings.deliveryQuoteTtl', 'Hạn báo giá Shipping Quote (phút)')}>
                      <input
                        type="number"
                        value={settings.delivery_quote_ttl_minutes ?? 10}
                        onChange={(e) =>
                          setSettings({ ...settings, delivery_quote_ttl_minutes: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                        placeholder="10"
                      />
                    </FormField>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
                    {t('settings.deliveryRuleNotice', '💡 Nguyên tắc tính cước: Backend tính chính xác theo khoảng cách di chuyển thực tế từ tọa độ GPS Chi nhánh đến tọa độ GPS Khách hàng. Quãng đường vượt quá khoảng cách tối đa sẽ không cho phép đặt giao hàng.')}
                  </div>
                </div>
              )}

              {activeTab === 'tax' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t('settings.vatMode', 'Chế độ định giá Thuế GTGT (VAT toàn hệ thống)')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => setSettings({ ...settings, vat_price_mode: 'VAT_INCLUDED' })}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          (settings.vat_price_mode || 'VAT_INCLUDED') === 'VAT_INCLUDED'
                            ? 'border-red-600 bg-red-50/40 text-red-900 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs sm:text-sm">{t('settings.vatIncluded', 'Giá bán ĐÃ BAO GỒM VAT')}</span>
                          {(settings.vat_price_mode || 'VAT_INCLUDED') === 'VAT_INCLUDED' && (
                            <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full">
                              {t('settings.vatActive', 'Đang áp dụng')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          {t('settings.vatIncludedDesc', 'Giá hiển thị trên menu/website là giá thanh toán cuối cùng. Thuế VAT được cấu thành bên trong giá (không cộng dồn thêm).')}
                        </p>
                      </div>

                      <div
                        onClick={() => setSettings({ ...settings, vat_price_mode: 'VAT_EXCLUDED' })}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          settings.vat_price_mode === 'VAT_EXCLUDED'
                            ? 'border-red-600 bg-red-50/40 text-red-900 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs sm:text-sm">{t('settings.vatExcluded', 'Giá bán CHƯA BAO GỒM VAT')}</span>
                          {settings.vat_price_mode === 'VAT_EXCLUDED' && (
                            <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full">
                              {t('settings.vatActive', 'Đang áp dụng')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          {t('settings.vatExcludedDesc', 'Giá hiển thị là giá trước thuế. Backend sẽ tự động tính và cộng thêm số tiền thuế VAT vào tổng thanh toán đơn hàng.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t('settings.vatDisplayOptions', 'Tùy chọn hiển thị thông tin thuế')}
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-xs text-slate-800">{t('settings.vatShowInvoice', 'Hiển thị tách dòng VAT trên hóa đơn / Phiếu tạm tính')}</p>
                        <span className="text-[11px] text-slate-500">{t('settings.vatShowInvoiceDesc', 'In ra chi tiết dòng tiền thuế GTGT trên bill bán hàng')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.vat_show_on_invoice === true || settings.vat_show_on_invoice === 'true' || settings.vat_show_on_invoice === undefined}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            vat_show_on_invoice: e.target.checked ? 'true' : 'false',
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-xs text-slate-800">{t('settings.vatShowPos', 'Hiển thị tiền thuế VAT trên giao diện POS')}</p>
                        <span className="text-[11px] text-slate-500">{t('settings.vatShowPosDesc', 'Thu ngân nhìn thấy dòng thuế rõ ràng khi thanh toán')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.vat_show_on_pos === true || settings.vat_show_on_pos === 'true' || settings.vat_show_on_pos === undefined}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            vat_show_on_pos: e.target.checked ? 'true' : 'false',
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50">
                      <div>
                        <p className="font-semibold text-xs text-slate-800">{t('settings.vatShowCheckout', 'Hiển thị tiền thuế VAT trên Checkout Online')}</p>
                        <span className="text-[11px] text-slate-500">{t('settings.vatShowCheckoutDesc', 'Khách hàng đặt qua website nhìn thấy dòng thuế minh bạch')}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.vat_show_on_checkout === true || settings.vat_show_on_checkout === 'true' || settings.vat_show_on_checkout === undefined}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            vat_show_on_checkout: e.target.checked ? 'true' : 'false',
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-100 mb-2">
                    <h3 className="text-xs sm:text-sm font-bold text-rose-900 mb-0.5">
                      Cấu hình Đánh giá món ăn & Trải nghiệm đơn hàng
                    </h3>
                    <p className="text-[11px] text-rose-700">
                      Thiết lập điểm thưởng hội viên, thời hạn gửi đánh giá và các chính sách kiểm duyệt truyền thông.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Điểm thưởng khi đánh giá đơn hàng hoàn thành (mặc định: 999)">
                      <input
                        type="number"
                        min="0"
                        value={settings.ORDER_REVIEW_REWARD_POINTS !== undefined ? settings.ORDER_REVIEW_REWARD_POINTS : 999}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            ORDER_REVIEW_REWARD_POINTS: Number(e.target.value),
                          })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-bold text-red-600"
                      />
                    </FormField>

                    <FormField label="Thời hạn cho phép gửi đánh giá đơn (ngày, mặc định: 14)">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={settings.ORDER_REVIEW_WINDOW_DAYS !== undefined ? settings.ORDER_REVIEW_WINDOW_DAYS : 14}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            ORDER_REVIEW_WINDOW_DAYS: Number(e.target.value),
                          })
                        }
                        className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 font-bold text-slate-800"
                      />
                    </FormField>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors cursor-pointer">
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-slate-900">
                          Bật tặng điểm thưởng đánh giá đơn hàng
                        </p>
                        <span className="text-[11px] text-slate-500">
                          Hệ thống tự động cộng điểm thưởng vào ví thành viên khi gửi đánh giá đơn lần đầu.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.REVIEW_REWARD_ENABLED !== 'false' && settings.REVIEW_REWARD_ENABLED !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            REVIEW_REWARD_ENABLED: e.target.checked ? 'true' : 'false',
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors cursor-pointer">
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-slate-900">
                          Tự động gửi thông báo xin đánh giá
                        </p>
                        <span className="text-[11px] text-slate-500">
                          Gửi notification kèm link đánh giá ngay khi đơn hàng chuyển sang trạng thái Hoàn thành.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.ORDER_REVIEW_REQUEST_ENABLED !== 'false' && settings.ORDER_REVIEW_REQUEST_ENABLED !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            ORDER_REVIEW_REQUEST_ENABLED: e.target.checked ? 'true' : 'false',
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition-colors cursor-pointer">
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-slate-900">
                          Cho phép đính kèm ảnh và video trong đánh giá món ăn
                        </p>
                        <span className="text-[11px] text-slate-500">
                          Hỗ trợ tải lên tối đa 5 tệp (ảnh hoặc video tự động tối ưu &le; 5MB).
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.PRODUCT_REVIEW_MEDIA_ENABLED !== 'false' && settings.PRODUCT_REVIEW_MEDIA_ENABLED !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            PRODUCT_REVIEW_MEDIA_ENABLED: e.target.checked ? 'true' : 'false',
                          })
                        }
                        className="w-4 h-4 text-red-600 rounded"
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-rose-200 bg-rose-50/50 cursor-pointer">
                    <div>
                      <p className="font-bold text-xs sm:text-sm text-rose-900">
                        {t('settings.maintenanceMode', 'Bật chế độ bảo trì hệ thống')}
                      </p>
                      <span className="text-[11px] text-rose-700">
                        {t('settings.maintenanceDesc', 'Tạm ngừng nhận đơn hàng mới trên ứng dụng và website khách hàng')}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.maintenance_mode === true || settings.maintenance_mode === 'true'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          maintenance_mode: e.target.checked ? 'true' : 'false',
                        })
                      }
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                  </label>

                  <FormField label={t('settings.maxOrdersPerDay', 'Giới hạn số đơn tối đa trong ngày (0 = Không giới hạn)')}>
                    <input
                      type="number"
                      value={settings.max_orders_per_day || 0}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          max_orders_per_day: Number(e.target.value),
                        })
                      }
                      className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </FormField>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>{saving ? t('settings.saving', 'Đang lưu...') : t('settings.save', 'Lưu cài đặt')}</span>
                </button>
              </div>
            </form>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
