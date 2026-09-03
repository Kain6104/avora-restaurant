'use client';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Edit, Trash2, Plus, Search, MapPin } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAdmin } from '@/contexts/AdminContext';

const BranchMap = dynamic(() => import('./components/BranchMap'), { ssr: false, loading: () => <div className="h-[400px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center border">Đang tải bản đồ...</div> });

export default function BranchesPage() {
  const { role } = useAdmin();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    branchCode: '',
    phone: '',
    email: '',
    province: '',
    district: '',
    ward: '',
    street: '',
    openTime: '',
    closeTime: '',
    latitude: null as number | null,
    longitude: null as number | null,
    onlineOrderingEnabled: true,
  });

  const [addressSearch, setAddressSearch] = useState('');
  const [searchingAddress, setSearchingAddress] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/branches', { credentials: 'include' });
      const data = await res.json();
      setBranches(data.data || []);
    } catch (error) {
      toast.error('Lỗi tải danh sách chi nhánh');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormData({
      name: '', branchCode: '', phone: '', email: '', province: '', district: '', ward: '', street: '',
      openTime: '', closeTime: '', latitude: null, longitude: null, onlineOrderingEnabled: true
    });
    setAddressSearch('');
    setIsModalOpen(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      ...branch,
      name: branch.name || '',
      branchCode: branch.branchCode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      province: branch.province || '',
      district: branch.district || '',
      ward: branch.ward || '',
      street: branch.street || '',
      openTime: branch.openTime || '',
      closeTime: branch.closeTime || '',
      latitude: branch.latitude ?? null,
      longitude: branch.longitude ?? null,
      onlineOrderingEnabled: branch.onlineOrderingEnabled ?? true
    });
    setAddressSearch(branch.street || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chi nhánh này?')) return;
    try {
      const res = await fetch(`/api/admin/branches/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Xóa thành công');
        fetchBranches();
      } else {
        toast.error(data.message || 'Lỗi khi xóa');
      }
    } catch (e) {
      toast.error('Lỗi kết nối');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.latitude === null || formData.longitude === null) {
      toast.error('Vui lòng chọn tọa độ trên bản đồ');
      return;
    }
    
    try {
      const url = editingBranch ? `/api/admin/branches/${editingBranch.id}` : '/api/admin/branches';
      const method = editingBranch ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(editingBranch ? 'Cập nhật thành công' : 'Thêm mới thành công');
        setIsModalOpen(false);
        fetchBranches();
      } else {
        toast.error(data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      toast.error('Lỗi kết nối');
    }
  };

  const searchAddressOnMap = async () => {
    if (!addressSearch.trim()) return;
    setSearchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setFormData({ ...formData, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) });
        toast.success('Đã tìm thấy vị trí');
      } else {
        toast.error('Không tìm thấy địa chỉ này');
      }
    } catch (e) {
      toast.error('Lỗi khi tìm địa chỉ');
    } finally {
      setSearchingAddress(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quản lý Chi nhánh</h1>
        {role === 'ADMIN' && (
          <button onClick={openCreateModal} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
            <Plus size={20} /> Thêm chi nhánh
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Đang tải...</div>
        ) : branches.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Chưa có chi nhánh nào.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="px-6 py-4 font-medium">Chi nhánh</th>
                <th className="px-6 py-4 font-medium">Thông tin</th>
                <th className="px-6 py-4 font-medium text-center">Giờ HĐ</th>
                <th className="px-6 py-4 font-medium text-center">Online</th>
                <th className="px-6 py-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{b.name}</div>
                    <div className="text-sm text-gray-500">Mã: {b.branchCode}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{b.street ? `${b.street}` : 'Chưa cập nhật địa chỉ'}</div>
                    <div className="text-sm text-gray-500">{b.phone}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm">
                    {b.openTime || '--:--'} - {b.closeTime || '--:--'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-block w-3 h-3 rounded-full ${b.onlineOrderingEnabled ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(b)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18} /></button>
                      {role === 'ADMIN' && (
                        <button onClick={() => handleDelete(b.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold">{editingBranch ? 'Cập nhật chi nhánh' : 'Thêm chi nhánh mới'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto grow">
              <form id="branch-form" onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-8">
                
                {/* Cột trái: Form thông tin */}
                <div className="w-full lg:w-5/12 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Tên chi nhánh *</label>
                    <input disabled={role !== 'ADMIN'} required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500" placeholder="VD: Avora Q1" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Mã chi nhánh</label>
                      <input disabled={role !== 'ADMIN'} value={formData.branchCode} onChange={e => setFormData({...formData, branchCode: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500" placeholder="Tự tạo nếu để trống" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Số điện thoại</label>
                      <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Địa chỉ chi tiết</label>
                    <textarea rows={2} value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" placeholder="VD: 123 Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1">Giờ mở cửa</label>
                      <input type="time" value={formData.openTime} onChange={e => setFormData({...formData, openTime: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Giờ đóng cửa</label>
                      <input type="time" value={formData.closeTime} onChange={e => setFormData({...formData, closeTime: e.target.value})} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.onlineOrderingEnabled} onChange={e => setFormData({...formData, onlineOrderingEnabled: e.target.checked})} className="w-5 h-5 text-red-600 rounded" />
                      <span className="font-semibold">Cho phép đặt hàng Online</span>
                    </label>
                  </div>
                </div>

                {/* Cột phải: Bản đồ */}
                <div className="w-full lg:w-7/12 flex flex-col">
                  <label className="block text-sm font-semibold mb-2">Vị trí trên bản đồ * (Click vào bản đồ để chọn tọa độ)</label>
                  
                  <div className="flex gap-2 mb-3">
                    <input 
                      value={addressSearch} 
                      onChange={e => setAddressSearch(e.target.value)} 
                      placeholder="Gõ địa chỉ để tìm kiếm vị trí..." 
                      className="flex-1 border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" 
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddressOnMap(); } }}
                    />
                    <button type="button" onClick={searchAddressOnMap} disabled={searchingAddress} className="bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-900 disabled:opacity-70 flex items-center gap-2">
                      <Search size={18} /> {searchingAddress ? 'Đang tìm...' : 'Tìm'}
                    </button>
                  </div>

                  <div className="grow relative min-h-[400px]">
                    <BranchMap 
                      latitude={formData.latitude} 
                      longitude={formData.longitude} 
                      onChange={(lat, lng) => setFormData(prev => ({...prev, latitude: lat, longitude: lng}))} 
                    />
                  </div>

                  <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-2 text-blue-800 font-mono text-sm">
                    <MapPin size={16} /> 
                    <span>
                      Tọa độ: {formData.latitude !== null && formData.longitude !== null 
                        ? `${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}` 
                        : 'Chưa chọn'}
                    </span>
                  </div>
                </div>

              </form>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border rounded-lg font-medium hover:bg-gray-100">Hủy</button>
              <button type="submit" form="branch-form" className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                {editingBranch ? 'Lưu thay đổi' : 'Thêm chi nhánh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
