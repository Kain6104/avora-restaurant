'use client';

import React, { useState } from 'react';
import { X, Copy, Store, AlertCircle } from 'lucide-react';

interface BranchItem {
  id: string;
  name: string;
  branchCode?: string;
}

interface DuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTemplateName: string;
  branches: BranchItem[];
  currentBranchId: string;
  onConfirm: (targetBranchId: string, newName: string) => Promise<void>;
}

export const DuplicateModal: React.FC<DuplicateModalProps> = ({
  isOpen,
  onClose,
  sourceTemplateName,
  branches,
  currentBranchId,
  onConfirm,
}) => {
  const [targetBranchId, setTargetBranchId] = useState(currentBranchId);
  const [newName, setNewName] = useState(`${sourceTemplateName} (Bản sao)`);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError('Vui lòng nhập tên mẫu in mới');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(targetBranchId, newName.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhân bản mẫu in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Copy className="w-4 h-4 text-red-600" />
            <span>Nhân bản mẫu in</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Mẫu nguồn:</label>
            <div className="p-2.5 bg-slate-100 rounded-xl font-medium text-slate-800 border border-slate-200">
              {sourceTemplateName}
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Chi nhánh đích:</label>
            <div className="relative">
              <Store className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-red-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.branchCode ? `(${b.branchCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1.5">Tên mẫu in mới:</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-red-500"
              placeholder="Nhập tên mẫu in mới..."
              autoFocus
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            Lưu ý: Mẫu in mới được tạo sẽ có trạng thái <b>không mặc định</b> (isDefault = false) ban đầu để đảm bảo an toàn.
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{submitting ? 'Đang nhân bản...' : 'Xác nhận nhân bản'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
