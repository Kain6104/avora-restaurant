'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Loader2, AlertTriangle, CheckCircle2, ReceiptText } from 'lucide-react';
import toast from 'react-hot-toast';

interface VATInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: {
    taxCode: string;
    companyName: string;
    address: string;
    email: string;
  } | null;
}

/**
 * Tự động chuẩn hóa địa chỉ thuế:
 * - Thay thế các viết tắt "TP", "TP.", "Tp", "Tp.", "TP.HCM" thành "Thành phố..."
 * - Tự động thêm ", Việt Nam" vào cuối địa chỉ nếu chưa có
 */
export function formatTaxAddress(rawAddress: string): string {
  if (!rawAddress) return '';
  let str = rawAddress.trim();

  // Chuẩn hóa tên thành phố
  str = str.replace(/\b(T\.?P\.?|Tp\.?)\s+/gi, 'Thành phố ');
  str = str.replace(/\bTP\.HCM\b/gi, 'Thành phố Hồ Chí Minh');
  str = str.replace(/\bTPHCM\b/gi, 'Thành phố Hồ Chí Minh');
  str = str.replace(/\bTPHN\b/gi, 'Thành phố Hà Nội');
  str = str.replace(/\bTP\.HN\b/gi, 'Thành phố Hà Nội');

  // Bỏ dấu phẩy thừa ở cuối
  str = str.replace(/[\s,]+$/, '');

  // Thêm ", Việt Nam" nếu chưa có
  if (!/Việt\s*Nam$/i.test(str)) {
    str += ', Việt Nam';
  }

  return str;
}

export default function VATInvoiceModal({ isOpen, onClose, onSave, initialData }: VATInvoiceModalProps) {
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || '');
  const [companyName, setCompanyName] = useState(initialData?.companyName || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const taxCodeRef = useRef<HTMLInputElement>(null);
  const companyNameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleLookup = async () => {
    if (!taxCode.trim()) {
      setErrors((prev) => ({ ...prev, taxCode: true }));
      taxCodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      taxCodeRef.current?.focus();
      toast.error('Vui lòng nhập Mã số thuế để tra cứu');
      return;
    }
    setErrors((prev) => ({ ...prev, taxCode: false }));
    setIsLookingUp(true);
    setLookupSuccess(false);
    try {
      const res = await fetch(`https://api.vietqr.io/v2/business/${encodeURIComponent(taxCode.trim())}`);
      const data = await res.json();
      if (data.code === "00" && data.data) {
        setCompanyName(data.data.name || '');
        const formattedAddr = formatTaxAddress(data.data.address || '');
        setAddress(formattedAddr);
        setLookupSuccess(true);
        setErrors({});
        toast.success("Tra cứu thông tin doanh nghiệp thành công");
      } else {
        toast.error("Không tìm thấy thông tin cho mã số thuế này");
      }
    } catch (e) {
      toast.error("Lỗi kết nối khi tra cứu MST");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSave = () => {
    const newErrors: Record<string, boolean> = {};

    if (!taxCode.trim()) newErrors.taxCode = true;
    if (!companyName.trim()) newErrors.companyName = true;
    if (!address.trim()) newErrors.address = true;
    if (!email.trim() || !email.includes('@')) newErrors.email = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      // Cuộn xuống ô đầu tiên bị thiếu và focus
      if (newErrors.taxCode) {
        taxCodeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        taxCodeRef.current?.focus();
      } else if (newErrors.companyName) {
        companyNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        companyNameRef.current?.focus();
      } else if (newErrors.address) {
        addressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        addressRef.current?.focus();
      } else if (newErrors.email) {
        emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        emailRef.current?.focus();
      }

      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc có dấu (*)');
      return;
    }

    const cleanAddress = formatTaxAddress(address);
    onSave({
      taxCode: taxCode.trim(),
      companyName: companyName.trim(),
      address: cleanAddress,
      email: email.trim(),
    });
    toast.success('Đã lưu thông tin hóa đơn VAT');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden my-auto max-h-[90vh]">
        
        {/* Header với Icon Hóa Đơn */}
        <div className="bg-[#da251d] p-4 sm:p-5 flex items-center justify-between text-white shrink-0 shadow-sm">
          <h2 className="text-base sm:text-lg font-black flex items-center gap-2.5 tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
              <ReceiptText size={18} />
            </div>
            <span>Thông Tin Xuất Hóa Đơn VAT</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Warning banner */}
          <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-2xl flex items-start gap-2.5">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed font-medium">
              Vui lòng kiểm tra kỹ Mã số thuế và Địa chỉ trước khi lưu. Hóa đơn điện tử sẽ được phát hành sau khi đơn hàng giao thành công.
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {/* Mã số thuế */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mã số thuế <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  ref={taxCodeRef}
                  type="text"
                  value={taxCode}
                  onChange={(e) => {
                    setTaxCode(e.target.value.toUpperCase());
                    if (errors.taxCode) setErrors((prev) => ({ ...prev, taxCode: false }));
                  }}
                  placeholder="Nhập mã số thuế công ty"
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all outline-none uppercase ${
                    errors.taxCode
                      ? 'border-red-500 bg-red-50/50 ring-2 ring-red-100'
                      : 'border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={isLookingUp}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                >
                  {isLookingUp ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  <span>Tra cứu</span>
                </button>
              </div>
              {errors.taxCode && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">Vui lòng nhập mã số thuế</p>
              )}
              {lookupSuccess && (
                <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                  <CheckCircle2 size={13} />
                  Đã tự động lấy dữ liệu từ Tổng cục Thuế
                </p>
              )}
            </div>

            {/* Tên công ty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên công ty / Đơn vị <span className="text-red-500">*</span>
              </label>
              <input
                ref={companyNameRef}
                type="text"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (errors.companyName) setErrors((prev) => ({ ...prev, companyName: false }));
                }}
                placeholder="Nhập tên doanh nghiệp đầy đủ"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all outline-none ${
                  errors.companyName
                    ? 'border-red-500 bg-red-50/50 ring-2 ring-red-100'
                    : 'border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                }`}
              />
              {errors.companyName && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">Vui lòng nhập tên công ty</p>
              )}
            </div>

            {/* Địa chỉ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Địa chỉ đăng ký kinh doanh <span className="text-red-500">*</span>
              </label>
              <textarea
                ref={addressRef}
                rows={2}
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  if (errors.address) setErrors((prev) => ({ ...prev, address: false }));
                }}
                onBlur={() => {
                  if (address) setAddress(formatTaxAddress(address));
                }}
                placeholder="Địa chỉ theo GPKD (tự động chuẩn hóa Thành phố & Việt Nam)"
                className={`w-full px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all outline-none resize-none ${
                  errors.address
                    ? 'border-red-500 bg-red-50/50 ring-2 ring-red-100'
                    : 'border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                }`}
              />
              {errors.address && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">Vui lòng nhập địa chỉ công ty</p>
              )}
            </div>

            {/* Email nhận hóa đơn */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email nhận hóa đơn điện tử <span className="text-red-500">*</span>
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all outline-none ${
                  errors.email
                    ? 'border-red-500 bg-red-50/50 ring-2 ring-red-100'
                    : 'border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                }`}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: false }));
                }} 
                placeholder="Ví dụ: ketoan@congty.com" 
              />
              {errors.email && (
                <p className="text-[11px] text-red-600 font-semibold mt-1">Vui lòng nhập địa chỉ email hợp lệ</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5 rounded-b-3xl shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-xs cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button 
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#da251d] hover:bg-[#b91c2c] transition-all shadow-md active:scale-95 text-xs cursor-pointer"
          >
            Xác nhận lưu
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
