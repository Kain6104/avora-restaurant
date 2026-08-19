import React, { useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CancelOrderModalProps {
  orderCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PREDEFINED_REASONS = [
  'Tôi muốn thay đổi địa chỉ giao hàng',
  'Tôi muốn thay đổi món ăn/số lượng',
  'Thời gian giao hàng dự kiến quá lâu',
  'Tôi tìm thấy chỗ khác rẻ hơn',
  'Tôi thay đổi ý định, không muốn mua nữa',
];

export default function CancelOrderModal({ orderCode, isOpen, onClose, onSuccess }: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const finalReason = selectedReason === 'Khác' ? customReason : selectedReason;
  const isReasonValid = finalReason.trim().length > 0;

  const handleSubmit = async () => {
    if (!isReasonValid) return;
    setIsSubmitting(true);
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/orders/${orderCode}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ reason: finalReason }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Lỗi khi hủy đơn hàng');
      }

      toast.success('Đã hủy đơn hàng thành công');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Hủy đơn hàng</h2>
              <p className="text-xs font-mono text-slate-500 font-bold">{orderCode}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto custom-scrollbar">
          <p className="text-xs font-medium text-slate-600 mb-3">
            Vui lòng cho chúng tôi biết lý do bạn muốn hủy đơn hàng này.
          </p>

          <div className="space-y-2 mb-3">
            {PREDEFINED_REASONS.map((reason, idx) => (
              <label 
                key={idx} 
                className={`flex items-start p-2.5 border rounded-xl cursor-pointer transition-colors ${
                  selectedReason === reason 
                    ? 'border-red-500 bg-red-50/50' 
                    : 'border-slate-200 hover:border-red-200 hover:bg-slate-50'
                }`}
              >
                <input 
                  type="radio" 
                  name="cancel_reason" 
                  className="sr-only" 
                  checked={selectedReason === reason}
                  onChange={() => setSelectedReason(reason)}
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  selectedReason === reason ? 'border-red-500' : 'border-slate-300'
                }`}>
                  {selectedReason === reason && <div className="w-2 h-2 rounded-full bg-red-500" />}
                </div>
                <span className={`ml-2 text-xs font-medium ${selectedReason === reason ? 'text-red-900' : 'text-slate-700'}`}>
                  {reason}
                </span>
              </label>
            ))}

            <label 
              className={`flex items-start p-2.5 border rounded-xl cursor-pointer transition-colors ${
                selectedReason === 'Khác' 
                  ? 'border-red-500 bg-red-50/50' 
                  : 'border-slate-200 hover:border-red-200 hover:bg-slate-50'
              }`}
            >
              <input 
                type="radio" 
                name="cancel_reason" 
                className="sr-only" 
                checked={selectedReason === 'Khác'}
                onChange={() => setSelectedReason('Khác')}
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                selectedReason === 'Khác' ? 'border-red-500' : 'border-slate-300'
              }`}>
                {selectedReason === 'Khác' && <div className="w-2 h-2 rounded-full bg-red-500" />}
              </div>
              <span className={`ml-2 text-xs font-medium ${selectedReason === 'Khác' ? 'text-red-900' : 'text-slate-700'}`}>
                Lý do khác
              </span>
            </label>
          </div>

          {/* Textarea for Custom Reason */}
          <div className={`transition-all duration-300 overflow-hidden ${selectedReason === 'Khác' ? 'max-h-24 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
            <textarea
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-400 text-xs text-slate-700 resize-none h-16"
              placeholder="Nhập lý do hủy đơn của bạn..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition-colors"
          >
            Đóng lại
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!isReasonValid || isSubmitting}
            className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý
              </>
            ) : (
              'Xác nhận hủy'
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
