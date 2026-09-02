'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from 'react-hot-toast';
import { Save, ArrowLeft, ShoppingBag, MapPin } from 'lucide-react';
import ImageUploader from '@/app/admin/components/ImageUploader';

interface UserFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function UserForm({ initialData, isEdit }: UserFormProps) {
  const router = useRouter();
  const { role, selectedBranchId, availableBranches } = useAdmin();
  const [uploading, setUploading] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    birthdate: '',
    password: '',
    role: 'USER',
    branchId: '',
    avatarUrl: '',
    isEmailVerified: false,
    isPhoneVerified: false,
    isAccountLocked: false,
    forceRelogin: false
  });

  useEffect(() => {
    if (role === 'ADMIN') {
      fetchBranches();
    }
  }, [role]);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData,
        password: '', // Không hiển thị password cũ
        branchId: initialData.branchId || '',
        username: initialData.username || '',
        birthdate: initialData.birthdate ? new Date(initialData.birthdate).toISOString().split('T')[0] : '',
        isEmailVerified: initialData.isEmailVerified || false,
        isPhoneVerified: initialData.isPhoneVerified || false,
        isAccountLocked: initialData.isAccountLocked || false,
        forceRelogin: initialData.forceRelogin || false
      }));
    }
  }, [initialData]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/admin/branches', { credentials: 'include' });
      const data = await res.json();
      setBranches(data.data || []);
    } catch (e) {
      console.error(e);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const finalImageUrl = formData.avatarUrl;

      const submitData = {
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone || null,
        username: formData.username || null,
        birthdate: formData.birthdate ? new Date(formData.birthdate).toISOString() : null,
        password: formData.password || undefined,
        role: formData.role,
        branchId: formData.branchId || null,
        avatarUrl: finalImageUrl || null,
        isEmailVerified: formData.isEmailVerified,
        isPhoneVerified: formData.isPhoneVerified,
        isAccountLocked: formData.isAccountLocked,
        forceRelogin: formData.forceRelogin
      };
      
      if (!submitData.password) {
        delete submitData.password;
      }
      
      const url = isEdit ? `/api/admin/users/${initialData.id}` : `/api/admin/users`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include'
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật tài khoản thành công' : 'Thêm tài khoản thành công');
        router.back();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      toast.error('Không thể kết nối đến server');
    } finally {
      setUploading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">{isEdit ? 'Chi Tiết & Chỉnh Sửa Người Dùng' : 'Thêm Tài Khoản Mới'}</h1>
        </div>
        <button onClick={handleSubmit} disabled={uploading} className="bg-red-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-red-700 disabled:opacity-50 transition-colors">
          <Save size={18} /> {uploading ? 'Đang lưu...' : 'Lưu Thông Tin'}
        </button>
      </div>

      <form className="space-y-6">
        {/* HÀNG 1: THÔNG TIN CƠ BẢN VÀ AVATAR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col items-center">
            <h2 className="text-lg font-bold border-b pb-2 w-full mb-4">Ảnh Đại Diện</h2>
            <ImageUploader 
              imageUrl={formData.avatarUrl} 
              folder="avatars" 
              onUploadSuccess={(url) => setFormData(prev => ({ ...prev, avatarUrl: url }))} 
              label=""
              className="flex flex-col items-center justify-center w-full"
            />
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-bold border-b pb-2">Thông tin Cá nhân</h2>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Họ và Tên *</label>
                <input required value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Nguyễn Văn A" />
              </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input required type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="abc@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                <input value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="0912345678" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên đăng nhập</label>
                <input disabled value={formData.username || ''} className="w-full border rounded-lg px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed" placeholder="Không có" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ngày sinh</label>
                <input type="date" value={formData.birthdate || ''} onChange={e => setFormData({...formData, birthdate: e.target.value})} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Mật khẩu {isEdit && '(Để trống nếu không muốn đổi)'}</label>
              <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border rounded-lg px-3 py-2" placeholder="Nhập mật khẩu..." />
            </div>
          </div>
        </div>

        {/* HÀNG 2: PHÂN QUYỀN VÀ XUẤT HÓA ĐƠN VAT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 text-red-600">Phân Quyền Hệ Thống</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">Vai trò (Role)</label>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border rounded-lg px-3 py-2 font-bold" disabled={role !== 'ADMIN'}>
                <option value="USER">USER (Khách hàng)</option>
                {role === 'ADMIN' && (
                  <>
                    <option value="CHEF">CHEF (Bếp trưởng)</option>
                    <option value="MANAGER">MANAGER (Quản lý chi nhánh)</option>
                    <option value="ADMIN">ADMIN (Quản trị hệ thống)</option>
                  </>
                )}
              </select>
            </div>

            {(formData.role === 'MANAGER' || formData.role === 'CHEF') && (
              <div>
                <label className="block text-sm font-medium mb-1">Thuộc Chi nhánh</label>
                <select value={formData.branchId} onChange={e => setFormData({...formData, branchId: e.target.value})} className="w-full border rounded-lg px-3 py-2" disabled={role !== 'ADMIN'}>
                  <option value="">-- Chọn Chi nhánh --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {formData.branchId === '' && <p className="text-xs text-red-500 mt-1">Vui lòng chọn chi nhánh cho vai trò này!</p>}
              </div>
            )}
          </div>


          <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
            <h2 className="text-lg font-bold border-b pb-2 text-indigo-600">Trạng Thái Tài Khoản</h2>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 opacity-70">
                <div>
                  <div className="font-bold text-sm">Đã xác minh Email</div>
                  <div className="text-xs text-gray-500">Người dùng đã bấm link xác minh email</div>
                </div>
                <input type="checkbox" disabled checked={formData.isEmailVerified} className="w-5 h-5 text-indigo-600 rounded cursor-not-allowed" />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 opacity-70">
                <div>
                  <div className="font-bold text-sm">Đã xác minh SĐT</div>
                  <div className="text-xs text-gray-500">Người dùng đã nhập OTP xác minh SĐT</div>
                </div>
                <input type="checkbox" disabled checked={formData.isPhoneVerified} className="w-5 h-5 text-indigo-600 rounded cursor-not-allowed" />
              </label>

              <label className="flex items-center justify-between p-3 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer">
                <div>
                  <div className="font-bold text-sm text-red-700">Khóa tài khoản</div>
                  <div className="text-xs text-red-500">Người dùng sẽ không thể đăng nhập nếu bị khóa</div>
                </div>
                <input type="checkbox" checked={formData.isAccountLocked} onChange={e => setFormData({...formData, isAccountLocked: e.target.checked})} className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-red-300" />
              </label>

              <label className="flex items-center justify-between p-3 border border-orange-200 bg-orange-50 rounded-lg hover:bg-orange-100 cursor-pointer">
                <div>
                  <div className="font-bold text-sm text-orange-700">Buộc đăng nhập lại (Force Relogin)</div>
                  <div className="text-xs text-orange-500">Yêu cầu người dùng này đăng nhập lại ở lần mở app tới</div>
                </div>
                <input type="checkbox" checked={formData.forceRelogin} onChange={e => setFormData({...formData, forceRelogin: e.target.checked})} className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 border-orange-300" />
              </label>
            </div>
          </div>
        </div>
      </form>

      {isEdit && initialData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="md:col-span-1 bg-white rounded-xl shadow-sm border space-y-4 p-6">
            <h2 className="text-lg font-bold border-b pb-2 text-blue-600">Thống Kê Thành Viên</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Mã Thành Viên</p>
                <p className="font-mono font-bold text-lg text-gray-900">{initialData.memberCode || 'Chưa có'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Tổng chi tiêu</p>
                <p className="font-bold text-xl text-red-600">{formatMoney(initialData.totalSpending || 0)}</p>
              </div>
              <div className="flex justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Điểm hiện tại</p>
                  <p className="font-bold text-xl text-orange-500">{initialData.currentPoints || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Điểm tích lũy (All)</p>
                  <p className="font-bold text-xl text-gray-700">{initialData.points || 0}</p>
                </div>
              </div>
              <div className="flex justify-between border-t pt-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Ngày tham gia</p>
                  <p className="font-medium text-sm text-gray-800">{initialData.createdAt ? new Date(initialData.createdAt).toLocaleDateString('vi-VN') : 'Không rõ'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Đăng nhập qua</p>
                  <p className="font-medium text-sm text-gray-800">{initialData.authProvider || 'LOCAL'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-xl shadow-sm border space-y-4">
            <div className="flex items-center gap-2 font-bold text-gray-800 p-4 border-b">
              <ShoppingBag className="text-orange-500" size={18} />
              Lịch sử 10 đơn gần nhất
            </div>
            <div className="p-0">
              {initialData.orders?.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Chưa có đơn hàng nào</div>
              ) : (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {initialData.orders?.map((order: any) => (
                    <div 
                      key={order.id} 
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-gray-800 text-sm">{order.orderCode || order.id.split('-')[0]}</span>
                          <span className="text-xs text-gray-500 ml-2">{new Date(order.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="font-black text-red-600 text-sm">{formatMoney(order.totalAmount)}</div>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                          order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {order.status}
                        </span>
                        <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{order.branch?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border space-y-4">
            <div className="flex items-center gap-2 font-bold text-gray-800 p-4 border-b">
              <MapPin className="text-blue-500" size={18} />
              Sổ địa chỉ
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {initialData.addresses?.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">Chưa có địa chỉ lưu</div>
              ) : (
                initialData.addresses?.map((addr: any) => (
                  <div key={addr.id} className="p-3 bg-gray-50 rounded-lg border relative">
                    {addr.isDefault && <span className="absolute top-2 right-2 text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded uppercase">Mặc định</span>}
                    <p className="font-bold text-sm text-gray-800 pr-12 truncate">{addr.recipientName}</p>
                    <p className="text-xs text-gray-500 mb-1">{addr.phone}</p>
                    <p className="text-xs text-gray-600">{addr.streetDetail}, {addr.ward}, {addr.district}, {addr.province}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
