"use client";

import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Building2,
  Search,
  CheckCircle2,
  Loader2,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { RealMember } from './PaymentModal';

interface EditCustomerVatModalProps {
  customer: RealMember;
  onClose: () => void;
  onSuccess: (updatedCustomer: RealMember) => void;
}

export const EditCustomerVatModal: React.FC<EditCustomerVatModalProps> = ({
  customer,
  onClose,
  onSuccess,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // VAT Invoice Fields (Only editable fields)
  const [taxCode, setTaxCode] = useState(customer.taxCode || '');
  const [companyName, setCompanyName] = useState(customer.companyName || '');
  const [taxAddress, setTaxAddress] = useState(customer.taxAddress || '');
  const [invoiceEmail, setInvoiceEmail] = useState(customer.invoiceEmail || '');

  const [isLookingUpTax, setIsLookingUpTax] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick lookup tax info
  const handleLookupTax = async () => {
    const cleanMst = taxCode.trim();
    if (!cleanMst || cleanMst.length < 4) {
      toast.error('Vui lòng nhập mã số thuế hợp lệ');
      return;
    }

    setIsLookingUpTax(true);
    try {
      const res = await fetch(`${baseUrl}/api/pos/tax-lookup/${encodeURIComponent(cleanMst)}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCompanyName(json.data.companyName || '');
        setTaxAddress(json.data.address || '');
        toast.success('Đã tìm thấy & chuẩn hóa thông tin doanh nghiệp!', {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        });
      } else {
        toast.error(json.message || 'Không tìm thấy thông tin công ty');
      }
    } catch (err: any) {
      toast.error('Lỗi khi tra cứu mã số thuế');
    } finally {
      setIsLookingUpTax(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        taxCode: taxCode.trim() || undefined,
        companyName: companyName.trim() || undefined,
        taxAddress: taxAddress.trim() || undefined,
        invoiceEmail: invoiceEmail.trim() || undefined,
      };

      const res = await fetch(`${baseUrl}/api/pos/members/${customer.id}/tax-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể cập nhật thông tin hóa đơn');
      }

      toast.success(`Đã cập nhật thông tin hóa đơn cho khách: ${customer.fullName}`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      onSuccess(json.data);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu thông tin hóa đơn');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-100 text-[#da251d] flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Thông tin xuất hóa đơn VAT</h3>
              <p className="text-[11px] text-gray-500">
                Chỉ cho phép sửa/thêm thông tin xuất hóa đơn cho khách hàng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Locked Information Section */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
            <div className="flex items-center gap-1.5 text-gray-500 font-bold text-[11px]">
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span>Thông tin tài khoản (Cố định, không được sửa):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-gray-400 block">Họ và tên:</span>
                <span className="font-bold text-gray-800">{customer.fullName}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Số điện thoại:</span>
                <span className="font-mono font-bold text-gray-800">{customer.phone || 'Chưa SĐT'}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Mã thành viên:</span>
                <span className="font-mono font-bold text-amber-700">{customer.memberCode || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Hạng thành viên:</span>
                <span className="font-bold text-gray-800">{customer.membershipTier?.name || 'Thành viên'}</span>
              </div>
            </div>
          </div>

          {/* Editable VAT Invoice Section */}
          <div className="p-3.5 bg-red-50/40 rounded-xl border border-red-200/80 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs">
              <Building2 className="w-4 h-4 text-[#da251d]" />
              <span>Thông tin xuất hóa đơn VAT doanh nghiệp:</span>
            </div>

            {/* MST with quick lookup */}
            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Mã số thuế doanh nghiệp (MST):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  placeholder="Nhập MST (VD: 0300588569)..."
                  className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-mono font-bold"
                />
                <button
                  type="button"
                  disabled={isLookingUpTax || !taxCode.trim()}
                  onClick={handleLookupTax}
                  className="px-3 py-1.5 bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  {isLookingUpTax ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Tra cứu MST</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Tên công ty / Đơn vị (trên DKKD):
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Tên công ty trên đăng ký kinh doanh..."
                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Địa chỉ công ty (trên hóa đơn):
              </label>
              <input
                type="text"
                value={taxAddress}
                onChange={(e) => setTaxAddress(e.target.value)}
                placeholder="Địa chỉ xuất hóa đơn..."
                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-1">
                Email nhận hóa đơn điện tử:
              </label>
              <input
                type="email"
                value={invoiceEmail}
                onChange={(e) => setInvoiceEmail(e.target.value)}
                placeholder="ketoan@congty.com..."
                className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg outline-none focus:border-[#da251d] text-xs font-medium"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-semibold transition-colors text-xs cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#da251d] hover:bg-[#b81d16] disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold transition-all shadow-xs text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Lưu thông tin hóa đơn</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
