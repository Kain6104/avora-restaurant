'use client';

import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export default function FormField({
  label,
  required = false,
  error,
  hint,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400 font-normal">{hint}</p>}
      {error && <p className="text-[11px] text-red-600 font-medium">{error}</p>}
    </div>
  );
}
