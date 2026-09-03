'use client';

import React, { useEffect, useState } from 'react';
import { useAdmin } from '@/contexts/AdminContext';
import { Save, Store, Clock, Truck, CreditCard, Settings2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminSettingsPage() {
  const { role } = useAdmin();
  const [activeTab, setActiveTab] = useState('restaurant');
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === 'ADMIN') {
      fetchSettings();
    }
  }, [role]);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings?keys=restaurant_name,restaurant_phone,restaurant_address,delivery_fee,delivery_min_free,delivery_radius,opening_time,closing_time,closing_days,bank_account_name,bank_account_number,bank_name,momo_number,maintenance_mode,max_orders_per_day', { credentials: 'include' });
      const data = await res.json();
      setSettings(data.data || {});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Cập nhật cài đặt thành công!');
      } else {
        toast.error('Lỗi khi cập nhật cài đặt');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    }
  };

  if (role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Truy cập bị từ chối</h2>
          <p className="text-gray-500">Chỉ có Admin mới có quyền thay đổi Cài đặt hệ thống.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cài đặt hệ thống</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 space-y-1">
          <button
            onClick={() => setActiveTab('restaurant')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'restaurant' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Store size={18} /> Thông tin Nhà Hàng
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'hours' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Clock size={18} /> Giờ mở cửa
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'delivery' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Truck size={18} /> Giao hàng
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'payment' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <CreditCard size={18} /> Thanh toán
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
              activeTab === 'system' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings2 size={18} /> Cấu hình nâng cao
          </button>
        </div>

        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
            <form onSubmit={handleSave} className="space-y-6">
              
              {activeTab === 'restaurant' && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold border-b pb-2">Thông tin liên hệ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên Nhà Hàng</label>
                      <input type="text" value={settings.restaurant_name || ''} onChange={e => setSettings({...settings, restaurant_name: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="Nhập tên..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại Hotline</label>
                      <input type="text" value={settings.restaurant_phone || ''} onChange={e => setSettings({...settings, restaurant_phone: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="1900 xxxx" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ trụ sở chính</label>
                      <input type="text" value={settings.restaurant_address || ''} onChange={e => setSettings({...settings, restaurant_address: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'delivery' && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold border-b pb-2">Cấu hình vận chuyển</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phí giao hàng cơ bản (VNĐ)</label>
                      <input type="number" value={settings.delivery_fee || 0} onChange={e => setSettings({...settings, delivery_fee: Number(e.target.value)})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Miễn phí giao hàng khi đơn từ (VNĐ)</label>
                      <input type="number" value={settings.delivery_min_free || 0} onChange={e => setSettings({...settings, delivery_min_free: Number(e.target.value)})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bán kính giao hàng tối đa (km)</label>
                      <input type="number" value={settings.delivery_radius || 0} onChange={e => setSettings({...settings, delivery_radius: Number(e.target.value)})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'hours' && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold border-b pb-2">Giờ mở cửa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Giờ mở cửa</label>
                      <input type="time" value={settings.opening_time || '07:00'} onChange={e => setSettings({...settings, opening_time: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Giờ đóng cửa</label>
                      <input type="time" value={settings.closing_time || '22:00'} onChange={e => setSettings({...settings, closing_time: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Các ngày nghỉ cố định (Nếu có)</label>
                      <input type="text" value={settings.closing_days || ''} onChange={e => setSettings({...settings, closing_days: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="VD: Nghỉ mùng 1 Âm lịch..." />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payment' && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold border-b pb-2">Thông tin thanh toán (Mặc định)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ngân hàng</label>
                      <input type="text" value={settings.bank_name || ''} onChange={e => setSettings({...settings, bank_name: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="VD: Vietcombank" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên chủ tài khoản</label>
                      <input type="text" value={settings.bank_account_name || ''} onChange={e => setSettings({...settings, bank_account_name: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="NGUYEN VAN A" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số tài khoản</label>
                      <input type="text" value={settings.bank_account_number || ''} onChange={e => setSettings({...settings, bank_account_number: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="123456789" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số MoMo (Tùy chọn)</label>
                      <input type="text" value={settings.momo_number || ''} onChange={e => setSettings({...settings, momo_number: e.target.value})} className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" placeholder="0901234567" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'system' && (
                <div className="space-y-5">
                  <h3 className="text-lg font-bold border-b pb-2">Cấu hình nâng cao</h3>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border">
                      <div>
                        <div className="font-bold text-gray-900">Chế độ bảo trì</div>
                        <div className="text-sm text-gray-500">Bật chế độ này sẽ tạm dừng khách hàng đặt món mới.</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.maintenance_mode === 'true'} onChange={e => setSettings({...settings, maintenance_mode: e.target.checked ? 'true' : 'false'})} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn số đơn tối đa trong ngày (0 = Không giới hạn)</label>
                      <input type="number" value={settings.max_orders_per_day || 0} onChange={e => setSettings({...settings, max_orders_per_day: Number(e.target.value)})} className="w-full md:w-1/2 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none" />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button type="submit" className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-red-700 shadow-sm flex items-center gap-2">
                  <Save size={18} /> Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
