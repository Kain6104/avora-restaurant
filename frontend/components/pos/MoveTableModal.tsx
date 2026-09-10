"use client";

import React, { useState } from 'react';
import { X, ArrowRightLeft, Users, CheckCircle2 } from 'lucide-react';
import { PosTable } from './pos-types';

interface MoveTableModalProps {
  currentTable: PosTable | null;
  tables: PosTable[];
  onClose: () => void;
  onConfirmMove: (targetTableId: string) => Promise<void>;
  isProcessing?: boolean;
}

export const MoveTableModal: React.FC<MoveTableModalProps> = ({
  currentTable,
  tables,
  onClose,
  onConfirmMove,
  isProcessing = false,
}) => {
  const [selectedTargetTableId, setSelectedTargetTableId] = useState<string>('');

  const vacantTables = tables.filter(
    (t) => t.visualStatus === 'VACANT' && t.id !== currentTable?.id,
  );

  const handleConfirm = async () => {
    if (!selectedTargetTableId) return;
    await onConfirmMove(selectedTargetTableId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Chuyển bàn (Move Table)</h3>
              <p className="text-[11px] text-gray-500">
                Chuyển toàn bộ hóa đơn từ bàn {currentTable?.name} sang bàn trống
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <span className="text-xs font-bold text-gray-700">Chọn bàn đích trống:</span>

          {vacantTables.length === 0 ? (
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-center text-xs text-gray-500">
              Hiện tại không có bàn trống nào trong chi nhánh
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {vacantTables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTargetTableId(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectedTargetTableId === t.id
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs'
                      : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span>{t.name}</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Users className="w-3 h-3" />
                      {t.capacity}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 font-normal">{t.areaName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-white"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedTargetTableId || isProcessing}
            onClick={handleConfirm}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            {isProcessing ? 'Đang chuyển...' : 'XÁC NHẬN CHUYỂN BÀN'}
          </button>
        </div>
      </div>
    </div>
  );
};
