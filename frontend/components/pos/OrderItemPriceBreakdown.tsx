"use client";

import React from 'react';
import {
  getItemPriceBreakdown,
  formatVnd,
  ItemPriceBreakdown,
} from './pos-item-price-helper';

interface OrderItemPriceBreakdownProps {
  item: any;
  fallbackOrderCreatedAt?: string | Date | null;
  showAddedBy?: boolean;
  className?: string;
  isCompact?: boolean;
}

export const OrderItemPriceBreakdown: React.FC<OrderItemPriceBreakdownProps> = ({
  item,
  fallbackOrderCreatedAt,
  showAddedBy = true,
  className = '',
  isCompact = false,
}) => {
  const breakdown: ItemPriceBreakdown = getItemPriceBreakdown(item, fallbackOrderCreatedAt);

  return (
    <div className={`text-left ${className}`}>
      {/* 1. Added By & Added Time (Thêm bởi: [Tên nhân viên] | HH:mm dd/MM/yyyy) */}
      {showAddedBy && (
        <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight select-text mt-0.5">
          {breakdown.addedByFormatted}
        </div>
      )}

      {/* 2. Options Breakdown (Giá món + từng Option căn thẳng hàng dọc tuyệt đối ở mép phải) */}
      {breakdown.hasOptions && (
        <div
          className={`mt-1.5 space-y-0.5 border-l-2 border-red-200/80 pl-2 text-slate-600 ${
            isCompact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          {/* Base Product Price */}
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-slate-600">Giá món:</span>
            <span className="shrink-0 font-mono tabular-nums text-right font-semibold text-slate-800 min-w-[75px]">
              +{formatVnd(breakdown.baseProductPrice)}
            </span>
          </div>

          {/* Each Option (Paid or 0đ) */}
          {breakdown.options.map((opt, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="truncate text-slate-600">{opt.name}:</span>
              <span
                className={`shrink-0 font-mono tabular-nums text-right font-semibold min-w-[75px] ${
                  opt.price > 0 ? 'text-slate-800' : 'text-slate-500'
                }`}
              >
                +{formatVnd(opt.price)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Receipt-specific breakdown table for Print and Receipt Preview screens
 */
export const ReceiptItemOptionsTable: React.FC<{
  item: any;
  fallbackOrderCreatedAt?: string | Date | null;
  className?: string;
}> = ({ item, fallbackOrderCreatedAt, className = '' }) => {
  const breakdown = getItemPriceBreakdown(item, fallbackOrderCreatedAt);

  if (!breakdown.hasOptions) return null;

  return (
    <div className={`mt-1 border-t border-dotted border-slate-200 pt-1 text-[9.5px] text-slate-600 ${className}`}>
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className="text-left py-0.5 text-slate-500">Giá món:</td>
            <td className="text-right py-0.5 font-mono tabular-nums font-semibold text-slate-700 whitespace-nowrap min-w-[65px]">
              +{formatVnd(breakdown.baseProductPrice)}
            </td>
          </tr>
          {breakdown.options.map((opt, idx) => (
            <tr key={idx}>
              <td className="text-left py-0.5 text-slate-500">{opt.name}:</td>
              <td
                className={`text-right py-0.5 font-mono tabular-nums font-semibold whitespace-nowrap min-w-[65px] ${
                  opt.price > 0 ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                +{formatVnd(opt.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
