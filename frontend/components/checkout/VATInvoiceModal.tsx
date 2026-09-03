import React, { useState } from 'react';
import { X, Search, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface VATInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: {
    taxCode: string;
    companyName: string;
    address: string;
    email: string;
  } | null;
}

export default function VATInvoiceModal({ isOpen, onClose, onSave, initialData }: VATInvoiceModalProps) {
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || '');
  const [companyName, setCompanyName] = useState(initialData?.companyName || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLookup = async () => {
    if (!taxCode) {
      toast.error('Vui lòng nhập Mã số thuế');
      return;
    }
    setIsLookingUp(true);
    setLookupSuccess(false);
    try {
      const res = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`);
      const data = await res.json();
      if (data.code === "00" && data.data) {
        setCompanyName(data.data.name || '');
        setAddress(data.data.address || '');
        setLookupSuccess(true);
        toast.success("Tra cứu thông tin thành công");
      } else {
        toast.error("Không tìm thấy thông tin doanh nghiệp");
      }
    } catch (e) {
      toast.error("Lỗi kết nối khi tra cứu MST");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSave = () => {
    if (!taxCode || !companyName || !address || !email) {
      toast.error('Vui lòng điền đầy đủ thông tin xuất hóa đơn');
      return;
    }
    onSave({ taxCode, companyName, address, email });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#da251d] p-4 flex items-center justify-between text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-5 h-5 flex items-center justify-center border-2 border-white rounded-sm text-xs font-black">VAT</span>
            Xuất Hóa Đơn VAT
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-black/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar max-h-[75vh]">
          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <h3 className="text-amber-800 font-bold flex items-center gap-2 mb-2 text-sm">
              <AlertTriangle size={16} /> Lưu ý:
            </h3>
            <ul className="list-disc list-inside text-[13px] text-amber-700/90 space-y-1">
              <li>Vui lòng nhập chính xác thông tin Công ty đăng ký trên Thuế.</li>
              <li>Hóa đơn điện tử sẽ được xuất và gửi qua email trong ngày.</li>
              <li>Nhà hàng <span className="font-bold">không chịu trách nhiệm</span> nếu quý khách cung cấp sai thông tin xuất hóa đơn.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Mã số thuế</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className={`flex-1 p-3 bg-white border ${lookupSuccess ? 'border-emerald-500' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-[#da251d]/20 focus:border-[#da251d] outline-none transition-all placeholder:text-slate-400 font-medium`}
                  value={taxCode} 
                  onChange={e => setTaxCode(e.target.value)} 
                  placeholder="Nhập mã số thuế" 
                />
                <button 
                  type="button"
                  onClick={handleLookup}
                  disabled={isLookingUp || !taxCode}
                  className="flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-black disabled:bg-slate-400 text-white px-5 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap text-sm"
                >
                  {isLookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Tra cứu
                </button>
              </div>
              
              {lookupSuccess && (
                <div className="mt-2 text-emerald-600 text-[13px] font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Đã tìm thấy thông tin!
                  <div className="ml-auto text-[11px] font-normal bg-emerald-50 px-2 py-1 rounded text-emerald-700">Dữ liệu từ Cục Thuế</div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên công ty</label>
              <input 
                type="text" 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#da251d]/20 focus:border-[#da251d] outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
                value={companyName} 
                onChange={e => setCompanyName(e.target.value)} 
                placeholder="Tên công ty / Doanh nghiệp" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Địa chỉ thuế</label>
              <textarea 
                rows={2}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#da251d]/20 focus:border-[#da251d] outline-none transition-all placeholder:text-slate-400 font-medium text-sm resize-none"
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Địa chỉ theo đăng ký kinh doanh" 
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email nhận hóa đơn</label>
              <input 
                type="email" 
                className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#da251d]/20 focus:border-[#da251d] outline-none transition-all placeholder:text-slate-400 font-medium text-sm"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="Nhập email nhận hóa đơn điện tử" 
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-sm"
          >
            Hủy
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#da251d] hover:bg-[#b91c2c] transition-colors shadow-lg shadow-[#da251d]/30 active:scale-95 text-sm"
          >
            Xác nhận lưu
          </button>
        </div>

      </div>
    </div>
  );
}
