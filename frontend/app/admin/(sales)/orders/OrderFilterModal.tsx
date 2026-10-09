'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Building2,
  User,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Cloud,
} from 'lucide-react';

export interface OrderFilterValues {
  dateFrom: string;
  dateTo: string;
  branchId: string;
  cashierName: string;
  status: string;
  isInvoiceRequested: string; // '' | 'true' | 'false'
  paymentMethod: string;
  sortBy: string;
}

export const DEFAULT_FILTER_VALUES: OrderFilterValues = {
  dateFrom: '',
  dateTo: '',
  branchId: 'ALL',
  cashierName: 'ALL',
  status: '',
  isInvoiceRequested: '',
  paymentMethod: 'ALL',
  sortBy: 'date_desc',
};

interface OrderFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValues: OrderFilterValues;
  onApply: (values: OrderFilterValues) => void;
  onReset: () => void;
  branches: Array<{ id: string; name: string }>;
  cashiers: string[];
  paymentMethods: Array<{ id: string; name: string; methodCode: string }>;
}

export const OrderFilterModal: React.FC<OrderFilterModalProps> = ({
  isOpen,
  onClose,
  initialValues,
  onApply,
  onReset,
  branches,
  cashiers,
  paymentMethods,
}) => {
  const [values, setValues] = useState<OrderFilterValues>(initialValues);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
    }
  }, [isOpen, initialValues]);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply(values);
    onClose();
  };

  const handleReset = () => {
    setValues(DEFAULT_FILTER_VALUES);
    onReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-1.5 sm:p-4 animate-in fade-in duration-150 select-none">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-3.5 py-2.5 sm:px-5 sm:py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Bộ lọc tìm kiếm</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleApply} className="p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 text-xs">
          {/* 1. Thời gian */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Thời gian</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={values.dateFrom}
                  onChange={(e) => setValues((v) => ({ ...v, dateFrom: e.target.value }))}
                  className="w-full pl-8 pr-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs"
                  placeholder="Từ ngày"
                />
              </div>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-purple-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={values.dateTo}
                  onChange={(e) => setValues((v) => ({ ...v, dateTo: e.target.value }))}
                  className="w-full pl-8 pr-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs"
                  placeholder="Đến ngày"
                />
              </div>
            </div>
          </div>

          {/* 2. Chi nhánh */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Chi nhánh</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🏢</span>
              <select
                value={values.branchId}
                onChange={(e) => setValues((v) => ({ ...v, branchId: e.target.value }))}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs cursor-pointer appearance-none"
              >
                <option value="ALL">Tất cả Chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* 3. Thu ngân */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Thu ngân</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">👤</span>
              <select
                value={values.cashierName}
                onChange={(e) => setValues((v) => ({ ...v, cashierName: e.target.value }))}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs cursor-pointer appearance-none"
              >
                <option value="ALL">Tất cả Thu ngân</option>
                {cashiers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* 4. Trạng thái đơn */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Trạng thái đơn</label>
            <div className="relative">
              <select
                value={values.status}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs cursor-pointer appearance-none"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ xác nhận</option>
                <option value="CONFIRMED">Đã xác nhận</option>
                <option value="PREPARING">Đang chuẩn bị</option>
                <option value="DELIVERING">Đang giao</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
            </div>
          </div>

          {/* 5 & 6. Grid 2 cột: Trạng thái HĐĐT & Phương thức thanh toán */}
          <div className="grid grid-cols-2 gap-3">
            {/* Trạng thái HĐĐT */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Trạng thái HĐĐT</label>
              <div className="relative">
                <select
                  value={values.isInvoiceRequested}
                  onChange={(e) => setValues((v) => ({ ...v, isInvoiceRequested: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs cursor-pointer appearance-none"
                >
                  <option value="">Tất cả</option>
                  <option value="true">Yêu cầu xuất (YCXHĐCT)</option>
                  <option value="false">Không yêu cầu</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
              </div>
            </div>

            {/* Phương thức thanh toán */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Phương thức thanh toán</label>
              <div className="relative">
                <select
                  value={values.paymentMethod}
                  onChange={(e) => setValues((v) => ({ ...v, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs cursor-pointer appearance-none truncate"
                >
                  <option value="ALL">Tất cả PTTT</option>
                  <option value="CASH">Tiền mặt</option>
                  <option value="TRANSFER">Chuyển khoản</option>
                  <option value="SEPAY_QR">SePay QR</option>
                  <option value="CARD">Thẻ POS</option>
                  <option value="COD">COD</option>
                  {paymentMethods
                    .filter((pm) => !['CASH', 'TRANSFER', 'SEPAY_QR', 'CARD', 'COD'].includes(pm.methodCode))
                    .map((pm) => (
                      <option key={pm.id} value={pm.methodCode}>
                        {pm.name}
                      </option>
                    ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</div>
              </div>
            </div>
          </div>

          {/* 7. Sắp xếp theo giá trị */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">Sắp xếp theo giá trị</label>
            <div className="relative">
              <select
                value={values.sortBy}
                onChange={(e) => setValues((v) => ({ ...v, sortBy: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-purple-400 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 transition-all shadow-2xs cursor-pointer appearance-none"
              >
                <option value="date_desc">Mặc định (Thời gian mới nhất)</option>
                <option value="amount_desc">Giá trị: Cao đến thấp</option>
                <option value="amount_asc">Giá trị: Thấp đến cao</option>
                <option value="date_asc">Thời gian: Cũ nhất trước</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-600 text-xs">▼</div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 grid grid-cols-2 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="min-h-[44px] py-2.5 px-3 sm:px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs active:scale-98"
            >
              <Cloud className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="truncate">Xóa thiết lập</span>
            </button>

            <button
              type="submit"
              className="min-h-[44px] py-2.5 px-3 sm:px-4 bg-[#5b3eb8] hover:bg-[#4d329f] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-purple-600/20 active:scale-98"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span className="truncate">Áp dụng bộ lọc</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
