"use client";

import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  Search,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useModalZIndex } from '@/lib/modal-stack';

interface CreateCustomerModalProps {
  onClose: () => void;
  onSuccess: (member: any) => void;
  isDarkMode?: boolean;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  onClose,
  onSuccess,
  isDarkMode = false,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const modalZIndex = useModalZIndex(true, 110);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Invoice Fields
  const [hasInvoice, setHasInvoice] = useState(false);
  const [taxCode, setTaxCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');

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
        toast.success('Đã tìm thấy thông tin doanh nghiệp!', {
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
    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      toast.error('Vui lòng nhập họ tên khách hàng');
      return;
    }
    if (!cleanPhone) {
      toast.error('Vui lòng nhập số điện thoại');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        fullName: cleanName,
        phone: cleanPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
      };

      if (hasInvoice) {
        payload.taxCode = taxCode.trim() || undefined;
        payload.companyName = companyName.trim() || undefined;
        payload.taxAddress = taxAddress.trim() || undefined;
        payload.invoiceEmail = invoiceEmail.trim() || undefined;
      }

      const res = await fetch(`${baseUrl}/api/pos/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Không thể tạo khách hàng');
      }

      toast.success(`Đã thêm khách hàng: ${cleanName}`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });
      onSuccess(json.data);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu khách hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150 select-none"
      style={{ zIndex: modalZIndex }}
    >
      <div className={`rounded-t-3xl sm:rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[92vh] animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
        isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-200 text-gray-900'
      }`}>
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-gray-50/80 border-gray-100'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Thêm khách hàng mới</h3>
              <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Tạo tài khoản thành viên tích điểm & thông tin hóa đơn</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Họ và tên khách hàng: <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A..."
                  className={`w-full pl-8 pr-3 py-2 rounded-xl outline-none text-xs font-medium border ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block font-bold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Số điện thoại: <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678..."
                  className={`w-full pl-8 pr-3 py-2 rounded-xl outline-none text-xs font-mono font-medium border ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Email:</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="khachhang@gmail.com..."
                  className={`w-full pl-8 pr-3 py-2 rounded-xl outline-none text-xs font-medium border ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Địa chỉ giao hàng:</label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, phường, quận..."
                  className={`w-full pl-8 pr-3 py-2 rounded-xl outline-none text-xs font-medium border ${
                    isDarkMode
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:bg-white'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Toggle Invoice VAT Info */}
          <div className={`pt-2 border-t ${isDarkMode ? 'border-slate-750' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <label className={`font-bold flex items-center gap-1.5 cursor-pointer ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <Building2 className="w-4 h-4 text-blue-500" />
                <span>Thông tin xuất hóa đơn VAT</span>
              </label>
              <button
                type="button"
                onClick={() => setHasInvoice(!hasInvoice)}
                className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  hasInvoice ? 'bg-blue-600' : isDarkMode ? 'bg-slate-700' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    hasInvoice ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {hasInvoice && (
              <div className={`p-3 rounded-xl border space-y-2.5 animate-in fade-in duration-150 ${
                isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-blue-50/50 border-blue-100'
              }`}>
                {/* MST with quick lookup */}
                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Mã số thuế doanh nghiệp:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      placeholder="Nhập MST (VD: 0300588569)..."
                      className={`flex-1 px-3 py-1.5 rounded-lg outline-none text-xs font-mono font-bold border ${
                        isDarkMode
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                      }`}
                    />
                    <button
                      type="button"
                      disabled={isLookingUpTax || !taxCode.trim()}
                      onClick={handleLookupTax}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-xs min-w-[34px]"
                      title="Tra cứu mã số thuế"
                    >
                      {isLookingUpTax ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Tên công ty / Đơn vị:</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Tên công ty trên đăng ký kinh doanh..."
                    className={`w-full px-3 py-1.5 rounded-lg outline-none text-xs font-medium border ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Địa chỉ công ty (trên hóa đơn):</label>
                  <input
                    type="text"
                    value={taxAddress}
                    onChange={(e) => setTaxAddress(e.target.value)}
                    placeholder="Địa chỉ xuất hóa đơn..."
                    className={`w-full px-3 py-1.5 rounded-lg outline-none text-xs font-medium border ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Email nhận hóa đơn:</label>
                  <input
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="ketoan@congty.com..."
                    className={`w-full px-3 py-1.5 rounded-lg outline-none text-xs font-medium border ${
                      isDarkMode
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:border-blue-500'
                        : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer inside form */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors text-xs cursor-pointer ${
                isDarkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !fullName.trim() || !phone.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold transition-all shadow-xs text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Lưu & Chọn khách hàng</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
