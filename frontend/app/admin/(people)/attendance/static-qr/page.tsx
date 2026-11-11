'use client';

import React, { useState, useRef } from 'react';
import useSWR from 'swr';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Download, Printer, MapPin, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function StaticQrGeneratorPage() {
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fetch branches
  const { data: branchRes } = useSWR('/api/pos/init', fetcher);
  const branches: any[] = branchRes?.data?.branches || [];

  // Fetch static QR
  const { data: qrRes } = useSWR(
    selectedBranchId ? `/api/attendance/qr/static?branchId=${selectedBranchId}` : null,
    fetcher,
  );
  const qrData = qrRes?.data?.qrData || '';
  const branchName = qrRes?.data?.branchName || 'Tên Chi Nhánh';
  const branchAddress = qrRes?.data?.address || '';

  // Tải file PNG Super HD
  const handleDownloadPng = () => {
    if (!qrData) return;
    const svgElement = printAreaRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background trắng
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tiêu đề thương hiệu
    ctx.fillStyle = '#DA251D';
    ctx.font = 'bold 70px Calibri, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AVORA F&B RESTAURANT', 800, 160);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 90px Calibri, sans-serif';
    ctx.fillText('QR CHẤM CÔNG', 800, 270);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    img.onload = () => {
      // Vẽ QR to ở giữa
      ctx.drawImage(img, 250, 360, 1100, 1100);

      // Tên chi nhánh bên dưới
      ctx.fillStyle = '#DA251D';
      ctx.font = 'bold 80px Calibri, sans-serif';
      ctx.fillText(branchName.toUpperCase(), 800, 1560);

      if (branchAddress) {
        ctx.fillStyle = '#64748b';
        ctx.font = '50px Calibri, sans-serif';
        ctx.fillText(branchAddress, 800, 1650);
      }

      const link = document.createElement('a');
      link.download = `QR_ChamCong_${branchName.replace(/\s+/g, '_')}_SuperHD.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Đã tải file ảnh in Super HD thành công!');
    };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#DA251D] uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            Bản In Chất Lượng Cao (Super HD)
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tạo & Tải Mã QR Tĩnh Dán Tại Quán</h1>
          <p className="text-xs text-slate-500 mt-1">
            Mã QR tĩnh không đổi dùng để in ấn lên biển mica hoặc decal dán tại chi nhánh. Vẫn đảm bảo an toàn 100% nhờ xác thực định vị GPS.
          </p>
        </div>

        {qrData && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-200"
            >
              <Printer size={15} />
              <span>In Ngay</span>
            </button>
            <button
              onClick={handleDownloadPng}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download size={15} />
              <span>Tải Ảnh In (PNG 1600x1800)</span>
            </button>
          </div>
        )}
      </div>

      {/* Chọn Chi Nhánh */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <MapPin size={14} className="text-[#DA251D]" />
          <span>Bước 1: Chọn chi nhánh cần tạo mã QR:</span>
        </label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-[#DA251D]"
        >
          <option value="">-- Vui lòng chọn chi nhánh --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Khung Xem Trước Biển In (Print Preview Standee) */}
      {selectedBranchId && qrData ? (
        <div className="flex flex-col items-center">
          <div
            ref={printAreaRef}
            className="w-full max-w-md bg-white border-4 border-slate-800 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center gap-4 print:border-none print:shadow-none"
          >
            <div>
              <div className="text-xs font-black tracking-widest text-[#DA251D] uppercase">
                AVORA F&B RESTAURANT
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
                QR CHẤM CÔNG
              </h2>
            </div>

            <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-300">
              <QRCodeSVG value={qrData} size={280} level="H" includeMargin={true} />
            </div>

            <div>
              <div className="text-lg font-black text-[#DA251D] uppercase tracking-wide">
                {branchName}
              </div>
              {branchAddress && (
                <div className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {branchAddress}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 w-full text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Yêu cầu nhân viên bật vị trí GPS khi quét</span>
            </div>
          </div>

          <div className="mt-4 max-w-md w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Lưu ý khi sử dụng mã tĩnh:</span> File tải xuống là bản SIÊU NÉT (1600x1800 pixels). Bạn có thể gửi file ảnh này cho xưởng in để in standee mica để quầy hoặc in decal chống nước dán tại cửa hàng.
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center text-slate-400">
          <QrCode size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Vui lòng chọn một chi nhánh ở trên để hiển thị biển in mã QR.</p>
        </div>
      )}
    </div>
  );
}

