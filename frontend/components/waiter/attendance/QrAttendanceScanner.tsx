'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  SwitchCamera,
  Zap,
  ZapOff,
  ChevronDown,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWaiterStore } from '@/store/useWaiterStore';
import jsQR from 'jsqr';

interface CameraDeviceInfo {
  id: string;
  label: string;
  isBack: boolean;
}

interface QrAttendanceScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
}

export default function QrAttendanceScanner({ isOpen, onClose, onSuccess }: QrAttendanceScannerProps) {
  const { soundEnabled, hapticEnabled, currentBranch } = useWaiterStore();

  const [availableCameras, setAvailableCameras] = useState<CameraDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isCameraListOpen, setIsCameraListOpen] = useState(false);

  const [isStarting, setIsStarting] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerStatus, setScannerStatus] = useState<string>('Đang khởi tạo camera...');

  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);
  const [isZoomSupported, setIsZoomSupported] = useState<boolean>(false);

  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    type?: string;
    employeeName?: string;
    branchName?: string;
    time?: string;
    message?: string;
    firstTimeDevice?: boolean;
  } | null>(null);

  const [gpsCoords, setGpsCoords] = useState<GeolocationCoordinates | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const barcodeDetectorRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isAutoZoomingRef = useRef<boolean>(false);
  const noQrConsecutiveCountRef = useRef<number>(0);
  const currentZoomRef = useRef<number>(1);

  // Giữ ref đồng bộ với state zoom
  useEffect(() => {
    currentZoomRef.current = currentZoom;
  }, [currentZoom]);

  // Âm thanh phản hồi
  const playBeep = (isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 220, ctx.currentTime);
      if (isSuccess) {
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      }
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isSuccess ? 0.25 : 0.4));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (isSuccess ? 0.25 : 0.4));
    } catch {}
  };

  const triggerHaptic = (isSuccess: boolean) => {
    if (!hapticEnabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(isSuccess ? [50, 40, 60] : [100, 50, 100]);
    } catch {}
  };

  // Device ID phần cứng (Fingerprint)
  const getDeviceId = (): string => {
    let id = typeof localStorage !== 'undefined' ? localStorage.getItem('avora_waiter_device_id') : null;
    if (!id) {
      const screenInfo = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}` : 'screen';
      const navInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'nav';
      const raw = `${screenInfo}_${navInfo}_${Date.now()}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
      }
      id = `HW_${Math.abs(hash).toString(16)}_${Date.now().toString(36)}`;
      try {
        localStorage.setItem('avora_waiter_device_id', id);
      } catch {}
    }
    return id;
  };

  // 1. Lấy vị trí GPS song song ngay khi mở scanner
  useEffect(() => {
    if (!isOpen) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsCoords(pos.coords),
        (err) => console.warn('[GPS Warning] Chấm công có thể thiếu tọa độ GPS chính xác:', err.message),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      );
    }
  }, [isOpen]);

  // Dừng toàn bộ camera stream & cleanup
  const stopAllCameraStreams = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // 2. Liệt kê các camera có sẵn sau khi cấp quyền
  const enumerateAllCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      const mapped: CameraDeviceInfo[] = videoInputs.map((d, index) => {
        const label = d.label.toLowerCase();
        const isBack = label.includes('back') || label.includes('sau') || label.includes('rear') || label.includes('environment');
        let cleanLabel = d.label || `Camera ${index + 1}`;

        if (!d.label) {
          cleanLabel = index === 0 ? 'Camera sau (Chính)' : `Camera ${index + 1}`;
        }

        return {
          id: d.deviceId,
          label: cleanLabel,
          isBack,
        };
      });

      setAvailableCameras(mapped);

      // Nếu chưa có camera được chọn, ưu tiên camera sau không phải góc siêu rộng
      const savedCameraId = typeof localStorage !== 'undefined' ? localStorage.getItem('avora_preferred_camera_id') : null;
      const validSaved = mapped.find((c) => c.id === savedCameraId);

      if (validSaved) {
        setSelectedCameraId(validSaved.id);
      } else {
        const backCamera =
          mapped.find((c) => c.isBack && !c.label.toLowerCase().includes('wide') && !c.label.toLowerCase().includes('0.5')) ||
          mapped.find((c) => c.isBack) ||
          mapped[0];

        if (backCamera) {
          setSelectedCameraId(backCamera.id);
        }
      }
    } catch (e) {
      console.warn('[Camera] Không thể liệt kê danh sách camera:', e);
    }
  }, []);

  // 3. Áp dụng mức Zoom mượt mà (ShopeePay Auto-Zoom)
  const applyZoom = useCallback(async (targetZoom: number) => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
    if (capabilities.zoom) {
      const min = capabilities.zoom.min || 1;
      const max = capabilities.zoom.max || 1;
      const clamped = Math.min(max, Math.max(min, targetZoom));
      try {
        await (track as any).applyConstraints({ advanced: [{ zoom: clamped }] });
        setCurrentZoom(clamped);
        currentZoomRef.current = clamped;
      } catch (e) {
        console.warn('Không thể áp dụng zoom phần cứng:', e);
      }
    }
  }, []);

  // 4. Khởi động Camera tương thích cao (Samsung Galaxy S23 + Safari iOS)
  const startCamera = useCallback(
    async (cameraIdToUse?: string) => {
      setIsStarting(true);
      setCameraError(null);
      setScannerStatus('Đang kết nối camera...');

      stopAllCameraStreams();

      try {
        // Constraints mềm dẻo tránh OverconstrainedError trên Android Samsung
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
        };

        if (cameraIdToUse) {
          videoConstraints.deviceId = { exact: cameraIdToUse };
        } else {
          videoConstraints.facingMode = { ideal: 'environment' };
        }

        let stream: MediaStream | null = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
            audio: false,
          });
        } catch (strictErr: any) {
          console.warn('[Camera] Thử fallback 1 (facingMode: environment):', strictErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' },
              audio: false,
            });
          } catch (facingErr) {
            console.warn('[Camera] Thử fallback 2 (video: true):', facingErr);
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }

        if (!stream) {
          throw new Error('Không thể nhận luồng dữ liệu từ camera.');
        }

        mediaStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Đọc tính năng Zoom & Flash của Camera Track
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          const settings: any = track.getSettings ? track.getSettings() : {};

          // Focus liên tục nếu hỗ trợ
          if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
            try {
              await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
            } catch {}
          }

          // Hỗ trợ Hardware Zoom
          if (capabilities.zoom) {
            setIsZoomSupported(true);
            setMaxZoom(capabilities.zoom.max || 1);
            const initZoom = settings.zoom || capabilities.zoom.min || 1;
            setCurrentZoom(initZoom);
            currentZoomRef.current = initZoom;
          } else {
            setIsZoomSupported(false);
            setMaxZoom(1);
            setCurrentZoom(1);
            currentZoomRef.current = 1;
          }

          // Hỗ trợ Torch Flash
          if (capabilities.torch) {
            setIsTorchSupported(true);
          } else {
            setIsTorchSupported(false);
          }
        }

        // Cập nhật lại danh sách camera thực tế
        await enumerateAllCameras();

        // Khởi tạo BarcodeDetector nếu trình duyệt hỗ trợ
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const supported = await (window as any).BarcodeDetector.getSupportedFormats();
            if (supported.includes('qr_code')) {
              barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            }
          } catch {}
        }

        setIsStarting(false);
        setScannerStatus('Hãy đưa mã QR tại quầy vào khung hình');
      } catch (err: any) {
        console.error('[Camera Error]', err);
        let message = 'Không thể mở camera. Vui lòng cấp quyền truy cập máy ảnh!';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Bạn đã từ chối quyền truy cập máy ảnh. Vui lòng cấp quyền trong cài đặt trình duyệt để tiếp tục!';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'Không tìm thấy thiết bị camera trên máy này.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Camera đang bị ứng dụng khác sử dụng hoặc bị khóa. Vui lòng tắt các ứng dụng camera khác và thử lại!';
        } else if (err.name === 'OverconstrainedError') {
          message = 'Camera không tương thích độ phân giải yêu cầu. Đang thử camera khác...';
        }

        setCameraError(message);
        setIsStarting(false);
      }
    },
    [enumerateAllCameras, stopAllCameraStreams],
  );

  // 5. Bật / Tắt đèn Flash
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const newTorch = !isTorchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: newTorch }] });
      setIsTorchOn(newTorch);
    } catch {
      toast.error('Không thể điều khiển đèn Flash trên thiết bị này');
    }
  };

  // 6. Xử lý Gửi mã Chấm công lên Server (Đầy đủ cả qrCodeData và qrData)
  const handleDecodedQr = useCallback(
    async (rawQr: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      playBeep(true);
      triggerHaptic(true);

      setScannerStatus('Đang xác thực thông tin ca và vị trí GPS...');

      let qrData = rawQr.trim();
      try {
        if (rawQr.includes('?')) {
          const url = new URL(rawQr);
          if (url.searchParams.has('qrData')) {
            qrData = url.searchParams.get('qrData') || qrData;
          } else if (url.searchParams.has('code')) {
            qrData = url.searchParams.get('code') || qrData;
          }
        } else if (rawQr.startsWith('{') && rawQr.endsWith('}')) {
          const parsed = JSON.parse(rawQr);
          qrData = parsed.qrData || parsed.qrCodeData || parsed.c || parsed.code || qrData;
        }
      } catch {}

      const payload = {
        qrCodeData: qrData,
        qrData: qrData,
        scanType: 'AUTO',
        latitude: gpsCoords?.latitude ?? 0,
        longitude: gpsCoords?.longitude ?? 0,
        accuracy: gpsCoords?.accuracy ?? 0,
        gpsAccuracy: gpsCoords?.accuracy ?? 0,
        deviceId: getDeviceId(),
        branchId: currentBranch?.id,
      };

      try {
        const res = await fetch('/api/attendance/employee/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          const d = json.data;
          const isCheckIn = d.action === 'CHECK_IN';
          setScanResult({
            success: true,
            type: isCheckIn ? 'VÀO CA (CHECK-IN)' : 'TAN CA (CHECK-OUT)',
            employeeName: d.employeeName || 'Nhân viên',
            branchName: d.branchName || currentBranch?.name || 'Chi nhánh',
            time: d.time || new Date().toLocaleTimeString('vi-VN'),
            message: d.message || (isCheckIn ? 'Ghi nhận vào ca thành công!' : 'Ghi nhận tan ca thành công!'),
            firstTimeDevice: d.firstTimeDevice,
          });

          if (onSuccess) {
            onSuccess(d);
          }

          // Tự đóng sau 2.2 giây để người dùng đọc thông báo thành công
          setTimeout(() => {
            onClose();
          }, 2200);
        } else {
          playBeep(false);
          triggerHaptic(false);
          const errMsg = json.message || json.error?.message || 'Chấm công thất bại. Vui lòng thử lại!';
          setScanResult({
            success: false,
            message: errMsg,
          });

          // Cho phép quét lại sau 3 giây nếu lỗi
          setTimeout(() => {
            setScanResult(null);
            setIsProcessing(false);
            setScannerStatus('Hãy đưa mã QR tại quầy vào khung hình');
          }, 3000);
        }
      } catch (e: any) {
        playBeep(false);
        triggerHaptic(false);
        setScanResult({
          success: false,
          message: 'Lỗi mạng hoặc không thể kết nối tới máy chủ chấm công.',
        });
        setTimeout(() => {
          setScanResult(null);
          setIsProcessing(false);
          setScannerStatus('Hãy đưa mã QR tại quầy vào khung hình');
        }, 3000);
      }
    },
    [isProcessing, gpsCoords, currentBranch, onSuccess, onClose],
  );

  // 7. VÒNG LẶP DUAL-ENGINE: BarcodeDetector + jsQR (Offscreen Canvas) + ShopeePay Auto-Zoom
  useEffect(() => {
    if (!isOpen || isStarting || cameraError) return;

    let lastScanTime = 0;
    let isActive = true;

    // Chuẩn bị canvas giải mã
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    const scanFrame = async (timestamp: number) => {
      if (!isActive) return;

      if (!videoRef.current || isProcessing) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Quét mỗi 120ms (khoảng 8 FPS) để cân bằng tốc độ nhận diện & tiết kiệm pin
      if (timestamp - lastScanTime > 120) {
        lastScanTime = timestamp;

        let detectedRawValue: string | null = null;
        let detectedRatio = 0;

        // --- BƯỚC 1: NATIVE BARCODEDETECTOR ---
        if (barcodeDetectorRef.current) {
          try {
            const barcodes = await barcodeDetectorRef.current.detect(video);
            if (barcodes && barcodes.length > 0) {
              const b = barcodes[0];
              if (b.rawValue) {
                detectedRawValue = b.rawValue;
              }
              if (b.boundingBox) {
                detectedRatio = b.boundingBox.width / video.videoWidth;
              }
            }
          } catch {}
        }

        // --- BƯỚC 2: FALLBACK jsQR TRÊN OFFSCREEN CANVAS (Đảm bảo 100% Safari, S23, Chrome) ---
        if (!detectedRawValue && canvasRef.current) {
          const canvas = canvasRef.current;
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Scale canvas phù hợp để giải mã nhanh và chính xác
          const maxDim = 800;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const cw = Math.floor(vw * scale);
          const ch = Math.floor(vh * scale);

          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, cw, ch);
            const imgData = ctx.getImageData(0, 0, cw, ch);
            const code = jsQR(imgData.data, imgData.width, imgData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (code && code.data) {
              detectedRawValue = code.data;
              const loc = code.location;
              const p1 = loc.topLeftCorner;
              const p2 = loc.topRightCorner;
              const p3 = loc.bottomRightCorner;
              const p4 = loc.bottomLeftCorner;
              const w1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              const w2 = Math.hypot(p3.x - p4.x, p3.y - p4.y);
              const avgW = (w1 + w2) / 2;
              detectedRatio = avgW / cw;
            }
          }
        }

        // --- BƯỚC 3: CƠ CHẾ AUTO-ZOOM SHOPEEPAY ---
        if (detectedRatio > 0 || detectedRawValue) {
          noQrConsecutiveCountRef.current = 0;

          // Nếu phát hiện QR ở xa (< 22% chiều rộng khung hình) và camera hỗ trợ zoom
          if (detectedRatio > 0 && detectedRatio < 0.22 && isZoomSupported && maxZoom > 1) {
            if (!isAutoZoomingRef.current && currentZoomRef.current < Math.min(maxZoom, 3.0)) {
              isAutoZoomingRef.current = true;
              setScannerStatus('Đang tự động phóng to mã QR...');
              const nextZoom = Math.min(maxZoom, currentZoomRef.current + 0.4);
              await applyZoom(nextZoom);
              setTimeout(() => {
                isAutoZoomingRef.current = false;
              }, 350);
            }
          }

          // Nếu đã giải mã thành công mã QR
          if (detectedRawValue) {
            handleDecodedQr(detectedRawValue);
            return;
          }
        } else {
          // Khi KHÔNG có QR trong vùng nhìn
          noQrConsecutiveCountRef.current++;

          // Sau khoảng 1.5 giây (~12 frames) không thấy QR, tự động trả zoom về 1.0x
          if (noQrConsecutiveCountRef.current > 12 && currentZoomRef.current > 1.05 && isZoomSupported) {
            applyZoom(1.0);
            setScannerStatus('Hãy đưa mã QR tại quầy vào khung hình');
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, isStarting, cameraError, isProcessing, isZoomSupported, maxZoom, applyZoom, handleDecodedQr]);

  // Khởi động khi mở
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setScanResult(null);
      startCamera(selectedCameraId);
    } else {
      stopAllCameraStreams();
    }

    return () => {
      stopAllCameraStreams();
    };
  }, [isOpen, selectedCameraId, startCamera, stopAllCameraStreams]);

  // Chuyển đổi camera nhanh
  const handleSwitchCamera = (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    try {
      localStorage.setItem('avora_preferred_camera_id', newCameraId);
    } catch {}
    setIsCameraListOpen(false);
  };

  const cycleNextCamera = () => {
    if (availableCameras.length <= 1) {
      enumerateAllCameras();
      return;
    }
    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    handleSwitchCamera(availableCameras[nextIndex].id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between select-none overflow-hidden touch-none font-sans">
      {/* 1. TOP BAR — NATIVE IOS CAMERA STYLE (LUÔN HIỂN THỊ BIỂU TƯỢNG ĐỔI CAMERA) */}
      <div className="w-full px-4 pt-[max(12px,calc(env(safe-area-inset-top)+6px))] pb-3 flex items-center justify-between z-30 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
        {/* Nút Đóng */}
        <button
          onClick={onClose}
          type="button"
          className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 transition-all flex items-center justify-center text-white backdrop-blur-md cursor-pointer"
          title="Đóng camera"
        >
          <X size={20} strokeWidth={2.5} />
        </button>

        {/* Tiêu đề & Chi nhánh */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 font-black text-sm tracking-tight">
            <Camera size={16} className="text-[#DA251D]" />
            <span>Quét mã QR chấm công</span>
          </div>
          {currentBranch && (
            <span className="text-[10.5px] text-slate-300 font-medium flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="text-red-400" />
              {currentBranch.name}
            </span>
          )}
        </div>

        {/* Cụm công cụ: Flash & LUÔN HIỂN THỊ BIỂU TƯỢNG ĐỔI CAMERA */}
        <div className="flex items-center gap-2">
          {isTorchSupported && (
            <button
              onClick={toggleTorch}
              type="button"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                isTorchOn ? 'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/40' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
              title="Bật/Tắt đèn Flash"
            >
              {isTorchOn ? <Zap size={18} fill="currentColor" /> : <ZapOff size={18} />}
            </button>
          )}

          {/* Biểu tượng đổi camera: LUÔN HIỂN THỊ TRÊN HEADER THEO YÊU CẦU BẮT BUỘC */}
          <div className="relative">
            <button
              onClick={() => {
                if (availableCameras.length <= 1) {
                  enumerateAllCameras();
                }
                setIsCameraListOpen(!isCameraListOpen);
              }}
              type="button"
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 transition-all flex items-center justify-center text-white backdrop-blur-md cursor-pointer"
              title="Lựa chọn camera"
            >
              <SwitchCamera size={18} />
            </button>

            {/* Popup Dropdown chọn Camera */}
            {isCameraListOpen && (
              <div className="absolute top-12 right-0 w-60 bg-slate-900/95 border border-white/20 rounded-2xl shadow-2xl p-2 z-50 backdrop-blur-xl animate-scaleUp">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
                  <span>Chọn camera thiết bị</span>
                  <button
                    onClick={cycleNextCamera}
                    className="text-[10px] text-red-400 hover:underline cursor-pointer"
                  >
                    Đổi nhanh
                  </button>
                </div>
                {availableCameras.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">Đang nhận diện ống kính...</div>
                ) : (
                  availableCameras.map((cam, idx) => (
                    <button
                      key={cam.id || idx}
                      onClick={() => handleSwitchCamera(cam.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                        selectedCameraId === cam.id ? 'bg-[#DA251D] text-white' : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="truncate">{cam.label}</span>
                      {selectedCameraId === cam.id && <span className="w-2 h-2 rounded-full bg-white shrink-0 ml-2" />}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. VÙNG CAMERA CHÍNH & KHUNG VUÔNG 1:1 CHUẨN XÁC */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* Video Camera Feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Darkened Mask with Square Cutout (Khung nhận diện hình vuông 1:1) */}
        <div className="relative z-10 flex flex-col items-center">
          {/* KHUNG NHẬN DIỆN 1:1 HÌNH VUÔNG CHUẨN XÁC */}
          <div
            className="w-[min(72vw,270px)] h-[min(72vw,270px)] aspect-square relative rounded-2xl transition-all duration-300"
            style={{
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
            }}
          >
            {/* 4 Góc Khung Vuông Cân Đối (Bắt buộc nằm chính xác tại 4 góc) */}
            <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-white rounded-tl-xl pointer-events-none" />
            <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-white rounded-tr-xl pointer-events-none" />
            <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-white rounded-bl-xl pointer-events-none" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-white rounded-br-xl pointer-events-none" />

            {/* Tia Laser Quét Đỏ/Trắng Lên Xuống */}
            {!cameraError && !isStarting && !scanResult && (
              <div className="absolute inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-[#DA251D] to-transparent shadow-[0_0_12px_#DA251D] animate-scanningLaser pointer-events-none" />
            )}

            {/* Loading / Starting Indicator */}
            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-xs rounded-2xl">
                <RefreshCw size={28} className="animate-spin text-white mb-2" />
                <span className="text-xs font-bold text-white">Đang mở camera...</span>
              </div>
            )}

            {/* Error Overlay (Tránh màn hình đen) */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-4 text-center rounded-2xl border border-red-500/30">
                <AlertTriangle size={32} className="text-rose-500 mb-2 shrink-0 animate-bounce" />
                <h4 className="text-xs font-bold text-white mb-1">Lỗi Camera</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-3 line-clamp-3">
                  {cameraError}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startCamera(selectedCameraId)}
                    className="px-3 py-1.5 bg-[#DA251D] text-white rounded-lg font-bold text-xs active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    Thử lại
                  </button>
                  <button
                    onClick={cycleNextCamera}
                    className="px-3 py-1.5 bg-white/20 text-white rounded-lg font-bold text-xs active:scale-95 transition-all cursor-pointer"
                  >
                    Chọn camera khác
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nhãn Hướng Dẫn & Trạng Thái ShopeePay Auto-Zoom */}
          <div className="mt-4 px-4 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-md text-xs font-semibold text-center text-slate-200 max-w-xs shadow-lg">
            {scannerStatus}
          </div>
        </div>

        {/* OVERLAY KẾT QUẢ CHẤM CÔNG (Check-in / Check-out) */}
        {scanResult && (
          <div className="absolute inset-0 z-40 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
            <div
              className={`w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border ${
                scanResult.success ? 'bg-slate-900 border-emerald-500/40 text-white' : 'bg-slate-900 border-rose-500/40 text-white'
              }`}
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg ${
                  scanResult.success ? 'bg-emerald-500/20 text-emerald-400 ring-4 ring-emerald-500/10' : 'bg-rose-500/20 text-rose-400 ring-4 ring-rose-500/10'
                }`}
              >
                {scanResult.success ? <CheckCircle2 size={36} strokeWidth={2.5} /> : <AlertTriangle size={36} strokeWidth={2.5} />}
              </div>

              <h3 className="font-black text-lg mb-1 tracking-tight">
                {scanResult.success ? scanResult.type : 'Chấm công chưa thành công'}
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {scanResult.message}
              </p>

              {scanResult.success && (
                <div className="bg-white/5 rounded-2xl p-3 border border-white/10 text-xs space-y-1.5 mb-4 text-left font-sans">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nhân viên:</span>
                    <span className="font-bold text-white">{scanResult.employeeName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chi nhánh:</span>
                    <span className="font-bold text-white">{scanResult.branchName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thời gian:</span>
                    <span className="font-mono font-bold text-emerald-400">{scanResult.time}</span>
                  </div>
                  {scanResult.firstTimeDevice && (
                    <div className="text-[10px] text-amber-300 bg-amber-500/10 p-1.5 rounded-lg border border-amber-500/20 mt-1">
                      Thiết bị này đã được đăng ký cố định cho tài khoản của bạn.
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. FOOTER HƯỚNG DẪN */}
      <div className="w-full px-6 py-4 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-center">
        <p className="text-[11.5px] text-slate-300 font-medium">
          Đảm bảo giữ thiết bị ổn định và đặt mã QR chi nhánh trong ô quét hình vuông.
        </p>
      </div>
    </div>
  );
}
