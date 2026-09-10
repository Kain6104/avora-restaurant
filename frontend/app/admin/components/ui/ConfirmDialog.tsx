'use client';

import React from 'react';
import Modal from './Modal';
import { AlertCircle, Trash2, HelpCircle } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  type = 'danger',
  variant,
  loading = false,
}: ConfirmDialogProps) {
  const activeType = variant || type;

  const iconConfig = {
    danger: {
      icon: <Trash2 size={24} className="text-red-600" />,
      bg: 'bg-red-50',
      btn: 'bg-red-600 hover:bg-red-700 text-white',
    },
    warning: {
      icon: <AlertCircle size={24} className="text-amber-600" />,
      bg: 'bg-amber-50',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    },
    info: {
      icon: <HelpCircle size={24} className="text-blue-600" />,
      bg: 'bg-blue-50',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  }[activeType];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="sm"
      footer={
        <>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 ${
              iconConfig.btn
            } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Đang xử lý...' : confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        <div
          className={`p-3 rounded-2xl ${iconConfig.bg} flex items-center justify-center shrink-0`}
        >
          {iconConfig.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-bold text-slate-900 tracking-tight">{title}</h4>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}
