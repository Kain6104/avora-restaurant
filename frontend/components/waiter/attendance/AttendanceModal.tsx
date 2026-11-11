'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWaiterStore } from '@/store/useWaiterStore';
import {
  QrCode,
  MapPin,
  Clock,
  Calendar,
  LogOut,
  LogIn,
  Camera,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Smartphone,
  ChevronRight,
  Filter,
  X,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ResponsiveModal from '@/components/ui/ResponsiveModal';
import { Html5Qrcode } from 'html5-qrcode';

interface AttendanceItem {
  id: string;
  date: string;
  shiftName: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  status: string;
  notes: string;
}

export default function AttendanceModal() {
  const {
    isAttendanceModalOpen,
    setAttendanceModalOpen,
    currentUser,
    currentBranch,
    activeBranchId,
    soundEnabled,
    hapticEnabled,
  } = useWaiterStore();

  const [activeTab, setActiveTab] = useState<'HISTORY' | 'MATRIX'>('HISTORY');
  const [filterType, setFilterType] = useState<'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'>('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  // Trạng thái nhân viên
  const [employeeStatus, setEmployeeStatus] = useState<{
    isWorking: boolean;
    nextAction: string;
    currentShift: string | null;
    checkInTime: string | null;
  } | null>(null);

  // Lịch sử
  const [historyList, setHistoryList] = useState<AttendanceItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Ma trận tuần
  const [matrixData, setMatrixData] = useState<{
    weekDays: Array<{ dayName: string; dateShort: string; isoDate: string; isToday: boolean }>;
    attByDate: Record<string, AttendanceItem[]>;
    daysWorked: number;
  } | null>(null);

  // Camera & Quét mã
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredDeviceAlert, setRegisteredDeviceAlert] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Đồng hồ thực tế
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
      setCurrentDate(
        now.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch trạng thái nhân viên
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/attendance/employee/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setEmployeeStatus(json.data);
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra trạng thái chấm công', e);
    }
  };

  // Tính ngày theo filter
  const getDateRange = () => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (filterType === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (filterType === 'last_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      start = new Date(now.setDate(diff));
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (filterType === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (filterType === 'last_month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (filterType === 'custom') {
      if (customStartDate && customEndDate) {
        return { startStr: customStartDate, endStr: customEndDate };
      }
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    return { startStr, endStr };
  };

  // Fetch lịch sử chấm công
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { startStr, endStr } = getDateRange();
      const res = await fetch(`/api/attendance/employee/history?startDate=${startStr}&endDate=${endStr}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          const list: AttendanceItem[] = json.data;
          setHistoryList(list);

          // Xử lý dữ liệu ma trận tuần
          const s = new Date(startStr);
          const e = new Date(endStr);
          const weekDays = [];
          const cur = new Date(s);
          const todayISO = new Date().toISOString().split('T')[0];

          while (cur <= e) {
            const iso = cur.toISOString().split('T')[0];
            const dShort = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}`;
            const dNum = cur.getDay();
            const dayName = dNum === 0 ? 'CN' : `T${dNum + 1}`;
            weekDays.push({
              dayName,
              dateShort: dShort,
              isoDate: iso,
              isToday: iso === todayISO,
            });
            cur.setDate(cur.getDate() + 1);
          }

          const attByDate: Record<string, AttendanceItem[]> = {};
          let daysCount = 0;
          for (const item of list) {
            const [d, m, y] = item.date.split('/');
            const iso = `${y}-${m}-${d}`;
            if (!attByDate[iso]) {
              attByDate[iso] = [];
              daysCount++;
            }
            attByDate[iso].push(item);
          }

          setMatrixData({
            weekDays,
            attByDate,
            daysWorked: daysCount,
          });
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy lịch sử chấm công', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isAttendanceModalOpen) {
      fetchStatus();
      fetchHistory();
    }
  }, [isAttendanceModalOpen, filterType, customStartDate, customEndDate]);

  // Lấy hoặc sinh Device ID phần cứng (Fingerprint)
  const getDeviceId = (): string => {
    let id = localStorage.getItem('avora_waiter_device_id');
    if (!id) {
      const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const navInfo = navigator.userAgent;
      const raw = `${screenInfo}_${navInfo}_${Date.now()}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      id = `HW_${Math.abs(hash).toString(16)}_${Date.now().toString(36)}`;
      localStorage.setItem('avora_waiter_device_id', id);
    }
    return id;
  };

  // Mở camera scanner
  const handleOpenScanner = () => {
    setIsScannerOpen(true);
    setScannerStatus('Đang xin quyền vị trí GPS...');

    if (!('geolocation' in navigator)) {
      toast.error('Trình duyệt không hỗ trợ GPS.');
      setIsScannerOpen(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setScannerStatus('Đang mở camera quét mã...');
        setTimeout(() => startCamera(pos.coords), 300);
      },
      (err) => {
        toast.error('Vui lòng bật quyền vị trí (GPS) trên thiết bị để chấm công!');
        setIsScannerOpen(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  // Dừng camera an toàn
  const stopCameraSafely = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.getState() === 2) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Lỗi dừng camera:', e);
      } finally {
        html5QrCodeRef.current = null;
      }
    }
  };

  const handleCloseScanner = async () => {
    await stopCameraSafely();
    setIsScannerOpen(false);
  };

  // Khởi động Camera (lọc ống kính 1x chuẩn như Sushi Wa)
  const startCamera = async (coords: GeolocationCoordinates) => {
    try {
      await stopCameraSafely();

      const qr = new Html5Qrcode('avora-qr-reader');
      html5QrCodeRef.current = qr;

      const devices = await Html5Qrcode.getCameras();
      let selectedCameraId: string | null = null;

      if (devices && devices.length > 0) {
        const backCameras = devices.filter((d) => {
          const l = d.label.toLowerCase();
          return l.includes('back') || l.includes('sau') || l.includes('environment');
        });

        if (backCameras.length > 0) {
          const standardCameras = backCameras.filter((d) => {
            const l = d.label.toLowerCase();
            return (
              !l.includes('ultrawide') &&
              !l.includes('ultra wide') &&
              !l.includes('macro') &&
              !l.includes('telephoto') &&
              !l.includes('0.5')
            );
          });
          selectedCameraId = standardCameras.length > 0 ? standardCameras[0].id : backCameras[0].id;
        } else {
          selectedCameraId = devices[devices.length - 1].id;
        }
      }

      const cameraSetting = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: 'environment' };

      const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };

      await qr.start(
        cameraSetting,
        config,
        async (decodedText) => {
          await stopCameraSafely();
          setIsScannerOpen(false);
          await submitScan(decodedText, coords);
        },
        () => {},
      );

      setScannerStatus('Hãy đưa mã QR tại quầy vào khung hình');
    } catch (err) {
      console.warn('Lỗi khởi động camera 1x, fallback environment:', err);
      try {
        if (html5QrCodeRef.current) {
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
              await stopCameraSafely();
              setIsScannerOpen(false);
              await submitScan(decodedText, coords);
            },
            () => {},
          );
          setScannerStatus('Hãy đưa mã QR tại quầy vào khung hình');
        }
      } catch (fallbackErr) {
        toast.error('Không thể mở camera. Vui lòng cấp quyền truy cập máy ảnh!');
        setIsScannerOpen(false);
      }
    }
  };

  // Gửi dữ liệu chấm công
  const submitScan = async (rawQr: string, coords: GeolocationCoordinates) => {
    setIsSubmitting(true);
    let qrData = rawQr;
    try {
      const u = new URL(rawQr);
      if (u.searchParams.has('qrData')) {
        qrData = u.searchParams.get('qrData') || rawQr;
      }
    } catch (e) {}

    const deviceId = getDeviceId();

    try {
      const payload = {
        qrCodeData: qrData,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        scanType: 'AUTO',
        deviceId,
        branchId: activeBranchId || currentBranch?.id,
      };

      const res = await fetch('/api/attendance/employee/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || 'Chấm công thất bại!');
      }

      // Haptic & Sound Feedback
      if (hapticEnabled && 'vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      if (soundEnabled) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } catch (e) {}
      }

      if (data.data?.status === 'SUCCESS_REGISTERED') {
        setRegisteredDeviceAlert(data.data.message);
      } else {
        toast.success(data.message || 'Chấm công thành công!', { duration: 5000 });
      }

      await fetchStatus();
      await fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi chấm công!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính tổng giờ và số lần vi phạm
  const totalHours = historyList.reduce((acc, cur) => acc + (cur.hours || 0), 0);
  const lateCount = historyList.filter(
    (item) => item.status.includes('LATE') || item.status.includes('EARLY'),
  ).length;

  const getBadgeConfig = (status: string) => {
    switch (status) {
      case 'ON_TIME':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'Đúng giờ', icon: CheckCircle };
      case 'LATE':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'Đi trễ', icon: AlertTriangle };
      case 'EARLY_LEAVE':
        return { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'Về sớm', icon: LogOut };
      case 'LATE_AND_EARLY_LEAVE':
        return { bg: 'bg-red-50 text-red-700 border-red-200', text: 'Trễ & Về sớm', icon: XCircle };
      case 'FLEXIBLE':
        return { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'Ca tự do', icon: Clock };
      default:
        return { bg: 'bg-slate-50 text-slate-700 border-slate-200', text: status || 'Khác', icon: Clock };
    }
  };

  return (
    <>
      <ResponsiveModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        title="Quản Lý Chấm Công"
        maxWidth="2xl"
      >
        <div className="flex flex-col gap-4 text-slate-800 pb-2">
          {/* Header Thông tin ca & Trạng thái hiện tại */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white text-xs">
                  {currentUser?.fullName ? currentUser.fullName.charAt(0) : 'U'}
                </div>
                <div>
                  <h4 className="font-bold text-sm leading-none">{currentUser?.fullName || 'Nhân viên'}</h4>
                  <span className="text-[11px] text-slate-300 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-[#DA251D]" />
                    {currentBranch?.name || 'Chi nhánh mặc định'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-black tracking-tight font-mono text-emerald-400">{currentTime}</div>
                <div className="text-[10px] text-slate-400 capitalize">{currentDate}</div>
              </div>
            </div>

            {/* Trạng thái công việc hiện tại */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center justify-between border border-white/10 relative z-10">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3 h-3 rounded-full animate-pulse ${
                    employeeStatus?.isWorking ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-slate-400'
                  }`}
                />
                <div>
                  <div className="text-[11px] text-slate-300">Trạng thái hiện tại</div>
                  <div className="font-bold text-xs text-white">
                    {employeeStatus?.isWorking ? 'Đang trong ca làm việc' : 'Chưa vào ca làm'}
                  </div>
                </div>
              </div>

              {employeeStatus?.isWorking && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-300">Giờ vào:</div>
                  <div className="font-mono font-bold text-xs text-emerald-300">
                    {employeeStatus.checkInTime || '--:--'}
                  </div>
                </div>
              )}
            </div>

            {/* Nút Chấm Công To Lớn */}
            <button
              onClick={handleOpenScanner}
              disabled={isSubmitting}
              className="mt-3 w-full py-3 bg-[#DA251D] hover:bg-[#b91c1c] active:scale-[0.98] transition-all rounded-xl font-bold text-sm shadow-lg shadow-[#DA251D]/30 flex items-center justify-center gap-2 text-white"
            >
              <Camera size={18} />
              <span>{employeeStatus?.nextAction ? `Quét Mã ${employeeStatus.nextAction}` : 'Quét Mã Chấm Công'}</span>
            </button>
          </div>

          {/* Tab Switcher & Bộ Lọc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start">
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'HISTORY' ? 'bg-white shadow text-[#DA251D]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lịch sử công
              </button>
              <button
                onClick={() => setActiveTab('MATRIX')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'MATRIX' ? 'bg-white shadow text-[#DA251D]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ma trận tuần
              </button>
            </div>

            {/* Dropdown Bộ lọc */}
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-none focus:border-[#DA251D]"
              >
                <option value="this_week">Tuần này</option>
                <option value="last_week">Tuần trước</option>
                <option value="this_month">Tháng này</option>
                <option value="last_month">Tháng trước</option>
                <option value="custom">Tùy chọn...</option>
              </select>
            </div>
          </div>

          {/* Form chọn ngày nếu chọn Custom */}
          {filterType === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-slate-500">Từ:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none"
                />
              </div>
              <div className="flex-1 flex items-center gap-1.5">
                <span className="text-slate-500">Đến:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 outline-none"
                />
              </div>
            </div>
          )}

          {/* Thống kê nhanh */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                <Clock size={20} />
              </div>
              <div>
                <div className="text-[11px] text-emerald-800 font-medium">Tổng giờ làm</div>
                <div className="text-lg font-black text-emerald-900 font-mono leading-none mt-0.5">
                  {totalHours.toFixed(2)}h
                </div>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
                <AlertTriangle size={20} />
              </div>
              <div>
                <div className="text-[11px] text-rose-800 font-medium">Lần trễ / về sớm</div>
                <div className="text-lg font-black text-rose-900 font-mono leading-none mt-0.5">
                  {lateCount} lần
                </div>
              </div>
            </div>
          </div>

          {/* NỘI DUNG TAB 1: LỊCH SỬ CHẤM CÔNG DẠNG DANH SÁCH */}
          {activeTab === 'HISTORY' && (
            <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {isLoadingHistory ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#DA251D]" />
                  <p className="text-xs">Đang tải lịch sử chấm công...</p>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Không có dữ liệu công trong khoảng thời gian này.</p>
                </div>
              ) : (
                historyList.map((item) => {
                  const cfg = getBadgeConfig(item.status);
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-3 shadow-sm transition-all flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                          <Calendar size={13} className="text-[#DA251D]" />
                          <span>{item.date}</span>
                          <span className="text-slate-400 font-normal">|</span>
                          <span className="text-slate-600 font-medium">{item.shiftName}</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${cfg.bg}`}
                        >
                          <Icon size={12} />
                          {cfg.text}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50/80 rounded-lg p-2 text-center">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Giờ vào</div>
                          <div className="font-mono font-bold text-xs text-emerald-600">{item.checkIn}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Giờ ra</div>
                          <div
                            className={`font-mono font-bold text-xs ${
                              item.checkOut === 'Đang làm' ? 'text-amber-500 animate-pulse' : 'text-slate-700'
                            }`}
                          >
                            {item.checkOut}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Số giờ</div>
                          <div className="font-mono font-bold text-xs text-blue-600">
                            {Number(item.hours).toFixed(2)}h
                          </div>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="text-[11px] text-slate-500 bg-amber-50/50 border border-amber-200/50 rounded-lg px-2 py-1 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="text-amber-600 mt-0.5 shrink-0" />
                          <span>{item.notes}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* NỘI DUNG TAB 2: MA TRẬN CA LÀM (TUẦN) */}
          {activeTab === 'MATRIX' && (
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm bg-white">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="p-2.5 font-bold border-r border-slate-200 text-left min-w-[110px]">
                      Nhân viên
                    </th>
                    {matrixData?.weekDays.map((d) => (
                      <th
                        key={d.isoDate}
                        className={`p-2 font-bold min-w-[85px] border-r border-slate-200 last:border-r-0 ${
                          d.isToday ? 'bg-red-50 text-[#DA251D]' : ''
                        }`}
                      >
                        <div className="text-[10px] opacity-80">{d.dayName}</div>
                        <div className="font-mono">{d.dateShort}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2.5 border-r border-slate-200 text-left align-top bg-slate-50/50">
                      <div className="font-bold text-slate-800 leading-tight">
                        {currentUser?.fullName || 'Tôi'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{currentUser?.role || 'Waiter'}</div>
                      <div className="mt-2 inline-block px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9.5px] font-bold">
                        {matrixData?.daysWorked || 0} ngày làm
                      </div>
                    </td>

                    {matrixData?.weekDays.map((d) => {
                      const records = matrixData.attByDate[d.isoDate] || [];
                      return (
                        <td
                          key={d.isoDate}
                          className={`p-1.5 border-r border-slate-200 last:border-r-0 align-top ${
                            d.isToday ? 'bg-red-50/30' : ''
                          }`}
                        >
                          {records.length === 0 ? (
                            <span className="text-slate-300 font-mono">-</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {records.map((r, idx) => (
                                <div
                                  key={idx}
                                  className="bg-slate-100 hover:bg-slate-200 rounded p-1 text-[10px] text-left border border-slate-200 transition-colors"
                                >
                                  <div className="font-bold text-slate-700 truncate">{r.shiftName}</div>
                                  <div className="font-mono text-[9px] text-slate-500">
                                    {r.checkIn} - {r.checkOut}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ResponsiveModal>

      {/* MODAL QUÉT CAMERA QR TOÀN MÀN HÌNH (HTML5 QRCODE) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-between p-4 backdrop-blur-sm animate-fadeIn">
          {/* Top Bar */}
          <div className="w-full max-w-md flex items-center justify-between text-white pt-2">
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-emerald-400" />
              <span className="font-bold text-sm">Quét mã QR chấm công</span>
            </div>
            <button
              onClick={handleCloseScanner}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Vùng Camera Scanner */}
          <div className="w-full max-w-sm flex flex-col items-center justify-center relative">
            <div
              id="avora-qr-reader"
              className="w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-black relative"
            />
            <p className="text-xs text-slate-200 mt-4 text-center font-medium bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">
              {scannerStatus}
            </p>
          </div>

          {/* Bottom Bar Info */}
          <div className="w-full max-w-md pb-4 text-center text-slate-400 text-[11px]">
            Đảm bảo giữ thiết bị ổn định và đặt mã QR chi nhánh trong ô quét.
          </div>
        </div>
      )}

      {/* POPUP THÔNG BÁO ĐĂNG KÝ THIẾT BỊ LẦN ĐẦU */}
      {registeredDeviceAlert && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-scaleUp">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <Smartphone size={32} />
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">Đăng Ký Thiết Bị Thành Công!</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {registeredDeviceAlert}
            </p>
            <button
              onClick={() => setRegisteredDeviceAlert(null)}
              className="w-full py-2.5 bg-[#DA251D] hover:bg-[#b91c1c] text-white rounded-xl font-bold text-xs shadow-md transition-all"
            >
              Tôi Đã Hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
