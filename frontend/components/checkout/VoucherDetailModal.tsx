import React from 'react';
import { X, Info, CheckCircle2 } from 'lucide-react';

interface VoucherDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: any;
}

export default function VoucherDetailModal({ isOpen, onClose, voucher }: VoucherDetailModalProps) {
  if (!isOpen || !voucher) return null;

  const endDate = new Date(voucher.endDate);
  
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Info className="w-5 h-5 text-[#da251d]" />
            Chi tiết voucher
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar max-h-[70vh]">
          
          <h3 className="text-xl font-bold text-[#da251d] mb-4">
            {voucher.title || voucher.code}
          </h3>

          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">Đơn tối thiểu:</span>
              <span className="font-bold text-slate-800">{voucher.minOrderValue.toLocaleString('vi-VN')}đ</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500">HSD / Hạn đổi:</span>
              <span className="font-bold text-slate-800">
                {endDate.toLocaleDateString('vi-VN')} {endDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>

          {/* Details Box */}
          <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-red-800 mb-2 text-sm flex items-center gap-1.5">
              <TicketIcon className="w-4 h-4" /> Điều kiện chi tiết:
            </h4>
            <div className="text-[13px] text-red-900/80 space-y-1.5 leading-relaxed">
              <p className="font-bold">ĐIỀU KIỆN & CHI TIẾT ƯU ĐÃI:</p>
              <p>[ {voucher.title || voucher.code} ]</p>
              <br/>
              <ul className="list-disc list-inside space-y-1">
                <li>{voucher.discountType === 'FREE_SHIP' ? 'Miễn phí vận chuyển (Freeship).' : `Giảm ${voucher.discountType === 'PERCENTAGE' ? voucher.discountValue + '%' : (voucher.discountValue/1000) + 'k'}.`}</li>
                <li>Áp dụng cho đơn hàng có giá trị từ {voucher.minOrderValue.toLocaleString('vi-VN')} VNĐ trở lên.</li>
                {voucher.maxDiscount && <li>Giảm tối đa {voucher.maxDiscount.toLocaleString('vi-VN')} VNĐ.</li>}
                <li>Mã Code sẽ có hiệu lực trong 7 ngày kể từ lúc bạn bấm Đổi Thành Công (nếu đổi từ điểm).</li>
                {voucher.usageLimitPerUser && <li>Mỗi tài khoản được sử dụng mã này tối đa {voucher.usageLimitPerUser} lần.</li>}
                <li>Áp dụng khi thanh toán qua: Tất cả.</li>
              </ul>
              <br/>
              <p className="font-bold">Lưu ý chung:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Không áp dụng đồng thời với các chương trình khuyến mãi/Voucher khác.</li>
                <li>Phần thưởng không có giá trị quy đổi thành tiền mặt.</li>
              </ul>
              {voucher.description && (
                <>
                  <br/>
                  <p className="font-bold">Mô tả thêm:</p>
                  <p>{voucher.description}</p>
                </>
              )}
            </div>
          </div>

          {/* Applied Products Box */}
          <div className="border border-green-200 rounded-xl overflow-hidden">
            <div className="bg-white p-3 font-bold text-slate-800 flex items-center gap-2 text-sm border-b border-green-100">
              <span className="w-5 h-5 flex items-center justify-center text-green-600 bg-green-50 rounded"><CheckCircle2 size={14} /></span>
              Sản phẩm áp dụng:
            </div>
            <div className="bg-green-50/50 p-3 text-[13px] text-green-700 font-medium">
              <p className="flex items-start gap-1.5">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                Áp dụng cho toàn bộ danh mục món ăn.
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl">
          <button 
            onClick={onClose}
            className="w-full bg-[#da251d] hover:bg-[#b91c2c] text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}
