"use client";

import React, { useState, useEffect } from 'react';
import {
  X,
  Store,
  Printer,
  RefreshCw,
  Receipt,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Phone,
  Shield,
  FileText,
  ChevronRight,
  ExternalLink,
  Menu,
  CalendarCheck,
  QrCode,
  ListOrdered,
  LogOut,
  Wifi,
  Bell,
  Save,
  User as UserIcon,
  ChefHat,
  Sliders,
  Plus,
  Minus,
  Check,
  Tag,
  RotateCcw,
  Utensils,
  UtensilsCrossed,
  Zap,
  Info,
  Pin,
  Monitor,
  Power,
  Lock,
  Mail,
  Send,
  KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { platformBridge } from '@/lib/platform/platform-bridge';
import { printAgent, WindowsPrinter } from '@/lib/print-agent';
import { PosBranch, PosOrder, PosUserData, PosActiveTab } from './pos-types';
import { PosExitConfirmModal } from './PosExitConfirmModal';
import { PosShiftReceiptsView } from './PosShiftReceiptsView';

interface PosSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: PosBranch | null;
  branches: PosBranch[];
  canSwitchBranch: boolean;
  currentUser: PosUserData | null;
  onSelectBranch: (branch: PosBranch) => void;
  onSyncData: () => Promise<void>;
  lastSyncedAt?: Date;
  completedOrders?: PosOrder[];
  allOrders?: PosOrder[];
  onReprintReceipt?: (order: PosOrder) => void;
  activePosTab?: PosActiveTab;
  onSelectTab?: (tab: PosActiveTab) => void;
  onLogout?: () => void;
  onGoToAdmin?: () => void;
  onUpdateBranchSettings?: (updatedBranch: PosBranch) => void;
  onOpenDesktopLaunch?: () => void;
  orderCounts?: {
    allOrders?: number;
    qrOrders?: number;
    reservations?: number;
  };
  onOpenEndOfDayReport?: () => void;
}

// Máy in ảo hệ điều hành
const VIRTUAL_PRINTERS = [
  { id: 'local-pdf', name: 'Microsoft Print to PDF' },
  { id: 'local-onenote', name: 'OneNote (Desktop)' },
  { id: 'local-xps', name: 'Microsoft XPS Document Writer' },
  { id: 'local-fax', name: 'Fax' },
];

// Mẫu máy in vật lý thông dụng
const DEFAULT_PHYSICAL_MODELS = [
  { id: 'default-xp350b', name: 'Xprinter XP-350B' },
  { id: 'default-tmt82', name: 'Epson TM-T82' },
];

