"use client";

import React, { useState } from 'react';
import { ArrowRightLeft, Users } from 'lucide-react';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { PosTable } from './pos-types';

interface MoveTableModalProps {
  currentTable: PosTable | null;
  tables: PosTable[];
  onClose: () => void;
  onConfirmMove: (targetTableId: string) => Promise<void>;
  isProcessing?: boolean;
  isDarkMode?: boolean;
}

export const MoveTableModal: React.FC<MoveTableModalProps> = ({
  currentTable,
  tables,
  onClose,
  onConfirmMove,
  isProcessing = false,
  isDarkMode = false,
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
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      title="Chuyển bàn"
      subtitle={`Chuyển hóa đơn từ ${currentTable?.name || 'bàn hiện tại'} sang bàn trống`}
      icon={<ArrowRightLeft size={18} className="text-emerald-600" />}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              isDarkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedTargetTableId || isProcessing}
            onClick={handleConfirm}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {isProcessing ? 'Đang chuyển...' : 'Xác nhận chuyển bàn'}
          </button>
        </div>
      }
    >
      <div className="space-y-3 py-1">
        <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
          Chọn bàn đích trống:
        </span>

        {vacantTables.length === 0 ? (
          <div className={`p-6 rounded-2xl border text-center text-xs ${
            isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            Hiện tại không có bàn trống nào trong chi nhánh
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto overscroll-contain p-0.5">
            {vacantTables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTargetTableId(t.id)}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer active:scale-95 ${
                  selectedTargetTableId === t.id
                    ? isDarkMode
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-bold shadow-xs'
                      : 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-800/70 border-slate-700 hover:bg-slate-750 text-slate-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold">{t.name}</span>
                  <span className={`text-[10px] flex items-center gap-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Users className="w-3 h-3" />
                    {t.capacity}
                  </span>
                </div>
                {t.areaName && (
                  <span className={`text-[10px] mt-1 font-normal ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.areaName}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
};
