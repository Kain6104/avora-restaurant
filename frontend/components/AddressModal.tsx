'use client';

import React, { useState, useEffect } from 'react';
import { X, LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

export interface Address {
  id: string;
  recipientName: string;
  phone: string;
  province: string;
  ward: string;
  streetDetail: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface AddressModalProps {
  address?: Address | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddressModal({ address, onClose, onSuccess }: AddressModalProps) {
  const [formData, setFormData] = useState({
    recipientName: address?.recipientName || '',
    phone: address?.phone || '',
    province: address?.province || '',
    ward: address?.ward || '',
    streetDetail: address?.streetDetail || '',
    isDefault: address ? address.isDefault : false,
    latitude: address?.latitude || 10.762622,
    longitude: address?.longitude || 106.660172,
  });

  useEffect(() => {
    if (!address) {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          setFormData(prev => ({
            ...prev,
            recipientName: prev.recipientName || u.fullName || '',
            phone: prev.phone || u.phone || '',
          }));
        }
      } catch (e) {}
    }
  }, [address]);

  const autoFillAddressFromCoords = async (latitude: number, longitude: number, toastId?: string) => {
    setFormData(prev => ({ ...prev, latitude, longitude }));

    // 1. Try BigDataCloud Reverse Geocoding
    try {
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
      );
      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const province = bdcData.principalSubdivision || bdcData.countryName || '';
        let district = bdcData.locality || '';
        let ward = '';
        let streetDetail = '';

        if (Array.isArray(bdcData.localityInfo?.administrative)) {
          const adminList = bdcData.localityInfo.administrative;
          const districtObj = adminList.find((a: any) =>
            a.adminLevel === 6 ||
            a.description?.toLowerCase().includes('quận') ||
            a.description?.toLowerCase().includes('huyện') ||
            a.description?.toLowerCase().includes('thành phố') ||
            a.description?.toLowerCase().includes('thị xã')
          );
          if (districtObj && !district) district = districtObj.name;

          const wardObj = adminList.find((a: any) =>
            a.adminLevel === 8 ||
            a.description?.toLowerCase().includes('phường') ||
            a.description?.toLowerCase().includes('xã') ||
            a.description?.toLowerCase().includes('thị trấn') ||
            a.name?.toLowerCase().startsWith('phường') ||
            a.name?.toLowerCase().startsWith('xã')
          );
          if (wardObj) ward = wardObj.name;

          const streetObj = adminList.find((a: any) =>
            a.adminLevel >= 9 ||
            a.description?.toLowerCase().includes('đường') ||
            a.name?.toLowerCase().startsWith('đường')
          );
          if (streetObj) streetDetail = streetObj.name;
        }

        if (!streetDetail && bdcData.localityInfo?.informative) {
          const streetObj = bdcData.localityInfo.informative.find((a: any) =>
            a.description?.toLowerCase().includes('đường') ||
            a.name?.toLowerCase().startsWith('đường')
          );
          if (streetObj) streetDetail = streetObj.name;
        }

        const combinedWard = [ward, district].filter(Boolean).join(', ');
        if (province || combinedWard) {
          setFormData(prev => ({
            ...prev,
            province: province || prev.province,
            ward: combinedWard || prev.ward,
            streetDetail: streetDetail || prev.streetDetail || 'Vị trí hiện tại',
          }));
          if (toastId) toast.success('Đã lấy vị trí và điền địa chỉ thành công', { id: toastId });
          return;
        }
      }
    } catch (e) {
      // Fallback to Nominatim
    }

    // 2. Try OpenStreetMap Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi&addressdetails=1`
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const province = addr.province || addr.city || addr.state || '';
        const district = addr.district || addr.county || addr.suburb || addr.city_district || addr.town || '';
        const ward = addr.ward || addr.quarter || addr.neighbourhood || addr.suburb || addr.village || '';
        const road = addr.road || '';
        const houseNumber = addr.house_number || '';
        
        const parts = (data.display_name || '').split(',').map((s: string) => s.trim());
        const rawStreet = parts.length > 2 ? parts.slice(0, Math.min(2, parts.length - 3)).join(', ') : (parts[0] || '');
        const streetDetail = [houseNumber, road].filter(Boolean).join(' ') || addr.residential || addr.amenity || addr.building || rawStreet || '';
        const combinedWard = [ward, district].filter(Boolean).join(', ');

        setFormData(prev => ({
          ...prev,
          province: province || prev.province,
          ward: combinedWard || prev.ward,
          streetDetail: streetDetail || prev.streetDetail || 'Vị trí hiện tại',
        }));
        if (toastId) toast.success('Đã lấy vị trí và điền địa chỉ thành công', { id: toastId });
        return;
      }
    } catch (e) {}

    if (toastId) toast.success('Đã cập nhật tọa độ trên bản đồ', { id: toastId });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMapChange = (lat: number, lng: number) => {
    autoFillAddressFromCoords(lat, lng);
  };

  const handleToggleDefault = () => {
    setFormData(prev => ({ ...prev, isDefault: !prev.isDefault }));
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt của bạn không hỗ trợ định vị');
      return;
    }

    const toastId = toast.loading('Đang lấy vị trí hiện tại...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        autoFillAddressFromCoords(latitude, longitude, toastId);
      },
      (error) => {
        toast.error('Không thể lấy vị trí. Vui lòng cấp quyền truy cập vị trí.', { id: toastId });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loadingToast = toast.loading('Đang lưu địa chỉ...');
    
    try {
      const url = address 
        ? `/api/addresses/${address.id}`
        : '/api/addresses';
        
      const method = address ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(address ? 'Cập nhật thành công!' : 'Thêm mới thành công!', { id: loadingToast });
        onSuccess();
        onClose();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại', { id: loadingToast });
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 backdrop-blur-sm bg-slate-900/40 transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-5 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-slate-800">
            {address ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex justify-between items-center mb-6">
             <div className="text-sm text-slate-600">
               Vui lòng điền thông tin hoặc chọn nhanh vị trí hiện tại
             </div>
             <button 
                type="button" 
                onClick={handleGetCurrentLocation}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
             >
                <LocateFixed size={16} />
                Lấy vị trí hiện tại
             </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Người nhận</label>
              <input
                required
                name="recipientName"
                value={formData.recipientName}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all"
                placeholder="Tên người nhận"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Số điện thoại</label>
              <input
                required
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all"
                placeholder="Số điện thoại liên hệ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tỉnh / Thành phố</label>
              <input
                required
                name="province"
                value={formData.province}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all"
                placeholder="VD: Hồ Chí Minh"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phường / Xã</label>
              <input
                required
                name="ward"
                value={formData.ward}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all"
                placeholder="VD: Phường Bến Nghé"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Địa chỉ cụ thể</label>
              <input
                required
                name="streetDetail"
                value={formData.streetDetail}
                onChange={handleInputChange}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none transition-all"
                placeholder="Số nhà, tên đường..."
              />
            </div>
          </div>

          {/* Bản đồ */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <label className="block text-sm font-medium text-slate-700">Vị trí trên bản đồ</label>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                Kéo thả marker để chọn vị trí chính xác
              </span>
            </div>
            <div className="h-[250px] w-full">
              <MapPicker 
                position={{ lat: formData.latitude, lng: formData.longitude }} 
                onChange={handleMapChange} 
              />
            </div>
          </div>

          {/* Toggle Default */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-8">
            <div>
              <p className="font-medium text-slate-800">Đặt làm địa chỉ mặc định</p>
              <p className="text-sm text-slate-500">Sử dụng địa chỉ này cho các đơn hàng tiếp theo</p>
            </div>
            <button
              type="button"
              onClick={handleToggleDefault}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                formData.isDefault ? 'bg-red-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                  formData.isDefault ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors shadow-md hover:shadow-lg"
            >
              {address ? 'Cập nhật' : 'Lưu địa chỉ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