export const PosSettingsDrawer: React.FC<PosSettingsDrawerProps> = ({
  isOpen,
  onClose,
  currentBranch,
  branches,
  canSwitchBranch,
  currentUser,
  onSelectBranch,
  onSyncData,
  lastSyncedAt,
  completedOrders = [],
  allOrders = [],
  onReprintReceipt,
  activePosTab = 'TABLES',
  onSelectTab,
  onLogout,
  onGoToAdmin,
  onUpdateBranchSettings,
  onOpenDesktopLaunch,
  orderCounts = { allOrders: 0, qrOrders: 0, reservations: 0 },
  onOpenEndOfDayReport,
}) => {
  // 1. Sidebar menu bên trái:
  // - Máy in & Phiếu chế biến
  // - Mở két tiền thu ngân
  // - Đồng bộ dữ liệu POS
  // - Hóa đơn trong ca
  // - Chi nhánh & Giờ mở cửa
  // - Trang Quản trị Hệ thống
  const [activeSidebarItem, setActiveSidebarItem] = useState<
    'settings' | 'drawer' | 'sync' | 'invoices' | 'branch' | 'security' | 'about'
  >('settings');

  // -------------------------------------------------------------
  // TAB SECURITY: POS PIN Management & OTP Verification
  // -------------------------------------------------------------
  const [hasPosPin, setHasPosPin] = useState<boolean>(false);
  const [posPinUpdatedAt, setPosPinUpdatedAt] = useState<string | null>(null);
  const [maskedUserEmail, setMaskedUserEmail] = useState<string | null>(null);
  const [isLoadingPosPin, setIsLoadingPosPin] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'change' | 'remove'>('setup');

  // Phương thức xác minh danh tính: 'PASSWORD' (Mật khẩu) hoặc 'OTP' (Mã OTP 6 số qua Email)
  const [pinAuthMethod, setPinAuthMethod] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [pinPassword, setPinPassword] = useState<string>('');
  const [pinOtp, setPinOtp] = useState<string>('');
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [otpSentNotice, setOtpSentNotice] = useState<string | null>(null);

  const [pinCode, setPinCode] = useState<string>('');
  const [pinConfirm, setPinConfirm] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingPin, setIsSubmittingPin] = useState<boolean>(false);

  // Đếm ngược cooldown gửi mã OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const fetchPinStatus = async () => {
    setIsLoadingPosPin(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('avora_pos_token')
          : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/pos/auth/pin/status', {
        headers,
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHasPosPin(!!data.hasPin);
        setPosPinUpdatedAt(data.updatedAt || null);
        if (data.maskedEmail) {
          setMaskedUserEmail(data.maskedEmail);
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingPosPin(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPinStatus();
    }
  }, [isOpen]);

  // Gửi mã OTP 6 số về Email của người dùng
  const handleRequestOtp = async () => {
    if (otpCooldown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    setPinError(null);
    setOtpSentNotice(null);

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('avora_pos_token')
          : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/pos/auth/pin/request-otp', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Không thể gửi mã OTP.');
      }

      setOtpCooldown(60);
      setOtpSentNotice(data.message || 'Đã gửi mã OTP 6 số về email của bạn!');
      if (data.maskedEmail) setMaskedUserEmail(data.maskedEmail);
      toast.success(data.message || 'Đã gửi mã OTP 6 số về email thành công!');
    } catch (err: any) {
      setPinError(err.message || 'Lỗi gửi mã OTP xác thực.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    // 1. Kiểm tra xác thực danh tính
    if (pinAuthMethod === 'PASSWORD') {
      if (!pinPassword.trim()) {
        setPinError('Vui lòng nhập mật khẩu tài khoản hiện tại.');
        return;
      }
    } else {
      if (!pinOtp.trim() || pinOtp.trim().length !== 6) {
        setPinError('Vui lòng nhập đầy đủ mã xác thực OTP gồm đúng 6 chữ số.');
        return;
      }
    }

    // 2. Kiểm tra mã PIN (nếu là setup hoặc change)
    if (pinModalMode !== 'remove') {
      if (!/^\d{4}$/.test(pinCode.trim())) {
        setPinError('Mã PIN phải bao gồm đúng 4 chữ số (0-9).');
        return;
      }
      if (pinCode.trim() !== pinConfirm.trim()) {
        setPinError('Mã PIN xác nhận không khớp.');
        return;
      }
    }

    setIsSubmittingPin(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('access_token') ||
            localStorage.getItem('token') ||
            localStorage.getItem('avora_pos_token')
          : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = '/api/pos/auth/pin/setup';
      let method = 'POST';
      const body: any = {};

      if (pinAuthMethod === 'PASSWORD') {
        body.password = pinPassword.trim();
      } else {
        body.otp = pinOtp.trim();
      }

      if (pinModalMode === 'setup') {
        body.pin = pinCode.trim();
      } else if (pinModalMode === 'change') {
        url = '/api/pos/auth/pin/change';
        method = 'PUT';
        body.newPin = pinCode.trim();
      } else if (pinModalMode === 'remove') {
        url = '/api/pos/auth/pin';
        method = 'DELETE';
      }

      const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Thao tác không thành công.');
      }

      toast.success(data.message || 'Thao tác thành công!');
      setIsPinModalOpen(false);
      fetchPinStatus();
    } catch (err: any) {
      setPinError(err.message || 'Có lỗi xảy ra.');
    } finally {
      setIsSubmittingPin(false);
    }
  };


  // Sub-tabs cấu hình máy in: In hóa đơn / tạm tính | In bar / bếp | In tem mặt hàng
  const [printSubTab, setPrintSubTab] = useState<'bill' | 'kitchen' | 'barcode'>('bill');

  // Trạng thái kết nối Print Agent Local & danh sách máy in Windows
  const [agentStatus, setAgentStatus] = useState<'CHECKING' | 'ONLINE' | 'OFFLINE'>('CHECKING');
  const [windowsPrinters, setWindowsPrinters] = useState<WindowsPrinter[]>([]);

  // Dữ liệu máy in & khu vực chế biến tải từ backend
  const [printers, setPrinters] = useState<any[]>([]);
  const [kitchenStations, setKitchenStations] = useState<any[]>([]);
  const [hotKitchenStation, setHotKitchenStation] = useState<any>(null);
  const [drinkBarStation, setDrinkBarStation] = useState<any>(null);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // TAB 1: In hóa đơn / tạm tính (RECEIPT + TEMP_BILL)
  // -------------------------------------------------------------
  const [receiptPrinterName, setReceiptPrinterName] = useState<string>('');
  const [defaultReceiptPrinterId, setDefaultReceiptPrinterId] = useState<string>('');
  const [defaultPaperSize, setDefaultPaperSize] = useState<'80mm' | '58mm' | 'XP-350B'>('80mm');
  const [billCopies, setBillCopies] = useState<number>(1);
  const [tempBillCopies, setTempBillCopies] = useState<number>(1);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(true);
  const [autoPrintTempBill, setAutoPrintTempBill] = useState<boolean>(false);
  const [excludeBuffetItemsFromTempBill, setExcludeBuffetItemsFromTempBill] = useState<boolean>(false);
  const [removeBuffetItemsOnCheckout, setRemoveBuffetItemsOnCheckout] = useState<boolean>(false);

  // -------------------------------------------------------------
  // TAB 2: In bar / bếp (KITCHEN + BAR)
  // -------------------------------------------------------------
  // MÁY IN BẾP (NÓNG)
  const [kitchenEnabled, setKitchenEnabled] = useState<boolean>(true);
  const [kitchenPrinterName, setKitchenPrinterName] = useState<string>('');
  const [kitchenPrinterId, setKitchenPrinterId] = useState<string>('');
  const [kitchenPaperSize, setKitchenPaperSize] = useState<'80mm' | '58mm' | 'XP-350B'>('80mm');
  const [kitchenCopies, setKitchenCopies] = useState<number>(1);

  // MÁY IN QUẦY BAR (NƯỚC)
  const [barEnabled, setBarEnabled] = useState<boolean>(true);
  const [barPrinterName, setBarPrinterName] = useState<string>('');
  const [barPrinterId, setBarPrinterId] = useState<string>('');
  const [barPaperSize, setBarPaperSize] = useState<'80mm' | '58mm' | 'XP-350B'>('80mm');
  const [barCopies, setBarCopies] = useState<number>(1);

  // -------------------------------------------------------------
  // TAB 3: In tem mặt hàng (ITEM_LABEL)
  // -------------------------------------------------------------
  const [barcodeEnabled, setBarcodeEnabled] = useState<boolean>(true);
  const [barcodePrinterName, setBarcodePrinterName] = useState<string>('');
  const [barcodePrinterId, setBarcodePrinterId] = useState<string>('');
  const [barcodePaperSize, setBarcodePaperSize] = useState<string>('30x50mm');
  const [barcodeCopies, setBarcodeCopies] = useState<number>(1);

  // Các thao tác khác
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [drawerReason, setDrawerReason] = useState('Thu ngân mở két tiền kiểm tra');
  const [isKickingDrawer, setIsKickingDrawer] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

  const handleExitDesktopApp = () => {
    setIsExitConfirmOpen(true);
  };

  const handleConfirmExit = async () => {
    setIsExitConfirmOpen(false);
    onClose();
    await platformBridge.exitApp?.();
  };

  // Real-time Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const date = now.toLocaleDateString('vi-VN');
      setCurrentTimeStr(`${time} ${date}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  // Khởi tạo thông số In hóa đơn từ branch hiện tại
  useEffect(() => {
    if (currentBranch) {
      setDefaultReceiptPrinterId(currentBranch.defaultReceiptPrinterId || '');
      setDefaultPaperSize((currentBranch.defaultPaperSize as any) || '80mm');
      setBillCopies(currentBranch.receiptCopies || 1);
      setTempBillCopies(1);
      setAutoPrintReceipt(currentBranch.autoPrintReceipt !== false);
      setAutoPrintTempBill(!!currentBranch.autoPrintTempBill);
      setBranchQrAutoSend(!!(currentBranch as any).qrAutoSendToKitchen);
    }
  }, [currentBranch]);

  const [branchQrAutoSend, setBranchQrAutoSend] = useState<boolean>(false);
  const [isUpdatingQrSetting, setIsUpdatingQrSetting] = useState<boolean>(false);

  const handleToggleQrAutoSend = async () => {
    if (!currentBranch) return;
    const nextVal = !branchQrAutoSend;
    setIsUpdatingQrSetting(true);
    try {
      const res = await fetch(`/api/qr-order/admin/branches/${currentBranch.id}/qr-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrAutoSendToKitchen: nextVal }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Lỗi lưu cấu hình');
      }
      setBranchQrAutoSend(nextVal);
      if (onUpdateBranchSettings) {
        onUpdateBranchSettings({
          ...currentBranch,
          qrAutoSendToKitchen: nextVal,
        } as any);
      }
      toast.success(
        nextVal
          ? 'Đã BẬT: Món gọi qua QR sẽ tự động gửi thẳng vào bếp!'
          : 'Đã TẮT: Món gọi qua QR cần nhân viên duyệt tại tab QR Order.'
      );
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật cấu hình');
    } finally {
      setIsUpdatingQrSetting(false);
    }
  };

  // Kiểm tra Print Agent và lấy danh sách máy in Windows thật
  const checkAgentAndLoadPrinters = async (): Promise<WindowsPrinter[]> => {
    setAgentStatus('CHECKING');
    try {
      const health = await printAgent.checkHealth();
      if (health.ok) {
        setAgentStatus('ONLINE');
        const res = await printAgent.getPrinters();
        const prs = res.printers || [];
        const seen = new Set<string>();
        const uniquePrs = prs
          .map((p: any) => {
            const name = String(p.name || p.Name || '').trim();
            const id = String(p.id || p.Id || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
            const isVirtual = Boolean(
              p.isVirtual ?? p.IsVirtual ?? /(pdf|onenote|xps|fax|portprompt|nul:|anydesk|print to)/i.test(name)
            );
            return {
              id,
              name,
              driverName: String(p.driverName || p.DriverName || ''),
              portName: String(p.portName || p.PortName || ''),
              status: String(p.status || p.Status || 'READY'),
              isDefault: Boolean(p.isDefault ?? p.IsDefault),
              isVirtual,
            };
          })
          .filter((p) => {
            const key = (p.name || '').trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        setWindowsPrinters(uniquePrs);
        return uniquePrs;
      } else {
        setAgentStatus('OFFLINE');
        setWindowsPrinters([]);
        return [];
      }
    } catch (e) {
      setAgentStatus('OFFLINE');
      setWindowsPrinters([]);
      return [];
    }
  };

  // Load danh sách máy in, trạm & cài đặt BranchPrinterSetting của chi nhánh
  useEffect(() => {
    if (isOpen && currentBranch) {
      loadBranchPrintData(currentBranch.id);
    }
  }, [isOpen, currentBranch]);

  const loadBranchPrintData = async (branchId: string) => {
    setIsLoadingPrinters(true);
    try {
      const [detectedPrinters, printersRes, stationsRes, settingsRes] = await Promise.all([
        checkAgentAndLoadPrinters(),
        fetch(`/api/print-routing/printers?branchId=${branchId}`, { credentials: 'include' }),
        fetch(`/api/print-routing/stations?branchId=${branchId}`, { credentials: 'include' }),
        fetch(`/api/pos/branches/${branchId}/print-settings`, { credentials: 'include' }),
      ]);

      let loadedPrinters: any[] = [];
      if (printersRes.ok) {
        const json = await printersRes.json();
        if (json.success && Array.isArray(json.data)) {
          loadedPrinters = json.data;
          setPrinters(json.data);
        }
      }

      // Đọc cấu hình theo purpose từ BranchPrinterSetting
      if (settingsRes.ok) {
        const sJson = await settingsRes.json();
        if (sJson.success) {
          if (sJson.data?.excludeBuffetItemsFromTempBill !== undefined) {
            setExcludeBuffetItemsFromTempBill(Boolean(sJson.data.excludeBuffetItemsFromTempBill));
          }
          if (sJson.data?.removeBuffetItemsOnCheckout !== undefined) {
            setRemoveBuffetItemsOnCheckout(Boolean(sJson.data.removeBuffetItemsOnCheckout));
          }
        }
        if (sJson.success && Array.isArray(sJson.data?.settings)) {
          const settings: any[] = sJson.data.settings;

          const rSet = settings.find((s) => s.purpose === 'RECEIPT');
          if (rSet) {
            if (rSet.printerName) setReceiptPrinterName(rSet.printerName);
            if (rSet.printerId) setDefaultReceiptPrinterId(rSet.printerId);
            if (rSet.paperSize) setDefaultPaperSize(rSet.paperSize as any);
            if (rSet.copies) setBillCopies(rSet.copies);
            if (rSet.autoPrint !== undefined) setAutoPrintReceipt(rSet.autoPrint);
          }

          const tSet = settings.find((s) => s.purpose === 'TEMP_BILL');
          if (tSet) {
            if (tSet.copies) setTempBillCopies(tSet.copies);
            if (tSet.autoPrint !== undefined) setAutoPrintTempBill(tSet.autoPrint);
          }

          const kSet = settings.find((s) => s.purpose === 'KITCHEN');
          if (kSet) {
            if (kSet.printerName) setKitchenPrinterName(kSet.printerName);
            if (kSet.printerId) setKitchenPrinterId(kSet.printerId);
            if (kSet.paperSize) setKitchenPaperSize(kSet.paperSize as any);
            if (kSet.copies) setKitchenCopies(kSet.copies);
            if (kSet.isEnabled !== undefined) setKitchenEnabled(kSet.isEnabled);
          }

          const bSet = settings.find((s) => s.purpose === 'BAR');
          if (bSet) {
            if (bSet.printerName) setBarPrinterName(bSet.printerName);
            if (bSet.printerId) setBarPrinterId(bSet.printerId);
            if (bSet.paperSize) setBarPaperSize(bSet.paperSize as any);
            if (bSet.copies) setBarCopies(bSet.copies);
            if (bSet.isEnabled !== undefined) setBarEnabled(bSet.isEnabled);
          }

          const lSet = settings.find((s) => s.purpose === 'ITEM_LABEL');
          if (lSet) {
            if (lSet.printerName) setBarcodePrinterName(lSet.printerName);
            if (lSet.printerId) setBarcodePrinterId(lSet.printerId);
            if (lSet.paperSize) setBarcodePaperSize(lSet.paperSize);
            if (lSet.copies) setBarcodeCopies(lSet.copies);
            if (lSet.isEnabled !== undefined) setBarcodeEnabled(lSet.isEnabled);
          }
        }
      }

      // Tự động gán mặc định thông minh nếu chưa có cấu hình
      setReceiptPrinterName((prev) => {
        if (prev) return prev;
        const physical = detectedPrinters.find((p) => !p.isVirtual);
        if (physical) return physical.name;
        return detectedPrinters[0]?.name || 'Xprinter XP-350B';
      });

      setKitchenPrinterName((prev) => {
        if (prev) return prev;
        const physical = detectedPrinters.find((p) => !p.isVirtual);
        return physical ? physical.name : detectedPrinters[0]?.name || '';
      });

      setBarPrinterName((prev) => {
        if (prev) return prev;
        const physical = detectedPrinters.find((p) => !p.isVirtual);
        return physical ? physical.name : detectedPrinters[0]?.name || '';
      });

      setBarcodePrinterName((prev) => {
        if (prev) return prev;
        const physical = detectedPrinters.find((p) => !p.isVirtual && p.name?.toLowerCase().includes('xp-350'));
        if (physical) return physical.name;
        return detectedPrinters.find((p) => !p.isVirtual)?.name || '';
      });

      // Trạm chế biến
      if (stationsRes.ok) {
        const stJson = await stationsRes.json();
        if (stJson.success && Array.isArray(stJson.data)) {
          setKitchenStations(stJson.data);
          const hotSt = stJson.data.find(
            (s: any) =>
              s.code === 'HOT_KITCHEN' ||
              s.stationType === 'HOT_KITCHEN' ||
              s.name?.toLowerCase().includes('bếp') ||
              s.name?.toLowerCase().includes('nóng'),
          );
          setHotKitchenStation(hotSt || null);

          const barSt = stJson.data.find(
            (s: any) =>
              s.code === 'DRINK_BAR' ||
              s.stationType === 'DRINK_BAR' ||
              s.name?.toLowerCase().includes('bar') ||
              s.name?.toLowerCase().includes('pha chế') ||
              s.name?.toLowerCase().includes('nước'),
          );
          setDrinkBarStation(barSt || null);
        }
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu in ấn chi nhánh:', err);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  // In thử máy in qua Print Agent Local
  const handleTestPrint = async (
    targetPrinterName: string,
    purpose: 'RECEIPT' | 'KITCHEN' | 'BAR' | 'ITEM_LABEL',
    paperOrLabelSize: string,
  ) => {
    if (!targetPrinterName) {
      toast.error('Vui lòng chọn máy in trước khi in thử!');
      return;
    }

    const isVirtual = /(pdf|onenote|xps|fax|portprompt|nul:|print to)/i.test(targetPrinterName);
    if (isVirtual) {
      toast('Đang gửi lệnh tới máy in ảo Windows. Lưu ý: Máy in hóa đơn nhiệt cần máy in thật (XP-80C / Xprinter) kết nối USB/LAN!', {
        icon: 'ℹ️',
        duration: 5000,
      });
    }

    setTestingPrinterId(targetPrinterName);
    try {
      const res = await printAgent.testPrint(targetPrinterName, purpose, paperOrLabelSize);
      if (res.success) {
        toast.success(`Đã gửi lệnh in test thành công tới máy in [${targetPrinterName}]!`, {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        });
      } else {
        toast.error(`In thử thất bại: ${res.message || 'Không có phản hồi từ máy in'}`);
      }
    } catch (err: any) {
      toast.error(`Không thể kết nối máy in: ${err.message}`);
    } finally {
      setTestingPrinterId(null);
    }
  };

  // Lưu cài đặt máy in vào Database
  const handleSaveSettings = async () => {
    if (!currentBranch) return;
    setIsSaving(true);
    try {
      const isUUID = (str?: string | null) =>
        str ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) : false;

      const matchedReceiptPrinter = printers.find(
        (p) => p.name?.toLowerCase() === receiptPrinterName.toLowerCase(),
      );

      // 1. Cấu hình branch & danh sách BranchPrinterSetting theo purpose
      const settingsPayload = [
        {
          purpose: 'RECEIPT',
          printerName: receiptPrinterName || null,
          printerId: matchedReceiptPrinter?.id || (isUUID(defaultReceiptPrinterId) ? defaultReceiptPrinterId : null),
          paperSize: defaultPaperSize,
          copies: Number(billCopies) || 1,
          autoPrint: autoPrintReceipt,
          isEnabled: true,
        },
        {
          purpose: 'TEMP_BILL',
          printerName: receiptPrinterName || null,
          printerId: matchedReceiptPrinter?.id || (isUUID(defaultReceiptPrinterId) ? defaultReceiptPrinterId : null),
          paperSize: defaultPaperSize,
          copies: Number(tempBillCopies) || 1,
          autoPrint: autoPrintTempBill,
          isEnabled: true,
        },
        {
          purpose: 'KITCHEN',
          printerName: kitchenPrinterName || null,
          paperSize: kitchenPaperSize,
          copies: Number(kitchenCopies) || 1,
          isEnabled: kitchenEnabled,
        },
        {
          purpose: 'BAR',
          printerName: barPrinterName || null,
          paperSize: barPaperSize,
          copies: Number(barCopies) || 1,
          isEnabled: barEnabled,
        },
        {
          purpose: 'ITEM_LABEL',
          printerName: barcodePrinterName || null,
          paperSize: barcodePaperSize,
          copies: Number(barcodeCopies) || 1,
          isEnabled: barcodeEnabled,
        },
      ];

      const branchPayload = {
        defaultReceiptPrinterId: matchedReceiptPrinter?.id || (isUUID(defaultReceiptPrinterId) ? defaultReceiptPrinterId : null),
        defaultPaperSize,
        receiptCopies: Number(billCopies) || 1,
        autoPrintReceipt,
        autoPrintTempBill,
        excludeBuffetItemsFromTempBill,
        removeBuffetItemsOnCheckout,
        settings: settingsPayload,
      };

      const res = await fetch(`/api/pos/branches/${currentBranch.id}/print-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(branchPayload),
      });

      const json = await res.json();

      // 2. Gán máy in cho Bếp Nóng (nếu có trạm DB)
      const matchedKitchenPrinter = printers.find(
        (p) => p.name?.toLowerCase() === kitchenPrinterName.toLowerCase(),
      );
      if (hotKitchenStation && isUUID(hotKitchenStation.id) && matchedKitchenPrinter?.id) {
        await fetch('/api/print-routing/stations/assign-printer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            stationId: hotKitchenStation.id,
            printerId: matchedKitchenPrinter.id,
            isPrimary: true,
            priority: 1,
            printPurpose: 'KITCHEN_ORDER',
          }),
        }).catch((e) => console.error('Lỗi gán máy in bếp nóng:', e));
      }

      // 3. Gán máy in cho Quầy Bar (nếu có trạm DB)
      const matchedBarPrinter = printers.find(
        (p) => p.name?.toLowerCase() === barPrinterName.toLowerCase(),
      );
      if (drinkBarStation && isUUID(drinkBarStation.id) && matchedBarPrinter?.id) {
        await fetch('/api/print-routing/stations/assign-printer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            stationId: drinkBarStation.id,
            printerId: matchedBarPrinter.id,
            isPrimary: true,
            priority: 1,
            printPurpose: 'KITCHEN_ORDER',
          }),
        }).catch((e) => console.error('Lỗi gán máy in quầy bar:', e));
      }

      toast.success('Đã lưu cấu hình máy in chi nhánh thành công!', {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      });

      if (onUpdateBranchSettings && json.data) {
        onUpdateBranchSettings(json.data);
      }
      onClose();
    } catch (err: any) {
      toast.error(`Lỗi lưu cài đặt: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Đồng bộ dữ liệu POS
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await onSyncData();
      toast.success('Đồng bộ dữ liệu POS thành công!');
    } catch (err: any) {
      toast.error(`Đồng bộ thất bại: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Mở két tiền thu ngân
  const handleOpenCashDrawer = async () => {
    if (!currentBranch) return;
    setIsKickingDrawer(true);
    try {
      const targetPrinter = receiptPrinterName || 'Xprinter XP-350B';

      // 1. Phát xung mở két trực tiếp qua Print Agent
      const kickRes = await printAgent.openCashDrawer(targetPrinter);

      // 2. Ghi nhật ký kiểm toán backend
      const res = await fetch('/api/pos/cash-drawer/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branchId: currentBranch.id,
          reason: drawerReason.trim() || 'Mở két tiền thu ngân POS',
        }),
      });
      const json = await res.json();

      if (kickRes.success || (res.ok && json.success)) {
        toast.success(`Đã kích xung mở két tiền qua máy in [${targetPrinter}]!`, {
          icon: <Unlock className="w-4 h-4 text-emerald-500" />,
        });
      } else {
        toast.error(kickRes.message || json.message || 'Không thể mở két tiền.');
      }
    } catch (err: any) {
      toast.error(`Lỗi mở két tiền: ${err.message}`);
    } finally {
      setIsKickingDrawer(false);
    }
  };

  // Helper render dropdown máy in phân loại rõ ràng: Máy in vật lý & Máy in ảo
  const renderPrinterDropdown = (
    value: string,
    onChange: (val: string) => void,
    disabled?: boolean,
    placeholder = '-- Chọn máy in Windows --',
  ) => {
    const seenNames = new Set<string>();
    const deduplicatedPrinters: WindowsPrinter[] = [];
    for (const p of windowsPrinters) {
      const lowerName = (p?.name || '').trim().toLowerCase();
      if (lowerName && !seenNames.has(lowerName)) {
        seenNames.add(lowerName);
        deduplicatedPrinters.push(p);
      }
    }

    const physicalList = deduplicatedPrinters.filter((p) => !p.isVirtual);
    const virtualList = deduplicatedPrinters.filter((p) => p.isVirtual);

    const isMissing =
      Boolean(value) &&
      agentStatus === 'ONLINE' &&
      deduplicatedPrinters.length > 0 &&
      !deduplicatedPrinters.some((p) => p.name.toLowerCase() === value.toLowerCase());

    return (
      <div className="space-y-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full h-10 px-3 text-xs bg-slate-50 border rounded-xl outline-none focus:bg-white transition-colors disabled:opacity-50 disabled:bg-slate-100 cursor-pointer ${
            isMissing
              ? 'border-amber-400 bg-amber-50/40 text-amber-900 focus:border-amber-500 font-semibold'
              : 'border-slate-300 focus:border-[#da251d]'
          }`}
        >
          <option value="">{placeholder}</option>
          {deduplicatedPrinters.length > 0 ? (
            <>
              {physicalList.length > 0 && (
                <optgroup label="Máy in vật lý (Khuyên dùng)">
                  {physicalList.map((p, idx) => (
                    <option key={`phy-${p.name}-${idx}`} value={p.name}>
                      {p.name} {p.status ? `(${p.status})` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {virtualList.length > 0 && (
                <optgroup label="Máy in ảo / Hệ điều hành (PDF, OneNote...)">
                  {virtualList.map((p, idx) => (
                    <option key={`vir-${p.name}-${idx}`} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </>
          ) : (
            <>
              <optgroup label="Máy in vật lý thông dụng">
                {DEFAULT_PHYSICAL_MODELS.map((p, idx) => (
                  <option key={`def-phy-${p.name}-${idx}`} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Máy in ảo / Hệ điều hành">
                {VIRTUAL_PRINTERS.map((p, idx) => (
                  <option key={`def-vir-${p.name}-${idx}`} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            </>
          )}
        </select>
        {isMissing && (
          <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Máy in đã cấu hình không còn tồn tại trên thiết bị này</span>
          </p>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 text-slate-800 select-none animate-in fade-in duration-150">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (Tone sáng đỏ trắng thương hiệu AVORA) */}
      {/* ========================================================================= */}
      <header className="h-13 sm:h-14 bg-white border-b border-slate-200 px-3 sm:px-5 flex items-center justify-between gap-3 shrink-0 z-20 shadow-2xs">
        {/* Left: Hamburger + Logo AVORA */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-[#da251d] flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng menu cài đặt"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <img
              src="/avora_logo_ngang.png"
              alt="AVORA Restaurant"
              className="h-8 sm:h-9 w-auto max-w-[130px] sm:max-w-[150px] object-contain cursor-pointer"
            />
          </div>

          <span className="hidden sm:inline-block text-xs font-black text-slate-800 px-2.5 py-0.5 bg-slate-100 rounded-md border border-slate-200">
            Cài đặt POS Chi Nhánh
          </span>
        </div>

        {/* Center: Navigation shortcuts */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectTab?.('TABLES');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activePosTab === 'TABLES'
                ? 'bg-[#da251d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            Sơ đồ bàn
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectTab?.('ORDERS');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activePosTab === 'ORDERS'
                ? 'bg-[#da251d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span>Tất cả đơn</span>
            {orderCounts.allOrders !== undefined && orderCounts.allOrders > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-red-100 text-[#da251d] rounded-full font-bold">
                {orderCounts.allOrders}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectTab?.('RESERVATIONS');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activePosTab === 'RESERVATIONS'
                ? 'bg-[#da251d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span>Đặt bàn</span>
            {orderCounts.reservations !== undefined && orderCounts.reservations > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-sky-100 text-sky-700 rounded-full font-bold">
                {orderCounts.reservations}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectTab?.('QR_ORDERS');
            }}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activePosTab === 'QR_ORDERS'
                ? 'bg-[#da251d] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span>QR Order</span>
            {orderCounts.qrOrders !== undefined && orderCounts.qrOrders > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full font-bold">
                {orderCounts.qrOrders}
              </span>
            )}
          </button>
        </nav>

        {/* Right: Trực tuyến + Đóng */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Online</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-red-50 hover:border-red-200 text-slate-500 hover:text-[#da251d] flex items-center justify-center transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BODY: LEFT SIDEBAR + RIGHT CONTENT */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Ẩn hoàn toàn khi vào Tab Hóa đơn để tối ưu 100% diện tích) */}
        {activeSidebarItem !== 'invoices' && (
        <aside className="w-56 sm:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 select-none overflow-y-auto">
          <div className="p-3 space-y-4">
            {/* NHÓM: THIẾT LẬP THIẾT BỊ */}
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#da251d]" />
                <span>CÀI ĐẶT THIẾT BỊ</span>
              </div>
              <div className="mt-1 space-y-1">
                {/* 1. Máy in & Phiếu chế biến */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('settings')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    activeSidebarItem === 'settings'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 shrink-0" />
                    <span>Máy in & Phiếu chế biến</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      activeSidebarItem === 'settings' ? 'bg-white/20' : 'bg-slate-100'
                    }`}
                  >
                    {printers.length} máy
                  </span>
                </button>

                {/* 2. Mở két tiền thu ngân */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('drawer')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeSidebarItem === 'drawer'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]'
                  }`}
                >
                  <Unlock className="w-4 h-4 shrink-0" />
                  <span>Mở két tiền thu ngân</span>
                </button>

                {/* 3. Đồng bộ dữ liệu POS */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('sync')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeSidebarItem === 'sync'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>Đồng bộ dữ liệu POS</span>
                </button>
              </div>
            </div>

            {/* NHÓM: QUẢN LÝ VẬN HÀNH */}
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-[#da251d]" />
                <span>QUẢN LÝ VẬN HÀNH</span>
              </div>
              <div className="mt-1 space-y-1.5">
                {/* 4a. Tổng kết cuối ngày / Kết ca */}
                {onOpenEndOfDayReport && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEndOfDayReport();
                    }}
                    className="w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 cursor-pointer bg-red-50/60 hover:bg-red-50 border border-red-200/80 hover:border-[#da251d] shadow-2xs group active:scale-[0.99]"
                    title="Mở tổng kết doanh thu và in phiếu kết ca"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-[#da251d] text-white flex items-center justify-center shrink-0 shadow-xs">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-900 group-hover:text-[#da251d] truncate">
                          Tổng kết cuối ngày
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-white text-[#da251d] border border-red-200 shrink-0">
                        Báo cáo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal leading-snug group-hover:text-slate-700 pl-8">
                      Xem doanh thu, phương thức thanh toán, hàng hóa bán ra và in phiếu kết ca.
                    </p>
                  </button>
                )}

                {/* 4b. Hóa đơn & Biên lai */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('invoices')}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]"
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 shrink-0" />
                    <span>Hóa đơn & Biên lai</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                    {(allOrders && allOrders.length > 0)
                      ? allOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED').length || allOrders.length
                      : completedOrders.length}
                  </span>
                </button>

                {/* 5. Chi nhánh & Giờ mở cửa */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('branch')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeSidebarItem === 'branch'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]'
                  }`}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>Chi nhánh & Giờ mở cửa</span>
                </button>

                {/* 5b. Bảo mật & Đăng nhập (Mã PIN POS) */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('security')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    activeSidebarItem === 'security'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    <span>Bảo mật &amp; Đăng nhập</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      activeSidebarItem === 'security'
                        ? 'bg-white/20 text-white'
                        : hasPosPin
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {hasPosPin ? 'ĐÃ CÓ PIN' : 'CHƯA CÓ'}
                  </span>
                </button>

                {/* 6. Trang Quản trị Hệ thống */}
                <button
                  type="button"
                  onClick={() => {
                    if (onGoToAdmin) {
                      onGoToAdmin();
                    } else if (platformBridge.isDesktop) {
                      platformBridge.openExternalBrowser('/admin/dashboard');
                    } else {
                      window.open('/admin/dashboard', '_blank');
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-slate-500" />
                    <span>Trang Quản Trị Hệ Thống</span>
                  </div>
                </button>


                {/* 8. Giới thiệu & Cập nhật ứng dụng */}
                <button
                  type="button"
                  onClick={() => setActiveSidebarItem('about')}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    activeSidebarItem === 'about'
                      ? 'bg-[#da251d] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-red-50/70 hover:text-[#da251d]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Giới thiệu &amp; Cập nhật</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      activeSidebarItem === 'about' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    v{platformBridge.getVersion()}
                  </span>
                </button>

                {/* 8. Mở AVORA POS Desktop (Khi đang duyệt Web) */}
                {!platformBridge.isDesktop && onOpenDesktopLaunch && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDesktopLaunch();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#da251d] bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-between transition-colors cursor-pointer mt-1"
                  >
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 shrink-0 text-[#da251d]" />
                      <span>Mở AVORA POS</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-200 text-[#da251d] font-black uppercase">
                      SSO
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nút Thao Tác Ứng Dụng & Đăng Xuất Ca */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-2">
            {/* Nút Đóng ứng dụng (Chỉ hiển thị trên Desktop) */}
            {platformBridge.isDesktop && (
              <button
                type="button"
                onClick={handleExitDesktopApp}
                className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
                title="Đóng hoàn toàn ứng dụng AVORA POS (Alt + F4)"
              >
                <Power className="w-4 h-4" />
                <span>Đóng ứng dụng AVORA POS</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout?.();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-[#da251d] font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4 text-[#da251d]" />
              <span>Đăng xuất ca làm việc</span>
            </button>
          </div>
        </aside>
        )}

        {/* Right Main Content */}
        <main className="flex-1 bg-slate-50/70 flex flex-col overflow-hidden">
          {/* =================================================================== */}
          {/* SECTION 1: MÁY IN & PHIẾU CHẾ BIẾN (RENDER TRỰC TIẾP TRONG POS SHELL) */}
          {/* =================================================================== */}
          {activeSidebarItem === 'settings' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 3 Sub-tabs chính: In hóa đơn/tạm tính | In bar/bếp | In tem mặt hàng */}
              <div className="h-12 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center shrink-0 shadow-2xs">
                <div className="flex items-center gap-6 sm:gap-8 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPrintSubTab('bill')}
                    className={`h-12 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                      printSubTab === 'bill'
                        ? 'border-[#da251d] text-[#da251d]'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>In hóa đơn / tạm tính</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintSubTab('kitchen')}
                    className={`h-12 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                      printSubTab === 'kitchen'
                        ? 'border-[#da251d] text-[#da251d]'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>In bar / bếp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrintSubTab('barcode')}
                    className={`h-12 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                      printSubTab === 'barcode'
                        ? 'border-[#da251d] text-[#da251d]'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Tag className="w-4 h-4" />
                    <span>In tem mặt hàng</span>
                  </button>
                </div>
              </div>

              {/* Form Nội Dung Cài Đặt */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Print Agent Local Status Banner */}
                <div
                  className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                    agentStatus === 'ONLINE'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : agentStatus === 'CHECKING'
                      ? 'bg-sky-50/70 border-sky-200 text-sky-900'
                      : 'bg-red-50/70 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        agentStatus === 'ONLINE'
                          ? 'bg-emerald-500 animate-pulse'
                          : agentStatus === 'CHECKING'
                          ? 'bg-sky-500 animate-spin'
                          : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <div className="font-bold flex items-center gap-1.5 flex-wrap">
                        <span>
                          {platformBridge.isDesktop
                            ? 'AVORA POS Native Print Core:'
                            : 'Print Agent Local:'}
                        </span>
                        <span
                          className={
                            agentStatus === 'ONLINE'
                              ? 'text-emerald-700 font-extrabold'
                              : 'text-red-700 font-extrabold'
                          }
                        >
                          {agentStatus === 'ONLINE'
                            ? platformBridge.isDesktop
                              ? 'Đang hoạt động (.NET 8 WinSpool RAW)'
                              : 'Đang hoạt động (https://localhost:9101)'
                            : agentStatus === 'CHECKING'
                            ? 'Đang kiểm tra kết nối...'
                            : platformBridge.isDesktop
                            ? 'Ngoại tuyến (http://127.0.0.1:9123)'
                            : 'Ngoại tuyến / Chưa kết nối (https://localhost:9101)'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {agentStatus === 'ONLINE'
                          ? `Đã nhận diện ${windowsPrinters.length} máy in Windows thật trên máy tính thu ngân này.`
                          : platformBridge.isDesktop
                          ? 'Đang kết nối lại lõi in native WinSpool của ứng dụng AVORA POS...'
                          : 'Hãy đảm bảo ứng dụng print-agent đang chạy tại máy thu ngân này (https://localhost:9101).'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={checkAgentAndLoadPrinters}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${agentStatus === 'CHECKING' ? 'animate-spin' : ''}`}
                      />
                      <span>Kiểm tra lại</span>
                    </button>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* SUBTAB 1: IN HÓA ĐƠN / TẠM TÍNH */}
                {/* ------------------------------------------------------------- */}
                {printSubTab === 'bill' && (
                  <div className="max-w-3xl space-y-5">
                    {/* Card 1: MÁY IN HÓA ĐƠN */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                        <div className="w-8 h-8 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center font-bold">
                          <Receipt className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            MÁY IN HÓA ĐƠN
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            In hóa đơn thanh toán và phiếu tạm tính tại quầy thu ngân qua máy in Windows
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-1">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Tên máy in hóa đơn
                          </label>
                          {renderPrinterDropdown(receiptPrinterName, setReceiptPrinterName)}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Khổ giấy
                          </label>
                          <select
                            value={defaultPaperSize}
                            onChange={(e) => setDefaultPaperSize(e.target.value as any)}
                            className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-colors cursor-pointer"
                          >
                            <option value="80mm">80mm (Khổ nhiệt tiêu chuẩn)</option>
                            <option value="XP-350B">Xprinter XP-350B (76mm - Chống rớt giấy / Tiết kiệm)</option>
                            <option value="58mm">58mm (Khổ nhỏ K58)</option>
                          </select>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              handleTestPrint(receiptPrinterName, 'RECEIPT', defaultPaperSize)
                            }
                            disabled={!!testingPrinterId || !receiptPrinterName}
                            className="w-full h-10 px-3 rounded-xl border border-red-300 text-[#da251d] hover:bg-red-50 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>
                              {testingPrinterId === receiptPrinterName ? 'Đang in...' : 'In thử'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: LIÊN IN */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          LIÊN IN
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Cấu hình số bản in hóa đơn và tùy chọn tự động in
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Số liên in hóa đơn
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={billCopies}
                            onChange={(e) =>
                              setBillCopies(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Số liên in tạm tính
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={tempBillCopies}
                            onChange={(e) =>
                              setTempBillCopies(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-colors"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs font-medium text-slate-700">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={autoPrintReceipt}
                            onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                            className="w-4.5 h-4.5 text-[#da251d] rounded-md border-slate-300 focus:ring-[#da251d]"
                          />
                          <span>Tự động in hóa đơn khi thanh toán thành công</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={autoPrintTempBill}
                            onChange={(e) => setAutoPrintTempBill(e.target.checked)}
                            className="w-4.5 h-4.5 text-[#da251d] rounded-md border-slate-300 focus:ring-[#da251d]"
                          />
                          <span>Tự động in tạm tính nếu cần</span>
                        </label>
                      </div>
                    </div>

                    {/* Card 3: CẤU HÌNH GÓI BUFFET (IN ẤN & HÓA ĐƠN) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <UtensilsCrossed className="w-4 h-4 text-[#da251d]" />
                            <span>CẤU HÌNH GÓI BUFFET</span>
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Quy tắc hiển thị món ăn thuộc gói Buffet trên Phiếu tạm tính và Hóa đơn thanh toán
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        {/* Switch 1: KHÔNG IN MÓN BUFFET KHI IN TẠM TÍNH */}
                        <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Không in món Buffet khi in Tạm tính
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              Bật: Hệ thống sẽ tự động ẩn các món 0đ thuộc gói Buffet trên Phiếu tạm tính.
                            </p>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={excludeBuffetItemsFromTempBill}
                              onChange={(e) => setExcludeBuffetItemsFromTempBill(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#da251d]" />
                          </label>
                        </div>

                        {/* Switch 2: XÓA MÓN BUFFET KHI THANH TOÁN */}
                        <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Xóa món Buffet khi Thanh toán
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              Bật: Các món 0đ thuộc gói Buffet sẽ bị tự động xóa bỏ khỏi đơn hàng để làm gọn Hóa đơn cuối cùng.
                            </p>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                            <input
                              type="checkbox"
                              checked={removeBuffetItemsOnCheckout}
                              onChange={(e) => setRemoveBuffetItemsOnCheckout(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#da251d]" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* SUBTAB 2: IN BAR / BẾP */}
                {/* ------------------------------------------------------------- */}
                {printSubTab === 'kitchen' && (
                  <div className="max-w-3xl space-y-5">
                    {/* Card 1: MÁY IN BẾP (NÓNG) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                            <ChefHat className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              MÁY IN BẾP (NÓNG)
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              In phiếu cho bếp: món xào, nướng, lẩu, chiên
                            </p>
                          </div>
                        </div>

                        {/* Bật/Tắt Toggle */}
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span
                            className={kitchenEnabled ? 'text-[#da251d] font-bold' : 'text-slate-400'}
                          >
                            {kitchenEnabled ? 'Đang bật' : 'Đã tắt'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setKitchenEnabled(!kitchenEnabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                              kitchenEnabled ? 'bg-[#da251d]' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                                kitchenEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1 transition-opacity ${
                          kitchenEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
                        }`}
                      >
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Tên máy in Bếp (Nóng)
                          </label>
                          {renderPrinterDropdown(
                            kitchenPrinterName,
                            setKitchenPrinterName,
                            !kitchenEnabled,
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Khổ giấy
                          </label>
                          <select
                            value={kitchenPaperSize}
                            onChange={(e) => setKitchenPaperSize(e.target.value as any)}
                            disabled={!kitchenEnabled}
                            className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-colors cursor-pointer"
                          >
                            <option value="80mm">80mm (Khổ nhiệt tiêu chuẩn)</option>
                            <option value="XP-350B">Xprinter XP-350B (76mm)</option>
                            <option value="58mm">58mm (Khổ nhỏ K58)</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                              Số liên
                            </label>
                            <div className="flex items-center h-10 border border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                              <button
                                type="button"
                                disabled={!kitchenEnabled || kitchenCopies <= 1}
                                onClick={() => setKitchenCopies(Math.max(1, kitchenCopies - 1))}
                                className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="flex-1 text-center font-bold text-xs text-slate-800">
                                {kitchenCopies}
                              </span>
                              <button
                                type="button"
                                disabled={!kitchenEnabled || kitchenCopies >= 5}
                                onClick={() => setKitchenCopies(Math.min(5, kitchenCopies + 1))}
                                className="w-8 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-30 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleTestPrint(kitchenPrinterName, 'KITCHEN', kitchenPaperSize)
                            }
                            disabled={!kitchenEnabled || !!testingPrinterId || !kitchenPrinterName}
                            className="h-10 px-3.5 rounded-xl border border-red-300 text-[#da251d] hover:bg-red-50 font-bold text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {testingPrinterId === kitchenPrinterName ? 'Đang in...' : 'In thử'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: MÁY IN QUẦY BAR (NƯỚC) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                            <Utensils className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              MÁY IN QUẦY BAR (NƯỚC)
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              In phiếu cho quầy bar: đồ uống, cocktail, sinh tố, chè
                            </p>
                          </div>
                        </div>

                        {/* Bật/Tắt Toggle */}
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span
                            className={barEnabled ? 'text-[#da251d] font-bold' : 'text-slate-400'}
                          >
                            {barEnabled ? 'Đang bật' : 'Đã tắt'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBarEnabled(!barEnabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                              barEnabled ? 'bg-[#da251d]' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                                barEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1 transition-opacity ${
                          barEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
                        }`}
                      >
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Tên máy in Quầy Bar
                          </label>
                          {renderPrinterDropdown(
                            barPrinterName,
                            setBarPrinterName,
                            !barEnabled,
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Khổ giấy
                          </label>
                          <select
                            value={barPaperSize}
                            onChange={(e) => setBarPaperSize(e.target.value as any)}
                            disabled={!barEnabled}
                            className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-colors cursor-pointer"
                          >
                            <option value="80mm">80mm (Khổ nhiệt tiêu chuẩn)</option>
                            <option value="XP-350B">Xprinter XP-350B (76mm)</option>
                            <option value="58mm">58mm (Khổ nhỏ K58)</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                              Số liên
                            </label>
                            <div className="flex items-center h-10 border border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                              <button
                                type="button"
                                disabled={!barEnabled || barCopies <= 1}
                                onClick={() => setBarCopies(Math.max(1, barCopies - 1))}
                                className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="flex-1 text-center font-bold text-xs text-slate-800">
                                {barCopies}
                              </span>
                              <button
                                type="button"
                                disabled={!barEnabled || barCopies >= 5}
                                onClick={() => setBarCopies(Math.min(5, barCopies + 1))}
                                className="w-8 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-30 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleTestPrint(barPrinterName, 'BAR', barPaperSize)
                            }
                            disabled={!barEnabled || !!testingPrinterId || !barPrinterName}
                            className="h-10 px-3.5 rounded-xl border border-red-300 text-[#da251d] hover:bg-red-50 font-bold text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {testingPrinterId === barPrinterName ? 'Đang in...' : 'In thử'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* SUBTAB 3: IN TEM MẶT HÀNG */}
                {/* ------------------------------------------------------------- */}
                {printSubTab === 'barcode' && (
                  <div className="max-w-3xl space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                            <Tag className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                              MÁY IN TEM NHÃN
                            </h3>
                            <p className="text-[11px] text-slate-500">
                              In tem nhãn dán ly trà sữa, hộp mang về, tem barcode
                            </p>
                          </div>
                        </div>

                        {/* Bật/Tắt Toggle */}
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span
                            className={barcodeEnabled ? 'text-[#da251d] font-bold' : 'text-slate-400'}
                          >
                            {barcodeEnabled ? 'Đang bật' : 'Đã tắt'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBarcodeEnabled(!barcodeEnabled)}
                            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                              barcodeEnabled ? 'bg-[#da251d]' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`block w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                                barcodeEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Controls */}
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1 transition-opacity ${
                          barcodeEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
                        }`}
                      >
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Tên máy in Tem Nhãn
                          </label>
                          {renderPrinterDropdown(
                            barcodePrinterName,
                            setBarcodePrinterName,
                            !barcodeEnabled,
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Khổ tem
                          </label>
                          <select
                            value={barcodePaperSize}
                            onChange={(e) => setBarcodePaperSize(e.target.value)}
                            disabled={!barcodeEnabled}
                            className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:border-[#da251d] focus:bg-white transition-colors cursor-pointer"
                          >
                            <option value="30x50mm">30x50mm</option>
                            <option value="50x70mm">50x70mm</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                              Số liên
                            </label>
                            <div className="flex items-center h-10 border border-slate-300 rounded-xl bg-slate-50 overflow-hidden">
                              <button
                                type="button"
                                disabled={!barcodeEnabled || barcodeCopies <= 1}
                                onClick={() => setBarcodeCopies(Math.max(1, barcodeCopies - 1))}
                                className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="flex-1 text-center font-bold text-xs text-slate-800">
                                {barcodeCopies}
                              </span>
                              <button
                                type="button"
                                disabled={!barcodeEnabled || barcodeCopies >= 10}
                                onClick={() => setBarcodeCopies(Math.min(10, barcodeCopies + 1))}
                                className="w-8 h-full flex items-center justify-center text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-30 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleTestPrint(barcodePrinterName, 'ITEM_LABEL', barcodePaperSize)
                            }
                            disabled={!barcodeEnabled || !!testingPrinterId || !barcodePrinterName}
                            className="h-10 px-3.5 rounded-xl border border-red-300 text-[#da251d] hover:bg-red-50 font-bold text-xs shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {testingPrinterId === barcodePrinterName ? 'Đang in...' : 'In thử'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* SECTION 2: MỞ KÉT TIỀN THU NGÂN */}
          {/* =================================================================== */}
          {activeSidebarItem === 'drawer' && (
            <div className="p-4 sm:p-6 max-w-xl space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-base font-bold text-amber-700">
                  <Unlock className="w-5 h-5 text-amber-600" />
                  <span>Mở Két Tiền Thu Ngân (Cash Drawer)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Gửi lệnh xung điện qua máy in hóa đơn quầy để bật mở ngăn kéo tiền mặt. Mọi thao tác
                  đều được lưu lại vào nhật ký kiểm toán ca của thu ngân.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lý do mở két:
                  </label>
                  <input
                    type="text"
                    value={drawerReason}
                    onChange={(e) => setDrawerReason(e.target.value)}
                    placeholder="VD: Thu ngân đổi tiền lẻ, kiểm két..."
                    className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white transition-colors"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenCashDrawer}
                  disabled={isKickingDrawer}
                  className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Unlock className={`w-4 h-4 ${isKickingDrawer ? 'animate-spin' : ''}`} />
                  <span>{isKickingDrawer ? 'Đang gửi lệnh mở...' : 'BẬT MỞ KÉT TIỀN NGAY'}</span>
                </button>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* SECTION 3: ĐỒNG BỘ DỮ LIỆU POS */}
          {/* =================================================================== */}
          {activeSidebarItem === 'sync' && (
            <div className="p-4 sm:p-6 max-w-xl space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                  <RefreshCw className="w-5 h-5 text-[#da251d]" />
                  <span>Đồng Bộ Dữ Liệu Thời Gian Thực</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Làm mới danh mục món, bảng giá, sơ đồ bàn và khuyến mãi từ máy chủ trung tâm về trình
                  duyệt POS.
                </p>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Đồng bộ lần gần nhất:</span>
                  <span className="font-bold text-slate-800">
                    {lastSyncedAt ? lastSyncedAt.toLocaleTimeString('vi-VN') : 'Vừa xong'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="w-full h-11 rounded-xl bg-[#da251d] hover:bg-[#b81d16] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'ĐỒNG BỘ DỮ LIỆU NGAY'}</span>
                </button>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* SECTION 4: HÓA ĐƠN TRONG CA */}
          {/* =================================================================== */}
          {activeSidebarItem === 'invoices' && (
            <div className="flex-1 flex flex-col overflow-hidden h-full">
              <PosShiftReceiptsView
                branch={currentBranch}
                currentUser={currentUser}
                allOrders={allOrders && allOrders.length > 0 ? allOrders : completedOrders}
                onReprintReceipt={onReprintReceipt}
                onRefresh={onSyncData}
                onBackToSettings={() => setActiveSidebarItem('settings')}
              />
            </div>
          )}

          {/* =================================================================== */}
          {/* SECTION 5: CHI NHÁNH & GIỜ MỞ CỬA */}
          {/* =================================================================== */}
          {activeSidebarItem === 'branch' && (
            <div className="p-4 sm:p-6 max-w-2xl space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#da251d]" />
                  Chi Nhánh Đang Bán Hàng
                </h3>

                <div className="p-4 rounded-xl bg-red-50/40 border border-red-100 space-y-2">
                  <div className="text-base font-black text-slate-900">{currentBranch?.name}</div>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {[
                        currentBranch?.street,
                        currentBranch?.ward,
                        currentBranch?.district,
                        currentBranch?.province,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'Chưa cập nhật địa chỉ'}
                    </span>
                  </div>
                  {currentBranch?.phone && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Hotline: {currentBranch.phone}</span>
                    </div>
                  )}
                  {currentBranch?.openTime && (
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Giờ phục vụ: {currentBranch.openTime} - {currentBranch.closeTime}
                      </span>
                    </div>
                  )}
                </div>

                {/* ADMIN được đổi branch, MANAGER/Cashier bị khóa */}
                {canSwitchBranch && branches.length > 1 ? (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase">
                      Chuyển sang chi nhánh khác
                    </h4>
                    <div className="space-y-2">
                      {branches.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            onSelectBranch(b);
                            toast.success(`Đã chuyển sang ${b.name}`);
                          }}
                          className={`w-full p-3 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer ${
                            b.id === currentBranch?.id
                              ? 'border-[#da251d] bg-red-50/50 font-bold text-slate-900'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{b.name}</span>
                          <span className="text-[10px] text-slate-400">{b.branchCode}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Tài khoản được khóa cố định theo chi nhánh được phân công.</span>
                  </div>
                )}
              </div>

              {/* Cấu hình QR Gọi Món tại bàn */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-[#da251d]" />
                  Cấu hình QR Gọi Món Tại Bàn
                </h3>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      Tự động gửi món gọi QR trực tiếp vào bếp
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {branchQrAutoSend
                        ? 'Đang BẬT: Khách quét QR gọi món, hệ thống tự động xác nhận và in phiếu bếp ngay mà không cần nhân viên bấm duyệt.'
                        : 'Đang TẮT: Món gọi từ QR sẽ gửi vào tab "QR Order" để nhân viên kiểm tra và bấm "Duyệt & Gửi bếp" trước.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleQrAutoSend}
                    disabled={isUpdatingQrSetting}
                    className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 disabled:opacity-50 ${
                      branchQrAutoSend ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transition-transform ${
                        branchQrAutoSend ? 'translate-x-5.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* ========================================================================= */}
          {/* MỤC BẢO MẬT & ĐĂNG NHẬP (POS PIN) */}
          {/* ========================================================================= */}
          {activeSidebarItem === 'security' && (
            <div className="p-6 max-w-2xl space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#da251d]" />
                  Bảo mật &amp; Đăng nhập POS
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Quản lý mã PIN cá nhân để đăng nhập nhanh tức thì tại máy trạm AVORA POS Desktop
                </p>
              </div>

              {/* Card trạng thái PIN */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-slate-900">Mã PIN đăng nhập POS</div>
                    <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                      Cho phép bạn đăng nhập nhanh vào AVORA POS chỉ bằng mã PIN 4 số. Backend sẽ tự nhận diện danh tính và phân quyền ca làm việc.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border">
                    {hasPosPin ? (
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Đã thiết lập
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        Chưa thiết lập
                      </span>
                    )}
                  </div>
                </div>

                {hasPosPin && posPinUpdatedAt && (
                  <div className="text-[11px] text-slate-400">
                    Cập nhật lần cuối: {new Date(posPinUpdatedAt).toLocaleString('vi-VN')}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  {!hasPosPin ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPinModalMode('setup');
                        setPinAuthMethod('PASSWORD');
                        setPinPassword('');
                        setPinOtp('');
                        setOtpSentNotice(null);
                        setPinCode('');
                        setPinConfirm('');
                        setPinError(null);
                        setIsPinModalOpen(true);
                      }}
                      className="px-4 py-2.5 bg-[#da251d] text-white rounded-xl text-xs font-bold hover:bg-[#b91c1c] transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      THIẾT LẬP MÃ PIN
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPinModalMode('change');
                          setPinAuthMethod('PASSWORD');
                          setPinPassword('');
                          setPinOtp('');
                          setOtpSentNotice(null);
                          setPinCode('');
                          setPinConfirm('');
                          setPinError(null);
                          setIsPinModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        ĐỔI MÃ PIN
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPinModalMode('remove');
                          setPinAuthMethod('PASSWORD');
                          setPinPassword('');
                          setPinOtp('');
                          setOtpSentNotice(null);
                          setPinError(null);
                          setIsPinModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        XÓA MÃ PIN
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MỤC 8: GIỚI THIỆU & CẬP NHẬT ỨNG DỤNG (Directives 18, 19, 72, 95) */}
          {/* ========================================================================= */}
          {activeSidebarItem === 'about' && (
            <div className="p-6 max-w-2xl space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Info className="w-5 h-5 text-[#da251d]" />
                  Thông tin ứng dụng AVORA POS
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Hệ thống bán hàng, in ấn và điều phối nhà hàng thông minh
                </p>
              </div>

              {/* App Identity Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl text-white shadow-md flex items-center gap-4">
                <img
                  src="/avora_logo_desktop.png"
                  alt="AVORA Logo"
                  className="w-16 h-16 rounded-xl object-contain bg-white/10 p-1.5 shadow-inner"
                />
                <div className="flex-1 space-y-1">
                  <div className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                    AVORA POS
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                      Chính thức
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-3">
                    <span>Phiên bản: <b>v{platformBridge.getVersion()} (Build {platformBridge.getBuild ? platformBridge.getBuild() : 101})</b></span>
                    <span>Kênh: <b>STABLE</b></span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Lõi native C# .NET 8 • WinSpool RAW ESC/POS &amp; TSPL • SQLite Offline
                  </div>
                </div>
              </div>

              {/* Action Buttons: Check update & Pin taskbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await platformBridge.checkUpdate?.();
                    if (res?.updateAvailable) {
                      toast.success(`Đã phát hiện bản cập nhật mới v${res.manifest?.version}!`);
                    } else {
                      toast.success(`Bạn đang sử dụng phiên bản mới nhất (v${platformBridge.getVersion()}).`);
                    }
                  }}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-3 text-left shadow-2xs cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Kiểm tra cập nhật</div>
                    <div className="text-[11px] text-slate-500">Tự động tìm kiếm bản vá lỗi mới nhất</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const res = await platformBridge.guidePinToTaskbar?.();
                    toast(res?.message || 'Nhấp chuột phải vào icon AVORA POS -> Ghim vào thanh tác vụ (Pin to Taskbar)', {
                      icon: '📌',
                      duration: 6000,
                    });
                  }}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center gap-3 text-left shadow-2xs cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-[#da251d] flex items-center justify-center shrink-0">
                    <Pin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Ghim vào thanh tác vụ</div>
                    <div className="text-[11px] text-slate-500">Mở nhanh POS từ Windows Taskbar</div>
                  </div>
                </button>

                {/* Nút Đóng Ứng Dụng Trong Tab Giới Thiệu (Chỉ Desktop) */}
                {platformBridge.isDesktop && (
                  <button
                    type="button"
                    onClick={handleExitDesktopApp}
                    className="p-3.5 bg-red-50/80 border border-red-200 rounded-xl hover:bg-red-100 hover:border-red-300 transition-all flex items-center gap-3 text-left shadow-2xs cursor-pointer col-span-1 sm:col-span-2"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Power className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-red-700 flex items-center gap-2">
                        <span>Đóng ứng dụng AVORA POS</span>
                        <kbd className="px-1.5 py-0.5 bg-red-200/90 text-red-800 rounded font-mono text-[10px] font-bold">
                          Alt + F4
                        </kbd>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Thoát ứng dụng an toàn với hộp thoại kiểm tra dữ liệu và lệnh in
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* POS Keyboard Shortcuts reference */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Phím tắt hữu ích trên AVORA POS</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                    <span>Toàn màn hình</span>
                    <kbd className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono font-bold text-[11px]">F11</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                    <span>Đóng modal</span>
                    <kbd className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono font-bold text-[11px]">ESC</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                    <span>Đóng ứng dụng</span>
                    <kbd className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-mono font-bold text-[11px]">Alt + F4</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 3. FOOTER BAR (Đầy đủ: User, Branch Switcher/Lock, Đồng hồ, Đóng, Lưu) */}
      {/* ========================================================================= */}
      <footer className="h-14 bg-white border-t border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none z-20 shadow-xs">
        {/* Left: User hiện tại & Branch hiện tại */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 text-[#da251d] font-bold flex items-center justify-center text-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-900 leading-none">
                {currentUser?.fullName || currentUser?.email?.split('@')[0] || 'Thu ngân'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {currentUser?.role === 'ADMIN'
                  ? 'Quản trị viên'
                  : currentUser?.role === 'MANAGER'
                  ? 'Quản lý'
                  : 'Nhân viên POS'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 border-l border-slate-200 pl-3">
            <Store className="w-3.5 h-3.5 text-[#da251d] shrink-0" />
            {canSwitchBranch && branches.length > 1 ? (
              <select
                value={currentBranch?.id || ''}
                onChange={(e) => {
                  const b = branches.find((br) => br.id === e.target.value);
                  if (b) {
                    onSelectBranch(b);
                    toast.success(`Đã chuyển sang ${b.name}`);
                  }
                }}
                className="h-8 px-2 text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg outline-none focus:border-[#da251d] cursor-pointer"
              >
                {branches.map((b, idx) => (
                  <option key={`branch-${b.id}-${idx}`} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-800">
                  {currentBranch?.name || 'Đang tải chi nhánh...'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                  Phân công
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Đồng hồ, Nút Đóng & Nút Lưu Cài Đặt */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{currentTimeStr}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="h-10 px-6 rounded-xl bg-[#da251d] hover:bg-[#b81d16] active:scale-95 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-red-500/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Cài Đặt'}</span>
          </button>
        </div>
      </footer>

      {/* Modal Quản Lý Mã PIN POS */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#da251d]" />
                {pinModalMode === 'setup'
                  ? 'Thiết lập mã PIN POS mới'
                  : pinModalMode === 'change'
                  ? 'Đổi mã PIN POS'
                  : 'Xóa mã PIN POS'}
              </h4>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pinError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {pinError}
              </div>
            )}

            <form onSubmit={handleSavePin} className="space-y-4">
              {/* Chọn phương thức xác minh: Mật khẩu hoặc OTP Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Xác minh danh tính tài khoản <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPinAuthMethod('PASSWORD');
                      setPinError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      pinAuthMethod === 'PASSWORD'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Mật khẩu tài khoản</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPinAuthMethod('OTP');
                      setPinError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      pinAuthMethod === 'OTP'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Mã OTP qua Email</span>
                  </button>
                </div>
              </div>

              {/* PHƯƠNG THỨC 1: XÁC MINH BẰNG MẬT KHẨU */}
              {pinAuthMethod === 'PASSWORD' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu tài khoản hiện tại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={pinPassword}
                    onChange={(e) => setPinPassword(e.target.value)}
                    placeholder="Nhập mật khẩu tài khoản để xác nhận"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-[#da251d] outline-hidden transition-all"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nhập mật khẩu đăng nhập của bạn để bảo mật tài khoản.
                  </p>
                </div>
              )}

              {/* PHƯƠNG THỨC 2: XÁC MINH BẰNG MÃ OTP 6 SỐ QUA EMAIL */}
              {pinAuthMethod === 'OTP' && (
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#da251d]" />
                        Email nhận mã OTP
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                        {maskedUserEmail || currentUser?.email || 'Email đã đăng ký tài khoản'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={isSendingOtp || otpCooldown > 0}
                      className="px-3 py-1.5 bg-[#da251d] hover:bg-[#b91c1c] text-white text-[11px] font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {isSendingOtp ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      <span>
                        {otpCooldown > 0
                          ? `Gửi lại (${otpCooldown}s)`
                          : isSendingOtp
                          ? 'Đang gửi...'
                          : 'Gửi mã OTP'}
                      </span>
                    </button>
                  </div>

                  {otpSentNotice && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>{otpSentNotice}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nhập mã OTP 6 số <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={pinOtp}
                      onChange={(e) => setPinOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="• • • • • •"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-center text-xl tracking-[0.4em] font-mono font-bold text-slate-900 focus:border-[#da251d] outline-hidden shadow-xs"
                      autoFocus
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Mã có hiệu lực trong 5 phút. Vui lòng kiểm tra cả thư mục Spam/Rác.
                    </p>
                  </div>
                </div>
              )}

              {/* Ô NHẬP MÃ PIN 4 SỐ (CHO SETUP VÀ CHANGE) */}
              {pinModalMode !== 'remove' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mã PIN mới (đúng 4 số) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="● ● ● ●"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl tracking-[0.5em] font-mono font-bold text-slate-900 focus:bg-white focus:border-[#da251d] outline-hidden transition-all"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Chỉ 4 số (0-9). Không dùng mã PIN quá dễ đoán (0000, 1234, 1111...).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Xác nhận lại mã PIN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pinConfirm}
                      onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="● ● ● ●"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl tracking-[0.5em] font-mono font-bold text-slate-900 focus:bg-white focus:border-[#da251d] outline-hidden transition-all"
                    />
                  </div>
                </>
              )}

              {/* CẢNH BÁO KHI XÓA PIN */}
              {pinModalMode === 'remove' && (
                <div className="text-xs text-amber-800 bg-amber-50 p-3.5 rounded-xl border border-amber-200 leading-relaxed">
                  <b>Lưu ý quan trọng:</b> Sau khi xóa mã PIN, bạn sẽ không thể đăng nhập nhanh tại máy POS Desktop bằng mã PIN nữa mà phải nhập mật khẩu tài khoản.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPin}
                  className="px-5 py-2 bg-[#da251d] text-white text-xs font-bold rounded-xl hover:bg-[#b91c1c] disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  {isSubmittingPin
                    ? 'Đang xử lý...'
                    : pinModalMode === 'remove'
                    ? 'Xác nhận xóa PIN'
                    : 'Lưu mã PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận đóng ứng dụng AVORA POS */}
      <PosExitConfirmModal
        isOpen={isExitConfirmOpen}
        onClose={() => setIsExitConfirmOpen(false)}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
};
