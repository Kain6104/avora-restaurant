import React from 'react';
import type { Metadata } from 'next';
import VoucherForm from '../components/VoucherForm';

export const metadata: Metadata = {
  title: 'Tạo Mới Mã Ưu Đãi (Voucher) | AVORA Admin',
  description: 'Tạo mới mã giảm giá, voucher freeship và cấu hình hạn ngạch khuyến mãi cho hệ thống nhà hàng Avora.',
};

export default function CreateVoucherPage() {
  return <VoucherForm isEdit={false} />;
}
