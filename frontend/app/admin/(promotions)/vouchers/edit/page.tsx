'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import VoucherForm from '../components/VoucherForm';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function EditVoucherQueryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');

  const [voucher, setVoucher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Thiếu tham số mã ID của voucher cần chỉnh sửa');
      setLoading(false);
      return;
    }

    const fetchVoucher = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/promotions/vouchers/${id}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok && data?.data) {
          setVoucher(data.data);
        } else {
          setError(data?.message || 'Không tìm thấy thông tin Voucher');
        }
      } catch (err) {
        setError('Lỗi khi tải thông tin Voucher');
      } finally {
        setLoading(false);
      }
    };

    fetchVoucher();
  }, [id]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
        <p className="text-sm font-medium">Đang tải dữ liệu Voucher...</p>
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">Không thể tải Voucher</h2>
        <p className="text-sm text-slate-500 mb-4">{error || 'Vui lòng cung cấp mã ID voucher hợp lệ.'}</p>
        <Link
          href="/admin/vouchers"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Quay lại danh sách</span>
        </Link>
      </div>
    );
  }

  return <VoucherForm initialData={voucher} isEdit={true} />;
}

export default function EditVoucherPage() {
  return (
    <Suspense fallback={
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-2" />
        <p className="text-sm font-medium">Đang tải...</p>
      </div>
    }>
      <EditVoucherQueryContent />
    </Suspense>
  );
}
