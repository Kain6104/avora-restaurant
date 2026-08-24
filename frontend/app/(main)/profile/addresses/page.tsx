'use client';

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, X, LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Dynamically import MapPicker with ssr: false since leaflet uses window
const MapPicker = dynamic(() => import('@/components/MapPicker'), { ssr: false });

interface Address {
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

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    recipientName: '',
    phone: '',
    province: '',
    ward: '',
    streetDetail: '',
    isDefault: false,
    latitude: 10.762622, // Default HCMC
    longitude: 106.660172,
  });

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/api/addresses', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data);
      }
    } catch (error) {
      toast.error('Lỗi khi tải danh sách địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const openModal = (address?: Address) => {
    if (address) {
      setEditingAddress(address);
      setFormData({
        recipientName: address.recipientName || '',
        phone: address.phone || '',
        province: address.province || '',
        ward: address.ward || '',
        streetDetail: address.streetDetail || '',
        isDefault: address.isDefault,
        latitude: address.latitude || 10.762622,
        longitude: address.longitude || 106.660172,
      });
    } else {
      setEditingAddress(null);
      setFormData({
        recipientName: '',
        phone: '',
        province: '',
        ward: '',
        streetDetail: '',
        isDefault: false,
        latitude: 10.762622,
        longitude: 106.660172,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAddress(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMapChange = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
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
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        
        try {
          // Lấy thông tin địa chỉ từ tọa độ (Reverse Geocoding) thông qua Nominatim
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const addressInfo = data.address || {};
            
            const city = addressInfo.city || addressInfo.state || addressInfo.province || '';
            const suburb = addressInfo.suburb || addressInfo.quarter || addressInfo.neighbourhood || addressInfo.village || '';
            const road = addressInfo.road || '';
            const houseNumber = addressInfo.house_number || '';
            
            const streetDetail = [houseNumber, road].filter(Boolean).join(' ');
            
            setFormData(prev => ({
              ...prev,
              province: city || prev.province,
              ward: suburb || prev.ward,
              streetDetail: streetDetail || prev.streetDetail,
            }));
            toast.success('Đã lấy vị trí thành công', { id: toastId });
          } else {
            toast.success('Đã cập nhật tọa độ trên bản đồ', { id: toastId });
          }
        } catch (error) {
          toast.success('Đã cập nhật tọa độ trên bản đồ', { id: toastId });
        }
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
      const url = editingAddress 
        ? `http://localhost:3001/api/addresses/${editingAddress.id}`
        : 'http://localhost:3001/api/addresses';
        
      const method = editingAddress ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success(editingAddress ? 'Cập nhật thành công!' : 'Thêm mới thành công!', { id: loadingToast });
        fetchAddresses();
        closeModal();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra, vui lòng thử lại', { id: loadingToast });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa địa chỉ này?')) return;
    
    const loadingToast = toast.loading('Đang xóa...');
    try {
      const res = await fetch(`http://localhost:3001/api/addresses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Đã xóa địa chỉ', { id: loadingToast });
        fetchAddresses();
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      toast.error('Không thể xóa địa chỉ', { id: loadingToast });
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Sổ địa chỉ giao hàng</h1>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <Plus size={20} />
          <span>Thêm địa chỉ mới</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <MapPin className="mx-auto h-16 w-16 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-700">Chưa có địa chỉ nào</h3>
          <p className="text-slate-500 mt-2">Thêm địa chỉ giao hàng để đặt món nhanh chóng hơn.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {addresses.map((address) => (
            <div 
              key={address.id} 
              className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.05)] border border-slate-100 p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 relative overflow-hidden group"
            >
              {/* Decorative line for default address */}
              {address.isDefault && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
              )}
              
              <div className="flex items-start justify-between">
                <div className="flex gap-4 items-start">
                  <div className={`p-3 rounded-full mt-1 ${address.isDefault ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400 group-hover:text-red-500 group-hover:bg-red-50 transition-colors'}`}>
                    <MapPin size={24} />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {address.recipientName}
                      </h3>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-600 font-medium">{address.phone}</span>
                      
                      {address.isDefault && (
                        <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full ml-2">
                          Mặc định
                        </span>
                      )}
                    </div>
                    
                    <p className="text-slate-600 mt-2 leading-relaxed">
                      {address.streetDetail}
                      <br />
                      {address.ward}, {address.province}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => openModal(address)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(address.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 backdrop-blur-sm bg-slate-900/40 transition-opacity" 
            onClick={closeModal}
          ></div>
          
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-5 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-slate-800">
                {editingAddress ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}
              </h2>
              <button 
                onClick={closeModal}
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
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors shadow-md hover:shadow-lg"
                >
                  {editingAddress ? 'Cập nhật' : 'Lưu địa chỉ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
