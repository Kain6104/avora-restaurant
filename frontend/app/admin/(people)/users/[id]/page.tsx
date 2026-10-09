'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import UserForm from '../components/UserForm';
import UserFarmDetailTab from './components/UserFarmDetailTab';
import { toast } from 'react-hot-toast';
import { User, Sprout } from 'lucide-react';

export default function EditUserPage() {
  const params = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACCOUNT' | 'FARM'>('ACCOUNT');

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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-4 sm:p-6 bg-white rounded-2xl border border-slate-100 shadow-2xs animate-pulse">
        <div className="h-6 bg-slate-200/70 rounded-lg w-1/3 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-10 bg-slate-100 rounded-xl" />
          <div className="h-10 bg-slate-100 rounded-xl" />
        </div>
        <div className="h-28 bg-slate-100 rounded-xl" />
        <div className="h-10 bg-slate-200/50 rounded-xl w-32" />
      </div>
    );
  }
  if (!initialData) return <div className="p-10 text-center text-red-600">Không tìm thấy người dùng!</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Tab Bar */}
      <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('ACCOUNT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'ACCOUNT'
              ? 'bg-white text-gray-900 shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Thông Tin Tài Khoản</span>
        </button>

        <button
          onClick={() => setActiveTab('FARM')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'FARM'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Sprout className="w-4 h-4" />
          <span>🌾 Nông Trại AVORA Farm</span>
        </button>
      </div>

      {activeTab === 'ACCOUNT' ? (
        <UserForm initialData={initialData} isEdit={true} />
      ) : (
        <UserFarmDetailTab userId={params.id as string} />
      )}
    </div>
  );
}
