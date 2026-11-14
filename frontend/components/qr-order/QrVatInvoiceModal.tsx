'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Mail,
  MapPin,
} from 'lucide-react';
import { QrBottomSheet } from './QrBottomSheet';
import { QrGuest, QrSessionOrder } from './qr-types';
import toast from 'react-hot-toast';

interface QrVatInvoiceModalProps {
  isOpen: boolean;
  token: string;
  order: QrSessionOrder;
  guest: QrGuest;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Chuẩn hóa địa chỉ hành chính Việt Nam trên client tương đồng backend
 * VD: "TP. Hồ Chí Minh" -> "Thành phố Hồ Chí Minh, Việt Nam"
 */
export function normalizeVietnameseVatAddress(raw: string): string {
  if (!raw || !raw.trim()) return '';
  let addr = raw.replace(/\s+/g, ' ').trim();
  addr = addr
    .replace(/\bTP\.?\s*Hồ Chí Minh\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bTP\.?\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bTPHCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bThành phố\s*HCM\b/gi, 'Thành phố Hồ Chí Minh')
    .replace(/\bTP\.?\s+/gi, 'Thành phố ')
    .replace(/\bTp\.?\s+/gi, 'Thành phố ')
    .replace(/\bQ\.?\s*(\d+)/gi, 'Quận $1')
    .replace(/\bP\.?\s*(\d+)/gi, 'Phường $1')
    .replace(/\bP\.\s+/gi, 'Phường ')
    .replace(/\bQ\.\s+/gi, 'Quận ')
    .replace(/\bH\.\s+/gi, 'Huyện ')
    .replace(/\bTX\.\s+/gi, 'Thị xã ')
    .replace(/\bTT\.\s+/gi, 'Thị trấn ')
    .replace(/,\s*HCM\b/gi, ', Thành phố Hồ Chí Minh')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .replace(/,\s*$/, '')
    .trim();

  if (addr && !/việt nam$/i.test(addr) && !/vietnam$/i.test(addr)) {
    addr = `${addr}, Việt Nam`;
  }
  return addr;
}

export const QrVatInvoiceModal: React.FC<QrVatInvoiceModalProps> = ({
  isOpen,
  token,
  order,
  guest,
  onClose,
  onSuccess,
}) => {
  const [taxCode, setTaxCode] = useState(order.invoiceTaxCode || '');
  const [companyName, setCompanyName] = useState(order.invoiceCompanyName || '');
  const [address, setAddress] = useState(order.invoiceAddress || '');
  const [email, setEmail] = useState(order.invoiceEmail || guest.user?.email || '');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupHint, setLookupHint] = useState<{
    type: 'found' | 'manual' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTaxCode(order.invoiceTaxCode || '');
    setCompanyName(order.invoiceCompanyName || '');
    setAddress(order.invoiceAddress || '');
    setEmail(order.invoiceEmail || guest.user?.email || '');
    setLookupHint(null);
  }, [
    isOpen,
    order.invoiceTaxCode,
    order.invoiceCompanyName,
    order.invoiceAddress,
    order.invoiceEmail,
    guest.user?.email,
  ]);

  const handleLookupMst = async () => {
    const clean = taxCode.trim().replace(/\s+/g, '');
    if (!clean || clean.length < 10) {
      toast.error('Vui lòng nhập mã số thuế hợp lệ (tối thiểu 10 ký tự)');
      return;
    }

    setIsLookingUp(true);
    setLookupHint(null);
    try {
      const res = await fetch(
        `/api/qr-order/${token}/vat/lookup?mst=${encodeURIComponent(clean)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Không thể tra cứu mã số thuế');
      }
      if (data.found && data.data) {
        if (data.data.taxCode) setTaxCode(data.data.taxCode);
        if (data.data.companyName) setCompanyName(data.data.companyName);
        if (data.data.address) {
          setAddress(normalizeVietnameseVatAddress(data.data.address));
        }
        setLookupHint({
          type: 'found',
          message: 'Đã tự động điền thông tin doanh nghiệp và chuẩn hóa địa chỉ thuế.',
        });
      } else {
        setLookupHint({
          type: 'manual',
          message:
            data.message ||
            'Không tìm thấy dữ liệu trên hệ thống thuế. Quý khách vui lòng điền tay thông tin bên dưới.',
        });
      }
    } catch (err: unknown) {
      setLookupHint({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Không thể tra cứu tự động. Quý khách vui lòng nhập tay thông tin bên dưới.',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMst = taxCode.trim();
    const cleanName = companyName.trim();
    const normalizedAddr = normalizeVietnameseVatAddress(address);

    if (!cleanMst || !cleanName || !normalizedAddr) {
      toast.error('Vui lòng điền đầy đủ Mã số thuế, Tên đơn vị và Địa chỉ');
      return;
    }

    setAddress(normalizedAddr);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/qr-order/${token}/vat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxCode: cleanMst,
          companyName: cleanName,
          address: normalizedAddr,
          email: email.trim() || undefined,
          deviceSessionId: guest.deviceSessionId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Không thể gửi yêu cầu xuất hóa đơn VAT');
      }
      toast.success(json.message || 'Đã gửi yêu cầu xuất hóa đơn VAT!');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi gửi yêu cầu xuất hóa đơn VAT');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <QrBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Yêu cầu xuất hóa đơn VAT"
      subtitle={`Đơn #${order.orderCode}`}
      headerIcon={<FileText className="w-4 h-4 text-[#DA251D]" />}
      footer={
        <button
          type="submit"
          form="qr-vat-form"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-[#DA251D] hover:bg-[#b81d16] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang gửi yêu cầu...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>
                {order.isInvoiceRequested
                  ? 'Cập nhật thông tin hóa đơn VAT'
                  : 'Gửi yêu cầu xuất hóa đơn VAT'}
              </span>
            </>
          )}
        </button>
      }
    >
      <form id="qr-vat-form" onSubmit={handleSubmit} className="space-y-3.5">
        {order.isInvoiceRequested && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              Bàn đã ghi nhận thông tin xuất hóa đơn VAT. Quý khách có thể chỉnh sửa và cập nhật lại nếu cần.
            </span>
          </div>
        )}

        {/* Mã số thuế + compact Search icon-only button */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Mã số thuế (MST) <span className="text-[#DA251D]">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleLookupMst();
                }
              }}
              placeholder="Ví dụ: 0312345678 hoặc 0312345678-001"
              required
              className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white outline-none text-xs font-mono font-semibold transition-all"
            />
            <button
              type="button"
              onClick={handleLookupMst}
              disabled={isLookingUp}
              aria-label="Tra cứu nhanh bằng mã số thuế"
              title="Tra cứu MST"
              className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              {isLookingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {lookupHint && (
          <div
            className={`p-2.5 rounded-xl border flex items-start gap-2 text-[11px] leading-relaxed ${
              lookupHint.type === 'found'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : lookupHint.type === 'manual'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {lookupHint.type === 'found' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{lookupHint.message}</span>
          </div>
        )}

        {/* Tên công ty / Đơn vị */}
        <div>
          <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Tên công ty / Đơn vị <span className="text-[#DA251D]">*</span>
            </span>
          </label>
          <textarea
            rows={2}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Nhập tên đầy đủ của doanh nghiệp..."
            required
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white outline-none text-xs font-medium leading-relaxed break-words whitespace-pre-wrap resize-y transition-all"
          />
        </div>

        {/* Địa chỉ thuế — auto wrap multiline & auto normalize */}
        <div>
          <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Địa chỉ xuất hóa đơn <span className="text-[#DA251D]">*</span>
            </span>
          </label>
          <textarea
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => {
              if (address.trim()) {
                setAddress(normalizeVietnameseVatAddress(address));
              }
            }}
            placeholder="Số nhà, đường, phường/xã, Thành phố Hồ Chí Minh, Việt Nam"
            required
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white outline-none text-xs font-medium leading-relaxed break-words whitespace-pre-wrap resize-y transition-all"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            Địa chỉ tự động chuẩn hóa hành chính (VD: TP. Hồ Chí Minh → Thành phố Hồ Chí Minh, Việt Nam).
          </p>
        </div>

        {/* Email nhận hóa đơn điện tử */}
        <div>
          <label className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>Email nhận hóa đơn điện tử</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ketoan@congty.vn"
            className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#DA251D] focus:bg-white outline-none text-xs font-medium transition-all"
          />
        </div>
      </form>
    </QrBottomSheet>
  );
};

