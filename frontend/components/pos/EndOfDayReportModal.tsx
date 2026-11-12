"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Printer,
  Calendar,
  Clock,
  Store,
  DollarSign,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ShoppingBag,
  HelpCircle,
  FileSpreadsheet,
  Info,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  formatVND,
  formatVietnamDateTime,
  getPresetDateRange,
  EndOfDayPreset,
  getVietnamNow,
} from '@/lib/utils/vietnam-time';
import {
  EndOfDayThermalReceipt,
  EndOfDayReportData,
} from './EndOfDayThermalReceipt';
import { printAgent } from '@/lib/print-agent';
import { platformBridge } from '@/lib/platform/platform-bridge';

interface BranchOption {
  id: string;
  name: string;
  branchCode: string;
}

interface EndOfDayReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: BranchOption | null;
  branches: BranchOption[];
  canSwitchBranch?: boolean;
  activeShiftOpenedAt?: Date | string | null;
  activeShiftId?: string | null;
  currentCashierId?: string | null;
  currentCashierName?: string | null;
  isDarkMode?: boolean;
}

export const EndOfDayReportModal: React.FC<EndOfDayReportModalProps> = ({
  isOpen,
  onClose,
  currentBranch,
  branches,
  canSwitchBranch = false,
  activeShiftOpenedAt,
  activeShiftId,
  currentCashierId,
  currentCashierName,
  isDarkMode = false,
}) => {
  // Preset lựa chọn nhanh
  const [preset, setPreset] = useState<EndOfDayPreset>('CURRENT_SHIFT');

  // Khoảng thời gian (Giờ Việt Nam YYYY-MM-DDTHH:mm)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAllowedDate, setMinAllowedDate] = useState('');
  const [maxAllowedDate, setMaxAllowedDate] = useState('');

  // Bộ lọc
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentBranch?.id || 'ALL',
  );
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'POS' | 'ONLINE'>('ALL');
  const [showItemDetails, setShowItemDetails] = useState(false);

  // Dữ liệu & Trạng thái tải
  const [data, setData] = useState<EndOfDayReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Khởi tạo thời gian ban đầu khi mở modal
  useEffect(() => {
    if (isOpen) {
      const initialPreset = activeShiftOpenedAt ? 'CURRENT_SHIFT' : 'TODAY';
      setPreset(initialPreset);
      const range = getPresetDateRange(initialPreset, activeShiftOpenedAt);
      setFromDate(range.from);
      setToDate(range.to);
      setMinAllowedDate(range.minAllowed);
      setMaxAllowedDate(range.maxAllowed);
      if (currentBranch?.id) {
        setSelectedBranchId(currentBranch.id);
      }
    }
  }, [isOpen, activeShiftOpenedAt, currentBranch?.id]);

  // Đổi preset nhanh
  const handleSelectPreset = (newPreset: EndOfDayPreset) => {
    setPreset(newPreset);
    if (newPreset !== 'CUSTOM') {
      const range = getPresetDateRange(newPreset, activeShiftOpenedAt);
      setFromDate(range.from);
      setToDate(range.to);
      setMinAllowedDate(range.minAllowed);
      setMaxAllowedDate(range.maxAllowed);
    }
  };

  // Tải dữ liệu báo cáo từ Backend
  const fetchReport = useCallback(async () => {
    if (!fromDate || !toDate) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      params.set('from', fromDate);
      params.set('to', toDate);
      if (selectedBranchId && selectedBranchId !== 'ALL') {
        params.set('branchId', selectedBranchId);
      }
      if (sourceFilter !== 'ALL') {
        params.set('source', sourceFilter);
      }
      if (showItemDetails) {
        params.set('includeItemDetails', 'true');
      }
      if (preset === 'CURRENT_SHIFT' && activeShiftId) {
        params.set('shiftId', activeShiftId);
      }

      const res = await fetch(`/api/admin/reports/end-of-day?${params.toString()}`, {
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        const msg =
          json.error?.message ||
          json.message ||
          'Không thể lấy dữ liệu báo cáo tổng kết cuối ngày.';
        setErrorMessage(msg);
        setData(null);
        return;
      }

      setData(json.data);
    } catch (err: any) {
      console.error('Error fetching end of day report:', err);
      setErrorMessage(
        'Lỗi kết nối máy chủ khi tải báo cáo. Vui lòng kiểm tra lại đường truyền.',
      );
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, selectedBranchId, sourceFilter, showItemDetails, preset, activeShiftId]);

  // Tự động tải khi mở modal hoặc thay đổi các tiêu chí lọc
  useEffect(() => {
    if (isOpen && fromDate && toDate) {
      fetchReport();
    }
  }, [isOpen, fromDate, toDate, selectedBranchId, sourceFilter, showItemDetails, fetchReport]);

  // Kích hoạt In Báo Cáo 80mm
  const handlePrint = async () => {
    if (!data) {
      toast.error('Chưa có dữ liệu báo cáo để in');
      return;
    }

    setIsPrinting(true);

    try {
      const receiptElement = document.getElementById('avora-thermal-receipt-80mm');
      if (!receiptElement) {
        throw new Error('Không tìm thấy mẫu in nhiệt');
      }

      const receiptHtml = receiptElement.outerHTML;

      // Ưu tiên in qua PrintAgent (nếu trên Desktop Windows hoặc có Agent local)
      if (platformBridge.isDesktop) {
        try {
          await printAgent.printHtml({
            printerName: '',
            htmlContent: receiptHtml,
            paperSize: '80mm',
            copies: 1,
            idempotencyKey: `eod-${Date.now()}`,
          });
          toast.success('Đã gửi lệnh in báo cáo kết ca tới máy in nhiệt!');
          setIsPrinting(false);
          return;
        } catch (desktopErr) {
          console.warn('Desktop printAgent error, falling back to browser print:', desktopErr);
        }
      }

      // In trên trình duyệt Web qua hidden iframe
      let iframe = document.getElementById('avora-eod-print-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'avora-eod-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '80mm';
        iframe.style.height = '0';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Báo Cáo Tổng Kết Cuối Ngày</title>
              <style>
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 2mm 0;
                  background: #fff;
                  color: #000;
                  font-family: monospace;
                  -webkit-print-color-adjust: exact;
                }
              </style>
            </head>
            <body>
              ${receiptHtml}
              <script>
                window.onload = function() {
                  window.focus();
                  window.print();
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
      }

      toast.success('Đang mở hộp thoại in báo cáo...');
    } catch (err: any) {
      console.error('Error printing EOD receipt:', err);
      toast.error('Lỗi in báo cáo: ' + (err.message || 'Không xác định'));
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 select-none ${
      isDarkMode ? 'dark bg-slate-950/80' : 'bg-slate-900/60'
    }`}>
      <div className={`rounded-t-3xl sm:rounded-3xl shadow-2xl border max-w-5xl w-full h-[92dvh] sm:h-[95vh] max-h-[950px] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200 sm:animate-in sm:zoom-in-95 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2 sm:hidden shrink-0" />

        {/* =========================================================================
            1. MODAL HEADER: ĐỎ AVORA #DA251D ĐẶC TRƯNG
            ========================================================================= */}
        <div className="bg-[#da251d] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shadow-inner">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide uppercase leading-tight">
                TỔNG KẾT CUỐI NGÀY / KẾT CA
              </h2>
              <p className="text-[11px] sm:text-xs text-red-100 font-medium leading-none mt-0.5">
                Xem trước doanh thu thực tế & In phiếu kết ca chuẩn 80mm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút IN BÁO CÁO trên Header (Nổi bật) */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!data || isLoading || isPrinting}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white hover:bg-red-50 text-[#da251d] font-black rounded-xl text-xs sm:text-sm shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4 text-[#da251d]" />
              <span className="hidden sm:inline">IN BÁO CÁO (XP-80C)</span>
              <span className="sm:hidden">IN</span>
            </button>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng modal"
              className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. STICKY FILTER BAR: CÁC TIÊU CHÍ LỌC THỜI GIAN & CHI NHÁNH
            ========================================================================= */}
        <div className={`p-3 sm:p-4 border-b shrink-0 space-y-3 ${
          isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
        }`}>
          {/* Hàng 1: Preset Buttons Nhanh */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-bold mr-1 hidden sm:inline ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Mốc thời gian:
            </span>
            <button
              type="button"
              onClick={() => handleSelectPreset('CURRENT_SHIFT')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'CURRENT_SHIFT'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              Ca hiện tại
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'TODAY'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'YESTERDAY'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              Hôm qua
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('LAST_7_DAYS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'LAST_7_DAYS'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              7 ngày gần nhất
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === 'CUSTOM'
                  ? 'bg-[#da251d] text-white shadow-xs'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              Lựa chọn khác
            </button>

            {/* Nút Làm mới dữ liệu */}
            <button
              type="button"
              onClick={fetchReport}
              disabled={isLoading}
              title="Tải lại số liệu mới nhất"
              className={`ml-auto p-1.5 border rounded-xl transition-colors cursor-pointer disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
                  : 'bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Hàng 2: Date & Time Picker + Chi Nhánh + Nguồn Đơn + Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center">
            {/* Từ ngày giờ */}
            <div className="space-y-1">
              <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Từ thời điểm:</span>
              </label>
              <input
                type="datetime-local"
                value={fromDate}
                min={minAllowedDate}
                max={maxAllowedDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPreset('CUSTOM');
                }}
                className={`w-full text-xs font-bold font-mono rounded-xl px-2.5 py-1.5 outline-none shadow-2xs border ${
                  isDarkMode
                    ? 'bg-slate-800 text-white border-slate-700 focus:border-[#da251d] [color-scheme:dark]'
                    : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                }`}
              />
            </div>

            {/* Đến ngày giờ */}
            <div className="space-y-1">
              <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Đến thời điểm:</span>
              </label>
              <input
                type="datetime-local"
                value={toDate}
                min={minAllowedDate}
                max={maxAllowedDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPreset('CUSTOM');
                }}
                className={`w-full text-xs font-bold font-mono rounded-xl px-2.5 py-1.5 outline-none shadow-2xs border ${
                  isDarkMode
                    ? 'bg-slate-800 text-white border-slate-700 focus:border-[#da251d] [color-scheme:dark]'
                    : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                }`}
              />
            </div>

            {/* Chi nhánh */}
            <div className="space-y-1">
              <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Store className="w-3 h-3 text-slate-400" />
                <span>Chi nhánh:</span>
              </label>
              <select
                disabled={!canSwitchBranch}
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className={`w-full text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none shadow-2xs border ${
                  isDarkMode
                    ? 'bg-slate-800 text-white border-slate-700 focus:border-[#da251d]'
                    : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                } ${
                  !canSwitchBranch ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {canSwitchBranch && <option value="ALL">Tất cả chi nhánh</option>}
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className={isDarkMode ? 'bg-slate-800 text-white' : ''}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Nguồn đơn & Toggle chi tiết */}
            <div className="flex items-center gap-2 pt-4 sm:pt-0">
              <div className="flex-1 space-y-1">
                <label className={`text-[11px] font-bold uppercase tracking-wider ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Nguồn đơn:
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as any)}
                  className={`w-full text-xs font-bold rounded-xl px-2 py-1.5 outline-none shadow-2xs cursor-pointer border ${
                    isDarkMode
                      ? 'bg-slate-800 text-white border-slate-700 focus:border-[#da251d]'
                      : 'bg-white text-slate-900 border-slate-300 focus:border-[#da251d]'
                  }`}
                >
                  <option value="ALL" className={isDarkMode ? 'bg-slate-800 text-white' : ''}>Tất cả nguồn</option>
                  <option value="POS" className={isDarkMode ? 'bg-slate-800 text-white' : ''}>Tại quán (POS)</option>
                  <option value="ONLINE" className={isDarkMode ? 'bg-slate-800 text-white' : ''}>Đặt Online</option>
                </select>
              </div>

              {/* Toggle chi tiết món */}
              <div className="pt-4 shrink-0">
                <label
                  className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none ${
                    isDarkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                  title="Hiển thị chi tiết từng món ăn bán ra"
                >
                  <input
                    type="checkbox"
                    checked={showItemDetails}
                    onChange={(e) => setShowItemDetails(e.target.checked)}
                    className="w-4 h-4 text-[#da251d] rounded border-slate-300 focus:ring-[#da251d] cursor-pointer"
                  />
                  <span className="hidden xl:inline text-[11px]">Chi tiết món</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. MAIN CONTENT: CUỘN NỘI BỘ, KHÔNG LÀM TOÀN TRANG BỊ SCROLL
            ========================================================================= */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar ${
          isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'
        }`}>
          {/* Lỗi thông báo nếu có */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cảnh báo ca mở kéo dài hơn 24 giờ */}
          {preset === 'CURRENT_SHIFT' && activeShiftOpenedAt && new Date().getTime() - new Date(activeShiftOpenedAt).getTime() > 24 * 60 * 60 * 1000 && (
            <div className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 ${
              isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Ca làm việc này đã mở hơn 24 giờ (từ {formatVietnamDateTime(activeShiftOpenedAt)}). Bạn có thể kiểm tra dữ liệu và bấm <strong>Kết ca</strong> tại màn hình POS để chốt ca cũ và mở ca mới cho hôm nay.
              </span>
            </div>
          )}

          {/* Loading Skeleton nhẹ khi đang tải dữ liệu */}
          {isLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-24 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`h-64 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                <div className={`h-64 rounded-2xl ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
              </div>
            </div>
          )}

          {/* Nội dung báo cáo khi đã có dữ liệu */}
          {!isLoading && data && (
            <>
              {/* KHỐI 1: KPI CARDS ĐẦU BÁO CÁO */}
              <div>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  <DollarSign className="w-4 h-4 text-[#da251d]" />
                  <span>Chỉ số tài chính trọng yếu</span>
                </h3>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* KPI 1: TỔNG THỰC THU (Nổi bật nhất) */}
                  <div className={`col-span-2 sm:col-span-1 p-4 rounded-2xl border shadow-xs ${
                    isDarkMode
                      ? 'bg-gradient-to-br from-red-950/40 to-slate-850 border-red-900/60'
                      : 'bg-gradient-to-br from-red-50 to-orange-50/60 border-red-200'
                  }`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-500">
                      TỔNG THỰC THU
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-[#da251d] dark:text-red-400 mt-1">
                      {formatVND(data.summary.totalActualCollected)}
                    </p>
                    <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Số tiền thực thu sau khi trừ hoàn tiền (Refund)
                    </p>
                  </div>

                  {/* KPI 2: TỔNG ĐƠN HOÀN THÀNH */}
                  <div className={`p-4 rounded-2xl border shadow-2xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      ĐƠN HOÀN THÀNH
                    </p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {data.summary.completedOrderCount}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">đơn</span>
                    </div>
                    {data.summary.cancelledOrderCount > 0 && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        Đơn hủy: {data.summary.cancelledOrderCount} (tham khảo)
                      </p>
                    )}
                  </div>

                  {/* KPI 3: TỔNG THUẾ VAT */}
                  <div className={`p-4 rounded-2xl border shadow-2xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      TỔNG THUẾ VAT
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-indigo-500 dark:text-indigo-400 mt-1">
                      {formatVND(data.summary.totalVat)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Thuế VAT thực tế từ snapshot đơn
                    </p>
                  </div>

                  {/* KPI 4: DOANH THU RÒNG */}
                  <div className={`p-4 rounded-2xl border shadow-2xs ${
                    isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      DOANH THU RÒNG
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatVND(data.summary.netSales)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Sau khi trừ chiết khấu & VAT
                    </p>
                  </div>
                </div>

                {/* Hàng KPI phụ: Doanh thu gộp, Giảm giá, Phí ship, Phụ thu */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5 text-xs">
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Doanh thu gộp:</span>
                    <p className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {formatVND(data.summary.totalGrossSales)}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Tổng giảm giá:</span>
                    <p className="font-bold text-rose-500 dark:text-rose-400">
                      {formatVND(data.summary.totalDiscount)}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Phí giao hàng:</span>
                    <p className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                      {formatVND(data.summary.shippingFeeCustomerPaid)}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className={isDarkMode ? 'text-slate-400 font-medium' : 'text-slate-500 font-medium'}>Hoàn tiền (Refund):</span>
                    <p className="font-bold text-amber-500 dark:text-amber-400">
                      {formatVND(data.summary.refundTotal)}
                    </p>
                  </div>
                </div>
              </div>

              {/* KHỐI 2: PHƯƠNG THỨC THANH TOÁN & RECONCILIATION */}
              <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs space-y-3 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 ${
                  isDarkMode ? 'border-slate-700' : 'border-slate-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                      💳
                    </div>
                    <h4 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      PHƯƠNG THỨC THANH TOÁN
                    </h4>
                  </div>

                  {/* Trạng thái Đối soát (Reconciliation) */}
                  {data.reconciliation.valid ? (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      isDarkMode
                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    }`}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Khớp 100% với thực thu</span>
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      isDarkMode
                        ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                        : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        Chênh lệch: {formatVND(data.reconciliation.difference)}
                      </span>
                    </span>
                  )}
                </div>

                {/* Cảnh báo nếu có sai lệch đối soát */}
                {data.reconciliation.warnings.length > 0 && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                    isDarkMode ? 'bg-amber-950/40 border-amber-800 text-amber-300' : 'bg-amber-50/80 border-amber-200 text-amber-900'
                  }`}>
                    {data.reconciliation.warnings.map((w, idx) => (
                      <p key={idx} className="font-medium">
                        ⚠️ {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Bảng kê chi tiết phương thức */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className={`text-[11px] font-bold uppercase border-y ${
                      isDarkMode
                        ? 'text-slate-400 bg-slate-850 border-slate-700'
                        : 'text-slate-400 bg-slate-50 border-slate-100'
                    }`}>
                      <tr>
                        <th className="py-2 px-3">Phương thức</th>
                        <th className="py-2 px-3 text-center">Số giao dịch</th>
                        <th className="py-2 px-3 text-right">Tổng tiền</th>
                        <th className="py-2 px-3 text-right">Hoàn trả</th>
                        <th className="py-2 px-3 text-right">Thực thu</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-medium ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {data.payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                            Chưa có dữ liệu thanh toán trong khoảng thời gian này
                          </td>
                        </tr>
                      ) : (
                        data.payments.map((p) => (
                          <tr key={p.method} className={isDarkMode ? 'hover:bg-slate-750' : 'hover:bg-slate-50/70'}>
                            <td className={`py-2.5 px-3 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {p.label}
                            </td>
                            <td className="py-2.5 px-3 text-center">{p.count}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold">
                              {formatVND(p.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-amber-500">
                              {p.refunded > 0 ? formatVND(p.refunded) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#da251d] dark:text-red-400">
                              {formatVND(p.netAmount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className={`font-black border-t-2 ${
                      isDarkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50/80 border-slate-200 text-slate-900'
                    }`}>
                      <tr>
                        <td className="py-2.5 px-3 uppercase" colSpan={2}>
                          TỔNG CỘNG
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatVND(
                            data.payments.reduce((sum, p) => sum + p.amount, 0),
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-500">
                          {formatVND(data.summary.refundTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#da251d] dark:text-red-400">
                          {formatVND(data.reconciliation.totalPaymentSum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* KHỐI 3: HÀNG HÓA BÁN RA (CATEGORY SALES & PRODUCT SALES) */}
              <div className={`p-4 sm:p-5 rounded-2xl border shadow-2xs space-y-3 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
              }`}>
                <div className={`flex items-center justify-between border-b pb-3 ${
                  isDarkMode ? 'border-slate-700' : 'border-slate-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-500/10 text-[#da251d] flex items-center justify-center font-bold">
                      📦
                    </div>
                    <h4 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      HÀNG HÓA BÁN RA (TỔNG HỢP THEO NHÓM MÓN)
                    </h4>
                  </div>

                  <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Tổng: {data.categorySales.reduce((sum, c) => sum + c.quantitySold, 0)} phần
                  </span>
                </div>

                {/* Bảng tổng hợp theo nhóm hàng (Category) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className={`text-[11px] font-bold uppercase border-y ${
                      isDarkMode
                        ? 'text-slate-400 bg-slate-850 border-slate-700'
                        : 'text-slate-400 bg-slate-50 border-slate-100'
                    }`}>
                      <tr>
                        <th className="py-2 px-3">Tên nhóm hàng</th>
                        <th className="py-2 px-3 text-center">Số lượng bán</th>
                        <th className="py-2 px-3 text-right">Doanh thu nhóm</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-medium ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                      {data.categorySales.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-slate-400 italic">
                            Chưa có mặt hàng nào bán ra trong khoảng thời gian này
                          </td>
                        </tr>
                      ) : (
                        data.categorySales.map((cat) => (
                          <tr key={cat.categoryId} className={isDarkMode ? 'hover:bg-slate-750' : 'hover:bg-slate-50/70'}>
                            <td className={`py-2 px-3 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {cat.categoryName}
                            </td>
                            <td className="py-2 px-3 text-center font-bold">
                              {cat.quantitySold}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              {formatVND(cat.revenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className={`font-black border-t-2 ${
                      isDarkMode ? 'bg-slate-850 border-slate-700 text-white' : 'bg-slate-50/80 border-slate-200 text-slate-900'
                    }`}>
                      <tr>
                        <td className="py-2.5 px-3 uppercase">TỔNG CỘNG</td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {data.categorySales.reduce((sum, c) => sum + c.quantitySold, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#da251d] dark:text-red-400">
                          {formatVND(
                            data.categorySales.reduce((sum, c) => sum + c.revenue, 0),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Bảng chi tiết từng mặt hàng nếu được kích hoạt */}
                {showItemDetails && data.productSales && data.productSales.length > 0 && (
                  <div className={`pt-4 border-t space-y-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                    <h5 className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      Chi tiết từng mặt hàng bán ra
                    </h5>

                    <div className="overflow-x-auto max-h-72 custom-scrollbar">
                      <table className="w-full text-xs text-left">
                        <thead className={`text-[10px] font-bold uppercase sticky top-0 z-10 ${
                          isDarkMode ? 'text-slate-400 bg-slate-800' : 'text-slate-400 bg-slate-100'
                        }`}>
                          <tr>
                            <th className="py-1.5 px-2.5">Mã món</th>
                            <th className="py-1.5 px-2.5">Tên món</th>
                            <th className="py-1.5 px-2.5">Nhóm</th>
                            <th className="py-1.5 px-2.5 text-center">SL</th>
                            <th className="py-1.5 px-2.5 text-right">Đơn giá</th>
                            <th className="py-1.5 px-2.5 text-right">Giảm giá</th>
                            <th className="py-1.5 px-2.5 text-right">VAT</th>
                            <th className="py-1.5 px-2.5 text-right">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y font-medium ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'}`}>
                          {data.productSales.map((prod) => (
                            <tr key={prod.productId} className={isDarkMode ? 'hover:bg-slate-750' : 'hover:bg-slate-50'}>
                              <td className="py-1.5 px-2.5 font-mono text-slate-400">
                                {prod.itemCode}
                              </td>
                              <td className={`py-1.5 px-2.5 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {prod.name}
                              </td>
                              <td className="py-1.5 px-2.5 text-slate-400">
                                {prod.categoryName}
                              </td>
                              <td className="py-1.5 px-2.5 text-center font-bold">
                                {prod.quantitySold}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-mono">
                                {formatVND(prod.unitPriceSnapshot)}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-mono text-rose-500">
                                {prod.discountAmount > 0 ? formatVND(prod.discountAmount) : '-'}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-mono text-indigo-400">
                                {prod.vatAmount > 0 ? formatVND(prod.vatAmount) : '-'}
                              </td>
                              <td className={`py-1.5 px-2.5 text-right font-mono font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {formatVND(prod.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Render ngầm mẫu phiếu in nhiệt 80mm để sẵn sàng in bất cứ lúc nào */}
          {data && (
            <div className="hidden">
              <EndOfDayThermalReceipt data={data} showItemDetails={showItemDetails} />
            </div>
          )}
        </div>

        {/* =========================================================================
            4. MODAL FOOTER
            ========================================================================= */}
        <div className={`p-3 sm:p-4 border-t flex flex-wrap items-center justify-between gap-2 shrink-0 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="text-[11px] text-slate-400">
            {data && (
              <span>
                Thời gian tạo: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{data.generatedAtVn}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 font-bold rounded-xl text-xs sm:text-sm border transition-colors cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!data || isLoading || isPrinting}
              className="px-4 py-2 bg-[#da251d] hover:bg-red-700 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>IN BÁO CÁO KẾT CA (80mm)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
