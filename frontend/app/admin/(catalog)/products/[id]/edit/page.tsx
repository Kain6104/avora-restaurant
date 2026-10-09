'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ProductForm from '../../components/ProductForm';
import { toast } from 'react-hot-toast';

export default function EditProductPage() {
  const params = useParams();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/admin/products/${params.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setInitialData(data.data);
        } else {
          toast.error('Lỗi tải thông tin món ăn');
        }
      } catch (e) {
        toast.error('Lỗi kết nối');
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchProduct();
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
  if (!initialData) return <div className="p-10 text-center text-red-600">Không tìm thấy món ăn!</div>;

  return <ProductForm initialData={initialData} isEdit={true} />;
}
