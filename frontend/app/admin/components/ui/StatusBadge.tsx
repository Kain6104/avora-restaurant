'use client';

import React from 'react';
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  ShoppingBag,
  XCircle,
  Crown,
  ShieldCheck,
  ChefHat,
  User,
  Check,
  X,
  AlertCircle,
  Zap,
} from 'lucide-react';

export type StatusType =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ADMIN'
  | 'MANAGER'
  | 'CHEF'
  | 'USER'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'UPCOMING'
  | 'PAID'
  | 'UNPAID'
  | string;

interface StatusBadgeProps {
  status: StatusType;
  customLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode; dot: string }
> = {
  // Order statuses
  PENDING: {
    label: 'Chờ xác nhận',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/60',
    icon: <Clock size={12} strokeWidth={2.5} />,
    dot: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/60',
    icon: <CheckCircle2 size={12} strokeWidth={2.5} />,
    dot: 'bg-blue-500',
  },
  PREPARING: {
    label: 'Đang chuẩn bị',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200/60',
    icon: <Package size={12} strokeWidth={2.5} />,
    dot: 'bg-purple-500',
  },
  DELIVERING: {
    label: 'Đang giao',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200/60',
    icon: <Truck size={12} strokeWidth={2.5} />,
    dot: 'bg-indigo-500',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/60',
    icon: <ShoppingBag size={12} strokeWidth={2.5} />,
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Đã hủy',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200/60',
    icon: <XCircle size={12} strokeWidth={2.5} />,
    dot: 'bg-rose-500',
  },

  // Roles
  ADMIN: {
    label: 'Super Admin',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200/60',
    icon: <Crown size={12} strokeWidth={2.5} />,
    dot: 'bg-red-500',
  },
  MANAGER: {
    label: 'Quản lý',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/60',
    icon: <ShieldCheck size={12} strokeWidth={2.5} />,
    dot: 'bg-blue-500',
  },
  CHEF: {
    label: 'Bếp trưởng',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200/60',
    icon: <ChefHat size={12} strokeWidth={2.5} />,
    dot: 'bg-orange-500',
  },
  USER: {
    label: 'Khách hàng',
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200/60',
    icon: <User size={12} strokeWidth={2.5} />,
    dot: 'bg-slate-400',
  },

  // Generic status
  ACTIVE: {
    label: 'Hoạt động',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/60',
    icon: <Check size={12} strokeWidth={2.5} />,
    dot: 'bg-emerald-500',
  },
  INACTIVE: {
    label: 'Tạm ẩn / Khóa',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200/60',
    icon: <X size={12} strokeWidth={2.5} />,
    dot: 'bg-slate-400',
  },
  EXPIRED: {
    label: 'Đã kết thúc',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200/60',
    icon: <Clock size={12} strokeWidth={2.5} />,
    dot: 'bg-slate-400',
  },
  UPCOMING: {
    label: 'Sắp diễn ra',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200/60',
    icon: <Zap size={12} strokeWidth={2.5} />,
    dot: 'bg-purple-500',
  },
  PAID: {
    label: 'Đã thanh toán',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200/60',
    icon: <CheckCircle2 size={12} strokeWidth={2.5} />,
    dot: 'bg-emerald-500',
  },
  UNPAID: {
    label: 'Chưa thanh toán',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200/60',
    icon: <AlertCircle size={12} strokeWidth={2.5} />,
    dot: 'bg-amber-500',
  },
};

export default function StatusBadge({
  status,
  customLabel,
  size = 'md',
  showIcon = true,
  className = '',
}: StatusBadgeProps) {
  const upperStatus = String(status || '').toUpperCase();
  const config = STATUS_CONFIG[upperStatus] || {
    label: customLabel || String(status),
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200/60',
    icon: <Clock size={12} strokeWidth={2.5} />,
    dot: 'bg-slate-400',
  };

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      {showIcon && <span className="shrink-0">{config.icon}</span>}
      <span className="truncate">{customLabel || config.label}</span>
    </span>
  );
}
