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

  if (loading) return <div className="p-10 text-center">Đang tải dữ liệu...</div>;
  if (!initialData) return <div className="p-10 text-center text-red-600">Không tìm thấy món ăn!</div>;

  return <ProductForm initialData={initialData} isEdit={true} />;
}
