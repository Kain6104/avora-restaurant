'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';
import { toast } from 'react-hot-toast';
import {
  Save,
  ArrowLeft,
  ShoppingBag,
  MapPin,
  User as UserIcon,
  Shield,
  Lock,
  RotateCcw,
  Store,
  CreditCard,
  Award,
  CheckCircle2,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import ImageUploader from '@/app/admin/components/ImageUploader';
import { AdminCard, PageHeader, FormField, StatusBadge } from '@/app/admin/components/ui';
import ChangeEmailModal from './ChangeEmailModal';
import UserRoleAssignmentsSection from './UserRoleAssignmentsSection';

interface UserFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function UserForm({ initialData, isEdit }: UserFormProps) {
  const router = useRouter();
  const { role } = useAdmin();
  const [uploading, setUploading] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    username: '',
    birthdate: '',
    role: 'USER',
    branchId: '',
    avatarUrl: '',
    isEmailVerified: false,
    isPhoneVerified: false,
    isAccountLocked: false,
    forceRelogin: false,
  });

  useEffect(() => {
    if (role === 'ADMIN') {
      fetchBranches();
    }
  }, [role]);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        branchId: initialData.branchId || '',
        username: initialData.username || '',
        birthdate: initialData.birthdate
          ? new Date(initialData.birthdate).toISOString().split('T')[0]
          : '',
        isEmailVerified: initialData.isEmailVerified || false,
        isPhoneVerified: initialData.isPhoneVerified || false,
        isAccountLocked: initialData.isAccountLocked || false,
        forceRelogin: initialData.forceRelogin || false,
      }));
    }
  }, [initialData]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      const submitData: any = {
        fullName: formData.fullName,
        phone: formData.phone || null,
        username: formData.username || null,
        birthdate: formData.birthdate ? new Date(formData.birthdate).toISOString() : null,
        avatarUrl: formData.avatarUrl || null,
        isPhoneVerified: formData.isPhoneVerified,
        isAccountLocked: formData.isAccountLocked,
        forceRelogin: formData.forceRelogin,
      };

      // Khi chỉnh sửa, KHÔNG gửi role và branchId để không đè lên hệ thống phân quyền Enterprise RBAC
      if (!isEdit) {
        submitData.role = formData.role || 'USER';
        submitData.branchId = formData.branchId || null;
      }

      // Chỉ gửi email nếu tạo mới hoặc chưa xác thực
      if (!isEdit || !formData.isEmailVerified) {
        submitData.email = formData.email;
      }

      const url = isEdit ? `/api/admin/users/${initialData.id}` : `/api/admin/users`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật tài khoản thành công' : 'Thêm tài khoản thành công');
        router.push('/admin/users');
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

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title={isEdit ? `Chi tiết: ${formData.fullName || 'Người dùng'}` : 'Thêm tài khoản mới'}
        subtitle="Quản lý thông tin định danh cá nhân, phân quyền hệ thống và trạng thái bảo mật"
        breadcrumbs={[
          { label: 'Nhân sự', href: '/admin/users' },
          { label: 'Người dùng', href: '/admin/users' },
          { label: isEdit ? 'Chỉnh sửa' : 'Tạo mới' },
        ]}
        badge={isEdit && <StatusBadge status={formData.role} size="md" />}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs transition-colors"
            >
              <ArrowLeft size={15} />
              <span>Quay lại</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <Save size={15} />
              <span>{uploading ? 'Đang lưu...' : 'Lưu tài khoản'}</span>
            </button>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Row 1: Profile Image & Basic Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div>
            <AdminCard title="Ảnh đại diện">
              <ImageUploader
                imageUrl={formData.avatarUrl}
                folder="avatars"
                onUploadSuccess={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
                label=""
                className="w-full flex flex-col items-center justify-center py-2"
              />
            </AdminCard>
          </div>

          <div className="lg:col-span-2">
            <AdminCard title="Thông tin cá nhân" icon={<UserIcon size={16} />}>
              <div className="space-y-3.5">
                <FormField label="Họ và tên" required>
                  <input
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </FormField>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Email Field with Verification Badge & OTP Change Action */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>Email đăng nhập</span>
                        {isEdit && (
                          formData.isEmailVerified ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={11} />
                              Đã xác thực
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle size={11} />
                              Chưa xác thực
                            </span>
                          )
                        )}
                      </label>
                      {isEdit && (
                        <button
                          type="button"
                          onClick={() => setIsChangeEmailModalOpen(true)}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 transition-colors"
                        >
                          <Mail size={12} />
                          <span>Đổi Email qua OTP</span>
                        </button>
                      )}
                    </div>
                    <input
                      required
                      type="email"
                      disabled={isEdit && formData.isEmailVerified}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full h-10 px-3 text-xs sm:text-sm border rounded-xl outline-none transition-all ${
                        isEdit && formData.isEmailVerified
                          ? 'bg-slate-50 border-slate-200 text-slate-500 font-medium cursor-not-allowed'
                          : 'bg-white border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                      }`}
                      placeholder="email@example.com"
                    />
                    {isEdit && formData.isEmailVerified && (
                      <p className="text-[11px] text-slate-400">
                        Email đã xác thực được khóa chỉnh sửa trực tiếp. Bấm <strong>"Đổi Email qua OTP"</strong> để đổi sang email mới.
                      </p>
                    )}
                  </div>

                  <FormField label="Số điện thoại">
                    <input
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      placeholder="0912345678"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Tên đăng nhập (Username)">
                    <input
                      disabled
                      value={formData.username || ''}
                      className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed"
                      placeholder="Chưa thiết lập"
                    />
                  </FormField>
                  <FormField label="Ngày sinh">
                    <input
                      type="date"
                      value={formData.birthdate || ''}
                      onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
                      className="w-full h-10 px-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </FormField>
                </div>

                {/* Security Note: Passwords are managed strictly by customers */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3 mt-1">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                    <Shield size={16} />
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800">Chính sách bảo mật mật khẩu tài khoản</p>
                    <p className="text-slate-500 leading-relaxed">
                      Để đảm bảo quyền riêng tư và an toàn thông tin, Quản trị viên không được phép xem hoặc chỉnh sửa mật khẩu của người dùng. Khách hàng chỉ có thể tự đặt lại mật khẩu thông qua chức năng <strong>Quên mật khẩu</strong> và xác thực OTP qua email cá nhân.
                    </p>
                  </div>
                </div>
              </div>
            </AdminCard>
          </div>
        </div>

        {/* Row 2: Account Security & RBAC Notice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
          {/* Thông báo chuẩn Enterprise RBAC */}
          <AdminCard title="Hệ thống Phân quyền Enterprise RBAC" icon={<Shield size={16} className="text-indigo-600" />}>
            <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-2">
              <div className="flex items-center gap-2 text-indigo-950 font-bold">
                <Shield size={15} className="text-indigo-600" />
                <span>Phân quyền đa vai trò & đa chi nhánh</span>
              </div>
              <p className="text-indigo-900/80 leading-relaxed">
                Hệ thống AVORA áp dụng mô hình <strong>Enterprise RBAC</strong>. Tài khoản có thể đảm nhiệm nhiều vai trò độc lập tại các chi nhánh khác nhau.
              </p>
              <p className="text-[11px] text-indigo-700/80">
                👉 Vui lòng sử dụng bảng <strong>Vai trò & Quyền hạn phân nhánh</strong> ở bên dưới để gán hoặc cập nhật quyền chính xác, không bị giới hạn bởi vai trò đơn lẻ.
              </p>
            </div>
          </AdminCard>

          {/* Trạng thái bảo mật */}
          <AdminCard title="Trạng thái tài khoản & Bảo mật" icon={<Lock size={16} />}>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl border border-rose-200 bg-rose-50/50 cursor-pointer">
                <div>
                  <p className="font-bold text-xs sm:text-sm text-rose-900">Khóa tài khoản</p>
                  <span className="text-[11px] text-rose-700">
                    Người dùng sẽ bị chặn đăng nhập trên toàn hệ thống
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isAccountLocked}
                  onChange={(e) =>
                    setFormData({ ...formData, isAccountLocked: e.target.checked })
                  }
                  className="w-4 h-4 text-rose-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/50 cursor-pointer">
                <div>
                  <p className="font-bold text-xs sm:text-sm text-amber-900">Buộc đăng nhập lại</p>
                  <span className="text-[11px] text-amber-700">
                    Thu hồi toàn bộ phiên đăng nhập hiện tại trên thiết bị
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.forceRelogin}
                  onChange={(e) => setFormData({ ...formData, forceRelogin: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded"
                />
              </label>
            </div>
          </AdminCard>
        </div>
      </form>

      {/* Row 2.5: Role & Branch Assignments (Enterprise RBAC) */}
      {isEdit && initialData?.id && (
        <UserRoleAssignmentsSection userId={initialData.id} />
      )}

      {/* Row 3: Member Stats & Order History */}
      {isEdit && initialData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          {/* Member Stats */}
          <AdminCard title="Thông tin thành viên" icon={<Award size={16} />}>
            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between pb-2 border-b border-slate-50">
                <span className="text-slate-400">Mã thành viên:</span>
                <span className="font-mono font-bold text-slate-800">
                  {initialData.memberCode || 'Chưa có'}
                </span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-50">
                <span className="text-slate-400">Tổng chi tiêu:</span>
                <span className="font-black text-red-600">
                  {formatMoney(initialData.totalSpending || 0)}
                </span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-50">
                <span className="text-slate-400">Điểm hiện có:</span>
                <span className="font-bold text-amber-600">
                  {initialData.currentPoints || 0} pts
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ngày tham gia:</span>
                <span className="font-semibold text-slate-700">
                  {initialData.createdAt
                    ? new Date(initialData.createdAt).toLocaleDateString('vi-VN')
                    : '-'}
                </span>
              </div>
            </div>
          </AdminCard>

          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <AdminCard
              title="Lịch sử đơn hàng gần nhất"
              icon={<ShoppingBag size={16} />}
              badge={
                <span className="text-xs text-slate-400">
                  {initialData.orders?.length || 0} đơn gần nhất
                </span>
              }
            >
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {!initialData.orders || initialData.orders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">
                    Chưa có lịch sử mua hàng nào.
                  </p>
                ) : (
                  initialData.orders.map((order: any) => (
                    <div
                      key={order.id}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100/80 hover:bg-red-50/40 cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {(order.orderCode || order.id.slice(0, 8)).toUpperCase()}
                          </span>
                          <StatusBadge status={order.status} size="sm" />
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(order.createdAt).toLocaleString('vi-VN')} ·{' '}
                          {order.branch?.name || '-'}
                        </span>
                      </div>
                      <span className="font-black text-xs sm:text-sm text-red-600">
                        {formatMoney(order.totalAmount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* Change Email Modal */}
      {isEdit && initialData && (
        <ChangeEmailModal
          isOpen={isChangeEmailModalOpen}
          onClose={() => setIsChangeEmailModalOpen(false)}
          userId={initialData.id}
          currentEmail={formData.email}
          onSuccess={(newEmail) => {
            setFormData((prev) => ({
              ...prev,
              email: newEmail,
              isEmailVerified: true,
            }));
          }}
        />
      )}
    </div>
  );
}
