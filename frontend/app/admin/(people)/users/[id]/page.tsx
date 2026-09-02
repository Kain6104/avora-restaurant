'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import UserForm from '../components/UserForm';
import { toast } from 'react-hot-toast';

export default function EditUserPage() {
  const params = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/admin/users/${params.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setInitialData(data.data);
        } else {
          toast.error('Lỗi tải thông tin người dùng');
        }
      } catch (e) {
        toast.error('Lỗi kết nối');
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchUser();
  }, [params.id]);

  if (loading) return <div className="p-10 text-center">Đang tải dữ liệu...</div>;
  if (!initialData) return <div className="p-10 text-center text-red-600">Không tìm thấy người dùng!</div>;

  return <UserForm initialData={initialData} isEdit={true} />;
}
